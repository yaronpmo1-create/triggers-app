package com.yaronpmo1.triggers;

import android.content.Context;
import android.content.SharedPreferences;

import java.io.BufferedInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/**
 * עדכון תוכן (קבצי האתר של האפליקציה) בלי APK חדש.
 * חבילה מורדת ל-files/ota/v{גרסה}, נבדקת (סכום SHA-256), ומוחלת דרך serverBasePath של Capacitor.
 * אם החבילה לא עלתה ולא אושרה ע"י ה-JS (otaOk) פעמיים - חוזרים אוטומטית לחבילה הקודמת (או ל-APK).
 */
final class Ota {
    interface Prog { void on(long done, long total); }

    /** גרסת הגשר הנייטיב. לשמור זהה ל-NATIVE_API ב-scripts/ota-config.mjs (נבדק בבדיקות). */
    static final int NATIVE_API = 1;
    private static final String CAP_PREFS = "CapWebViewSettings"; // = com.getcapacitor.plugin.WebView.WEBVIEW_PREFS_NAME
    private static final String CAP_PATH = "serverBasePath";

    private Ota() {}

    private static SharedPreferences cap(Context c) { return c.getSharedPreferences(CAP_PREFS, Context.MODE_PRIVATE); }
    private static SharedPreferences op(Context c) { return c.getSharedPreferences("ota", Context.MODE_PRIVATE); }
    private static File root(Context c) { return new File(c.getFilesDir(), "ota"); }

    /** נקרא ב-MainActivity.onCreate לפני שה-Bridge נטען. */
    static void guard(Context c) {
        try {
            String path = cap(c).getString(CAP_PATH, "");
            if (path == null || path.isEmpty()) return;
            SharedPreferences o = op(c);
            if (o.getBoolean("ok", true)) return;
            int tries = o.getInt("tries", 0);
            if (tries >= 2 || !new File(path, "index.html").exists()) { rollback(c); return; }
            o.edit().putInt("tries", tries + 1).apply();
        } catch (Exception e) { /* לא מפילים את הפתיחה */ }
    }

    static void rollback(Context c) {
        SharedPreferences o = op(c);
        String bad = cap(c).getString(CAP_PATH, "");
        String prev = o.getString("prev", "");
        String badVer = o.getString("ver", "");
        if (prev == null || prev.isEmpty() || !new File(prev, "index.html").exists()) prev = "";
        cap(c).edit().putString(CAP_PATH, prev).apply();
        o.edit().putBoolean("ok", true).putInt("tries", 0).putString("ver", "").putString("prev", "")
                .putString("bad", (o.getString("bad", "") + "," + badVer)).putString("lastRollback", badVer).apply();
        if (bad != null && !bad.isEmpty()) rmrf(new File(bad));
    }

    /** ה-JS הצליח לעלות: מאשרים את החבילה ומנקים חבילות ישנות. */
    static void ok(Context c) {
        SharedPreferences o = op(c);
        o.edit().putBoolean("ok", true).putInt("tries", 0).apply();
        String cur = cap(c).getString(CAP_PATH, "");
        String prev = o.getString("prev", "");
        File[] all = root(c).listFiles();
        if (all == null) return;
        for (File f : all) {
            String p = f.getAbsolutePath();
            if (!p.equals(cur) && !p.equals(prev)) rmrf(f);
        }
    }

    /** מצב לצורך ה-JS: גרסת הגשר, גרסת החבילה שמוחלת (או ממתינה), רשימת גרסאות פגומות, ורולבק אחרון. */
    static String info(Context c) throws Exception {
        SharedPreferences o = op(c);
        String path = cap(c).getString(CAP_PATH, "");
        org.json.JSONObject r = new org.json.JSONObject();
        r.put("native", NATIVE_API);
        try { r.put("apk", (int) c.getPackageManager().getPackageInfo(c.getPackageName(), 0).getLongVersionCode()); } catch (Exception e) { r.put("apk", 0); }
        r.put("ver", (path != null && !path.isEmpty()) ? o.getString("ver", "") : "");
        r.put("ok", o.getBoolean("ok", true));
        r.put("bad", o.getString("bad", ""));
        r.put("lastRollback", o.getString("lastRollback", ""));
        return r.toString();
    }

    /** מביא טקסט (ota.json) עם זמן המתנה קצר. */
    static String fetchText(String url) throws Exception {
        HttpURLConnection h = open(url, 5000);
        try (InputStream in = h.getInputStream()) {
            ByteArrayOutputStream b = new ByteArrayOutputStream();
            byte[] buf = new byte[4096]; int n;
            while ((n = in.read(buf)) > 0) { b.write(buf, 0, n); if (b.size() > 65536) throw new Exception("big"); }
            return b.toString("UTF-8");
        } finally { h.disconnect(); }
    }

    private static HttpURLConnection open(String url, int readMs) throws Exception {
        String u = url;
        for (int hop = 0; hop < 5; hop++) {
            HttpURLConnection h = (HttpURLConnection) new URL(u).openConnection();
            h.setConnectTimeout(5000); h.setReadTimeout(readMs); h.setInstanceFollowRedirects(false);
            h.setRequestProperty("Cache-Control", "no-cache");
            int code = h.getResponseCode();
            if (code >= 300 && code < 400) { String loc = h.getHeaderField("Location"); h.disconnect(); if (loc == null) throw new Exception("redirect"); u = new URL(new URL(u), loc).toString(); if (!u.startsWith("https://")) throw new Exception("https"); continue; }
            if (code != 200) { h.disconnect(); throw new Exception("http " + code); }
            return h;
        }
        throw new Exception("redirects");
    }

    /** מוריד, מאמת, פורס, ומגדיר כחבילה פעילה לפתיחה הבאה. מחזיר את תיקיית החבילה. */
    static String download(Context c, String url, String sha256, String version, int minNative, Prog prog) throws Exception {
        if (minNative > NATIVE_API) throw new Exception("needapk");
        if (!version.matches("[0-9]{1,12}")) throw new Exception("version");
        File cache = new File(c.getCacheDir(), "ota.zip");
        MessageDigest md = MessageDigest.getInstance("SHA-256");
        HttpURLConnection h = open(url, 20000);
        try (InputStream in = new BufferedInputStream(h.getInputStream()); OutputStream out = new FileOutputStream(cache)) {
            byte[] buf = new byte[16384]; int n; long tot = 0; long all = h.getContentLengthLong();
            while ((n = in.read(buf)) > 0) { out.write(buf, 0, n); md.update(buf, 0, n); tot += n; if (tot > 40L * 1024 * 1024) throw new Exception("big"); if (prog != null) prog.on(tot, all); }
        } finally { h.disconnect(); }
        StringBuilder hex = new StringBuilder();
        for (byte b : md.digest()) hex.append(String.format("%02x", b));
        if (!hex.toString().equalsIgnoreCase(sha256)) { cache.delete(); throw new Exception("sum"); }

        File base = root(c); base.mkdirs();
        File tmp = new File(base, "tmp-" + version); rmrf(tmp); tmp.mkdirs();
        String tmpCanon = tmp.getCanonicalPath() + File.separator;
        try (ZipInputStream z = new ZipInputStream(new BufferedInputStream(new java.io.FileInputStream(cache)))) {
            ZipEntry e;
            while ((e = z.getNextEntry()) != null) {
                String name = e.getName().replace('\\', '/');
                File f = new File(tmp, name);
                if (!f.getCanonicalPath().startsWith(tmpCanon)) throw new Exception("zip");
                if (e.isDirectory()) { f.mkdirs(); continue; }
                f.getParentFile().mkdirs();
                try (OutputStream out = new FileOutputStream(f)) { byte[] buf = new byte[16384]; int n; while ((n = z.read(buf)) > 0) out.write(buf, 0, n); }
            }
        }
        cache.delete();
        if (!new File(tmp, "index.html").exists() || !new File(tmp, "app.js").exists()) { rmrf(tmp); throw new Exception("content"); }
        File dir = new File(base, "v" + version);
        rmrf(dir);
        if (!tmp.renameTo(dir)) throw new Exception("rename");

        SharedPreferences cp = cap(c), o = op(c);
        String cur = cp.getString(CAP_PATH, "");
        String prev = o.getString("prev", "");
        if (cur == null || cur.isEmpty()) prev = "";
        else if (!cur.equals(dir.getAbsolutePath()) && o.getBoolean("ok", true)) prev = cur;
        o.edit().putBoolean("ok", false).putInt("tries", 0).putString("ver", version).putString("prev", prev).apply();
        cp.edit().putString(CAP_PATH, dir.getAbsolutePath()).apply();
        return dir.getAbsolutePath();
    }

    static String currentPath(Context c) { return cap(c).getString(CAP_PATH, ""); }

    static void rmrf(File f) {
        if (f == null || !f.exists()) return;
        File[] k = f.listFiles();
        if (k != null) for (File x : k) rmrf(x);
        f.delete();
    }
}

package com.yaronpmo1.triggers;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/** In-app updates: content bundle (OTA) and APK download + install. Only the app's own public release address is allowed. */
@CapacitorPlugin(name = "Triggers")
public class TriggersPlugin extends Plugin {
    private static final String BASE = "https://github.com/yaronpmo1-create/triggers-app/releases/download/triggers-latest/";

    private Context ctx() { return getContext(); }

    private void progress(String event, long done, long total) {
        JSObject o = new JSObject();
        o.put("done", done);
        o.put("total", total);
        o.put("pct", total > 0 ? (int) Math.min(100, done * 100 / total) : -1);
        notifyListeners(event, o);
    }

    @PluginMethod
    public void otaInfo(PluginCall call) {
        try { call.resolve(new JSObject(Ota.info(ctx()))); } catch (Exception e) { call.reject(String.valueOf(e.getMessage())); }
    }

    @PluginMethod
    public void otaFetch(PluginCall call) {
        final String url = call.getString("url", "");
        if (!url.startsWith(BASE)) { call.reject("host"); return; }
        new Thread(() -> {
            try { JSObject r = new JSObject(); r.put("text", Ota.fetchText(url)); call.resolve(r); } catch (Exception e) { call.reject(String.valueOf(e.getMessage())); }
        }).start();
    }

    @PluginMethod
    public void otaDownload(PluginCall call) {
        final String url = call.getString("url", "");
        if (!url.startsWith(BASE)) { call.reject("host"); return; }
        final String sha = call.getString("sha256", "");
        final String ver = call.getString("version", "");
        final int min = call.getInt("minNative", 1);
        new Thread(() -> {
            try {
                String dir = Ota.download(ctx(), url, sha, ver, min, (d, t) -> progress("otaProgress", d, t));
                JSObject r = new JSObject(); r.put("dir", dir); call.resolve(r);
            } catch (Exception e) { call.reject(String.valueOf(e.getMessage())); }
        }).start();
    }

    @PluginMethod
    public void otaOk(PluginCall call) {
        Ota.ok(ctx());
        call.resolve();
    }

    @PluginMethod
    public void otaReload(PluginCall call) {
        final String path = Ota.currentPath(ctx());
        if (path == null || path.isEmpty()) { call.reject("none"); return; }
        call.resolve();
        getActivity().runOnUiThread(() -> getBridge().setServerBasePath(path));
    }

    /** Downloads the new APK and opens Android's install screen. Rejects with "perm" when installing from this app is not yet allowed. */
    @PluginMethod
    public void apkInstall(PluginCall call) {
        final String url = call.getString("url", "");
        if (!url.startsWith(BASE) || !url.endsWith(".apk")) { call.reject("host"); return; }
        final Context c = ctx();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !c.getPackageManager().canRequestPackageInstalls()) {
            try {
                Intent s = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + c.getPackageName()));
                s.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                c.startActivity(s);
            } catch (Exception e) { /* ignore */ }
            call.reject("perm");
            return;
        }
        new Thread(() -> {
            try {
                File dir = new File(c.getCacheDir(), "apk"); dir.mkdirs();
                File f = new File(dir, "triggers-update.apk"); f.delete();
                String u = url;
                HttpURLConnection h = null;
                for (int hop = 0; hop < 5; hop++) {
                    h = (HttpURLConnection) new URL(u).openConnection();
                    h.setConnectTimeout(8000); h.setReadTimeout(20000); h.setInstanceFollowRedirects(false);
                    int code = h.getResponseCode();
                    if (code >= 300 && code < 400) {
                        String loc = h.getHeaderField("Location"); h.disconnect();
                        if (loc == null) throw new Exception("redirect");
                        u = new URL(new URL(u), loc).toString();
                        if (!u.startsWith("https://")) throw new Exception("https");
                        continue;
                    }
                    if (code != 200) { h.disconnect(); throw new Exception("http " + code); }
                    break;
                }
                long all = h.getContentLengthLong(), tot = 0, lastEmit = 0;
                try (InputStream in = new BufferedInputStream(h.getInputStream()); OutputStream out = new FileOutputStream(f)) {
                    byte[] buf = new byte[16384]; int n;
                    while ((n = in.read(buf)) > 0) {
                        out.write(buf, 0, n); tot += n;
                        if (tot > 60L * 1024 * 1024) throw new Exception("big");
                        if (tot - lastEmit > 65536) { lastEmit = tot; progress("apkProgress", tot, all); }
                    }
                } finally { h.disconnect(); }
                progress("apkProgress", tot, tot);
                Uri uri = FileProvider.getUriForFile(c, c.getPackageName() + ".fileprovider", f);
                Intent i = new Intent(Intent.ACTION_VIEW);
                i.setDataAndType(uri, "application/vnd.android.package-archive");
                i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                c.startActivity(i);
                call.resolve();
            } catch (Exception e) { call.reject(String.valueOf(e.getMessage())); }
        }).start();
    }
}

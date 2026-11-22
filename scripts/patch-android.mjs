// Adapts the Android project created by "cap add android": launcher icons, dark theme, fixed signing key.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const app = path.join(root, 'android/app');
const main = path.join(app, 'src/main');

const copyDir = (from, to) => {
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, e.name), b = path.join(to, e.name);
    if (e.isDirectory()) copyDir(a, b); else fs.copyFileSync(a, b);
  }
};

// 1. Icons: drop the adaptive-icon folder so our own icon shows on every Android version
fs.rmSync(path.join(main, 'res/mipmap-anydpi-v26'), { recursive: true, force: true });
for (const d of fs.readdirSync(path.join(root, 'assets/icons'), { withFileTypes: true })) {
  if (d.isDirectory()) copyDir(path.join(root, 'assets/icons', d.name), path.join(main, 'res', d.name));
}

// Vibration for the button press
const mfp = path.join(main, 'AndroidManifest.xml');
let mf = fs.readFileSync(mfp, 'utf8');
if (!mf.includes('android.permission.VIBRATE')) mf = mf.replace('</manifest>', '    <uses-permission android:name="android.permission.VIBRATE" />
</manifest>');
fs.writeFileSync(mfp, mf);

// 2. Dark theme and splash
fs.writeFileSync(path.join(main, 'res/values/tr_colors.xml'), '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="trBg">#12161C</color>\n</resources>\n');
fs.writeFileSync(path.join(main, 'res/values/styles.xml'), `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="AppTheme" parent="Theme.AppCompat.DayNight.NoActionBar">
        <item name="colorPrimary">@color/colorPrimary</item>
        <item name="colorPrimaryDark">@color/colorPrimaryDark</item>
        <item name="colorAccent">@color/colorAccent</item>
        <item name="android:statusBarColor">@color/trBg</item>
        <item name="android:navigationBarColor">@color/trBg</item>
    </style>
    <style name="AppTheme.NoActionBar" parent="Theme.AppCompat.DayNight.NoActionBar">
        <item name="windowActionBar">false</item>
        <item name="windowNoTitle">true</item>
        <item name="android:background">@color/trBg</item>
        <item name="android:statusBarColor">@color/trBg</item>
        <item name="android:navigationBarColor">@color/trBg</item>
    </style>
    <style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">
        <item name="windowSplashScreenBackground">@color/trBg</item>
        <item name="windowSplashScreenAnimatedIcon">@color/trBg</item>
        <item name="postSplashScreenTheme">@style/AppTheme.NoActionBar</item>
    </style>
</resources>
`);

// 3. Signing: fixed key from environment (KEYSTORE_PATH, KEYSTORE_PASSWORD, KEY_ALIAS, KEY_PASSWORD)
let g = fs.readFileSync(path.join(app, 'build.gradle'), 'utf8');
if (!g.includes('signingConfigs')) {
  g = g.replace('android {\n', `android {
    signingConfigs {
        tr {
            storeFile file(System.getenv("KEYSTORE_PATH") ?: "../../keystore.jks")
            storePassword System.getenv("KEYSTORE_PASSWORD")
            keyAlias System.getenv("KEY_ALIAS")
            keyPassword System.getenv("KEY_PASSWORD")
        }
    }
`);
  g = g.replace('buildTypes {\n', 'buildTypes {\n        debug {\n            signingConfig signingConfigs.tr\n        }\n');
  g = g.replace('release {\n            minifyEnabled false', 'release {\n            signingConfig signingConfigs.tr\n            minifyEnabled false');
  g = g.replace('versionCode 1', 'versionCode Integer.parseInt(System.getenv("VERSION_CODE") ?: "1")');
  fs.writeFileSync(path.join(app, 'build.gradle'), g);
}
console.log('android patched');

/* Triggers: a personal self-observation log. Data stays on the device (IndexedDB). Plain JS, no build step. */
(function () {
'use strict';

var DEFAULT_TR = ['דוא"ל מהעבודה', 'רעש', 'עייפות', 'ויכוח', 'איחור', 'פרסומות'];
var COLS = ['#e66a5c', '#7c9cf0', '#f2b544', '#b78af0', '#35c4a0', '#e58fb8', '#5cc3e6', '#c6d36b'];
var DN = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];

/* ---------- icons (24x24, one stroke style) ---------- */
var TP = {
  'דוא"ל מהעבודה': '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  'רעש': '<path d="M4 10v4h3l5 4V6L7 10z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>',
  'עייפות': '<path d="M19 14.5A8 8 0 0 1 9.5 5a8 8 0 1 0 9.5 9.5z"/><path d="M14 3h4l-4 4h4"/>',
  'ויכוח': '<path d="M3 4h11v8H8l-3 3v-3H3z"/><path d="M9 16h5l3 3v-3h4v-7h-5"/><path d="M8.5 6.5v2.5M8.5 10.5v.01"/>',
  'איחור': '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/>',
  'פרסומות': '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1"/>',
  '+': '<path d="M12 5v14M5 12h14"/>',
  '_': '<path d="M12 3v5M12 16v5M3 12h5M16 12h5M6 6l3 3M15 15l3 3M18 6l-3 3M9 15l-3 3"/>',
  'home': '<path d="M3 11l9-8 9 8v10H3z"/>',
  'book': '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19V5M9 7h6"/>',
  'chart': '<path d="M5 20V10M12 20V4M19 20v-7"/>',
  'gear': '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
  'trash': '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  'check': '<path d="M5 12l5 5 9-10"/>',
  'down': '<path d="M12 4v12M6 11l6 6 6-6M5 21h14"/>',
  'up': '<path d="M12 20V8M6 13l6-6 6 6M5 3h14"/>'
};
function ic(k, cls) {
  return '<svg class="' + (cls || 'sv') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (TP[k] || TP._) + '</svg>';
}
function tic(name) { return ic(TP[name] ? name : '_', 'tic').replace('<svg ', '<svg style="color:' + colorOf(name) + '" '); }

/* ---------- small helpers ---------- */
function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function p2(n) { return ('0' + n).slice(-2); }
function fmt(n) { return String(Math.round(n * 10) / 10); }
function dkey(ts) { var d = new Date(ts); return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); }
function hm(ts) { var d = new Date(ts); return p2(d.getHours()) + ':' + p2(d.getMinutes()); }
function startOfDay(ts) { var d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); }
function dayLabel(ts) {
  var t = startOfDay(Date.now()), d = startOfDay(ts);
  if (d === t) return 'היום';
  if (d === t - 864e5) return 'אתמול';
  return new Date(ts).toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'numeric' });
}
var FIXED = { 'דוא"ל מהעבודה': '#5ea2ff', 'רעש': '#c58bff', 'עייפות': '#ffd166', 'ויכוח': '#ff8a65', 'איחור': '#4fd1c5', 'פרסומות': '#ff8fc8' };
function colorOf(name) {
  if (FIXED[name]) return FIXED[name];
  var h = 0, i;
  for (i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return COLS[h % COLS.length];
}
function hex2(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
function mix(a, b, t) {
  var x = hex2(a), y = hex2(b), r = [0, 1, 2].map(function (i) { return Math.round(x[i] + (y[i] - x[i]) * t); });
  return '#' + r.map(function (n) { return ('0' + n.toString(16)).slice(-2); }).join('');
}
/* intensity scale: green (weak) to dark red (strong) */
var STOPS = [[0, '#2ecc71'], [4, '#f1c40f'], [6.5, '#f39c12'], [8.5, '#e74c3c'], [10, '#8b0000']];
function lvColor(v) {
  for (var i = 1; i < STOPS.length; i++) {
    if (v <= STOPS[i][0]) { var a = STOPS[i - 1], b = STOPS[i]; return mix(a[1], b[1], (v - a[0]) / (b[0] - a[0])); }
  }
  return STOPS[STOPS.length - 1][1];
}
var GRAD = 'linear-gradient(to left,#2ecc71 0%,#f1c40f 40%,#f39c12 65%,#e74c3c 85%,#8b0000 100%)';
function flBg(v) { return 'background-image:' + GRAD + ';background-size:' + Math.round(1000 / Math.max(v, 0.3)) + '% 100%;background-position:right;background-repeat:no-repeat'; }

/* ---------- storage: IndexedDB with in-memory fallback ---------- */
var db = null;
function dbOpen() {
  return new Promise(function (res) {
    try {
      var r = indexedDB.open('triggers-app', 1);
      r.onupgradeneeded = function () {
        var d = r.result;
        d.createObjectStore('entries', { keyPath: 'id' });
        d.createObjectStore('meta');
      };
      r.onsuccess = function () { db = r.result; res(); };
      r.onerror = function () { res(); };
      r.onblocked = function () { res(); };
    } catch (e) { res(); }
  });
}
function dbReq(store, mode, fn) {
  return new Promise(function (res) {
    if (!db) { res(undefined); return; }
    try {
      var t = db.transaction(store, mode), s = t.objectStore(store), q = fn(s);
      t.oncomplete = function () { res(q ? q.result : undefined); };
      t.onerror = t.onabort = function () { res(undefined); };
    } catch (e) { res(undefined); }
  });
}
function saveEntry(e) { return dbReq('entries', 'readwrite', function (s) { return s.put(e); }); }
function dropEntry(id) { return dbReq('entries', 'readwrite', function (s) { return s.delete(id); }); }
function clearEntries() { return dbReq('entries', 'readwrite', function (s) { return s.clear(); }); }
function setMeta(k, v) { return dbReq('meta', 'readwrite', function (s) { return s.put(v, k); }); }
function getMeta(k) { return dbReq('meta', 'readonly', function (s) { return s.get(k); }); }

/* ---------- state ---------- */
var E = [];        /* entries: {id, tr, lv, ts, n, help} */
var T = [];        /* trigger names */
var S = { tab: 0, sel: '', lvl: 5, last: -1, toast: false, detail: false, adding: false, filter: '', open: -1, arm: '', msg: '', err: false, persisted: true };

function nextId() { var m = 0; E.forEach(function (x) { if (x.id > m) m = x.id; }); return m + 1; }
function saveTriggers() { setMeta('triggers', T.slice()); }
function entryById(id) { for (var i = 0; i < E.length; i++) if (E[i].id === id) return E[i]; return null; }
function sorted() { return E.slice().sort(function (a, b) { return b.ts - a.ts; }); }

/* ---------- render ---------- */
var main = document.getElementById('main'), nav = document.getElementById('nav');

function rowH(x) {
  var o = S.open === x.id, sub = [];
  if (x.n) sub.push(esc(x.n));
  if (x.help) sub.push('מה עזר: ' + esc(x.help));
  return '<div class="row" data-o="' + x.id + '"><span class="ri">' + tic(x.tr) + '</span><span class="tx">' + esc(x.tr) +
    (sub.length ? '<span class="sb">' + sub.join('<br>') + '</span>' : '') +
    (o ? '<span class="act"><input class="in" data-en="' + x.id + '" placeholder="הערה (לא חובה)" maxlength="500" value="' + esc(x.n || '') + '"><input class="in" data-eh="' + x.id + '" placeholder="מה עזר? (לא חובה)" maxlength="500" value="' + esc(x.help || '') + '">' +
      (S.arm === 'e' + x.id
        ? '<button class="ibtn red arm" data-del="' + x.id + '" aria-label="אישור מחיקה">' + ic('trash', 'sv') + ' למחוק?</button>'
        : '<button class="ibtn red" data-del="' + x.id + '" title="מחיקת הרישום" aria-label="מחיקת הרישום">' + ic('trash', 'sv') + '</button>') + '</span>' : '') +
    '</span><span class="ds" style="color:' + lvColor(x.lv) + '">' + fmt(x.lv) + '</span><span class="tm">' + hm(x.ts) + '</span></div>';
}

function homeH() {
  var h = '';
  if (!T.length) {
    h += '<div class="empty">עוד אין טריגרים. מוסיפים את הראשון:</div>';
  } else {
    h += '<div class="tiles">';
    T.forEach(function (t) {
      h += '<button class="tile' + (S.sel === t ? ' on' : '') + '" style="--c:' + colorOf(t) + '" data-s="' + esc(t) + '" title="' + esc(t) + '" aria-label="' + esc(t) + '">' + tic(t) + '<span>' + esc(t) + '</span></button>';
    });
  }
  if (!T.length) h += '<div class="tiles">';
  h += '<button class="tile add" id="ad" title="טריגר חדש" aria-label="טריגר חדש">' + ic('+', 'tic') + '<span>חדש</span></button></div>';
  if (S.adding) h += '<div class="flex" style="margin-top:10px"><input class="in" id="nt" placeholder="שם הטריגר החדש" maxlength="30"><button class="ibtn" id="ntok" title="הוספה" aria-label="הוספת טריגר">' + ic('check') + '</button></div>';
  if (T.length) {
    h += '<div class="lbl flex" style="justify-content:space-between;margin-top:14px"><span>עוצמה: מחליקים אצבע על הפס</span><b id="lvn" style="color:' + lvColor(S.lvl) + ';font-size:16px">' + fmt(S.lvl) + '</b></div>';
    h += '<div class="sl" id="b5" tabindex="0" role="slider" aria-label="עוצמה" aria-valuemin="0" aria-valuemax="10" aria-valuenow="' + fmt(S.lvl) + '"><div class="tk"></div><div class="fl" style="width:' + S.lvl * 10 + '%;' + flBg(S.lvl) + '"></div><div class="th" style="inset-inline-start:calc(' + S.lvl * 10 + '% - 14px);background:' + lvColor(S.lvl) + '"></div></div>';
    h += '<div class="lvs"><span>0</span><span>10</span></div>';
    var today = startOfDay(Date.now()), cs = E.filter(function (x) { return x.tr === S.sel && x.ts >= today; }).length;
    var bc = colorOf(S.sel);
    h += '<div class="bigwrap"><button class="big" id="bg" style="--c:' + bc + ';--cl:' + mix(bc, '#ffffff', 0.45) + ';--cd:' + mix(bc, '#000000', 0.4) + '">' + tic(S.sel).replace(/style="color:[^"]*"/, '') + '<span>' + esc(S.sel) + '</span><small>היום: ' + cs + '</small></button></div>';
    h += '<div class="hint">לחיצה רושמת: ' + esc(S.sel) + ', עוצמה ' + fmt(S.lvl) + '</div>';
  }
  var L = entryById(S.last);
  if (S.toast && L) {
    h += '<div class="card flex"><span style="flex:1">נרשם ב-' + hm(L.ts) + ': ' + esc(L.tr) + ', עוצמה ' + fmt(L.lv) + '</span>';
    if (!S.detail) h += '<button class="ibtn" data-more="1" title="הוספת פרטים לרישום הזה" aria-label="הוספת פרטים לרישום הזה">' + ic('book') + '</button>';
    h += '<button class="ibtn red" data-undo="' + L.id + '" title="ביטול הרישום" aria-label="ביטול הרישום">' + ic('trash') + '</button></div>';
  }
  if (S.detail && L) {
    h += '<div class="card"><h4>פרטים (לא חובה)</h4><div class="lbl">הערה</div><input class="in" id="nn" maxlength="500" placeholder="מה קרה, איפה, עם מי" value="' + esc(L.n || '') + '">';
    h += '<div class="lbl">מה עזר?</div><input class="in" id="nh" maxlength="500" placeholder="לא חובה" value="' + esc(L.help || '') + '">';
    h += '<button class="save" id="sv" title="סיום" aria-label="סיום">' + ic('check') + '<span>סיום</span></button></div>';
  }
  var td = startOfDay(Date.now()), list = sorted().filter(function (x) { return x.ts >= td; });
  h += '<div class="card"><h4>היום</h4>';
  if (!list.length) h += '<div class="empty" style="padding:8px">עוד לא נרשם כלום היום.</div>';
  list.forEach(function (x) { h += rowH(x); });
  return h + '</div>';
}

function journalH() {
  var names = T.slice();
  E.forEach(function (x) { if (names.indexOf(x.tr) < 0) names.push(x.tr); });
  var h = '<div class="chips"><button data-f="" class="' + (S.filter === '' ? 'on' : '') + '">הכול</button>';
  names.forEach(function (t) { h += '<button data-f="' + esc(t) + '" class="' + (S.filter === t ? 'on' : '') + '" style="--c:' + colorOf(t) + '"><span class="ci">' + tic(t) + '</span>' + esc(t) + '</button>'; });
  h += '</div>';
  var list = sorted().filter(function (x) { return S.filter === '' || x.tr === S.filter; });
  if (!list.length) return h + '<div class="empty">אין עדיין רישומים. הרישום הראשון נעשה במסך הבית.</div>';
  var last = '';
  list.forEach(function (x) {
    var k = dkey(x.ts);
    if (k !== last) { h += '<div class="dayh">' + esc(dayLabel(x.ts)) + '</div>'; last = k; }
    h += rowH(x);
  });
  return h;
}

function statsH() {
  if (!E.length) return '<div class="empty">הנתונים יופיעו אחרי הרישומים הראשונים.</div>';
  var now = Date.now(), t0 = startOfDay(now), i, days = {};
  E.forEach(function (x) { days[dkey(x.ts)] = true; });
  var streak = 0, c = t0;
  if (!days[dkey(c)]) c -= 864e5;
  while (days[dkey(c)]) { streak++; c -= 864e5; }
  var wk = [], tot = 0, prev = 0;
  for (i = 6; i >= 0; i--) {
    var s = t0 - i * 864e5, n = E.filter(function (x) { return x.ts >= s && x.ts < s + 864e5; }).length;
    wk.push({ n: n, d: DN[new Date(s).getDay()], today: i === 0 });
    tot += n;
  }
  prev = E.filter(function (x) { return x.ts >= t0 - 13 * 864e5 && x.ts < t0 - 6 * 864e5; }).length;
  var df = tot - prev;
  var m30 = E.filter(function (x) { return x.ts >= t0 - 29 * 864e5; });
  var hrs = []; for (i = 0; i < 24; i++) hrs.push(0);
  var cnt = {};
  m30.forEach(function (x) { hrs[new Date(x.ts).getHours()]++; cnt[x.tr] = (cnt[x.tr] || 0) + 1; });
  var names = Object.keys(cnt).sort(function (a, b) { return cnt[b] - cnt[a]; }), mx = cnt[names[0]] || 1;
  var h = '<div class="two"><div class="card"><b>' + streak + '</b><small>ימים ברצף</small></div><div class="card"><b>' + m30.length + '</b><small>ב-30 הימים האחרונים</small></div></div>';
  h += '<div class="card"><h4>מגמה</h4><div style="font-size:13.5px;line-height:1.6">ב-7 הימים האחרונים ' + tot + ' רישומים, ובשבוע שלפניהם ' + prev + '. ' + (df < 0 ? 'ירידה של ' + (-df) : df > 0 ? 'עלייה של ' + df : 'ללא שינוי') + '.</div></div>';
  var wm = Math.max.apply(null, wk.map(function (w) { return w.n; })) || 1;
  h += '<div class="card"><h4>7 הימים האחרונים</h4><div class="cols">';
  wk.forEach(function (w) { h += '<div class="' + (w.today ? 'today' : '') + '"><span>' + w.n + '</span><i style="height:' + Math.round(w.n / wm * 62) + 'px"></i>' + w.d + '</div>'; });
  h += '</div></div><div class="card"><h4>לפי שעות ביום</h4><div class="hrs">';
  var hx = Math.max.apply(null, hrs) || 1;
  hrs.forEach(function (v) { h += '<i style="height:' + Math.round(v / hx * 100) + '%"></i>'; });
  h += '</div><div class="hl"><span>0</span><span>6</span><span>12</span><span>18</span><span>23</span></div></div>';
  h += '<div class="card"><h4>מה חוזר הכי הרבה (30 יום)</h4>';
  names.forEach(function (k) { h += '<div class="bar"><span class="bn"><span class="ri">' + tic(k) + '</span>' + esc(k) + '</span><i style="width:' + Math.round(cnt[k] / mx * 100) + '%;background:' + colorOf(k) + '"></i><span>' + cnt[k] + '</span></div>'; });
  return h + '</div>';
}

function settingsH() {
  var h = '<div class="card"><h4>הטריגרים שלי</h4>';
  T.forEach(function (t, k) {
    h += '<div class="lrow"><span class="ri">' + tic(t) + '</span><span class="sp">' + esc(t) + '</span><button class="ibtn red" data-rm="' + k + '" title="הסרת הטריגר" aria-label="הסרת ' + esc(t) + '">' + ic('trash') + '</button></div>';
  });
  h += '<div class="flex" style="margin-top:10px"><input class="in" id="st" placeholder="טריגר חדש" maxlength="30"><button class="ibtn" id="stok" title="הוספה" aria-label="הוספת טריגר">' + ic('check') + '</button></div>';
  h += '<p class="note">הסרת טריגר לא מוחקת רישומים קיימים שלו.</p></div>';
  h += '<div class="card"><h4>גיבוי הנתונים</h4>';
  h += '<button class="act2" id="ex">' + ic('down') + '<span>ייצוא הנתונים לקובץ גיבוי</span></button>';
  h += '<button class="act2" id="im">' + ic('up') + '<span>ייבוא מקובץ גיבוי</span></button>';
  h += '<input type="file" id="fi" accept=".json,application/json" hidden>';
  h += '<div class="msg' + (S.err ? ' err' : '') + '" id="bm">' + esc(S.msg) + '</div>';
  h += '<p class="note">הנתונים נשמרים רק בטלפון הזה. ניקוי נתוני הדפדפן או החלפת מכשיר מוחקים אותם, ולכן כדאי לגבות מדי פעם.' + (S.persisted ? '' : ' השמירה בטלפון לא זמינה כרגע, והרישומים יימחקו עם סגירת האפליקציה.') + '</p></div>';
  h += '<div class="card"><h4>מחיקת כל הנתונים</h4>' +
    (S.arm === 'all'
      ? '<button class="act2 red" id="clr">' + ic('trash') + '<span>לחיצה נוספת מוחקת את כל הרישומים</span></button>'
      : '<button class="act2 red" id="clr">' + ic('trash') + '<span>מחיקת כל הרישומים</span></button>') + '</div>';
  h += updateCardH();
  h += '<div class="card"><h4>על האפליקציה</h4><p class="note" style="margin:0;color:#c5ccd6">כלי להתבוננות עצמית, לא טיפול ולא ייעוץ רפואי. אם קשה לך, כדאי לפנות לאיש מקצוע.</p></div>';
  return h;
}

function render() {
  main.innerHTML = [homeH, journalH, statsH, settingsH][S.tab]();
  var tabs = [['בית', 'home'], ['יומן', 'book'], ['נתונים', 'chart'], ['הגדרות', 'gear']], n = '';
  tabs.forEach(function (t, k) { n += '<button data-n="' + k + '" class="' + (S.tab === k ? 'on' : '') + '">' + ic(t[1]) + t[0] + '</button>'; });
  nav.innerHTML = n;
  bind();
}

/* ---------- actions ---------- */
function addTrigger(v) {
  v = (v || '').trim();
  if (!v) return '';
  if (T.indexOf(v) < 0) { T.push(v); saveTriggers(); }
  return v;
}
function bind() {
  function q(s, f) { main.querySelectorAll(s).forEach(f); }
  nav.querySelectorAll('[data-n]').forEach(function (b) {
    b.onclick = function () { S.tab = +b.dataset.n; S.open = -1; S.arm = ''; S.msg = ''; S.err = false; render(); main.scrollTop = 0; };
  });
  q('[data-s]', function (b) { b.onclick = function () { S.sel = b.dataset.s; setMeta('sel', S.sel); render(); }; });
  var ad = main.querySelector('#ad');
  if (ad) ad.onclick = function () { S.adding = !S.adding; render(); var i = document.getElementById('nt'); if (i) i.focus(); };
  var ntok = main.querySelector('#ntok'), nt = main.querySelector('#nt');
  function doAdd() { var v = addTrigger(nt.value); if (v) { S.sel = v; setMeta('sel', v); } S.adding = false; render(); }
  if (ntok) ntok.onclick = doAdd;
  if (nt) nt.onkeydown = function (e) { if (e.key === 'Enter') doAdd(); };

  var bg = main.querySelector('#bg');
  if (bg) bg.onclick = function () {
    try { if (navigator.vibrate) navigator.vibrate(18); } catch (x) {}
    var e = { id: nextId(), tr: S.sel, lv: S.lvl, ts: Date.now(), n: '', help: '' };
    E.push(e); saveEntry(e); S.last = e.id; S.toast = true; S.detail = false; render();
  };
  q('[data-more]', function (b) { b.onclick = function () { S.detail = true; render(); var i = document.getElementById('nn'); if (i) i.focus(); }; });
  q('[data-undo]', function (b) { b.onclick = function () { removeEntry(+b.dataset.undo); S.toast = false; S.detail = false; S.last = -1; render(); }; });
  var sv = main.querySelector('#sv');
  if (sv) sv.onclick = function () { S.detail = false; render(); };
  function bindText(sel, field) {
    q(sel, function (i) {
      i.oninput = function () {
        var id = +(i.dataset.en || i.dataset.eh || 0), x = entryById(id);
        if (x) { x[field] = i.value; saveEntry(x); }
      };
    });
  }
  bindText('[data-en]', 'n'); bindText('[data-eh]', 'help');
  var nn = main.querySelector('#nn'), nh = main.querySelector('#nh');
  if (nn) nn.oninput = function () { var x = entryById(S.last); if (x) { x.n = nn.value; saveEntry(x); } };
  if (nh) nh.oninput = function () { var x = entryById(S.last); if (x) { x.help = nh.value; saveEntry(x); } };

  var b5 = main.querySelector('#b5');
  if (b5) {
    var dr = false;
    var setL = function (v) {
      v = Math.round(Math.min(10, Math.max(0, v)) * 10) / 10; S.lvl = v;
      var fl = b5.querySelector('.fl'), th = b5.querySelector('.th'), c = lvColor(v);
      fl.style.width = v * 10 + '%';
      fl.style.backgroundSize = Math.round(1000 / Math.max(v, 0.3)) + '% 100%';
      th.style.insetInlineStart = 'calc(' + v * 10 + '% - 14px)';
      th.style.background = c;
      b5.setAttribute('aria-valuenow', fmt(v));
      var ln = document.getElementById('lvn'); ln.textContent = fmt(v); ln.style.color = c;
      var hn = main.querySelector('.hint'); if (hn) hn.textContent = 'לחיצה רושמת: ' + S.sel + ', עוצמה ' + fmt(v);
    };
    var fromX = function (e) { var r = b5.getBoundingClientRect(); setL((r.right - e.clientX) / r.width * 10); };
    b5.addEventListener('pointerdown', function (e) { dr = true; try { b5.setPointerCapture(e.pointerId); } catch (x) {} fromX(e); });
    b5.addEventListener('pointermove', function (e) { if (dr) fromX(e); });
    b5.addEventListener('pointerup', function () { dr = false; setMeta('lvl', S.lvl); });
    b5.addEventListener('pointercancel', function () { dr = false; });
    b5.addEventListener('keydown', function (e) {
      var d = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? 0.5 : e.key === 'ArrowRight' || e.key === 'ArrowDown' ? -0.5 : 0;
      if (d) { e.preventDefault(); setL(S.lvl + d); }
    });
  }

  q('[data-f]', function (b) { b.onclick = function () { S.filter = b.dataset.f; S.open = -1; render(); }; });
  q('[data-o]', function (r) {
    r.onclick = function (e) {
      if (e.target.closest('[data-del],input')) return;
      var id = +r.dataset.o; S.open = S.open === id ? -1 : id; S.arm = ''; render();
    };
  });
  q('[data-del]', function (b) {
    b.onclick = function () {
      var id = +b.dataset.del;
      if (S.arm !== 'e' + id) { S.arm = 'e' + id; render(); return; }
      removeEntry(id); S.open = -1; S.arm = ''; if (S.last === id) { S.last = -1; S.toast = false; S.detail = false; } render();
    };
  });
  q('[data-rm]', function (b) { b.onclick = function () { T.splice(+b.dataset.rm, 1); saveTriggers(); if (T.indexOf(S.sel) < 0) S.sel = T[0] || ''; setMeta('sel', S.sel); render(); }; });
  var st = main.querySelector('#st'), stok = main.querySelector('#stok');
  function doAdd2() { addTrigger(st.value); if (!S.sel) S.sel = T[0] || ''; render(); }
  if (stok) stok.onclick = doAdd2;
  if (st) st.onkeydown = function (e) { if (e.key === 'Enter') doAdd2(); };
  var chkb = main.querySelector('#chkb');
  if (chkb) chkb.onclick = function () { checkUpdate(true); };
  var ex = main.querySelector('#ex'), im = main.querySelector('#im'), fi = main.querySelector('#fi'), clr = main.querySelector('#clr');
  if (ex) ex.onclick = exportData;
  if (im) im.onclick = function () { fi.click(); };
  if (fi) fi.onchange = function () { if (fi.files[0]) importData(fi.files[0]); };
  if (clr) clr.onclick = function () {
    if (S.arm !== 'all') { S.arm = 'all'; render(); return; }
    E = []; clearEntries(); S.arm = ''; S.last = -1; S.toast = false; S.msg = 'כל הרישומים נמחקו.'; S.err = false; render();
  };
}
function removeEntry(id) { E = E.filter(function (x) { return x.id !== id; }); dropEntry(id); }
function note(msg, err) { S.msg = msg; S.err = !!err; var m = document.getElementById('bm'); if (m) { m.textContent = msg; m.className = 'msg' + (err ? ' err' : ''); } }

var NATIVE = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
function nativeExport(json, name) {
  var P = window.Capacitor.Plugins || {}, F = P.Filesystem, Sh = P.Share;
  if (!F || !Sh) { note('השיתוף לא זמין במכשיר הזה.', true); return; }
  F.writeFile({ path: name, data: json, directory: 'CACHE', encoding: 'utf8' })
    .then(function (r) { return Sh.share({ title: 'גיבוי טריגרים', url: r.uri, dialogTitle: 'שמירת קובץ הגיבוי' }); })
    .then(function () { note('קובץ הגיבוי מוכן לשמירה (למשל בקבצים או ב-Drive).'); })
    .catch(function (e) { if (e && /cancel/i.test(String(e.message || e))) return; note('הייצוא לא הצליח.', true); });
}
function exportData() {
  try {
    var data = { app: 'triggers', version: 1, exported: new Date().toISOString(), triggers: T, entries: E };
    var d = new Date();
    var fname = 'triggers-backup-' + d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()) + '.json';
    if (NATIVE) { nativeExport(JSON.stringify(data), fname); return; }
    var blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fname;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
    note('נוצר קובץ גיבוי עם ' + E.length + ' רישומים. הוא נשמר בתיקיית ההורדות.');
  } catch (e) { note('הייצוא לא הצליח.', true); }
}
function importData(file) {
  var r = new FileReader();
  r.onload = function () {
    try {
      var d = JSON.parse(r.result);
      if (!d || d.app !== 'triggers' || !Array.isArray(d.entries)) throw new Error('bad');
      var added = 0, seen = {};
      E.forEach(function (x) { seen[x.ts + '|' + x.tr] = true; });
      d.entries.forEach(function (x) {
        if (!x || typeof x.tr !== 'string' || typeof x.ts !== 'number') return;
        var k = x.ts + '|' + x.tr; if (seen[k]) return; seen[k] = true;
        var lv = Math.min(10, Math.max(0, Number(x.lv) || 0));
        var e = { id: nextId(), tr: x.tr.slice(0, 30), lv: lv, ts: x.ts, n: String(x.n || '').slice(0, 500), help: String(x.help || '').slice(0, 500) };
        E.push(e); saveEntry(e); added++;
      });
      if (Array.isArray(d.triggers)) d.triggers.forEach(function (t) { if (typeof t === 'string') addTrigger(t.slice(0, 30)); });
      if (!S.sel) S.sel = T[0] || '';
      S.msg = 'נוספו ' + added + ' רישומים מהקובץ.'; S.err = false; render();
    } catch (e) { note('הקובץ לא תקין, ולא נטען כלום.', true); }
  };
  r.onerror = function () { note('לא הצלחתי לקרוא את הקובץ.', true); };
  r.readAsText(file);
}

/* ---------- in-app update (Android app only) ---------- */
var TRP = NATIVE ? (window.Capacitor.Plugins || {}).Triggers : null;
var REL = 'https://github.com/yaronpmo1-create/triggers-app/releases/download/triggers-latest/';
var U = { cur: 0, info: { native: 1, apk: 0 }, avail: null, last: '', sheet: false, state: 'idle', pct: -1 };
function usz(n) { return n > 1048576 ? (n / 1048576).toFixed(1) + ' מ״ב' : Math.max(1, Math.round(n / 1024)) + ' ק״ב'; }
function updHeader() {
  var b = document.getElementById('upd');
  if (!b) return;
  b.hidden = !TRP;
  b.classList.toggle('has', !!U.avail);
  b.classList.toggle('spin', U.state === 'checking');
}
function updateCardH() {
  if (!TRP) return '<div class="card"><h4>עדכון האפליקציה</h4><p class="note" style="margin:0">האתר מתעדכן לבד בכל פתיחה עם אינטרנט.</p></div>';
  return '<div class="card"><h4>עדכון האפליקציה</h4><div class="flex"><span style="flex:1;font-size:14.5px">גרסה ' + (U.cur || '—') +
    '<small style="display:block;color:#8e98a8;font-size:12px;margin-top:2px">' + (U.avail ? 'יש גרסה חדשה: ' + U.avail.m.version : (U.last ? 'נבדק לאחרונה: ' + U.last : 'עוד לא נבדק')) +
    '</small></span><button class="pill" id="chkb">' + (U.avail ? 'פתיחת העדכון' : 'בדיקת עדכון') + '</button></div></div>';
}
function sheetH() {
  var a = U.avail, h = '<div class="sheet"><div class="grab"></div>';
  if (U.state === 'checking') return h + '<h3>בודק עדכון...</h3></div>';
  if (U.state === 'down') {
    return h + '<h3>' + (a && a.type === 'apk' ? 'מוריד את קובץ ההתקנה' : 'מוריד את העדכון') + '</h3><div class="pbar"><i id="pb" style="width:' + Math.max(U.pct, 4) + '%"></i></div><div class="ver" id="pt">' + (U.pct >= 0 ? U.pct + '%' : 'מוריד...') + '</div></div>';
  }
  if (U.state === 'wait') return h + '<h3>מפעיל מחדש עם הגרסה החדשה</h3></div>';
  if (U.state === 'installing') return h + '<h3>נפתח חלון ההתקנה של Android</h3><div class="ver">לאשר "התקנה" ולחזור לאפליקציה. הנתונים נשארים.</div><button class="go" id="sok">סגירה</button></div>';
  if (U.state === 'perm') return h + '<h3>צריך לאפשר התקנה מהאפליקציה</h3><div class="ver">נפתחו ההגדרות של Android. מאפשרים "התקנת אפליקציות" לאפליקציה הזו, חוזרים ולוחצים שוב.</div><button class="go" id="sgo">נסה שוב</button><button class="later" id="slater">סגירה</button></div>';
  if (U.state === 'err') return h + '<h3>העדכון לא הצליח</h3><div class="ver">בדוק חיבור לאינטרנט ונסה שוב. הגרסה הנוכחית נשארת כמו שהיא.</div><button class="go" id="sok">סגירה</button></div>';
  if (!a) return h + '<h3>אין עדכון חדש</h3><div class="ver">הגרסה שלך, ' + (U.cur || '—') + ', היא האחרונה.</div><button class="go" id="sok">סגירה</button></div>';
  var m = a.m, apk = a.type === 'apk';
  h += '<h3>' + (apk ? 'גרסה חדשה דורשת התקנה' : 'גרסה חדשה זמינה') + '</h3><div class="ver">' + (U.cur || '—') + ' ← ' + m.version + ' · ' + (apk ? 'כ-3 מ״ב' : usz(m.size)) + '</div><ul>';
  var notes = (m.notes && m.notes.length) ? m.notes : ['שיפורים ותיקונים'];
  notes.forEach(function (n) { h += '<li>' + esc(n) + '</li>'; });
  if (apk) h += '<li>Android ישאל אישור להתקנה</li><li>הנתונים שלך נשארים</li>';
  h += '</ul><button class="go" id="sgo">' + ic('down', 'sv') + '<span>' + (apk ? 'הורדה והתקנה' : 'עדכון עכשיו') + '</span></button><button class="later" id="slater">לא עכשיו</button></div>';
  return h;
}
function renderSheet() {
  var sh = document.getElementById('sheet');
  if (!sh) return;
  sh.className = 'ov' + (U.sheet ? ' show' : '');
  sh.innerHTML = U.sheet ? sheetH() : '';
  var go = document.getElementById('sgo'), later = document.getElementById('slater'), ok = document.getElementById('sok');
  if (go) go.onclick = applyUpdate;
  if (later) later.onclick = function () { U.sheet = false; U.state = 'idle'; renderSheet(); };
  if (ok) ok.onclick = function () { U.sheet = false; U.state = 'idle'; renderSheet(); };
  sh.onclick = function (e) { if (e.target === sh && U.state !== 'down' && U.state !== 'wait') { U.sheet = false; U.state = 'idle'; renderSheet(); } };
}
function updProg(pct) {
  U.pct = pct;
  var pb = document.getElementById('pb'), pt = document.getElementById('pt');
  if (pb) pb.style.width = Math.max(pct, 4) + '%';
  if (pt) pt.textContent = pct >= 0 ? pct + '%' : 'מוריד...';
}
function checkUpdate(manual) {
  if (!TRP) return;
  if (manual && U.avail) { U.sheet = true; U.state = 'idle'; renderSheet(); return; }
  U.state = 'checking'; updHeader();
  if (manual) { U.sheet = true; renderSheet(); }
  TRP.otaFetch({ url: REL + 'ota.json' }).then(function (r) {
    var m = JSON.parse(r.text);
    U.last = hm(Date.now());
    U.avail = m.version > U.cur ? { m: m, type: m.minNative > U.info.native ? 'apk' : 'ota' } : null;
    U.state = 'idle'; updHeader();
    if (U.sheet) renderSheet();
    if (S.tab === 3) render();
  }).catch(function () {
    U.state = manual ? 'err' : 'idle'; updHeader();
    if (U.sheet) renderSheet();
  });
}
function applyUpdate() {
  var a = U.avail;
  if (!a || !TRP) return;
  U.state = 'down'; U.pct = -1; renderSheet(); updHeader();
  if (a.type === 'apk') {
    TRP.apkInstall({ url: REL + 'triggers-app.apk' }).then(function () { U.state = 'installing'; renderSheet(); })
      .catch(function (e) { U.state = String(e && (e.message || e)).indexOf('perm') >= 0 ? 'perm' : 'err'; renderSheet(); });
    return;
  }
  TRP.otaDownload({ url: REL + 'bundle.zip', sha256: a.m.sha256, version: String(a.m.version), minNative: a.m.minNative }).then(function () {
    U.state = 'wait'; renderSheet();
    try { localStorage.setItem('tr_updated', String(a.m.version)); } catch (x) {}
    return TRP.otaReload();
  }).catch(function () { U.state = 'err'; renderSheet(); });
}
function showToast(t) {
  var x = document.getElementById('toast');
  if (!x) return;
  x.textContent = t; x.classList.add('show');
  setTimeout(function () { x.classList.remove('show'); }, 3000);
}
function startUpdates() {
  var upd = document.getElementById('upd');
  if (upd) upd.onclick = function () { checkUpdate(true); };
  if (!TRP) { updHeader(); return; }
  try { TRP.addListener('otaProgress', function (e) { updProg(e.pct); }); TRP.addListener('apkProgress', function (e) { updProg(e.pct); }); } catch (x) {}
  fetch('bundle.json', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (j) { U.cur = j.version || 0; }).catch(function () {})
    .then(function () { return TRP.otaInfo(); }).then(function (i) { U.info = i; }).catch(function () {})
    .then(function () {
      try { TRP.otaOk(); } catch (x) {}
      try {
        var v = localStorage.getItem('tr_updated');
        if (v) { localStorage.removeItem('tr_updated'); showToast('האפליקציה עודכנה לגרסה ' + v); }
      } catch (x) {}
      updHeader(); checkUpdate(false);
    });
}

/* ---------- start ---------- */
function start() {
  dbOpen().then(function () {
    S.persisted = !!db;
    return Promise.all([dbReq('entries', 'readonly', function (s) { return s.getAll(); }), getMeta('triggers'), getMeta('sel'), getMeta('lvl')]);
  }).then(function (r) {
    E = Array.isArray(r[0]) ? r[0] : [];
    T = Array.isArray(r[1]) ? r[1] : DEFAULT_TR.slice();
    if (!Array.isArray(r[1])) saveTriggers();
    S.sel = T.indexOf(r[2]) >= 0 ? r[2] : (T[0] || '');
    if (typeof r[3] === 'number') S.lvl = r[3];
    document.getElementById('date').textContent = new Date().toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'numeric' });
    render();
    startUpdates();
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
  });
  if (!NATIVE && 'serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(function () {});
}
start();
})();

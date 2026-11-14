/*
 * SHELL — a home screen you type at, that keeps a ledger of the day.
 *
 * BRIDGE. On the phone the page talks to window.ShellNative (android/.../Native.kt). WebView matches a call by
 * name AND argument count, so every call here passes exactly the arguments the Kotlin method takes:
 *   apps() launch(key) appInfo(pkg) uninstall(pkg)
 *   notifs() notifOpen(id) notifDismiss(id) dismissAll() notifReply(id,text) notifAction(id,index)
 *   media() mediaCmd(cmd) events(days) openEvent(id) newEvent(title,start,end,allDay)
 *   contacts() call(number) sms(number,body) openContact(id) profile()
 *   battery() device() perms() askPerm(name) setHome() setDnd(on) torch(on)
 *   timer(seconds,label) alarm(hour,minute,label) remind(id,at,text) cancelRemind(id)
 *   web(query) url(href) maps(query) settings(panel) shade() copy(text) haptic(kind) shareFile(name,mime,text)
 *   usage() camera() ready() updateInfo() checkUpdate(what) installUpdate() applyPage() resetPage() version()
 * Native events arrive as SHELL.onNative(type, json): back home resume perms apps battery media notifs events remind update.
 * In a browser the made-up bridge in mock.js stands in.
 */
(function () {
'use strict';
var MOCK = !window.ShellNative;
var N = window.ShellNative || window.ShellMock;
function nat(m) {
  try {
    if (!N || typeof N[m] === 'undefined') return null;
    var a = Array.prototype.slice.call(arguments, 1), r;
    switch (a.length) { case 0: r = N[m](); break; case 1: r = N[m](a[0]); break; case 2: r = N[m](a[0], a[1]); break;
      case 3: r = N[m](a[0], a[1], a[2]); break; default: r = N[m](a[0], a[1], a[2], a[3]); }
    if (typeof r === 'string') { try { return JSON.parse(r); } catch (e) { return r; } }
    return r === undefined ? null : r;
  } catch (e) { console.warn('bridge ' + m + ': ' + e.message); return null; }
}
function has(m) { return !!N && typeof N[m] !== 'undefined'; }

// ------------------------------------------------------------------ small things
var $ = function (id) { return document.getElementById(id); };
function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
function pad(n) { return (n < 10 ? '0' : '') + n; }
function dayKey(d) { d = d || new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function midnight() { var d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); }
var DOW = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'], MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
function clock(ms) {
  var d = new Date(ms), h = d.getHours(), m = pad(d.getMinutes());
  if (D.opts.h24) return pad(h) + ':' + m;
  return pad(h % 12 || 12) + ':' + m;
}
function dur(ms, long) {
  var m = Math.round(ms / 60000), h = Math.floor(m / 60);
  if (long) return h ? h + 'H ' + pad(m % 60) + 'M' : m + 'M';
  return h ? h + 'h ' + (m % 60) + 'm' : m + ' min';
}
function big(s) { return s.replace(/0/g, 'O'); }   // the thin clock face reads cleaner without the dotted zero
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function hap(k) { nat('haptic', k || 'key'); }
function rgb(hex) { var n = parseInt(hex.slice(1), 16); return 'rgb(' + (n >> 16) + ', ' + ((n >> 8) & 255) + ', ' + (n & 255) + ')'; }
function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

// ------------------------------------------------------------------ saved data
var KEY = 'shell.data';
var D = { v: 1, theme: 'ember', chips: ['remind', 'go', 'text', 'photo'], alias: {}, hidden: [], notes: [], reminders: [], counts: {},
  days: {}, hist: [], focus: null, best: 0, opts: { h24: true, grain: true, crt: false, sessions: true, city: { name: 'Reston', lat: 38.9586, lon: -77.357 } } };
try {
  var saved = JSON.parse(localStorage.getItem(KEY) || 'null');
  if (saved && saved.v === 1) { for (var k in saved) if (k !== 'opts') D[k] = saved[k]; for (var o in saved.opts || {}) D.opts[o] = saved.opts[o]; }
} catch (e) {}
var saveT = 0;
function save() { clearTimeout(saveT); saveT = setTimeout(function () { try { localStorage.setItem(KEY, JSON.stringify(D)); } catch (e) {} }, 120); }
function today() {
  var k = dayKey(), t = D.days[k];
  if (!t) {
    t = D.days[k] = { log: [], launches: 0, returns: 0, people: [] };
    var keys = Object.keys(D.days).sort();
    while (keys.length > 14) delete D.days[keys.shift()];
  }
  return t;
}

// ------------------------------------------------------------------ live phone state
var APPS = [], BYPKG = {}, CONTACTS = [], NOTIFS = [], EVENTS = [], MEDIA = null, BATT = {}, PERMS = {}, U = { ok: false };
var S = { panel: null, mode: null, sug: [], histAt: -1, ov: null };
function loadApps() {
  APPS = (nat('apps') || []).slice().sort(function (a, b) { return a.label.toLowerCase() < b.label.toLowerCase() ? -1 : 1; });
  BYPKG = {}; APPS.forEach(function (a) { if (!BYPKG[a.pkg]) BYPKG[a.pkg] = a; });
}
function loadAll() {
  PERMS = nat('perms') || {};
  CONTACTS = nat('contacts') || [];
  NOTIFS = nat('notifs') || [];
  EVENTS = nat('events', 7) || [];
  BATT = nat('battery') || {};
  var m = nat('media'); MEDIA = m && m.title ? m : null;
  loadUsage();
}
function loadUsage() {
  U = (has('usage') && nat('usage')) || { ok: false };
  if (U.ok) { var t = today(); t.unlocks = U.unlocks; t.screenMs = U.screenMs; save(); }
}
function label(pkg) { return BYPKG[pkg] ? BYPKG[pkg].label : pkg.split('.').pop(); }
function live() { return NOTIFS.filter(function (n) { return n.live; }); }
function people() {
  var set = {}, m0 = midnight();
  NOTIFS.forEach(function (n) { if (n.person && n.time >= m0) set[n.person.toLowerCase()] = 1; });
  today().people.forEach(function (p) { set[p.toLowerCase()] = 1; });
  return Object.keys(set).length;
}
function met(name) { var t = today(); if (t.people.indexOf(name) < 0) { t.people.push(name); save(); } }

// ------------------------------------------------------------------ themes
var THEMES = {
  ember: { a: '#b65424', a2: '#7d3716' }, mono: { a: '#0a0a0a', a2: '#0a0a0a' }, dusk: { a: '#5a4a8c', a2: '#33295a' },
  moss: { a: '#566a35', a2: '#303d1d' }, ice: { a: '#3f6f8c', a2: '#234458' }, blood: { a: '#8f2222', a2: '#571212' },
  gold: { a: '#8f6b14', a2: '#5a430c' }, rose: { a: '#a8546c', a2: '#6a3042' },
  void: { a: '#0a0a0a', a2: '#0a0a0a', g2: '#0d0d0d', g: '#161616', pink: '#f5f3ef' }
};
var curTheme = null;
function themeNow() {
  if (D.theme !== 'auto') return THEMES[D.theme] ? D.theme : 'ember';
  var h = new Date().getHours();
  return h >= 5 && h < 8 ? 'rose' : h < 16 && h >= 8 ? 'ice' : h >= 16 && h < 19 ? 'ember' : h >= 19 && h < 22 ? 'dusk' : 'mono';
}
function applyTheme() {
  var name = themeNow(); if (name === curTheme) return;
  curTheme = name;
  var t = THEMES[name], st = document.documentElement.style, g2 = t.g2 || '#8d8d8a', n = parseInt(g2.slice(1), 16);
  st.setProperty('--a', t.a); st.setProperty('--a2', t.a2);
  st.setProperty('--g2', g2); st.setProperty('--g', t.g || '#aaaaa6');
  st.setProperty('--g2rgb', (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255));
  st.setProperty('--pink', t.pink || '#0b0b0b');
  st.setProperty('--pdim', t.pink ? 'rgba(245,243,239,.5)' : 'rgba(11,11,11,.55)');
}
function applyLooks() {
  document.body.classList.toggle('nograin', !D.opts.grain);
  document.body.classList.toggle('crt', !!D.opts.crt);
}

// ------------------------------------------------------------------ the ledger
function log(kind, text, cmd) {
  var e = { t: Date.now(), k: kind, s: text }; if (cmd) e.c = cmd;
  var t = today(); t.log.push(e); if (t.log.length > 400) t.log.splice(0, t.log.length - 400);
  save(); drawLedger(); return e;
}
function say(s) { log('out', s); }
function ok(s) { log('ok', s); }
function err(s) { log('err', s); }
function ledgerRows() {
  var rows = today().log.slice();
  if (U.ok && D.opts.sessions) (U.sessions || []).forEach(function (s) {
    rows.push({ t: s.start, k: 'app', s: dur(s.end - s.start) + ' · ' + label(s.pkg), c: label(s.pkg).toLowerCase() });
  });
  rows.sort(function (a, b) { return a.t - b.t; });
  return rows.slice(-90);
}
function drawLedger() {
  var box = $('rows'), rows = ledgerRows(); box.textContent = '';
  if (!rows.length) rows = [{ t: Date.now(), k: 'sys', s: 'nothing on the ledger yet.' }, { t: Date.now(), k: 'out', s: 'type below. try: help' }];
  rows.forEach(function (r, i) {
    var lead = r.k === 'cmd' || r.k === 'app' || r.k === 'sys';
    if (lead && i && (r.k === 'cmd' || rows[i - 1].k === 'out' || rows[i - 1].k === 'ok' || rows[i - 1].k === 'err')) box.appendChild(el('div', 'e gap'));
    var b = el(r.c ? 'button' : 'div', 'e ' + r.k);
    b.appendChild(el('span', 't', lead ? clock(r.t) : ''));
    b.appendChild(el('span', 's', r.k === 'cmd' ? '> ' + r.s : r.k === 'out' ? '→ ' + r.s : r.k === 'ok' ? '✓ ' + r.s : r.k === 'err' ? '× ' + r.s : r.s));
    if (r.c) b.addEventListener('click', function () { fill(r.c); });
    box.appendChild(b);
  });
  var L = $('ledger'); L.scrollTop = L.scrollHeight;
}

// ------------------------------------------------------------------ header, numbers, clock
var lastMin = '';
function nextEvent() {
  var now = Date.now();
  for (var i = 0; i < EVENTS.length; i++) { var e = EVENTS[i]; if (!e.allDay && e.end > now && e.start < now + 18 * 3600000) return e; }
  return null;
}
function drawTop() {
  var d = new Date(), t = today(), w = live().length;
  $('title').textContent = 'SHELL [' + (S.panel ? S.panel.name : 'HOME') + ']™';
  var compact = document.body.classList.contains('compact');
  var right = DOW[d.getDay()] + ' ' + d.getDate() + ' ' + MON[d.getMonth()];
  var hdr = $('hdr'); hdr.textContent = '';
  if (S.panel) {
    var x = el('button', '', '× CLOSE'); x.addEventListener('click', function () { closePanel(); }); hdr.appendChild(x);
  } else {
    hdr.appendChild(el('div', '', right));
    hdr.appendChild(el('div', '', compact ? clock(d.getTime()) : (BATT.pct != null ? BATT.pct + '%' + (BATT.charging ? ' +' : '') : '')));
  }
  var st = $('stats'); st.textContent = '';
  function row(n, name, f) { var b = el('button', '', n + ' / ' + name); b.addEventListener('click', f); st.appendChild(b); }
  if (U.ok) { row(pad(U.unlocks), 'UNLOCKS', cmdLedger); row(dur(U.screenMs, true), 'SCREEN', cmdLedger); }
  else { row(pad(t.launches), 'LAUNCHES', cmdLedger); row(pad(t.returns), 'RETURNS', cmdLedger); }
  row(pad(people()), 'PEOPLE', cmdLedger);
  row(pad(w), 'WAITING', cmdWaiting);
  row('00', 'JUDGMENT', function () { run('judgment'); });
  var ev = nextEvent();
  if (ev || MEDIA || D.focus) st.appendChild(el('div', 'gap'));
  if (D.focus) row('FOCUS', 'UNTIL ' + clock(D.focus.end), function () { fill('focus off'); });
  if (ev) row(clock(ev.start), ev.title, cmdWeek);
  if (MEDIA) row(MEDIA.playing ? '▶' : '■', MEDIA.title, function () { nat('mediaCmd', 'toggle'); hap(); });
}
function tick() {
  var now = Date.now(), d = new Date(now), c = $('clock');
  if (D.focus) {
    var left = D.focus.end - now;
    if (left <= 0) { var mins = D.focus.mins; D.focus = null; save(); ok('focus done · ' + mins + ' min'); hap('long'); lastMin = ''; }
    else {
      var s = Math.ceil(left / 1000);
      c.classList.add('focus'); $('ch').textContent = big(pad(Math.floor(s / 60))); $('cm').textContent = big(pad(s % 60));
    }
  }
  var m = clock(now);
  if (m === lastMin) return;
  lastMin = m;
  if (!D.focus) { c.classList.remove('focus'); $('ch').textContent = big(m.slice(0, 2)); $('cm').textContent = big(m.slice(3)); }
  $('ptime').textContent = m;
  if (d.getMinutes() % 5 === 0 && !document.hidden) loadUsage();
  applyTheme(); drawTop();
  if (d.getHours() === 0 && d.getMinutes() === 0) drawLedger();
}

// ------------------------------------------------------------------ panels
function openPanel(name, build) {
  closeOv();
  S.panel = { name: name, build: build };
  document.body.classList.add('panel', 'compact');
  drawPanel(true); drawTop();
}
function closePanel() {
  if (!S.panel) return false;
  S.panel = null; document.body.classList.remove('panel');
  if (document.activeElement !== $('q')) document.body.classList.remove('compact');
  drawTop(); drawLedger(); return true;
}
function drawPanel(reset) {
  if (!S.panel) return;
  var P = $('panel'), top = P.scrollTop; P.textContent = '';
  (S.panel.build() || []).forEach(function (r) {
    if (r.h != null) { P.appendChild(el('div', 'ph', r.h)); return; }
    if (r.note != null) { P.appendChild(el('div', 'note', r.note)); return; }
    if (r.pre) { var pre = el('pre', 'pre'); r.pre.forEach(function (x) { pre.appendChild(typeof x === 'string' ? document.createTextNode(x) : el('b', '', x.b)); }); P.appendChild(pre); return; }
    var b = el(r.f || r.hold ? 'button' : 'div', 'r' + (r.l == null ? ' nol' : '') + (r.cls ? ' ' + r.cls : ''));
    if (r.l != null) b.appendChild(el('span', 'l', r.l));
    var s = el('span', 's', r.s); if (r.sub) s.appendChild(el('span', 'sub' + (r.bar ? ' bar' : ''), r.sub)); b.appendChild(s);
    if (r.r) {
      var rr = el('span', 'rr');
      r.r.forEach(function (a) {
        if (!a.f) { rr.appendChild(el('span', '', a.t)); return; }
        var ab = el('span', '', ''), btn = el('button', '', a.t);
        btn.addEventListener('click', function (e) { e.stopPropagation(); hap(); a.f(); }); ab.appendChild(btn); rr.appendChild(ab);
      });
      b.appendChild(rr);
    }
    if (r.f || r.hold) tapHold(b, r.f, r.hold);
    P.appendChild(b);
  });
  P.scrollTop = reset ? 0 : top;
}
function tapHold(node, tap, hold) {
  var tm = 0, held = false, sx = 0, sy = 0;
  function cancel() { clearTimeout(tm); }
  node.addEventListener('pointerdown', function (e) {
    held = false; sx = e.clientX; sy = e.clientY;
    if (hold) tm = setTimeout(function () { held = true; hap('long'); hold(); }, 480);
  });
  node.addEventListener('pointermove', function (e) { if (Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy) > 12) cancel(); });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (t) { node.addEventListener(t, cancel); });
  node.addEventListener('click', function () { if (held) { held = false; return; } if (tap) { hap(); tap(); } });
  node.addEventListener('contextmenu', function (e) { e.preventDefault(); if (hold && !held) { cancel(); held = true; hold(); setTimeout(function () { held = false; }, 400); } });
}

// ---- apps
function visible(a) { return D.hidden.indexOf(a.key) < 0; }
function launch(a) {
  if (nat('launch', a.key) === false) { err('could not open ' + a.label); return; }
  D.counts[a.key] = (D.counts[a.key] || 0) + 1; today().launches++; save(); say(a.label);
}
function cmdApps(arg) {
  var all = /^(all|hidden|-a)$/.test(arg || '');
  openPanel('APPS', function () {
    var rows = [], last = '', top = APPS.filter(visible).filter(function (a) { return D.counts[a.key]; })
      .sort(function (a, b) { return D.counts[b.key] - D.counts[a.key]; }).slice(0, 5);
    function r(a, l) { return { l: l, s: a.label, f: function () { closePanel(); log('cmd', a.label.toLowerCase(), a.label.toLowerCase()); launch(a); }, hold: function () { appSheet(a); } }; }
    if (top.length) { rows.push({ h: 'most used here' }); top.forEach(function (a) { rows.push(r(a, pad(D.counts[a.key]))); }); }
    rows.push({ h: APPS.filter(visible).length + ' apps · hold one for options' });
    APPS.filter(visible).forEach(function (a) {
      var c = a.label.charAt(0).toUpperCase(); if (!/[A-Z]/.test(c)) c = '#';
      rows.push(r(a, c === last ? '' : c)); last = c;
    });
    var hid = APPS.filter(function (a) { return !visible(a); });
    if (hid.length && all) { rows.push({ h: 'hidden' }); hid.forEach(function (a) { rows.push(r(a, '')); }); }
    else if (hid.length) rows.push({ note: hid.length + ' hidden. type: apps all' });
    return rows;
  });
}
function appSheet(a) {
  openPanel('APP', function () {
    var hid = !visible(a), chip = D.chips.indexOf(a.label.toLowerCase()) >= 0;
    return [{ h: a.label + ' · opened ' + (D.counts[a.key] || 0) + '× from here' },
      { s: 'open', f: function () { closePanel(); launch(a); } },
      { s: chip ? 'remove from the chip row' : 'pin to the chip row', f: function () { run('chip ' + (chip ? 'rm ' : 'add ') + a.label.toLowerCase()); } },
      { s: hid ? 'unhide' : 'hide from lists', f: function () { run((hid ? 'unhide ' : 'hide ') + a.label.toLowerCase()); } },
      { s: 'give it a short name…', f: function () { closePanel(); fill('alias  = ' + a.label.toLowerCase(), 6); } },
      { s: 'app info', f: function () { nat('appInfo', a.pkg); } },
      { s: 'uninstall', f: function () { run('uninstall ' + a.label.toLowerCase()); } }];
  });
}

// ---- waiting (notifications)
function cmdWaiting() {
  openPanel('WAITING', function () {
    var L = live().sort(function (a, b) { return b.time - a.time; }), rows = [];
    if (!PERMS.notif) return [{ h: 'nothing to show yet' }, { s: 'allow notification access', sub: 'so SHELL can list what is waiting, and reply', f: function () { nat('askPerm', 'notif'); } }];
    if (!L.length) return [{ h: 'nothing waiting' }, { note: 'no one needs you. enjoy it.' }, { s: 'phone shade', cls: 'dimrow', f: function () { nat('shade'); } }];
    function one(n, who) {
      var acts = [];
      if (n.canReply) acts.push({ t: 'reply', f: function () { replyTo(n); } });
      acts.push({ t: '×', f: function () { nat('notifDismiss', n.id); NOTIFS = NOTIFS.filter(function (x) { return x.id !== n.id; }); drawPanel(); drawTop(); drawChips(); } });
      return { l: clock(n.time), s: who, sub: (who === n.title ? '' : n.title + (n.text ? ' · ' : '')) + n.text, r: acts, f: function () { nat('notifOpen', n.id); } };
    }
    var ppl = L.filter(function (n) { return n.kind === 'msg' || n.kind === 'call'; }), rest = L.filter(function (n) { return n.kind !== 'msg' && n.kind !== 'call'; });
    if (ppl.length) { rows.push({ h: 'people' }); ppl.forEach(function (n) { rows.push(one(n, n.person || n.title)); }); }
    if (rest.length) { rows.push({ h: 'everything else' }); rest.forEach(function (n) { rows.push(one(n, label(n.pkg))); }); }
    rows.push({ h: '' });
    rows.push({ s: 'clear all', cls: 'dimrow', f: function () { nat('dismissAll'); NOTIFS = []; drawPanel(); drawTop(); drawChips(); } });
    rows.push({ s: 'phone shade', cls: 'dimrow', f: function () { nat('shade'); } });
    return rows;
  });
}
function replyTo(n) {
  closePanel();
  setMode({ label: 'reply → ' + (n.person || n.title), ph: 'your reply_', kind: 'SEND', hint: function (s) { return 'send “' + s + '”'; },
    done: function (s) {
      log('cmd', 'reply ' + (n.person || n.title).toLowerCase() + ' ' + s);
      if (nat('notifReply', n.id, s)) { ok('sent'); met(n.person || n.title); } else err('could not send from here. open the app.');
    } });
}

// ---- week
function cmdWeek() {
  openPanel('WEEK', function () {
    if (!PERMS.calendar) return [{ h: 'no calendar yet' }, { s: 'allow calendar', f: function () { nat('askPerm', 'calendar'); } }];
    var rows = [], last = '', t0 = midnight();
    EVENTS.forEach(function (e) {
      var d = new Date(e.start), k = dayKey(d);
      if (k !== last) { var n = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - t0) / 864e5);
        rows.push({ h: (n <= 0 ? 'today' : n === 1 ? 'tomorrow' : DOW[d.getDay()]) + ' · ' + d.getDate() + ' ' + MON[d.getMonth()] }); last = k; }
      rows.push({ l: e.allDay ? 'all day' : clock(e.start), s: e.title || '(no title)', sub: e.loc || '', f: function () { nat('openEvent', e.id); } });
    });
    if (!rows.length) rows.push({ h: 'next 7 days' }, { note: 'nothing. suspicious.' });
    rows.push({ h: '' }, { s: 'add one: event dinner fri 7pm', cls: 'dimrow', f: function () { closePanel(); fill('event '); } });
    return rows;
  });
}

// ---- the ledger, in full
function blocks(v, n) { var f = Math.max(v > 0 ? 1 : 0, Math.round(v * n)); return new Array(f + 1).join('█') + new Array(n - f + 1).join('░'); }
function cmdLedger() {
  openPanel('LEDGER', function () {
    var t = today(), rows = [{ h: 'today' }];
    if (U.ok) {
      rows.push({ l: pad(U.unlocks), s: 'unlocks', sub: U.first ? 'first at ' + clock(U.first) : '' });
      rows.push({ l: dur(U.screenMs), s: 'screen on' });
    } else rows.push({ s: 'turn on usage access', sub: 'for unlocks, screen time and where the day went', f: function () { nat('askPerm', 'usage'); } });
    rows.push({ l: pad(t.launches), s: 'opened from here' }, { l: pad(t.returns), s: 'returns home' }, { l: pad(people()), s: 'people' }, { l: '00', s: 'judgment' });
    if (U.ok && U.apps && U.apps.length) {
      rows.push({ h: 'where it went' });
      var max = U.apps[0].ms || 1;
      U.apps.slice(0, 8).forEach(function (a) { rows.push({ l: dur(a.ms), s: label(a.pkg), sub: blocks(a.ms / max, 18) + '  ' + a.n + '×', bar: 1, cls: 'tight' }); });
    }
    var keys = Object.keys(D.days).sort().slice(-7), bars = '▁▂▃▄▅▆▇█';
    if (keys.length > 1) {
      var vals = keys.map(function (k) { return D.days[k].screenMs || D.days[k].launches || 0; }), mx = Math.max.apply(null, vals) || 1;
      rows.push({ h: 'last ' + keys.length + ' days' });
      rows.push({ pre: [vals.map(function (v) { return bars.charAt(Math.min(7, Math.floor(v / mx * 7.99))) + ' '; }).join(' ') + '\n' + keys.map(function (k) { return DOW[new Date(k + 'T12:00').getDay()].charAt(0) + ' '; }).join(' ')] });
    }
    rows.push({ h: '' }, { s: 'export today as text', cls: 'dimrow', f: function () { run('export'); } },
      { s: (D.opts.sessions ? 'hide' : 'show') + ' app sessions on home', cls: 'dimrow', f: function () { D.opts.sessions = !D.opts.sessions; save(); drawPanel(); } },
      { note: 'kept on this phone only. nothing leaves it.' });
    return rows;
  });
}

// ---- notes, reminders, history, themes, setup, help
function cmdNotes() {
  openPanel('NOTES', function () {
    var rows = [{ h: D.notes.length + ' notes · tap to copy' }];
    D.notes.slice().reverse().forEach(function (n) {
      rows.push({ l: clock(n.t), s: n.s, r: [{ t: '×', f: function () { D.notes.splice(D.notes.indexOf(n), 1); save(); drawPanel(); } }], f: function () { nat('copy', n.s); closePanel(); say('copied'); } });
    });
    rows.push({ s: 'new: note buy tile spacers', cls: 'dimrow', f: function () { closePanel(); fill('note '); } });
    return rows;
  });
}
function cmdReminders() {
  openPanel('REMINDERS', function () {
    var rows = [{ h: D.reminders.length + ' pending' }];
    D.reminders.slice().sort(function (a, b) { return a.at - b.at; }).forEach(function (r) {
      var d = new Date(r.at);
      rows.push({ l: clock(r.at), s: r.s, sub: dayKey(d) === dayKey() ? '' : DOW[d.getDay()] + ' ' + d.getDate() + ' ' + MON[d.getMonth()],
        r: [{ t: '×', f: function () { nat('cancelRemind', r.id); D.reminders.splice(D.reminders.indexOf(r), 1); save(); drawPanel(); } }] });
    });
    rows.push({ s: 'new: remind 20m call the inspector', cls: 'dimrow', f: function () { closePanel(); fill('remind '); } });
    return rows;
  });
}
function cmdThemes() {
  openPanel('THEME', function () {
    var rows = [{ h: 'top colour' }];
    ['auto'].concat(Object.keys(THEMES)).forEach(function (n) {
      rows.push({ s: n, sub: n === 'auto' ? 'follows the hour: rose, ice, ember, dusk, mono' : n === 'void' ? 'all black, for the dark' : '', cls: D.theme === n ? 'on' : '',
        f: function () { D.theme = n; save(); applyTheme(); drawPanel(); } });
    });
    rows.push({ h: 'texture' },
      { s: 'grain', cls: D.opts.grain ? 'on' : '', f: function () { D.opts.grain = !D.opts.grain; save(); applyLooks(); drawPanel(); } },
      { s: 'scanlines', cls: D.opts.crt ? 'on' : '', f: function () { D.opts.crt = !D.opts.crt; save(); applyLooks(); drawPanel(); } },
      { s: '24-hour clock', cls: D.opts.h24 ? 'on' : '', f: function () { D.opts.h24 = !D.opts.h24; save(); lastMin = ''; tick(); drawPanel(); } });
    return rows;
  });
}
function cmdSetup() {
  openPanel('SETUP', function () {
    PERMS = nat('perms') || {};
    function p(key, name, why) { return { l: PERMS[key] ? 'on' : 'off', s: name, sub: why, cls: PERMS[key] ? 'dimrow' : '', f: function () { nat('askPerm', key === 'isHome' ? 'home' : key); } }; }
    var dev = nat('device') || {}, up = nat('updateInfo') || {};
    return [{ h: 'what SHELL may do' },
      p('isHome', 'home app', 'what the home button opens'),
      p('notif', 'notification access', 'the waiting list, replies, now playing'),
      p('usage', 'usage access', 'unlocks, screen time, where the day went'),
      p('contacts', 'contacts', 'call and text starred people by name'),
      p('calendar', 'calendar', 'next event, the week'),
      p('phone', 'phone', 'call without stopping at the dialer'),
      p('dnd', 'do not disturb', 'dnd on / off'),
      p('alarms', 'exact alarms', 'reminders that fire on time'),
      { h: 'updates' },
      { s: 'check for a newer page', sub: up.pageSha ? 'showing ' + up.pageSha : 'showing the built-in page', f: function () { run('update'); } },
      { s: 'check for a newer app', sub: 'installed: ' + (up.app || nat('version') || '?'), f: function () { run('update app'); } },
      { h: 'this phone' },
      { note: (dev.model || '') + (dev.android ? ' · android ' + dev.android : '') + (dev.total ? '\n' + Math.round(dev.free / 1e9) + ' GB free of ' + Math.round(dev.total / 1e9) : '') }];
  });
}
function cmdHistory() {
  openPanel('HISTORY', function () {
    var rows = [{ h: 'tap to bring one back' }];
    D.hist.slice().reverse().forEach(function (h) { rows.push({ s: '> ' + h, f: function () { closePanel(); fill(h); } }); });
    return rows;
  });
}

// ------------------------------------------------------------------ time parsing
function parseWhen(str) {
  var s = ' ' + str.toLowerCase().replace(/\s+/g, ' ') + ' ', m, d = new Date(), dayset = false;
  function rest() { return s.replace(/^\s*(me\s+)?(to\s+|that\s+)?/, '').replace(/\s+(at|on|in)\s*$/, '').trim(); }
  m = s.match(/\s(?:in\s+)?(\d+(?:\.\d+)?)\s*(seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d)\s/);
  if (m) { s = s.replace(m[0], ' '); return { at: Date.now() + parseFloat(m[1]) * { s: 1e3, m: 6e4, h: 36e5, d: 864e5 }[m[2].charAt(0)], rest: rest() }; }
  m = s.match(/\s(?:on\s+)?(tomorrow|tmrw|today|tonight|sun|mon|tue|wed|thu|fri|sat)[a-z]*\s/);
  var tonight = false;
  if (m) {
    s = s.replace(m[0], ' '); dayset = true;
    if (m[1] === 'tomorrow' || m[1] === 'tmrw') d.setDate(d.getDate() + 1);
    else if (m[1] === 'tonight') tonight = true;
    else if (m[1] !== 'today') { var want = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].indexOf(m[1]), add = (want - d.getDay() + 7) % 7 || 7; d.setDate(d.getDate() + add); }
  }
  m = s.match(/\s(at\s+)?(\d{1,2})(?::(\d\d))?\s*(am|pm|a|p)?\s/);
  if (m && !(m[1] || m[3] || m[4] || dayset)) m = null;
  if (m) {
    s = s.replace(m[0], ' ');
    var h = +m[2], mi = +(m[3] || 0), ap = (m[4] || '').charAt(0);
    if (h > 23 || mi > 59) return null;
    if (ap === 'p' && h < 12) h += 12; if (ap === 'a' && h === 12) h = 0;
    d.setHours(h, mi, 0, 0);
    if (!ap && h < 12 && (tonight || (d.getTime() <= Date.now() && !dayset))) d.setHours(h + 12);
    if (d.getTime() <= Date.now() && !dayset) d.setDate(d.getDate() + 1);
    return { at: d.getTime(), rest: rest() };
  }
  if (dayset) { d.setHours(tonight ? 20 : 9, 0, 0, 0); if (d.getTime() <= Date.now()) return null; return { at: d.getTime(), rest: rest() }; }
  return null;
}
function whenText(at) {
  var d = new Date(at), k = dayKey(d), tm = new Date(); tm.setDate(tm.getDate() + 1);
  return (k === dayKey() ? '' : k === dayKey(tm) ? 'tomorrow ' : DOW[d.getDay()].toLowerCase() + ' ') + clock(at);
}

// ------------------------------------------------------------------ finding things
function score(name, q) {
  name = name.toLowerCase();
  if (name === q) return 100; if (name.indexOf(q) === 0) return 80;
  var words = name.split(/[\s\-_.]+/);
  for (var i = 1; i < words.length; i++) if (words[i].indexOf(q) === 0) return 60;
  if (name.indexOf(q) > 0) return 40;
  if (q.length > 1) { var initials = words.map(function (w) { return w.charAt(0); }).join(''); if (initials.indexOf(q) === 0) return 50; }
  var j = 0; for (var c = 0; c < name.length && j < q.length; c++) if (name.charAt(c) === q.charAt(j)) j++;
  return j === q.length && q.length > 2 ? 15 : 0;
}
function findApps(q, withHidden) {
  q = q.toLowerCase().trim(); if (!q) return [];
  return APPS.map(function (a) { var s = score(a.label, q); return { a: a, s: s ? s + Math.min(D.counts[a.key] || 0, 12) : 0 }; })
    .filter(function (x) { return x.s && (withHidden || visible(x.a) || x.s >= 100); })
    .sort(function (x, y) { return y.s - x.s; }).map(function (x) { return x.a; });
}
function findContact(q) {
  q = q.toLowerCase().trim(); if (!q) return null;
  var best = null, bs = 0;
  CONTACTS.forEach(function (c) { var s = score(c.name, q); if (s > bs && s >= 40) { bs = s; best = c; } });
  return best;
}
function splitContact(arg) {
  var w = arg.split(/\s+/);
  for (var n = Math.min(3, w.length); n > 0; n--) { var c = findContact(w.slice(0, n).join(' ')); if (c && score(c.name, w.slice(0, n).join(' ').toLowerCase()) >= 60) return { c: c, rest: w.slice(n).join(' ') }; }
  return null;
}
function isMath(s) { return /^[\d\s.+\-*\/()%^x]+$/.test(s) && /\d/.test(s) && /[+\-*\/%^x]/.test(s.replace(/^\s*-/, '')); }
function calc(src) {
  var s = src.replace(/\s+/g, '').replace(/x/g, '*'), i = 0;
  function pct(v) { if (s.charAt(i) === '%') { i++; return v / 100; } return v; }
  function atom() {
    var c = s.charAt(i);
    if (c === '(') { i++; var v = expr(); if (s.charAt(i) !== ')') throw 0; i++; return pct(v); }
    if (c === '-') { i++; return -atom(); }
    if (c === '+') { i++; return atom(); }
    var m = /^\d*\.?\d+/.exec(s.slice(i)); if (!m) throw 0; i += m[0].length; return pct(parseFloat(m[0]));
  }
  function pow() { var b = atom(); if (s.charAt(i) === '^') { i++; return Math.pow(b, pow()); } return b; }
  function term() { var v = pow(); for (;;) { var c = s.charAt(i); if (c === '*') { i++; v *= pow(); } else if (c === '/') { i++; v /= pow(); } else return v; } }
  function expr() { var v = term(); for (;;) { var c = s.charAt(i); if (c === '+') { i++; v += term(); } else if (c === '-') { i++; v -= term(); } else return v; } }
  try { var out = expr(); if (i < s.length || !isFinite(out)) return null; return String(Math.round(out * 1e8) / 1e8); } catch (e) { return null; }
}

// ------------------------------------------------------------------ commands
var CMDS = [], BY = {};
function cmd(names, usage, group, f) { var c = { n: names[0], u: usage, g: group, f: f }; CMDS.push(c); names.forEach(function (n) { BY[n] = c; }); }
function needContacts() { if (PERMS.contacts) return false; err('contacts are off. type: setup'); return true; }

cmd(['call', 'ring', 'dial'], 'call <name or number>', 'do', function (a) {
  if (!a) return say('call who?');
  if (/^[\d\s+()\-#*]{3,}$/.test(a)) { nat('call', a.replace(/\s/g, '')); return say('calling ' + a); }
  if (needContacts()) return;
  var c = findContact(a); if (!c) return err('no starred contact “' + a + '”. star them in Contacts.');
  nat('call', c.phone); met(c.name); say('calling ' + c.name);
});
cmd(['text', 'sms', 'msg'], 'text <name> <message>', 'do', function (a) {
  if (!a) return say('text who?');
  if (needContacts()) return;
  var x = splitContact(a); if (!x) return err('no starred contact in “' + a + '”');
  nat('sms', x.c.phone, x.rest); met(x.c.name);
  say(x.rest ? 'drafted to ' + x.c.name + ': “' + x.rest + '”. you press send.' : 'texting ' + x.c.name);
});
cmd(['reply'], 'reply <name> <message>', 'do', function (a) {
  var w = (a || '').split(/\s+/), who = (w.shift() || '').toLowerCase(), msg = w.join(' ');
  var n = live().filter(function (x) { return x.canReply && (x.person || x.title).toLowerCase().indexOf(who) === 0; }).sort(function (x, y) { return y.time - x.time; })[0];
  if (!who || !n) return err(who ? 'nothing from “' + who + '” to reply to' : 'reply to who?');
  if (!msg) return replyTo(n);
  if (nat('notifReply', n.id, msg)) { ok('sent to ' + (n.person || n.title)); met(n.person || n.title); } else err('could not send from here. open the app.');
});
cmd(['remind', 'reminder'], 'remind <when> <what>  · 20m, 6pm, tomorrow 9am', 'do', function (a) {
  if (!a) return cmdReminders();
  var w = parseWhen(a); if (!w) return err('when? try: remind 20m call the inspector');
  var r = { id: 'r' + Date.now().toString(36), at: w.at, s: w.rest || 'reminder' };
  if (nat('remind', r.id, r.at, r.s) === false) return err('could not set it. type: setup, then allow exact alarms');
  D.reminders.push(r); save(); ok('will remind you ' + whenText(r.at) + ': ' + r.s);
});
cmd(['reminders'], 'reminders', 'see', cmdReminders);
cmd(['timer'], 'timer <10m> [label]', 'do', function (a) {
  var m = (a || '').match(/^(\d+(?:\.\d+)?)\s*(s|sec|m|min|h|hr)?[a-z]*\s*(.*)$/); if (!m) return err('how long? try: timer 10m pasta');
  var secs = Math.round(parseFloat(m[1]) * { s: 1, m: 60, h: 3600 }[(m[2] || 'm').charAt(0)]);
  nat('timer', secs, m[3] || 'SHELL'); ok('timer · ' + (secs < 60 ? secs + ' sec' : dur(secs * 1000)) + (m[3] ? ' · ' + m[3] : ''));
});
cmd(['alarm', 'wake'], 'alarm <6:30am> [label]', 'do', function (a) {
  var m = (a || '').match(/^(\d{1,2})(?::(\d\d))?\s*(am|pm|a|p)?\b\s*(.*)$/i); if (!m || +m[1] > 23 || +(m[2] || 0) > 59) return err('what time? try: alarm 6:30am');
  var h = +m[1], ap = (m[3] || '').charAt(0).toLowerCase(); if (ap === 'p' && h < 12) h += 12; if (ap === 'a' && h === 12) h = 0;
  nat('alarm', h, +(m[2] || 0), m[4] || 'SHELL'); var d = new Date(); d.setHours(h, +(m[2] || 0)); ok('alarm · ' + clock(d.getTime()) + (m[4] ? ' · ' + m[4] : ''));
});
cmd(['event'], 'event <title> <fri 7pm>', 'do', function (a) {
  var w = parseWhen(a || ''); if (!w || !w.rest) return err('try: event dinner fri 7pm');
  nat('newEvent', cap(w.rest), w.at, w.at + 3600000, false); say('new event · ' + cap(w.rest) + ' · ' + whenText(w.at));
});
cmd(['note'], 'note <anything>', 'do', function (a) {
  if (!a) return cmdNotes();
  D.notes.push({ t: Date.now(), s: a }); save(); ok('noted');
});
cmd(['notes'], 'notes', 'see', cmdNotes);
cmd(['go', 'map', 'maps', 'nav'], 'go <place>', 'do', function (a) { if (!a) return say('go where?'); nat('maps', a); say('maps · ' + a); });
cmd(['web', 'search', '?'], 'web <anything>', 'do', function (a) { if (!a) return say('search for what?'); nat('web', a); say('searching “' + a + '”'); });
cmd(['open'], 'open <app>', 'do', function (a) {
  var f = findApps(a || '', true); if (!f.length) return err('no app like “' + a + '”');
  launch(f[0]);
});
cmd(['photo', 'camera', 'cam', 'pic'], 'photo', 'do', function () {
  if (has('camera') && nat('camera')) return say('camera');
  var f = findApps('camera', true); if (f.length) return launch(f[0]); err('no camera app found');
});
cmd(['pay', 'venmo'], 'pay <name> <amount> [for what]', 'do', function (a) {
  var app = null; ['venmo', 'cash app', 'paypal', 'zelle', 'wallet'].some(function (n) { var f = findApps(n, true); if (f.length && score(f[0].label, n) >= 60) { app = f[0]; return true; } });
  if (!app) return err('no payment app found');
  if (a) nat('copy', a);
  nat('launch', app.key); say('opened ' + app.label + (a ? '. “' + a + '” is on your clipboard.' : '') + ' the sending is yours.');
});
cmd(['music', 'play'], 'play · pause · next · prev', 'do', function () {
  if (MEDIA) { nat('mediaCmd', 'play'); return say('playing: ' + MEDIA.title); }
  var a = APPS.filter(function (x) { return x.cat === 'audio' && visible(x); }).sort(function (x, y) { return (D.counts[y.key] || 0) - (D.counts[x.key] || 0); })[0];
  if (MOCK) { nat('mediaCmd', 'play'); return say('playing: late night, low tempo'); }
  if (a) return launch(a); err('nothing to play with');
});
cmd(['pause', 'stop'], '', 'do', function () { nat('mediaCmd', 'pause'); say('paused'); });
cmd(['next', 'skip'], '', 'do', function () { nat('mediaCmd', 'next'); say('next'); });
cmd(['prev', 'back'], '', 'do', function () { nat('mediaCmd', 'prev'); say('previous'); });
cmd(['calc', '='], 'calc 18*4.5  · or just type the sum', 'do', function (a) { var v = calc(a || ''); if (v == null) return err('that is not a sum'); nat('copy', v); ok(a.replace(/\s+/g, '') + ' = ' + v + ' · copied'); });

cmd(['apps', 'ls'], 'apps', 'see', cmdApps);
cmd(['waiting', 'inbox'], 'waiting', 'see', cmdWaiting);
cmd(['week', 'agenda', 'events'], 'week', 'see', cmdWeek);
cmd(['ledger', 'today', 'stats', 'top'], 'ledger', 'see', cmdLedger);
cmd(['cal', 'month'], 'cal', 'see', function () {
  openPanel('CAL', function () {
    var d = new Date(), y = d.getFullYear(), mo = d.getMonth(), first = new Date(y, mo, 1).getDay(), n = new Date(y, mo + 1, 0).getDate(), out = ['Su Mo Tu We Th Fr Sa\n' + new Array(first + 1).join('   ')];
    for (var i = 1; i <= n; i++) { var cell = (i < 10 ? ' ' : '') + i; if (i === d.getDate()) out.push({ b: cell }); else out.push(cell); out.push((first + i) % 7 === 0 ? '\n' : ' '); }
    return [{ h: MON[mo] + ' ' + y }, { pre: out }];
  });
});
cmd(['battery', 'batt'], 'battery', 'see', function () { BATT = nat('battery') || BATT; say((BATT.pct != null ? BATT.pct + '%' : 'unknown') + (BATT.charging ? ', charging' : '')); });
cmd(['weather', 'wx'], 'weather [set <city>]', 'see', function (a) {
  var m = (a || '').match(/^set\s+(.+)$/);
  function show(c) {
    fetch('https://api.open-meteo.com/v1/forecast?latitude=' + c.lat + '&longitude=' + c.lon + '&current=temperature_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto&forecast_days=1')
      .then(function (r) { return r.json(); }).then(function (j) {
        var w = j.current.weather_code, sky = w === 0 ? 'clear' : w < 4 ? 'some cloud' : w < 50 ? 'fog' : w < 70 ? 'rain' : w < 80 ? 'snow' : w < 95 ? 'showers' : 'storm';
        say(c.name.toLowerCase() + ' · ' + Math.round(j.current.temperature_2m) + '° ' + sky + ' · ' + Math.round(j.daily.temperature_2m_min[0]) + '–' + Math.round(j.daily.temperature_2m_max[0]) + '° · rain ' + (j.daily.precipitation_probability_max[0] || 0) + '%');
      }).catch(function () { err('no weather. offline?'); });
  }
  if (!m) return show(D.opts.city);
  fetch('https://geocoding-api.open-meteo.com/v1/search?count=1&name=' + encodeURIComponent(m[1])).then(function (r) { return r.json(); }).then(function (j) {
    var g = j.results && j.results[0]; if (!g) return err('no place called “' + m[1] + '”');
    D.opts.city = { name: g.name, lat: g.latitude, lon: g.longitude }; save(); show(D.opts.city);
  }).catch(function () { err('could not look that up. offline?'); });
});
cmd(['history', 'hist'], 'history', 'see', cmdHistory);
cmd(['help', 'man', 'commands'], 'help', 'see', function (a) {
  openPanel('HELP', function () {
    var rows = [{ note: 'type an app, a sum, or a thing to do. enter runs the bottom line.\nswipe up: apps · swipe down: waiting · tap the clock: ledger' }];
    var G = { do: 'do things', see: 'look at things', phone: 'the phone', shape: 'make it yours' };
    if (a === 'all' || a === 'fun') G.fun = 'no reason';
    Object.keys(G).forEach(function (g) {
      rows.push({ h: G[g] });
      CMDS.forEach(function (c) { if (c.g === g && c.u) rows.push({ s: c.u, cls: 'tight', f: function () { closePanel(); fill(c.n + ' '); } }); });
    });
    if (!G.fun) rows.push({ h: '' }, { note: 'there is more than this. it is not listed.' });
    return rows;
  });
});

cmd(['flash', 'torch', 'light'], 'flash [off]', 'phone', function (a) { var on = a !== 'off'; if (nat('torch', on) === false) return err('no flashlight here'); say('flashlight ' + (on ? 'on. flash off to end.' : 'off')); });
cmd(['dnd', 'quiet'], 'dnd [off]', 'phone', function (a) { var on = a !== 'off'; if (nat('setDnd', on) === false) { nat('askPerm', 'dnd'); return err('allow do-not-disturb access first'); } say('do not disturb ' + (on ? 'on' : 'off')); });
cmd(['settings'], 'settings [wifi bt display sound battery apps]', 'phone', function (a) { nat('settings', a || ''); say('settings' + (a ? ' · ' + a : '')); });
cmd(['wifi'], '', 'phone', function () { nat('settings', 'wifi'); say('settings · wifi'); });
cmd(['bt', 'bluetooth'], '', 'phone', function () { nat('settings', 'bluetooth'); say('settings · bluetooth'); });
cmd(['shade', 'tray'], 'shade', 'phone', function () { nat('shade'); });
cmd(['setup', 'perms', 'permissions'], 'setup', 'phone', cmdSetup);
cmd(['update', 'upgrade'], 'update [app]', 'phone', function (a) { nat('checkUpdate', a === 'app' ? 'app' : 'page'); say('checking for a newer ' + (a === 'app' ? 'app' : 'page')); });
cmd(['info'], 'info <app>', 'phone', function (a) { var f = findApps(a || '', true); if (!f.length) return err('no app like “' + a + '”'); appSheet(f[0]); });
cmd(['uninstall'], 'uninstall <app>', 'phone', function (a) {
  var f = findApps(a || '', true); if (!f.length) return err('no app like “' + a + '”');
  confirm('uninstall ' + f[0].label + '?', function () { nat('uninstall', f[0].pkg); say('handed ' + f[0].label + ' to android. it will ask once more.'); });
});

cmd(['theme', 'color', 'colour'], 'theme [auto ember mono dusk moss ice blood gold rose void]', 'shape', function (a) {
  if (!a) return cmdThemes();
  if (a !== 'auto' && !THEMES[a]) return err('no theme “' + a + '”');
  D.theme = a; save(); applyTheme(); ok('theme · ' + a);
});
cmd(['chip', 'chips', 'pin'], 'chip add <thing> · chip rm <thing> · chip reset', 'shape', function (a) {
  var m = (a || '').match(/^(add|rm|remove|del|reset)?\s*(.*)$/), w = m[2].toLowerCase();
  if (m[1] === 'reset') D.chips = ['remind', 'go', 'text', 'photo'];
  else if (!w) return say('chips: ' + D.chips.join(' · '));
  else if (m[1] && m[1] !== 'add') { var i = D.chips.indexOf(w); if (i < 0) return err('no chip “' + w + '”'); D.chips.splice(i, 1); }
  else if (D.chips.indexOf(w) < 0) D.chips.push(w);
  save(); drawChips(); ok('chips: ' + D.chips.join(' · '));
});
cmd(['alias'], 'alias <short> = <anything>  · alias rm <short>', 'shape', function (a) {
  var m = (a || '').match(/^rm\s+(\S+)$/);
  if (m) { delete D.alias[m[1]]; save(); return ok('forgot ' + m[1]); }
  m = (a || '').match(/^(\S+)\s*=\s*(.+)$/);
  if (!m) { var k = Object.keys(D.alias); return say(k.length ? k.map(function (x) { return x + ' = ' + D.alias[x]; }).join(' · ') : 'none yet. try: alias sp = spotify'); }
  D.alias[m[1].toLowerCase()] = m[2]; save(); ok(m[1] + ' now means: ' + m[2]);
});
cmd(['hide'], 'hide <app> · unhide <app>', 'shape', function (a) {
  var f = findApps(a || ''); if (!f.length) return err('no app like “' + a + '”');
  if (visible(f[0])) D.hidden.push(f[0].key); save(); ok('hid ' + f[0].label + '. apps all shows it.');
});
cmd(['unhide', 'show'], '', 'shape', function (a) {
  var f = findApps(a || '', true).filter(function (x) { return !visible(x); }); if (!f.length) return err('nothing hidden like “' + a + '”');
  D.hidden.splice(D.hidden.indexOf(f[0].key), 1); save(); ok(f[0].label + ' is back');
});
cmd(['clock'], 'clock 12 · clock 24', 'shape', function (a) { D.opts.h24 = a !== '12'; save(); lastMin = ''; tick(); drawLedger(); ok((D.opts.h24 ? '24' : '12') + '-hour clock'); });
cmd(['crt', 'scanlines'], 'crt', 'shape', function () { D.opts.crt = !D.opts.crt; save(); applyLooks(); ok('scanlines ' + (D.opts.crt ? 'on' : 'off')); });
cmd(['grain'], 'grain', 'shape', function () { D.opts.grain = !D.opts.grain; save(); applyLooks(); ok('grain ' + (D.opts.grain ? 'on' : 'off')); });
cmd(['export', 'share'], 'export', 'shape', function () {
  var txt = 'SHELL ledger · ' + dayKey() + '\n\n' + ledgerRows().map(function (r) { return (r.k === 'cmd' || r.k === 'app' || r.k === 'sys' ? clock(r.t) : '     ') + '  ' + (r.k === 'cmd' ? '> ' : r.k === 'out' ? '→ ' : r.k === 'ok' ? '✓ ' : '') + r.s; }).join('\n') + '\n';
  if (nat('shareFile', 'ledger-' + dayKey() + '.txt', 'text/plain', txt)) say('today, as a text file'); else err('could not share');
});
cmd(['clear', 'cls'], 'clear', 'shape', function () { today().log = []; save(); drawLedger(); });
cmd(['reset'], 'reset', 'shape', function () { confirm('erase everything SHELL has saved?', function () { try { localStorage.removeItem(KEY); } catch (e) {} location.reload(); }); });

// ---- no reason
cmd(['focus', 'pomodoro'], 'focus <25> · focus off', 'fun', function (a) {
  if (a === 'off' || a === 'stop') { if (!D.focus) return say('not focusing'); nat('cancelRemind', 'focus'); D.focus = null; save(); lastMin = ''; tick(); return say('focus ended early. no judgment.'); }
  var mins = Math.max(1, Math.min(180, parseInt(a, 10) || 25));
  D.focus = { end: Date.now() + mins * 60000, mins: mins }; save();
  nat('remind', 'focus', D.focus.end, 'Focus done · ' + mins + ' min'); ok('focus · ' + mins + ' min · until ' + clock(D.focus.end)); tick(); drawTop();
});
cmd(['breathe', 'breath'], 'breathe', 'fun', function () { breathe(); });
cmd(['roll', 'dice'], 'roll [2d6]', 'fun', function (a) {
  var m = (a || '1d6').match(/^(\d*)d?(\d*)$/), n = Math.min(20, +(m && m[1]) || 1), sides = Math.min(1000, +(m && m[2]) || 6), r = [], sum = 0;
  for (var i = 0; i < n; i++) { var v = 1 + Math.floor(Math.random() * sides); r.push(v); sum += v; }
  say(n + 'd' + sides + ' · ' + r.join(' + ') + (n > 1 ? ' = ' + sum : ''));
});
cmd(['flip', 'coin'], 'flip', 'fun', function () { say(Math.random() < .5 ? 'heads' : 'tails'); });
cmd(['8ball', 'ask'], '8ball <question>', 'fun', function () { say(pick(['yes.', 'no.', 'obviously.', 'not like this.', 'ask again after lunch.', 'the ledger says no.', 'it was always yes.', 'unclear. do it anyway.', 'sleep on it.', 'you already know.'])); });
cmd(['fortune', 'wisdom'], 'fortune', 'fun', function () {
  say(pick(['the grid was never the point.', 'forty-one unlocks is a number, not a verdict.', 'whatever you came here to open, you have already forgotten.', 'a home screen is a door. walk through or close it.',
    'nobody ever regretted a shorter feed.', 'the best app is the one you close.', 'text them back.', 'measure twice, pour once.', 'permits are just patience with a stamp.', 'today is mostly unwritten. see below.',
    'you can’t scroll to the bottom. it was tried.', 'the punch list ends. that is its beauty.']));
});
cmd(['matrix', 'rain'], 'matrix', 'fun', function () { matrix(); });
cmd(['snake'], 'snake', 'fun', function () { snake(); });
cmd(['judgment', 'judge', 'judgement'], '', 'fun', function () { say('00. it stays 00.'); });
cmd(['based'], '', 'fun', function () { ok('confirmed.'); });
cmd(['cope'], '', 'fun', function () { say(U.ok ? dur(U.screenMs) + ' of screen today. coping noted.' : 'noted.'); });
cmd(['touch'], '', 'fun', function (a) { say(a === 'grass' ? 'grass is not installed on this device. go outside.' : 'touch what?'); });
cmd(['sudo'], '', 'fun', function () { say('you are already root here. it’s your phone.'); });
cmd(['whoami'], '', 'fun', function () { var p = nat('profile') || {}; say((p.name || 'someone with a phone') + '. ' + pad(today().returns) + ' returns today.'); });
cmd(['uptime'], '', 'fun', function () { say(U.ok && U.first ? 'up since ' + clock(U.first) + ' · ' + dur(Date.now() - U.first) : 'awake for a while'); });
cmd(['date'], '', 'fun', function () { say(new Date().toString().toLowerCase()); });
cmd(['echo'], '', 'fun', function (a) { say(a || ''); });
cmd(['ping'], '', 'fun', function () { say('pong'); });
cmd(['exit', 'quit', 'logout'], '', 'fun', function () { say('there is no exit. this is the home screen.'); });
cmd(['vim', 'vi', 'emacs', 'nano'], '', 'fun', function () { say('you are not trapped. the back button works.'); });
cmd(['rm'], '', 'fun', function (a) { say(/-rf/.test(a || '') ? 'deleting everything… no. obviously not.' : 'rm what? (nothing will happen)'); });
cmd(['hello', 'hi', 'hey', 'hola'], '', 'fun', function () { say(pick(['hello.', 'hola.', 'yes?', 'still here.'])); });
cmd(['thanks', 'thx', 'gracias'], '', 'fun', function () { say('de nada.'); });
cmd(['coffee'], '', 'fun', function () { say('418. i’m a home screen.'); });

// ------------------------------------------------------------------ running what was typed
function expand(s) { var w = s.split(/\s+/), a = D.alias[w[0].toLowerCase()]; return a ? (a + ' ' + w.slice(1).join(' ')).trim() : s; }
function parse(s) {
  s = expand(s.trim()).replace(/^[>.\/]\s*/, '');
  var m = s.match(/^(\S+)\s*([\s\S]*)$/); if (!m) return null;
  var c = BY[m[1].toLowerCase()]; return c ? { c: c, arg: m[2].trim() } : null;
}
function suggest(q) {
  var s = q.trim(), out = []; if (!s) return out;
  if (S.mode) return [{ label: S.mode.hint ? S.mode.hint(s) : s, kind: S.mode.kind || 'OK', run: function () { var m = S.mode; setMode(null); clearQ(); m.done(s); }, raw: true }];
  var ex = expand(s), low = ex.toLowerCase(), p = parse(s), one = !/\s/.test(low);
  if (isMath(low)) { var v = calc(low); if (v != null) out.push({ label: low.replace(/\s+/g, '') + ' = ' + v, kind: 'SUM', run: function () { nat('copy', v); ok(low.replace(/\s+/g, '') + ' = ' + v + ' · copied'); } }); }
  var found = findApps(low).slice(0, 4), exact = one && found.length && found[0].label.toLowerCase() === low;
  function addApps() { found.forEach(function (a) { out.push({ label: a.label, kind: 'APP', run: function () { launch(a); } }); }); }
  if (exact) addApps();
  if (p) out.push({ label: p.arg || !p.c.u ? ex : p.c.u, kind: 'DO', run: function () { p.c.f(p.arg); } });
  if (!exact) addApps();
  if (one && low.length > 1) CMDS.forEach(function (c) { if (c.u && c.g !== 'fun' && c.n.indexOf(low) === 0 && c.n !== low && out.length < 7) out.push({ label: c.u, kind: 'CMD', fill: c.n + ' ' }); });
  if (low.length > 1 && !p) { var c = findContact(low); if (c) out.push({ label: 'call ' + c.name, kind: 'CALL', run: function () { BY.call.f(c.name); } }); }
  if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(low)) out.push({ label: 'open ' + low, kind: 'URL', run: function () { nat('url', 'https://' + low); say(low); } });
  out.push({ label: 'search “' + s + '”', kind: 'WEB', run: function () { nat('web', s); say('searching “' + s + '”'); } });
  return out.slice(0, 6);
}
function run(text) {
  text = (text || '').trim(); if (!text) return;
  var list = suggest(text), first = list[0];
  hap();
  if (first && first.raw) return first.run();
  if (first && first.fill) return fill(first.fill);
  D.hist = D.hist.filter(function (h) { return h !== text; }); D.hist.push(text); if (D.hist.length > 60) D.hist.shift(); S.histAt = -1;
  closePanel(); clearQ();
  log('cmd', text, text);
  if (first) first.run();
}
function confirm(q, yes) {
  say(q + ' y / n');
  setMode({ label: 'confirm', ph: 'y / n_', kind: 'ANSWER', done: function (s) { if (/^y/i.test(s)) yes(); else say('left alone.'); } });
}
function setMode(m) {
  S.mode = m;
  $('plabel').textContent = m ? m.label : 'Next entry';
  $('q').placeholder = m ? m.ph : 'say anything_';
  if (m) { $('q').focus(); }
}
function fill(s, caret) { var q = $('q'); q.value = s; q.focus(); var n = caret == null ? s.length : caret; try { q.setSelectionRange(n, n); } catch (e) {} drawSug(); }
function clearQ() { var q = $('q'); q.value = ''; drawSug(); if (!S.mode) q.blur(); }
function drawSug() {
  var box = $('sug'), q = $('q').value; box.textContent = '';
  S.sug = suggest(q);
  S.sug.forEach(function (x, i) {
    var b = el('button'); b.appendChild(el('span', '', x.label)); b.appendChild(el('span', 'k', (i ? '' : '⏎ ') + x.kind));
    b.addEventListener('mousedown', function (e) { e.preventDefault(); });
    b.addEventListener('click', function () {
      if (x.fill) return fill(x.fill);
      if (x.raw) return x.run();
      hap(); var typed = x.kind === 'APP' ? x.label.toLowerCase() : $('q').value.trim();
      closePanel(); clearQ(); log('cmd', typed, typed); x.run();
    });
    box.appendChild(b);
  });
  box.classList.toggle('on', S.sug.length > 0);
  dockSize();
}
function drawChips() {
  var box = $('chips'), w = live().length; box.textContent = '';
  function chip(t, f, hot) { var b = el('button', 'chip' + (hot ? ' hot' : ''), t); b.addEventListener('mousedown', function (e) { e.preventDefault(); }); tapHold(b, f.tap, f.hold); box.appendChild(b); }
  if (w) chip(pad(w) + ' waiting', { tap: cmdWaiting }, true);
  D.chips.forEach(function (c) {
    chip(c, { tap: function () {
      if (c === 'photo') return run('photo');
      if (BY[c] && BY[c].u && /</.test(BY[c].u)) return fill(c + ' ');
      run(c);
    }, hold: function () { fill('chip rm ' + c); } });
  });
  dockSize();
}
function dockSize() {
  $('app').style.setProperty('--dockh', $('dock').offsetHeight + 'px');
  document.body.classList.toggle('tight', !S.panel && $('ledger').clientHeight < 150);   // keyboard up and no room: no half-rows over the grey
}

// ------------------------------------------------------------------ toys
function openOv(build, onClose) { var o = $('ov'), stage = el('div', 'stage'); o.textContent = ''; o.appendChild(stage); o.classList.add('on'); S.ov = { close: onClose }; $('q').blur(); build(stage); }
function closeOv() { if (!S.ov) return false; var c = S.ov.close; S.ov = null; var o = $('ov'); o.classList.remove('on'); o.textContent = ''; if (c) c(); return true; }
function matrix() {
  var raf = 0;
  openOv(function (o) {
    var c = el('canvas'); o.appendChild(c); o.appendChild(el('div', 'hint', 'tap to leave'));
    var w = c.width = o.clientWidth, h = c.height = o.clientHeight, x = c.getContext('2d'), size = 15, cols = Math.ceil(w / size), y = [], col = getComputedStyle(document.documentElement).getPropertyValue('--a').trim();
    if (col === '#0a0a0a') col = '#c8c6c1';
    for (var i = 0; i < cols; i++) y[i] = Math.random() * -40;
    var chars = '01<>_/\\|=+-:;[]{}SHELL', last = 0;
    (function draw(t) {
      raf = requestAnimationFrame(draw); if (t - last < 55) return; last = t;
      x.fillStyle = 'rgba(0,0,0,.09)'; x.fillRect(0, 0, w, h); x.font = size + 'px JBM, monospace';
      for (var i = 0; i < cols; i++) {
        x.fillStyle = Math.random() < .06 ? '#f5f3ef' : col; x.fillText(chars.charAt(Math.floor(Math.random() * chars.length)), i * size, y[i] * size);
        if (y[i] * size > h && Math.random() > .975) y[i] = 0; y[i]++;
      }
    })(0);
    o.onclick = closeOv;
  }, function () { cancelAnimationFrame(raf); });
}
function breathe() {
  var tm = 0;
  openOv(function (o) {
    var big = el('div', 'big', '4'), capn = el('div', 'cap', 'in'); o.appendChild(big); o.appendChild(capn); o.appendChild(el('div', 'hint', 'in 4 · hold 7 · out 8 · tap to leave'));
    var seq = [['in', 4], ['hold', 7], ['out', 8]], i = 0, n = 4, rounds = 0;
    tm = setInterval(function () {
      n--; if (n <= 0) { i = (i + 1) % 3; if (i === 0 && ++rounds >= 4) { closeOv(); ok('breathed · 4 rounds'); return; } n = seq[i][1]; capn.textContent = seq[i][0]; hap('tick'); }
      big.textContent = n;
    }, 1000);
    o.onclick = closeOv;
  }, function () { clearInterval(tm); });
}
function snake() {
  var tm = 0, score = 0;
  openOv(function (o) {
    var W = 17, H = 22, pre = el('pre'), capn = el('div', 'cap', '0'); o.appendChild(pre); o.appendChild(capn); o.appendChild(el('div', 'hint', 'swipe to steer · back to leave'));
    var body, dir, next, food, dead;
    function drop() { do { food = [Math.floor(Math.random() * W), Math.floor(Math.random() * H)]; } while (body.some(function (b) { return b[0] === food[0] && b[1] === food[1]; })); }
    function reset() { body = [[8, 11], [7, 11], [6, 11]]; dir = next = [1, 0]; score = 0; dead = false; drop(); }
    function draw() {
      var g = [];
      for (var y = 0; y < H; y++) { var r = ''; for (var x = 0; x < W; x++) {
        var isB = body.some(function (b) { return b[0] === x && b[1] === y; });
        r += isB ? '██' : food[0] === x && food[1] === y ? '◆ ' : '· ';
      } g.push(r); }
      pre.textContent = g.join('\n'); capn.textContent = dead ? 'ate itself at ' + score + ' · tap to go again' : String(score);
    }
    function step() {
      if (dead) return; dir = next;
      var h = [(body[0][0] + dir[0] + W) % W, (body[0][1] + dir[1] + H) % H];
      if (body.some(function (b) { return b[0] === h[0] && b[1] === h[1]; })) { dead = true; hap('long'); if (score > D.best) { D.best = score; save(); } return draw(); }
      body.unshift(h);
      if (h[0] === food[0] && h[1] === food[1]) { score++; hap('tick'); drop(); } else body.pop();
      draw();
    }
    function turn(d) { if (d[0] !== -dir[0] || d[1] !== -dir[1]) next = d; }
    var sx = 0, sy = 0;
    o.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
    o.addEventListener('touchmove', function (e) {
      var dx = e.touches[0].clientX - sx, dy = e.touches[0].clientY - sy; if (Math.abs(dx) + Math.abs(dy) < 24) return;
      turn(Math.abs(dx) > Math.abs(dy) ? [dx > 0 ? 1 : -1, 0] : [0, dy > 0 ? 1 : -1]); sx = e.touches[0].clientX; sy = e.touches[0].clientY;
    }, { passive: true });
    S.ov.key = function (k) { var d = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[k]; if (d) turn(d); };
    o.onclick = function () { if (dead) { reset(); draw(); } };
    reset(); draw(); tm = setInterval(step, 150);
  }, function () { clearInterval(tm); if (score) say('snake · ' + score + ' · best ' + Math.max(D.best, score)); });
}

// ------------------------------------------------------------------ input, gestures, native events
function goHome() { closeOv(); setMode(null); closePanel(); $('q').value = ''; $('q').blur(); drawSug(); document.body.classList.remove('compact', 'typing'); drawTop(); var L = $('ledger'); L.scrollTop = L.scrollHeight; }
function back() {
  if (closeOv()) return;
  if (S.mode) { setMode(null); clearQ(); return say('never mind.'); }
  if ($('q').value) { $('q').value = ''; drawSug(); return; }
  if (document.activeElement === $('q')) { $('q').blur(); return; }
  closePanel();
}
function wire() {
  var q = $('q');
  q.addEventListener('input', drawSug);
  q.addEventListener('focus', function () { document.body.classList.add('typing', 'compact'); drawTop(); drawSug(); setTimeout(function () { var L = $('ledger'); L.scrollTop = L.scrollHeight; }, 60); });
  q.addEventListener('blur', function () { setTimeout(function () { if (document.activeElement === q) return; document.body.classList.remove('typing'); if (!S.panel) document.body.classList.remove('compact'); drawTop(); drawSug(); var L = $('ledger'); L.scrollTop = L.scrollHeight; }, 140); });
  q.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); run(q.value); }
    else if (e.key === 'Escape') back();
    else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      if (!D.hist.length) return; e.preventDefault();
      S.histAt = S.histAt < 0 ? D.hist.length : S.histAt; S.histAt = Math.max(0, Math.min(D.hist.length, S.histAt + (e.key === 'ArrowUp' ? -1 : 1)));
      fill(D.hist[S.histAt] || '');
    }
  });
  $('go').addEventListener('mousedown', function (e) { e.preventDefault(); });
  $('go').addEventListener('click', function () { run(q.value); });
  document.addEventListener('keydown', function (e) {
    if (S.ov) { if (e.key === 'Escape') closeOv(); else if (S.ov.key) S.ov.key(e.key); return; }
    if (e.target === q || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Escape') return back();
    if (e.key.length === 1) q.focus();
  });
  $('title').addEventListener('click', function () { hap(); if (S.panel) closePanel(); else BY.help.f(''); });
  tapHold($('clock'), cmdLedger, function () {
    var names = Object.keys(THEMES), i = names.indexOf(themeNow()); D.theme = names[(i + 1) % names.length]; save(); applyTheme(); say('theme · ' + D.theme);
  });
  // swipe up: apps. swipe down: waiting (or close a panel). Only when the list under the finger is at its end.
  var sx = 0, sy = 0, st = 0, tgt = null;
  ['top', 'ledger', 'panel'].forEach(function (id) {
    var n = $(id);
    n.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; st = Date.now(); tgt = n; }, { passive: true });
    n.addEventListener('touchend', function (e) {
      if (tgt !== n) return; tgt = null;
      var t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
      if (Math.abs(dy) < 70 || Math.abs(dy) < Math.abs(dx) * 1.6 || Date.now() - st > 600) return;
      var sc = id === 'top' ? null : n, atTop = !sc || sc.scrollTop <= 0, atEnd = !sc || sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 2;
      if (S.panel) { if (dy > 0 && atTop) { hap(); closePanel(); } return; }
      if (dy < 0 && atEnd) { hap(); cmdApps(); } else if (dy > 0 && atTop) { hap(); cmdWaiting(); }
    }, { passive: true });
  });
  window.addEventListener('resize', function () { dockSize(); var L = $('ledger'); L.scrollTop = L.scrollHeight; });
  document.addEventListener('contextmenu', function (e) { if (e.target !== q) e.preventDefault(); });
}
function refresh() { drawTop(); drawChips(); drawLedger(); if (S.panel) drawPanel(); }
var lastResume = 0;
window.SHELL = {
  onNative: function (type, data) {
    if (typeof data === 'string') { try { data = JSON.parse(data); } catch (e) {} }
    switch (type) {
      case 'back': back(); break;
      case 'home': goHome(); break;
      case 'resume':
        if (Date.now() - lastResume > 1500) { today().returns++; save(); } lastResume = Date.now();
        loadAll(); lastMin = ''; tick(); refresh(); break;
      case 'perms': loadAll(); refresh(); break;
      case 'apps': loadApps(); refresh(); break;
      case 'battery': if (data && typeof data === 'object') BATT = data; drawTop(); break;
      case 'media': MEDIA = data && data.title ? data : null; drawTop(); break;
      case 'notifs': NOTIFS = nat('notifs') || []; drawTop(); drawChips(); if (S.panel && S.panel.name === 'WAITING') drawPanel(); break;
      case 'events': EVENTS = nat('events', 7) || []; drawTop(); break;
      case 'remind':
        if (data === 'focus') break;
        var i = -1; D.reminders.forEach(function (r, n) { if (r.id === data) i = n; });
        if (i >= 0) { var r = D.reminders.splice(i, 1)[0]; save(); log('sys', 'reminder · ' + r.s); hap('long'); }
        break;
      case 'update':
        if (!data || typeof data !== 'object') break;
        var what = data.kind === 'app' ? 'app' : 'page';
        if (data.state === 'current') say(what + ' is up to date');
        else if (data.state === 'ready') { ok('new page ' + (data.sha || '') + '. loading.'); setTimeout(function () { nat('applyPage'); }, 700); }
        else if (data.state === 'available') { say('app ' + data.version + ' is out. installing.'); nat('installUpdate'); }
        else if (data.state === 'needs-permission') err('allow SHELL to install apps, then: update app');
        else if (data.state === 'rolled-back') err('the new page did not start. back on the built-in one.');
        else if (data.state === 'error') err(what + ' update: ' + (data.msg || 'failed'));
        else if (data.state === 'done') ok('app updated');
        break;
    }
  },
  bars: function () { var t = THEMES[themeNow()]; return [rgb(t.a), rgb(t.g || '#aaaaa6')]; },
  run: run
};

// ------------------------------------------------------------------ start
function seed() {
  var t = today(); if (t.log.length || Object.keys(D.days).length > 1) return;
  var now = Date.now(), M = 60000;
  if (MOCK) {
    [[52, 'cmd', 'call dad', 'call dad'], [52, 'out', 'calling Dad'], [33, 'cmd', 'text ana running late', 'text ana running late'], [33, 'out', 'drafted to Ana: “running late”. you press send.'],
      [21, 'cmd', 'note punch list: caulk, outlet covers', 'notes'], [21, 'ok', 'noted'], [12, 'cmd', 'music', 'music'], [12, 'out', 'playing: late night, low tempo']]
      .forEach(function (r) { var e = { t: now - r[0] * M, k: r[1], s: r[2] }; if (r[3]) e.c = r[3]; t.log.push(e); });
    t.launches = 6; t.returns = 17; t.people = ['Dad', 'Ana'];
    D.notes.push({ t: now - 21 * M, s: 'punch list: caulk, outlet covers' });
  } else {
    t.log.push({ t: now, k: 'sys', s: 'SHELL is running.' }, { t: now, k: 'out', s: 'type an app, a sum, or a thing to do.' }, { t: now, k: 'out', s: 'help lists commands. setup turns on the rest.' });
  }
  save();
}
function start() {
  applyTheme(); applyLooks(); loadApps(); loadAll(); seed(); wire();
  today().returns++; lastResume = Date.now(); save();
  tick(); refresh(); setInterval(tick, 1000);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { dockSize(); });
  nat('ready');
}
start();
})();

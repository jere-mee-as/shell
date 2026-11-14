/* Preview bridge: stands in for window.ShellNative in a browser, on made-up data. Never used on the phone. */
window.ShellMock = window.ShellNative ? null : (function () {
  var now = Date.now(), MIN = 60000, HOUR = 3600000;
  var names = ['Authenticator', 'Books', 'Calculator', 'Calendar', 'Camera', 'Chrome', 'Clock', 'Contacts', 'Discord', 'Docs', 'Drive',
    'Files', 'Gallery', 'GitHub', 'Gmail', 'Instagram', 'Keep Notes', 'Maps', 'Messages', 'Phone', 'Photos', 'Podcasts', 'Proton Mail',
    'Reddit', 'Settings', 'Sheets', 'Signal', 'Spotify', 'Steam', 'Substack', 'Uber', 'Venmo', 'Wallet', 'Weather', 'WhatsApp', 'YouTube'];
  var cats = { Spotify: 'audio', Podcasts: 'audio', YouTube: 'video', Instagram: 'social', Discord: 'social', Reddit: 'social', Maps: 'maps', Steam: 'game' };
  var apps = names.map(function (n) {
    var pkg = 'app.' + n.toLowerCase().replace(/[^a-z]/g, '');
    return { key: pkg + '/Main', pkg: pkg, label: n, cat: cats[n] || 'other', icon: '' };
  });
  var notifs = [
    { id: 'n1', pkg: 'app.messages', kind: 'msg', title: 'Ana', text: 'running late, save me a seat', person: 'Ana', convo: 'Ana', group: false, time: now - 9 * MIN, live: true, canReply: true, actions: [] },
    { id: 'n2', pkg: 'app.whatsapp', kind: 'msg', title: 'Leo', text: 'pizza after? you owe me 20', person: 'Leo', convo: 'Leo', group: false, time: now - 31 * MIN, live: true, canReply: true, actions: [] },
    { id: 'n3', pkg: 'app.gmail', kind: 'email', title: 'Permit office', text: 'Your review comments are ready', person: '', convo: '', group: false, time: now - 52 * MIN, live: true, canReply: false, actions: ['Archive'] },
    { id: 'n4', pkg: 'app.calendar', kind: 'other', title: 'Dinner in 1 hour', text: '19:30 at the usual place', person: '', convo: '', group: false, time: now - 4 * MIN, live: true, canReply: false, actions: [] }
  ];
  var media = null, dnd = false, torch = false;
  var perms = { notif: true, calendar: true, contacts: true, dnd: true, phone: true, alarms: true, usage: true, isHome: true };
  function at(h, m, addDays) { var d = new Date(); d.setDate(d.getDate() + (addDays || 0)); d.setHours(h, m, 0, 0); return d.getTime(); }
  function emit(type, data) { setTimeout(function () { window.SHELL && SHELL.onNative(type, data === undefined ? null : data); }, 60); }
  return {
    apps: function () { return apps; },
    launch: function () { return true; },
    appInfo: function () {}, uninstall: function () {},
    notifs: function () { return notifs; },
    notifOpen: function () {},
    notifDismiss: function (id) { notifs = notifs.filter(function (n) { return n.id !== id; }); emit('notifs'); },
    dismissAll: function () { notifs = []; emit('notifs'); },
    notifReply: function (id) { notifs = notifs.filter(function (n) { return n.id !== id; }); emit('notifs'); return true; },
    notifAction: function () {},
    media: function () { return media; },
    mediaCmd: function (c) {
      if (!media) media = { pkg: 'app.spotify', title: 'Late Night, Low Tempo', artist: 'Example Artist', playing: false };
      media.playing = c === 'play' || c === 'next' || c === 'prev' ? true : c === 'pause' ? false : !media.playing;
      emit('media', JSON.stringify(media));
    },
    events: function () {
      return [
        { id: 'e1', title: 'Dinner', start: now + 50 * MIN, end: now + 170 * MIN, allDay: false, loc: 'the usual place' },
        { id: 'e2', title: 'Site walk', start: at(9, 0, 1), end: at(10, 30, 1), allDay: false, loc: '' },
        { id: 'e3', title: 'Dance class', start: at(19, 0, 2), end: at(20, 0, 2), allDay: false, loc: '' },
        { id: 'e4', title: 'Essay draft due', start: at(0, 0, 4), end: at(0, 0, 5), allDay: true, loc: '' }
      ];
    },
    openEvent: function () {}, newEvent: function () { return true; },
    contacts: function () {
      return [{ id: '1', name: 'Ana', phone: '555 0101' }, { id: '2', name: 'Dad', phone: '555 0102' }, { id: '3', name: 'Leo', phone: '555 0103' },
        { id: '4', name: 'Marco', phone: '555 0104' }, { id: '5', name: 'Mom', phone: '555 0105' }];
    },
    call: function () {}, sms: function () {}, openContact: function () {},
    profile: function () { return { name: 'You' }; },
    battery: function () { return { pct: 84, charging: false }; },
    device: function () { return { model: 'Preview Phone', android: '16', free: 91e9, total: 256e9 }; },
    perms: function () { return perms; },
    askPerm: function (n) { if (n in perms) perms[n] = true; emit('perms'); },
    setHome: function () { perms.isHome = true; emit('perms'); },
    setDnd: function (on) { dnd = on; return true; },
    torch: function (on) { torch = on; return true; },
    timer: function () { return true; }, alarm: function () { return true; },
    remind: function (id, t) { setTimeout(function () { emit('remind', JSON.stringify(id)); }, Math.max(0, t - Date.now())); return true; },
    cancelRemind: function () { return true; },
    web: function () {}, url: function () {}, maps: function () {}, settings: function () {}, shade: function () {},
    copy: function () { return true; }, haptic: function () {}, shareFile: function () { return true; },
    camera: function () { return true; },
    usage: function () {
      return { ok: true, unlocks: 41, screenMs: 2 * HOUR + 48 * MIN, first: at(7, 12),
        apps: [{ pkg: 'app.instagram', ms: 48 * MIN, n: 9 }, { pkg: 'app.youtube', ms: 37 * MIN, n: 4 }, { pkg: 'app.messages', ms: 26 * MIN, n: 14 },
          { pkg: 'app.chrome', ms: 22 * MIN, n: 7 }, { pkg: 'app.maps', ms: 11 * MIN, n: 3 }, { pkg: 'app.gmail', ms: 9 * MIN, n: 5 }],
        sessions: [{ pkg: 'app.instagram', start: now - 49 * MIN, end: now - 35 * MIN }, { pkg: 'app.maps', start: now - 26 * MIN, end: now - 23 * MIN },
          { pkg: 'app.youtube', start: now - 10 * MIN, end: now - 1 * MIN }] };
    },
    ready: function () {},
    updateInfo: function () { return { app: 'preview', live: false, pageAt: 0, pageSha: '', onLive: false }; },
    checkUpdate: function (w) { emit('update', JSON.stringify({ kind: w, state: 'current' })); },
    installUpdate: function () {}, applyPage: function () {}, resetPage: function () {},
    version: function () { return 'preview'; }
  };
})();

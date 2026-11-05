// Portfolio demo of the yard sign app. Loaded before every other script on the sign app pages.
// It answers the app's /api/* calls in the browser from made-up data, so nothing reaches a server
// and nothing real is shown. Every household, address, person and phone number below is fictional.
(function () {
  const realFetch = window.fetch.bind(window);
  const KEY = 'signs_demo_state_v2';
  const now = Date.now();
  const iso = minsAgo => new Date(now - minsAgo * 60000).toISOString();

  // Fictional streets placed around Hastings and Cottage Grove. Street names are invented.
  const AREAS = [
    { route: 'R1', town: 'Hastings', area: 'Hastings, west of the river bluff', c: [44.738, -92.874], streets: ['Bluffview Ct', 'Juniper Hollow Dr', 'Larkspur Ln', 'Old Mill Rd'] },
    { route: 'R2', town: 'Hastings', area: 'Hastings, south side', c: [44.722, -92.852], streets: ['Prairie Rose Ct', 'Kestrel Way', 'Fieldstone Ave', 'Harvest Ridge Dr'] },
    { route: 'R3', town: 'Cottage Grove', area: 'Cottage Grove, east neighborhoods', c: [44.823, -92.925], streets: ['Aspen Glen Trl', 'Copper Creek Dr', 'Willow Bend Ct', 'Stonegate Pkwy'] },
    { route: 'R4', town: 'Hastings', area: 'Rural, Denmark and Nininger', c: [44.70, -92.915], streets: ['Ridgeline Rd', 'Hawk Valley Trl', 'Cedar Point Rd'] },
  ];
  const VOLS = [
    { id: 'v1', name: 'Dana Sample', phone: '651-555-0141' },
    { id: 'v2', name: 'Chris Example', phone: '651-555-0172' },
    { id: 'v3', name: 'Pat Placeholder', phone: '651-555-0118' },
  ];
  const FIRST = ['Alex', 'Jordan', 'Morgan', 'Riley', 'Casey', 'Taylor', 'Jamie', 'Avery', 'Quinn', 'Rowan', 'Skyler', 'Emerson', 'Hayden', 'Reese', 'Parker', 'Logan'];
  const LAST = ['Sample', 'Example', 'Demo', 'Testwood', 'Fictus', 'Placeholder', 'Mockford', 'Stand-in'];

  // Deterministic pseudo-random, so the demo looks the same on every load.
  let seed = 41;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const pick = a => a[Math.floor(rnd() * a.length)];

  function build() {
    const routes = [], all = [];
    let n = 0;
    AREAS.forEach((A, ri) => {
      const stops = [];
      const count = ri === 3 ? 6 : 9;
      for (let i = 0; i < count; i++) {
        n++;
        const house = 100 + Math.floor(rnd() * 1800);
        const street = A.streets[i % A.streets.length];
        const city = A.town === 'Cottage Grove' ? 'Cottage Grove' : ri === 3 ? 'Denmark Twp' : 'Hastings';
        const jen = rnd() < 0.2 ? 2 : 1, large = rnd() < 0.18 ? 1 : 0, other = rnd() < 0.35 ? 1 : 0;
        const items = [{ label: 'Jen Fox', count: jen, large }];
        if (other) items.push({ label: pick(['Peggy Flanagan', 'Judy Seeberger', 'Amy Klobuchar']), count: 1, large: 0 });
        const signs = items.reduce((t, x) => t + x.count, 0);
        const first = pick(FIRST), last = pick(LAST);
        const s = {
          id: 'p' + n, sid: 'S' + String(400 + n), address: `${house} ${street}, ${city}`, mapsAddress: `${house} ${street}, ${city}`,
          unit: '', status: 'To pick up', grab: items.map(x => `${x.count} ${x.label}${x.large ? ' (large)' : ''}`).join(', '),
          items, count: signs, large, notes: i === 2 ? 'Sign is by the back fence' : '', driverNote: '', found: false, by: '',
          lat: A.c[0] + (rnd() - 0.5) * 0.024, lng: A.c[1] + (rnd() - 0.5) * 0.034,
        };
        stops.push(s);
        all.push({ id: s.id, sid: s.sid, name: `${first} ${last}`, first, last, address: s.address, house: String(house), street, unit: '', city,
          phone: `651-555-${String(100 + n).padStart(4, '0')}`, email: '', size: large ? 'L' : 'S', count: jen, rebar: false,
          pickup: 'To pick up', pickupBy: '', route: A.route, routeIdx: ri });
      }
      const vol = VOLS[ri] || null;
      routes.push({
        id: 'rt' + (ri + 1), route: A.route, kind: '', group: '', town: A.town, area: A.area, status: 'Open',
        volunteer: vol ? vol.name : '', phone: vol ? vol.phone : '', phoneGuess: '', phoneGuessFrom: '',
        linkSent: vol && ri < 2 ? iso(60 * 20) : '', token: 'demo' + (ri + 1), lastAt: '', lastBy: '', coverage: null,
        large: stops.reduce((t, s) => t + s.large, 0), stops,
      });
    });
    // A1: a drive-every-street area. The outline and streets are public map data for part of Hastings;
    // the sign spots that make the orange glow are made up.
    const SPOTS = [[44.72872, -92.87713], [44.7169, -92.88858], [44.71682, -92.8884], [44.7168, -92.88847], [44.72593, -92.89377], [44.7221, -92.89044], [44.72192, -92.89044], [44.72203, -92.89045], [44.72962, -92.87706], [44.72321, -92.88647], [44.72314, -92.88652], [44.72288, -92.88601], [44.72523, -92.88869], [44.72512, -92.88895], [44.72172, -92.89251], [44.72171, -92.89239], [44.72152, -92.89256], [44.72444, -92.88756], [44.72419, -92.88776], [44.72375, -92.8899], [44.72373, -92.88953], [44.73132, -92.87687], [44.73104, -92.87704], [44.73127, -92.87712], [44.72074, -92.88758], [44.72246, -92.88215], [44.72278, -92.882], [44.72271, -92.88194], [44.73027, -92.88176], [44.73047, -92.88183], [44.7311, -92.87721]];
    const a1 = SPOTS.map((c, i) => ({ id: 'a' + i, sid: '', address: 'Sample stop', mapsAddress: '', unit: '', status: 'To pick up', grab: '1 Jen Fox',
      items: [{ label: 'Jen Fox', count: 1, large: 0 }], count: 1, large: 0, notes: '', driverNote: '', found: false, by: '', lat: c[0], lng: c[1] }));
    routes.push({ id: 'rt5', route: 'A1', kind: '', group: '', town: 'Hastings', area: 'Hastings, west side (drive every street)', status: 'Open', turf: true,
      volunteer: 'Sam Volunteer', phone: '651-555-0190', phoneGuess: '', phoneGuessFrom: '', linkSent: iso(60 * 20), token: 'demo5', lastAt: '', lastBy: '', coverage: null, large: 0, stops: a1 });
    // Some progress already made on R1 so the dashboards have something to show.
    const r1 = routes[0];
    r1.stops.slice(0, 5).forEach((s, i) => { s.status = i === 3 ? 'Keeping it' : 'Picked up'; s.by = VOLS[0].name; });
    r1.stops[1].driverNote = 'Sign was by the garage, stake left in the ground';
    r1.lastAt = iso(12); r1.lastBy = VOLS[0].name;
    routes[1].stops.slice(0, 2).forEach(s => { s.status = 'Picked up'; s.by = VOLS[1].name; });
    routes[1].lastAt = iso(95); routes[1].lastBy = VOLS[1].name;
    return {
      routes, all,
      signups: [
        { name: 'Sam Volunteer', phone: '651-555-0190', route: 'Hastings', large: 'Yes', created: iso(60 * 30), notes: 'Free after 1 pm' },
        { name: 'Lee Helper', phone: '651-555-0163', route: 'Cottage Grove', large: 'No', created: iso(60 * 26), notes: '' },
      ],
      counts: [
        { id: 'c1', name: 'Jen Fox', placed: null, source: 'From app list' },
        { id: 'c2', name: 'Other DFL campaigns', placed: 30, source: 'Estimate' },
        { id: 'c3', name: 'School board', placed: 12, source: 'Estimate' },
      ],
    };
  }

  function load() {
    try { const s = JSON.parse(sessionStorage.getItem(KEY) || 'null'); if (s && s.routes) return s; } catch {}
    return build();
  }
  let S = load();
  const save = () => { try { sessionStorage.setItem(KEY, JSON.stringify(S)); } catch {} };
  window.resetSignsDemo = () => { try { sessionStorage.removeItem(KEY); } catch {} location.reload(); };

  function tally(r) {
    r.total = r.stops.length;
    r.closed = r.stops.filter(s => s.status !== 'To pick up').length;
    r.large = r.stops.reduce((t, s) => t + (s.large || 0), 0);
  }
  function orgView() {
    S.routes.forEach(tally);
    const stops = S.routes.flatMap(r => r.stops);
    const back = stops.filter(s => s.status === 'Picked up').reduce((t, s) => t + s.count, 0);
    S.all.forEach(a => { const s = stops.find(x => x.id === a.id); if (s) { a.pickup = s.status; a.pickupBy = s.by; } });
    const counts = S.counts.map(c => c.source === 'From app list' ? { ...c, placed: stops.reduce((t, s) => t + s.items.filter(i => i.label === 'Jen Fox').reduce((u, i) => u + i.count, 0), 0) } : c);
    return {
      who: { name: 'Demo Organizer' },
      routes: S.routes,
      pickup: { stops: stops.length, open: stops.filter(s => s.status === 'To pick up').length, done: stops.length - stops.filter(s => s.status === 'To pick up').length, signs: stops.reduce((t, s) => t + s.count, 0), signsBack: back, large: stops.reduce((t, s) => t + s.large, 0), byCandidate: {} },
      pickupNotes: stops.filter(s => s.driverNote).map(s => ({ address: s.address, route: (S.routes.find(r => r.stops.includes(s)) || {}).route, status: s.status, note: s.driverNote, by: s.by })),
      counts, signups: S.signups, all: S.all,
      volunteers: { volunteers: VOLS.map(v => { const mine = stops.filter(s => s.by === v.name && s.status === 'Picked up'); return { ...v, aliases: [], signs: mine.reduce((t, s) => t + s.count, 0), delivered: mine.length, routes: S.routes.filter(r => r.volunteer === v.name).length, miles: mine.length * 0.6, declined: 0, days: mine.length ? 1 : 0, lastOut: mine.length ? '2026-11-04' : '', sizes: {}, routeNames: S.routes.filter(r => r.volunteer === v.name).map(r => r.route) }; }), unlinked: [], roadFactor: 1.3 },
    };
  }
  function routeView(token) {
    const r = S.routes.find(x => x.token === token) || S.routes[0];
    tally(r);
    return { route: r.route, area: r.area, listOnly: !r.turf, test: true, notes: 'Bring the signs to the drop-off garage by 3 pm.', volunteer: r.volunteer, expectExtra: 0, coverage: null, stops: r.stops };
  }
  const reply = (body, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
  const STATUS = { picked: 'Picked up', nosign: 'No sign there', keeping: 'Keeping it' };

  function handle(path, method, body) {
    const url = new URL(path, location.origin);
    const p = url.pathname;
    if (p === '/api/auth') return reply(method === 'GET' ? { signedIn: true } : { ok: true });
    if (p === '/api/turf') {
      if (url.searchParams.get('route') === 'A1') return realFetch('/signs/demo-turf-A1.json');
      return reply({ error: 'No area map for this route' }, 404);
    }
    if (p === '/api/map') return reply({ error: 'Not in the demo' }, 404);
    if (p === '/api/signup' || p === '/api/volunteer') return reply({ ok: true, demo: true });
    if (p === '/api/org') {
      if (method === 'GET') return reply(orgView());
      const b = body || {};
      const stop = id => S.routes.flatMap(r => r.stops).find(s => s.id === id);
      const route = id => S.routes.find(r => r.id === id);
      if (b.action === 'setPickupStatus') { const s = stop(b.pickupId); if (s) { s.status = b.status; s.by = s.status === 'To pick up' ? '' : 'Demo Organizer'; } }
      else if (b.action === 'setPickupNote') { const s = stop(b.pickupId); if (s) s.notes = b.notes || ''; }
      else if (b.action === 'markSent') { (b.routeIds || []).forEach(id => { const r = route(id); if (r) r.linkSent = b.sent ? new Date().toISOString() : ''; }); }
      else if (b.action === 'setVolunteer') { const r = route(b.routeId); if (r) { r.volunteer = b.volunteer || ''; r.phone = b.phone || ''; } }
      else if (b.action === 'setCount') { const c = S.counts.find(x => x.id === b.countId); if (c && 'placed' in b) c.placed = Number(b.placed) || 0; }
      else if (b.action === 'newLink') { const r = route(b.routeId); if (r) r.token = 'demo' + Math.random().toString(36).slice(2, 8); }
      save();
      return reply(orgView());
    }
    if (p === '/api/route') {
      if (method === 'GET') return reply(routeView(url.searchParams.get('token')));
      const b = body || {};
      const r = S.routes.find(x => x.token === b.token) || S.routes[0];
      if (b.action === 'coverage') return reply({ ok: true });
      if (b.action === 'hello') {
        const name = `${b.first || ''} ${b.last || ''}`.trim();
        return reply({ ...routeView(r.token), volunteer: { id: 'demo-vol', name } });
      }
      const who = (() => { try { return JSON.parse(localStorage.getItem('jfs_vol') || 'null')?.name || ''; } catch { return ''; } })();
      if (b.action === 'found') {
        const items = [['jen', 'Jen Fox'], ['zuzek', 'Zuzek'], ['kinneman', 'Kinneman'], ['larson', 'Larson'], ['other', 'Other']]
          .filter(([k]) => b[k]).map(([k, l]) => ({ label: l, count: b[k], large: 0 }));
        const count = items.reduce((t, x) => t + x.count, 0);
        r.stops.push({ id: 'f' + Date.now(), address: b.where, mapsAddress: b.where, unit: '', status: 'Picked up', grab: items.map(x => `${x.count} ${x.label}`).join(', '), items, count, large: 0, notes: '', driverNote: b.note || '', found: true, by: who });
      } else {
        const s = r.stops.find(x => x.id === b.stopId);
        if (!s) return reply({ error: 'That stop is not on this route.' }, 400);
        if (b.action === 'undo') { s.status = 'To pick up'; s.by = ''; }
        else if (b.action === 'note') { s.driverNote = b.note || ''; }
        else if (STATUS[b.action]) { s.status = STATUS[b.action]; s.by = who; if (b.note !== undefined) s.driverNote = b.note; r.lastAt = new Date().toISOString(); r.lastBy = who; }
      }
      save();
      return reply(routeView(r.token));
    }
    return null;
  }

  window.fetch = function (input, init) {
    const url = typeof input === 'string' ? input : input && input.url;
    if (url && (url.startsWith('/api/') || url.startsWith(location.origin + '/api/'))) {
      const method = ((init && init.method) || 'GET').toUpperCase();
      let body = null; try { body = init && init.body ? JSON.parse(init.body) : null; } catch {}
      const res = handle(url, method, body);
      if (res) return new Promise(ok => setTimeout(() => ok(res), 250));
    }
    return realFetch(input, init);
  };
})();

// Portfolio demo of the yard sign app, delivery edition (Aug to Oct 2026).
// Answers the app's /api/* calls in the browser from made-up data. Every household, address,
// person and phone number below is fictional; street names are invented.
(function () {
  const realFetch = window.fetch.bind(window);
  const KEY = 'signs_delivery_demo_v1';
  const now = Date.parse('2026-10-01T17:00:00Z'); // the demo is set during the delivery weeks
  const iso = minsAgo => new Date(now - minsAgo * 60000).toISOString();
  const day = d => new Date(now - d * 86400000).toISOString().slice(0, 10);

  const AREAS = [
    { route: 'R5', area: 'Hastings, west of the river bluff', city: 'Hastings', c: [44.738, -92.874], streets: ['Bluffview Ct', 'Juniper Hollow Dr', 'Larkspur Ln', 'Old Mill Rd'] },
    { route: 'R6', area: 'Hastings, south side', city: 'Hastings', c: [44.722, -92.852], streets: ['Prairie Rose Ct', 'Kestrel Way', 'Fieldstone Ave', 'Harvest Ridge Dr'] },
    { route: 'R7', area: 'Cottage Grove, east neighborhoods', city: 'Cottage Grove', c: [44.823, -92.925], streets: ['Aspen Glen Trl', 'Copper Creek Dr', 'Willow Bend Ct', 'Stonegate Pkwy'] },
    { route: 'R8', area: 'Rural, Denmark Township', city: 'Denmark Twp', c: [44.70, -92.915], streets: ['Ridgeline Rd', 'Hawk Valley Trl', 'Cedar Point Rd'] },
  ];
  const VOLS = [
    { id: 'v1', name: 'Dana Sample', phone: '651-555-0141' },
    { id: 'v2', name: 'Chris Example', phone: '651-555-0172' },
    { id: 'v3', name: 'Pat Placeholder', phone: '651-555-0118' },
  ];
  const FIRST = ['Alex', 'Jordan', 'Morgan', 'Riley', 'Casey', 'Taylor', 'Jamie', 'Avery', 'Quinn', 'Rowan', 'Skyler', 'Emerson', 'Hayden', 'Reese', 'Parker', 'Logan'];
  const LAST = ['Sample', 'Example', 'Demo', 'Testwood', 'Fictus', 'Placeholder', 'Mockford', 'Stand-in'];
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const pick = a => a[Math.floor(rnd() * a.length)];
  let n = 0;
  const person = (A, i) => {
    n++;
    const first = pick(FIRST), last = pick(LAST), house = 100 + Math.floor(rnd() * 1800), street = A.streets[i % A.streets.length];
    return { id: 's' + n, sid: 'S' + (300 + n), name: `${first} ${last}`, house: String(house), street, unit: '', city: A.city,
      address: `${house} ${street}, ${A.city}`, mapsAddress: `${house} ${street}, ${A.city}`, phone: `651-555-${String(200 + n).padStart(4, '0')}`,
      email: '', size: rnd() < 0.15 ? 'L' : 'S', rebar: false, notes: '', driverNote: '', status: 'Needs delivery', deliveredBy: '', date: '',
      lat: A.c[0] + (rnd() - 0.5) * 0.024, lng: A.c[1] + (rnd() - 0.5) * 0.034 };
  };

  function build() {
    const routes = AREAS.map((A, ri) => {
      const stops = Array.from({ length: ri === 3 ? 5 : 8 }, (_, i) => person(A, i));
      const vol = VOLS[ri] || null;
      return { id: 'rt' + ri, route: A.route, area: A.area, status: 'Open', volunteer: vol ? vol.name : '', phone: vol ? vol.phone : '', token: 'd' + (ri + 1), stops };
    });
    routes[0].stops.slice(0, 6).forEach((s, i) => { s.status = i === 4 ? 'Declined' : 'Delivered'; s.deliveredBy = VOLS[0].name; s.date = day(1); });
    routes[0].stops[2].driverNote = 'Put it by the mailbox, owner asked for the corner';
    routes[1].stops.slice(0, 3).forEach(s => { s.status = 'Delivered'; s.deliveredBy = VOLS[1].name; s.date = day(0); });
    routes[1].stops[5].notes = 'Large sign: deliver.';
    routes[1].stops[5].size = 'L';
    routes[2].stops[1].unit = 'Apt 4B';
    routes[2].stops[1].address = routes[2].stops[1].address.replace(',', ', Apt 4B,');
    const A = AREAS[0];
    const exceptions = [
      { ...person(A, 1), id: 'x1', kind: 'Possible duplicate', why: 'Same address as a household that already has a sign (delivered last week).', notes: '' },
      { ...person(AREAS[1], 2), id: 'x2', kind: 'Address not mappable', why: 'The map could not find this address. Check the house number and street.', house: '19', street: 'Kestral', notes: 'Corner lot, by the stop sign' },
      { ...person(AREAS[2], 0), id: 'x3', kind: 'Outside 41B', why: 'This address is outside the district lines.', notes: '' },
    ];
    exceptions[1].address = '19 Kestral, Hastings';
    const recent = [routes[1].stops[6], routes[2].stops[7], exceptions[0]].map((s, i) => ({ name: s.name, address: s.address, created: iso(60 * (8 + i * 20)), route: i === 2 ? '' : (i ? 'R7' : 'R6'), flagged: i === 2, status: s.status }));
    return { routes, exceptions, recent, extraDelivered: 520 };
  }
  function load() { try { const s = JSON.parse(sessionStorage.getItem(KEY) || 'null'); if (s && s.routes) return s; } catch {} return build(); }
  let S = load();
  const save = () => { try { sessionStorage.setItem(KEY, JSON.stringify(S)); } catch {} };

  function orgView() {
    const stops = S.routes.flatMap(r => r.stops);
    S.routes.forEach(r => {
      r.total = r.stops.length;
      r.delivered = r.stops.filter(s => s.status === 'Delivered').length;
      r.closed = r.stops.filter(s => s.status !== 'Needs delivery').length;
      if (r.closed === r.total) r.status = 'Complete';
    });
    const vols = VOLS.map(v => {
      const mine = stops.filter(s => s.deliveredBy === v.name);
      const del = mine.filter(s => s.status === 'Delivered').length;
      return { ...v, aliases: [], delivered: del, declined: mine.length - del, routes: S.routes.filter(r => r.volunteer === v.name).length,
        miles: del * 0.7, days: mine.length ? 1 : 0, lastOut: mine.length ? mine[0].date : '', sizes: {}, routeNames: S.routes.filter(r => r.volunteer === v.name).map(r => r.route) };
    });
    return {
      who: { name: 'Demo Organizer' },
      totals: { exceptions: S.exceptions.length, needs: stops.filter(s => s.status === 'Needs delivery').length, delivered: S.extraDelivered + stops.filter(s => s.status === 'Delivered').length },
      exceptions: S.exceptions,
      driverNotes: stops.filter(s => s.driverNote).map(s => ({ name: s.name, address: s.address, route: (S.routes.find(r => r.stops.includes(s)) || {}).route, status: s.status, note: s.driverNote, by: s.deliveredBy, date: s.date })),
      routes: S.routes, recent: S.recent, routePass: null,
      all: stops.concat(S.exceptions.map(e => ({ ...e, flagged: true }))),
      volunteers: { volunteers: vols, unlinked: [], roadFactor: 1.3 },
    };
  }
  function routeView(token) {
    const r = S.routes.find(x => x.token === token) || S.routes[0];
    return { route: r.route, area: r.area, volunteer: r.volunteer, stops: r.stops };
  }
  const reply = (body, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
  const who = () => { try { return JSON.parse(localStorage.getItem('jfs_vol') || 'null')?.name || ''; } catch { return ''; } };

  function handle(path, method, body) {
    const url = new URL(path, location.origin);
    const p = url.pathname, b = body || {};
    if (p === '/api/auth') return reply(method === 'GET' ? { signedIn: true } : { ok: true });
    if (p === '/api/signup') return reply({ ok: true, demo: true });
    if (p === '/api/org') {
      if (method === 'GET') return reply(orgView());
      const all = S.routes.flatMap(r => r.stops);
      if (b.action === 'decide' || b.action === 'fixAddress') {
        const i = S.exceptions.findIndex(e => e.id === b.signId);
        if (i >= 0) {
          const e = S.exceptions.splice(i, 1)[0];
          if (b.action === 'fixAddress' || b.choice === 'deliver') {
            const r = S.routes[1];
            if (b.action === 'fixAddress') e.address = `${b.house} ${b.street}, ${b.city}`;
            r.stops.push({ ...e, status: 'Needs delivery', kind: undefined, why: undefined });
          }
        }
      } else if (b.action === 'setStatus') { const s = all.find(x => x.id === b.signId); if (s) { s.status = b.status; if (b.status === 'Needs delivery') { s.deliveredBy = ''; s.date = ''; } } }
      else if (b.action === 'setNote') { const s = all.find(x => x.id === b.signId); if (s) s.notes = b.notes || ''; }
      else if (b.action === 'setVolunteer') { const r = S.routes.find(x => x.id === b.routeId); if (r) { r.volunteer = b.volunteer || ''; r.phone = b.phone || ''; } }
      else if (b.action === 'newLink') { const r = S.routes.find(x => x.id === b.routeId); if (r) r.token = 'd' + Math.random().toString(36).slice(2, 8); }
      else if (b.action === 'archiveRoute') { S.routes = S.routes.filter(x => x.id !== b.routeId); }
      else if (b.action === 'addSign') {
        const r = S.routes[0];
        r.stops.push({ id: 'n' + Date.now(), sid: '', name: `${b.first || ''} ${b.last || ''}`.trim() || 'New signup', address: `${b.house || ''} ${b.street || ''}, ${b.city || 'Hastings'}`.trim(),
          mapsAddress: '', phone: b.phone || '', email: '', size: 'S', notes: b.notes || '', driverNote: '', status: 'Needs delivery', deliveredBy: '', date: '' });
      }
      save();
      return reply(orgView());
    }
    if (p === '/api/route') {
      if (method === 'GET') return reply(routeView(url.searchParams.get('token')));
      const r = S.routes.find(x => x.token === b.token) || S.routes[0];
      if (b.action === 'hello') return reply({ ...routeView(r.token), volunteer: { id: 'demo-vol', name: `${b.first || ''} ${b.last || ''}`.trim() } });
      const s = r.stops.find(x => x.id === b.signId);
      if (!s) return reply({ error: 'That stop is not on this route.' }, 400);
      if (b.action === 'undo') { s.status = 'Needs delivery'; s.deliveredBy = ''; s.date = ''; }
      else if (b.action === 'note') s.driverNote = b.note || '';
      else if (b.action === 'delivered' || b.action === 'declined') {
        s.status = b.action === 'delivered' ? 'Delivered' : 'Declined'; s.deliveredBy = b.by || who(); s.date = day(0);
        if (b.note !== undefined) s.driverNote = b.note;
      }
      save();
      return reply(routeView(r.token));
    }
    return null;
  }

  window.fetch = function (input, init) {
    const u = typeof input === 'string' ? input : input && input.url;
    if (u && (u.startsWith('/api/') || u.startsWith(location.origin + '/api/'))) {
      const method = ((init && init.method) || 'GET').toUpperCase();
      let body = null; try { body = init && init.body ? JSON.parse(init.body) : null; } catch {}
      const res = handle(u, method, body);
      if (res) return new Promise(ok => setTimeout(() => ok(res), 250));
    }
    return realFetch(input, init);
  };
})();

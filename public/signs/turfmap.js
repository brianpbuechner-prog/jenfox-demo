// Turf map for the volunteer route page (pickup, Nov 4 2026).
// Shows the route's area, the streets in it, the stops and the phone's position. Streets turn green as the
// phone passes them, so a volunteer can sweep every street. Progress is kept on this phone (localStorage) and,
// since 31 Oct 2026, which streets are done is also sent to the campaign (/api/route action coverage). The phone's
// location itself is never sent: only street-piece numbers and hand-ticked street names. Also draws an optional drive-every-street loop (GPX button hidden) and starts
// driving mode (drive.js): a full-screen map that follows the phone with spoken turns along the loop.
(function () {
  // Google encoded polyline, precision 5.
  function decode(str) {
    const out = []; let i = 0, lat = 0, lng = 0;
    while (i < str.length) {
      let b, s = 0, r = 0;
      do { b = str.charCodeAt(i++) - 63; r |= (b & 31) << s; s += 5; } while (b >= 32);
      lat += (r & 1) ? ~(r >> 1) : (r >> 1);
      s = 0; r = 0;
      do { b = str.charCodeAt(i++) - 63; r |= (b & 31) << s; s += 5; } while (b >= 32);
      lng += (r & 1) ? ~(r >> 1) : (r >> 1);
      out.push([lat / 1e5, lng / 1e5]);
    }
    return out;
  }
  window.decodePolyline = decode;

  const cache = {};
  window.loadTurf = function (route) {
    if (!route) return Promise.resolve(null);
    if (!cache[route]) cache[route] = fetch('/api/turf?route=' + encodeURIComponent(route))
      .then(r => r.ok ? r.json() : null).then(t => t ? {
        ...t, polyD: t.poly.map(decode), streetsD: t.streets.map(decode),
      } : null).catch(() => null);
    return cache[route];
  };

  // The loop as one list of [lat,lng] per connected piece, built from street indexes.
  window.turfLoops = function (t) {
    return (t.loops || []).map(seq => {
      const pts = [];
      seq.forEach(si => {
        let c = t.streetsD[Math.abs(si) - 1]; if (!c) return;
        if (si < 0) c = c.slice().reverse();
        pts.push(...(pts.length ? c.slice(1) : c));
      });
      return pts;
    }).filter(p => p.length > 1);
  };

  // Local flat projection in meters, good enough over a few km.
  const M = 111320;
  const proj = (lat0) => (p) => [p[1] * M * Math.cos(lat0 * Math.PI / 180), p[0] * M];
  function segDist(p, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy;
    let t = L ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L : 0; t = Math.max(0, Math.min(1, t));
    const x = a[0] + t * dx - p[0], y = a[1] + t * dy - p[1];
    return Math.sqrt(x * x + y * y);
  }

  // Split streets into pieces of at most ~60 m, so passing one end of a long street does not mark all of it.
  function pieces(t, P) {
    const out = [];
    t.streetsD.forEach((c, si) => {
      let cur = [c[0]], len = 0;
      for (let i = 1; i < c.length; i++) {
        const a = P(c[i - 1]), b = P(c[i]); const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const n = Math.max(1, Math.ceil(d / 60));
        for (let k = 1; k <= n; k++) {
          const f = k / n, pt = [c[i - 1][0] + (c[i][0] - c[i - 1][0]) * f, c[i - 1][1] + (c[i][1] - c[i - 1][1]) * f];
          cur.push(pt); len += d / n;
          if (len >= 60) { out.push({ c: cur, len, si }); cur = [pt]; len = 0; }
        }
      }
      if (cur.length > 1 && len > 0) out.push({ c: cur, len, si });
    });
    out.forEach(p => { p.m = p.c.map(P); const xs = p.m.map(q => q[0]), ys = p.m.map(q => q[1]);
      p.box = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; });
    return out;
  }

  // For the organizer page: the same pieces, so piece numbers sent by phones mean the same streets there.
  window.turfPieces = function (t) { return pieces(t, proj(t.polyD[0][0][0])); };
  // A piece counts as done if GPS covered it or its street name was ticked by hand.
  window.pieceDone = function (t, ps, covered, tickedNames) {
    const sn = window.streetShortName || (x => x);
    return i => covered.has(i) || (tickedNames.size > 0 && !!t.names && tickedNames.has(sn(t.names[ps[i].si] || '')));
  };

  function gpx(name, loops) {
    const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="jenfox-signs" xmlns="http://www.topografix.com/GPX/1/1">\n<trk><name>${esc(name)} drive every street</name>\n`
      + loops.map(l => '<trkseg>' + l.map(p => `<trkpt lat="${p[0].toFixed(5)}" lon="${p[1].toFixed(5)}"/>`).join('') + '</trkseg>').join('\n')
      + '\n</trk></gpx>\n';
  }

  // Mount the card. getStops() returns the current stop list so pins follow taps on the page.
  // opts (31 Oct): { server: {p, s} from /api/route, getTicks: () => Set of street names ticked by hand }
  window.mountTurf = function (el, t, routeName, token, getStops, opts) {
    if (!window.L || !t) { el.innerHTML = ''; return null; }
    opts = opts || {};
    const key = 'jfs_cov_' + token;
    let covered = new Set(); try { covered = new Set(JSON.parse(localStorage.getItem(key) || '[]')); } catch {}
    const lat0 = t.polyD[0][0][0], P = proj(lat0);
    const ps = pieces(t, P), total = ps.reduce((a, p) => a + p.len, 0);
    // What other phones on this route already drove counts here too.
    let dirty = false;
    ((opts.server && opts.server.p) || []).forEach(i => { if (i < ps.length) covered.add(i); });
    for (const i of covered) if (!((opts.server && opts.server.p) || []).includes(i)) { dirty = true; break; } // local pieces the server has not seen
    const ticked = () => (opts.getTicks ? opts.getTicks() : new Set());
    let doneFn = window.pieceDone(t, ps, covered, ticked());
    // Where the suggested loop begins: first point of the first (biggest) piece, and the street it starts on.
    // The same loop driven the other way, for a helper who joins after someone else has started: parts in reverse order,
    // each part's streets in reverse order and direction. Each part is a closed loop, so a one-part area starts at the same spot.
    const tRev = { ...t, loops: (t.loops || []).slice().reverse().map(seq => seq.slice().reverse().map(x => -x)) };
    const firstOf = tt => { const L = window.turfLoops(tt); return L.length ? L[0][0] : null; };
    const nameOf = tt => (tt.loops && tt.loops[0] && tt.names) ? (tt.names[Math.abs(tt.loops[0][0]) - 1] || '') : '';
    let rev = false;
    const cur = () => rev ? tRev : t;
    const startLL = firstOf(t), startName = nameOf(t);
    const navHref = ll => `https://www.google.com/maps/dir/?api=1&destination=${ll[0].toFixed(5)},${ll[1].toFixed(5)}&travelmode=driving`;
    const esc = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    el.innerHTML = `<div class="card turf">
      <p class="lbl">Your area</p>
      <div id="tmap" style="height:340px;border-radius:10px;overflow:hidden;border:1px solid #ccc"></div>
      <div class="small" style="display:flex;flex-wrap:wrap;gap:4px 14px;margin:8px 0 0;align-items:center"><span><i style="display:inline-block;vertical-align:middle;margin-right:5px;width:20px;border-top:3px solid #f5a65b"></i><i style="display:inline-block;vertical-align:middle;margin-right:5px;width:20px;border-top:6px solid #a83e00;margin-left:-3px"></i>Not driven yet (orange glow = signs nearby)</span><span><i style="display:inline-block;vertical-align:middle;margin-right:5px;width:20px;border-top:4px solid #2e9e57"></i>Driven</span><span><i style="display:inline-block;vertical-align:middle;margin-right:5px;width:18px;height:12px;border:1.5px solid #1f4e9c;border-radius:6px;background:#fff;font:700 9px/12px Poppins,sans-serif;color:#1f4e9c;text-align:center;font-style:normal">3</i>Street order (zoom in)</span><span><i style="display:inline-block;vertical-align:middle;margin-right:5px;width:12px;height:12px;border:2px solid #1f4e9c;background:rgba(31,78,156,.08)"></i>Your area</span></div>
      ${t.polyD.length > 1 ? `<p class="small" style="margin:6px 0 0">Your area also has ${t.polyD.length - 1} small outlying spot${t.polyD.length > 2 ? 's' : ''}. <a href="#" id="twhole">Show the whole area</a></p>` : ''}
      <p class="small" id="tprog" style="margin:8px 0 0"></p>
      <div style="margin-top:10px;padding:10px 12px;border-radius:10px;background:rgba(31,78,156,.07);border:1px solid rgba(31,78,156,.2)">
        <p style="margin:0;font-weight:700">Suggested route: one loop that covers every street in your area</p>
        <p class="small" style="margin:4px 0 0">${t.loopMi ? `About ${t.loopMi} miles. ` : ''}Following it in order takes you down every street inside the blue outline, so you pass every sign. It is a suggestion: drive the streets in any order you like, and each street turns green once you have driven it.</p>
        <ol class="small" style="margin:8px 0 0;padding-left:20px"><li>Navigate to the start<span id="tstartname">${startName ? ` on <b>${esc(startName)}</b>` : ''}</span> (green dot on the map).</li><li>Tap <b>Start driving</b> and follow the turns.</li></ol>
        <label class="small" style="display:flex;gap:8px;align-items:flex-start;margin:8px 0 0;cursor:pointer"><input type="checkbox" id="trev" style="margin-top:3px"><span><b>Helping someone already out here?</b> Drive the loop backwards, so you two work toward each other instead of following the same streets. Green streets are already done.</span></label>
        <button class="btn soft" id="tshare" type="button" style="width:100%;margin-top:8px">Send a helper the backwards link</button>
        <p class="small muted" id="tsharemsg" style="margin:4px 0 0;display:none"></p>
      </div>
      ${startLL ? `<div class="acts" style="margin-top:8px"><a class="btn soft" id="tnav" target="_blank" rel="noopener" href="${navHref(startLL)}" style="grid-column:1/-1;display:block;text-align:center;text-decoration:none">1. Navigate to the start</a></div>` : ''}
      <div class="acts" style="margin-top:8px"><button class="btn" id="tdrive" style="grid-column:1/-1">${startLL ? '2. ' : ''}Start driving (turn-by-turn)</button></div>
      <div class="acts" style="margin-top:8px"><button class="btn ok" id="ttrack">Just track streets</button><button class="btn soft" id="tme">Find me</button></div>
      <p class="small muted" style="margin:8px 0 0"><b>Start driving</b> talks you through the loop, turn by turn. <b>Just track streets</b> skips the directions and only turns streets green as you drive them. Keep the screen on and the phone in a mount. The campaign sees which streets are done, not where you are.</p>
    </div>`;
    const map = L.map(el.querySelector('#tmap'), { zoomControl: true, attributionControl: true });
    // Open on the biggest part of the area. Outlying bits (a farm, a rural stop) would shrink the main area to a dot.
    const ringArea = r => Math.abs(r.reduce((a, p, i) => { const q = r[(i + 1) % r.length]; return a + p[1] * q[0] - q[1] * p[0]; }, 0));
    const main = t.polyD.reduce((m, r) => ringArea(r) > ringArea(m) ? r : m, t.polyD[0]);
    let whole = false;
    const fit = () => map.fitBounds(L.latLngBounds(whole ? t.polyD.flat() : main), { padding: [10, 10] });
    fit(); // a view must exist before layers are added
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { minZoom: 9, maxZoom: 17, attribution: '© OpenStreetMap contributors' }).addTo(map);
    const area = L.featureGroup(t.polyD.map(r => L.polygon(r, { color: '#1f4e9c', weight: 2, fillColor: '#1f4e9c', fillOpacity: 0.08 }))).addTo(map);
    const startDot = !startLL ? null : L.circleMarker(startLL, { radius: 9, color: '#fff', weight: 3, fillColor: '#2e9e57', fillOpacity: 1, pane: 'markerPane' }).bindTooltip('Start here', { permanent: true, direction: 'top', offset: [0, -8] }).addTo(map);
    // Streets near more open signs are drawn darker and thicker, so the busy stretches stand out.
    function heatStyle(n) {
      return n >= 3 ? { color: '#a83e00', weight: 6.5, opacity: 0.95 } : n === 2 ? { color: '#d25a00', weight: 5.5, opacity: 0.92 }
        : n === 1 ? { color: '#ec7a12', weight: 4.5, opacity: 0.88 } : { color: '#f5a65b', weight: 3, opacity: 0.7 };
    }
    let heat = ps.map(() => 0);
    function computeHeat() {
      const open = (getStops() || []).filter(s => typeof s.lat === 'number').map(s => P([s.lat, s.lng])); // every known sign, fixed for the day
      heat = ps.map(p => { const m = p.m[Math.floor(p.m.length / 2)]; return open.filter(q => Math.hypot(q[0] - m[0], q[1] - m[1]) <= 90).length; });
    }
    computeHeat();
    const lineStyle = i => doneFn(i) ? { color: '#2e9e57', weight: 4, opacity: 0.85 } : heatStyle(heat[i]);
    // a soft glow under the busy stretches, below the streets and the loop, so it shows even with the loop on
    map.createPane('heat').style.zIndex = 350;
    const glowStyle = i => { const n = doneFn(i) ? 0 : heat[i];
      return n >= 3 ? { color: '#ff4d00', weight: 20, opacity: 0.32 } : n === 2 ? { color: '#ff6a00', weight: 15, opacity: 0.26 } : n === 1 ? { color: '#ff8a1f', weight: 11, opacity: 0.2 } : { opacity: 0, weight: 0 }; };
    const glows = ps.map((p, i) => L.polyline(p.c, { pane: 'heat', interactive: false, lineCap: 'round', ...glowStyle(i) }).addTo(map));
    const lines = ps.map((p, i) => L.polyline(p.c, lineStyle(i)).addTo(map));
    setTimeout(() => { map.invalidateSize(); fit(); }, 50); // the card may still be laying out
    map.createPane('pins').style.zIndex = 450; // stop dots above the streets and the loop
    const pins = L.layerGroup().addTo(map);
    // Stop markers were dropped 30 Oct (too busy); the stop list below the map has every address.
    function drawPins() {}
    drawPins();
    function prog() {
      let c = 0; ps.forEach((p, i) => { if (doneFn(i)) c += p.len; });
      el.querySelector('#tprog').textContent = `${(c / 1609).toFixed(1)} of ${(total / 1609).toFixed(1)} miles of street done (${Math.round(100 * c / total)}%), counting every phone on this route.`;
    }
    prog();
    function save() { try { localStorage.setItem(key, JSON.stringify([...covered])); } catch {} dirty = true; schedule(); }
    // Send which pieces are done (never the location) about every 20 seconds while there is something new.
    // The whole set goes each time, so a lost request is made up by the next one.
    let timer = null, sending = false;
    function schedule() { if (!timer) timer = setTimeout(() => { timer = null; flush(); }, 20000); }
    async function flush(keepalive) {
      if (!dirty || sending) return;
      sending = true; dirty = false;
      try {
        const r = await fetch('/api/route', { method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: !!keepalive,
          body: JSON.stringify({ action: 'coverage', token, p: [...covered] }) });
        if (!r.ok) throw new Error('status ' + r.status);
        const j = await r.json();
        let more = false; (j.coverage && j.coverage.p || []).forEach(i => { if (i < ps.length && !covered.has(i)) { covered.add(i); more = true; } });
        if (more) { try { localStorage.setItem(key, JSON.stringify([...covered])); } catch {} restyle(); }
      } catch (e) { dirty = true; schedule(); }
      finally { sending = false; }
    }
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(true); });
    window.addEventListener('pagehide', () => flush(true));
    function restyle() { doneFn = window.pieceDone(t, ps, covered, ticked()); lines.forEach((l, i) => l.setStyle(lineStyle(i))); glows.forEach((g, i) => g.setStyle(glowStyle(i))); prog(); }
    if (dirty) schedule();
    let me = null, acc = null, watch = null, last = null, lock = null;
    function mark(pt) {
      const R = 30; let changed = false;
      for (let i = 0; i < ps.length; i++) {
        if (covered.has(i)) continue;
        const b = ps[i].box; if (pt[0] < b[0] - R || pt[0] > b[2] + R || pt[1] < b[1] - R || pt[1] > b[3] + R) continue;
        const m = ps[i].m; let d = Infinity;
        for (let k = 1; k < m.length && d > R; k++) d = Math.min(d, segDist(pt, m[k - 1], m[k]));
        if (d <= R) { covered.add(i); doneFn = window.pieceDone(t, ps, covered, ticked()); lines[i].setStyle(lineStyle(i)); glows[i].setStyle(glowStyle(i)); changed = true; }
      }
      return changed;
    }
    let drive = null;
    function onFix(pos) {
      if (drive) drive.onFix(pos);
      const ll = [pos.coords.latitude, pos.coords.longitude];
      if (!me) { acc = L.circle(ll, { radius: pos.coords.accuracy, color: '#1a73e8', weight: 1, fillOpacity: 0.08 }).addTo(map); me = L.circleMarker(ll, { radius: 8, color: '#fff', weight: 3, fillColor: '#1a73e8', fillOpacity: 1 }).addTo(map); }
      else { me.setLatLng(ll); acc.setLatLng(ll).setRadius(pos.coords.accuracy); }
      if (!watch) return;
      if (pos.coords.accuracy > 50) return; // too fuzzy to mark streets
      const p = P(ll); let ch = false;
      // fill the gap since the last fix, so a fast stretch still marks every piece it crossed
      if (last) { const d = Math.hypot(p[0] - last[0], p[1] - last[1]); if (d < 400) { const n = Math.ceil(d / 20); for (let k = 1; k < n; k++) ch = mark([last[0] + (p[0] - last[0]) * k / n, last[1] + (p[1] - last[1]) * k / n]) || ch; } }
      ch = mark(p) || ch; last = p;
      if (ch) { save(); prog(); }
    }
    function onErr(e) { const m = e && e.code === 1 ? 'Location is off for this site. Allow it in your browser settings to track streets.' : 'Could not get your location yet.'; el.querySelector('#tprog').textContent = m; if (drive) drive.onErr(m); }
    const tw = el.querySelector('#twhole');
    if (tw) tw.onclick = (ev) => { ev.preventDefault(); whole = !whole; tw.textContent = whole ? 'Back to the main area' : 'Show the whole area'; fit(); };
    el.querySelector('#tme').onclick = () => { if (!navigator.geolocation) { onErr({}); return; } navigator.geolocation.getCurrentPosition(p => { onFix(p); map.setView([p.coords.latitude, p.coords.longitude], 16); }, onErr, { enableHighAccuracy: true, timeout: 15000 }); };
    const tr = el.querySelector('#trev');
    if (tr) tr.onchange = () => {
      rev = tr.checked;
      const ll = firstOf(cur()), nm = nameOf(cur());
      const a = el.querySelector('#tnav'); if (a && ll) a.href = navHref(ll);
      const sn = el.querySelector('#tstartname'); if (sn) sn.innerHTML = nm ? ` on <b>${esc(nm)}</b>` : '';
      if (startDot && ll) startDot.setLatLng(ll);
      const d = el.querySelector('#tdrive'); if (d) d.textContent = (startLL ? '2. ' : '') + (rev ? 'Start driving backwards (turn-by-turn)' : 'Start driving (turn-by-turn)');
    };
    // ?backwards=1 on the route link opens with the backwards loop already chosen (the link a driver shares with a helper).
    try { if (tr && /^(1|true|yes)$/i.test(new URLSearchParams(location.search).get('backwards') || '')) { tr.checked = true; tr.onchange(); } } catch {}
    const ts = el.querySelector('#tshare');
    if (ts) ts.onclick = async () => {
      const url = location.origin + location.pathname + '?backwards=1';
      const text = 'Can you help with my sign pickup area? This link starts the drive-every-street loop from the other end, so we work toward each other.';
      const msg = el.querySelector('#tsharemsg'); const show = m => { msg.textContent = m; msg.style.display = ''; };
      try { if (navigator.share) { await navigator.share({ title: 'Sign pickup: help with ' + routeName, text, url }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
      try { await navigator.clipboard.writeText(text + ' ' + url); show('Link copied. Paste it in a text to your helper.'); }
      catch { show('Copy this link and text it to your helper: ' + url); }
    };
    const tb = el.querySelector('#ttrack');
    tb.onclick = async () => {
      if (watch) { navigator.geolocation.clearWatch(watch); watch = null; last = null; tb.textContent = 'Just track streets'; try { lock && lock.release(); } catch {} lock = null; prog(); flush(); return; }
      if (!navigator.geolocation) { onErr({}); return; }
      watch = navigator.geolocation.watchPosition(onFix, onErr, { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 });
      tb.textContent = 'Stop tracking';
      try { lock = await navigator.wakeLock.request('screen'); } catch {}
    };
    el.querySelector('#tdrive').onclick = () => {
      if (drive || !window.startDrive) return;
      drive = window.startDrive({ map, t: cur(), P, token: rev ? token + '_rev' : token, mapEl: el.querySelector('#tmap'), onExit: () => { drive = null; fit(); } });
      if (drive && !watch) tb.onclick();
    };
    // Street numbers (30 Oct): the order from the street list, as small badges at zoom 15 and closer.
    // A badge that would overlap another is left off; the list has every street. No loop line on this map.
    const order = window.streetOrder ? window.streetOrder(t) : [];
    let numLayer = null;
    function drawNums() {
      if (numLayer) { map.removeLayer(numLayer); numLayer = null; }
      if (!order.length || map.getZoom() < 15) return;
      numLayer = L.layerGroup(); const boxes = [];
      order.forEach(o => {
        const c = t.streetsD[o.idx], m = c[Math.floor(c.length / 2)], p = map.latLngToLayerPoint(m);
        const w = String(o.n).length * 6 + 10, bx = [p.x - w / 2 - 2, p.y - 9, p.x + w / 2 + 2, p.y + 9];
        if (boxes.some(q => bx[0] < q[2] && bx[2] > q[0] && bx[1] < q[3] && bx[3] > q[1])) return;
        boxes.push(bx);
        L.marker(m, { interactive: false, pane: 'pins', icon: L.divIcon({ className: '', iconSize: [w, 15], iconAnchor: [w / 2, 7.5],
          html: `<div style="background:#fff;border:1.5px solid #1f4e9c;color:#1f4e9c;font:700 10px/12px Poppins,sans-serif;border-radius:8px;text-align:center">${o.n}</div>` }) }).addTo(numLayer);
      });
      numLayer.addTo(map);
    }
    map.on('zoomend', drawNums); drawNums();
    return { drawPins, restyle, flush };
  };
})();

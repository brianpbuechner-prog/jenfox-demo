// Driving mode for the volunteer route page (pickup, Nov 4 2026).
// Full-screen map that follows the phone, a next-turn banner and spoken turns along the drive-every-street loop.
// Everything runs on the phone: no location is sent anywhere. Started from turfmap.js (window.startDrive).
(function () {
  const FT = 3.28084, MI = 1609.344;
  const ABBR = [[/\bStreet\b/g, 'St'], [/\bAvenue\b/g, 'Ave'], [/\bDrive\b/g, 'Dr'], [/\bRoad\b/g, 'Rd'], [/\bLane\b/g, 'Ln'],
    [/\bCourt\b/g, 'Ct'], [/\bCircle\b/g, 'Cir'], [/\bBoulevard\b/g, 'Blvd'], [/\bTrail\b/g, 'Trl'], [/\bPlace\b/g, 'Pl'],
    [/\bParkway\b/g, 'Pkwy'], [/\bTerrace\b/g, 'Ter'], [/\bHighway\b/g, 'Hwy'], [/^(North|South|East|West) /, m => m[0] + ' '],
    [/ (North|South|East|West)$/, m => ' ' + m[1]]];
  const short = n => { if (!n) return 'the road'; let s = n; ABBR.forEach(([a, b]) => { s = s.replace(a, b); }); return s; };
  const spoken = n => n || 'the road';
  const lc = x => x.charAt(0).toLowerCase() + x.slice(1);
  const ftText = (d, longForm) => {
    const ft = d * FT;
    if (ft < 1000) { const v = Math.max(50, Math.round(ft / 50) * 50); return v + (longForm ? ' feet' : ' ft'); }
    const mi = d / MI; const v = mi < 10 ? mi.toFixed(1) : String(Math.round(mi));
    return v + (longForm ? (v === '1.0' ? ' mile' : ' miles') : ' mi');
  };
  const bearing = (a, b) => Math.atan2(b[0] - a[0], b[1] - a[1]) * 180 / Math.PI; // projected [x east, y north], degrees from north
  const norm = a => { while (a > 180) a -= 360; while (a <= -180) a += 360; return a; };

  // Build the loop as one list of points with distance along it, the street of each point, and the maneuvers.
  function build(t, P) {
    const R = { ll: [], m: [], s: [], hop: [], legOf: [], legs: [], man: [], parts: [] };
    let s = 0;
    (t.loops || []).forEach((seq) => {
      const legs = [], pts = [];
      seq.forEach(si => {
        let c = t.streetsD[Math.abs(si) - 1]; if (!c) return;
        if (si < 0) c = c.slice().reverse();
        const i0 = pts.length ? pts.length - 1 : 0;
        pts.push(...(pts.length ? c.slice(1) : c));
        legs.push({ si, i0, i1: pts.length - 1, name: (t.names || [])[Math.abs(si) - 1] || '' });
      });
      if (pts.length < 2) return;
      const off = R.ll.length, legOff = R.legs.length;
      pts.forEach((q, k) => {
        const mm = P(q);
        if (R.m.length && !(k === 0 && off > 0)) s += Math.hypot(mm[0] - R.m[R.m.length - 1][0], mm[1] - R.m[R.m.length - 1][1]); // the jump between parts adds no distance
        R.ll.push(q); R.m.push(mm); R.s.push(s); R.hop.push(k === 0 && off > 0); // segment ending here is a jump between parts
      });
      legs.forEach((l, j) => { R.legs.push({ ...l, i0: l.i0 + off, i1: l.i1 + off, part: R.parts.length }); });
      for (let j = 0; j < legs.length; j++) for (let i = legs[j].i0 + off; i <= legs[j].i1 + off; i++) R.legOf[i] = legOff + j;
      R.parts.push({ i0: off, i1: R.ll.length - 1, legs: [legOff, R.legs.length - 1] });
    });
    const N = R.s.length;
    // point at distance x along the loop, staying inside one part
    const at = (x, lo, hi) => {
      x = Math.max(R.s[lo], Math.min(R.s[hi], x));
      let i = lo; while (i < hi && R.s[i + 1] < x) i++;
      if (i >= hi) return R.m[hi];
      const f = (x - R.s[i]) / ((R.s[i + 1] - R.s[i]) || 1);
      return [R.m[i][0] + (R.m[i + 1][0] - R.m[i][0]) * f, R.m[i][1] + (R.m[i + 1][1] - R.m[i][1]) * f];
    };
    R.at = at;
    R.parts.forEach((pt, pi) => {
      for (let j = pt.legs[0]; j < pt.legs[1]; j++) {
        const a = R.legs[j], b = R.legs[j + 1], i = a.i1, x = R.s[i];
        const pin = at(x - 20, pt.i0, pt.i1), pout = at(x + 20, pt.i0, pt.i1);
        const ang = norm(bearing(pin, R.m[i]) - bearing(R.m[i], pout));
        const turn = -ang; // positive = right
        const same = a.name === b.name, uturn = a.si === -b.si || Math.abs(turn) >= 165;
        let type;
        if (uturn) type = 'u';
        else if (Math.abs(turn) < 25) { if (same || !a.name || !b.name) continue; type = 'straight'; }
        else if (Math.abs(turn) < 50) { if (same) continue; type = turn > 0 ? 'slight right' : 'slight left'; }
        else if (Math.abs(turn) < 135) type = turn > 0 ? 'right' : 'left';
        else type = turn > 0 ? 'sharp right' : 'sharp left';
        R.man.push({ i, s: x, type, turn, name: b.name, from: a.name, part: pi });
      }
      const last = pt.i1;
      R.man.push({ i: last, s: R.s[last], type: pi < R.parts.length - 1 ? 'part' : 'end', name: '', part: pi, next: pi + 1 });
    });
    return R;
  }

  function words(mv, long) {
    const n = long ? spoken(mv.name) : short(mv.name);
    switch (mv.type) {
      case 'u': return long ? `Turn around and come back on ${spoken(mv.from)}` : `Turn around on ${short(mv.from)}`;
      case 'straight': return `Continue onto ${n}`;
      case 'part': return long ? 'This part of the area is done. Head to the next part' : 'Part done, head to the next part';
      case 'end': return long ? 'You have reached the end of the loop' : 'End of the loop';
      default: {
        const verb = `Turn ${mv.type}`;
        if (mv.name && mv.name === mv.from) return `${verb} to stay on ${n}`;
        return mv.name ? `${verb} onto ${n}` : verb;
      }
    }
  }
  function arrowSvg(mv) {
    if (mv.type === 'u') return '<svg viewBox="0 0 48 48" width="56" height="56"><path d="M30 42V18a10 10 0 0 0-20 0v6" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/><path d="M2 20l8 10 8-10" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    if (mv.type === 'end' || mv.type === 'part') return '<svg viewBox="0 0 48 48" width="56" height="56"><path d="M12 44V6m0 2h24l-6 8 6 8H12" fill="none" stroke="#fff" stroke-width="4.5" stroke-linejoin="round" stroke-linecap="round"/></svg>';
    const deg = { straight: 0, 'slight right': 40, right: 90, 'sharp right': 135, 'slight left': -40, left: -90, 'sharp left': -135 }[mv.type] || 0;
    return `<svg viewBox="0 0 48 48" width="56" height="56"><g transform="rotate(${deg} 24 24)"><path d="M24 42V8M12 20L24 8l12 12" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></g></svg>`;
  }

  window.startDrive = function (ctx) {
    const { map, t, P, token, mapEl, onExit } = ctx;
    const R = build(t, P), N = R.s.length;
    if (N < 2) return null;
    const key = 'jfs_drv_' + token;
    let pos = 0; try { pos = Number(localStorage.getItem(key)) || 0; } catch {}
    let pending = null, jumped = false;
    let started = false, follow = true, muted = false, off = 0, lastLL = null, heading = null, lastFixP = null;
    const said = {}; let saidOff = false, lock = null;

    // full-screen layout
    const saved = mapEl.getAttribute('style') || '';
    mapEl.setAttribute('style', 'position:fixed;left:0;top:0;width:100vw;height:100vh;height:100dvh;z-index:900;border-radius:0;border:0');
    document.body.style.overflow = 'hidden';
    const ui = document.createElement('div');
    ui.innerHTML = `
      <div id="dvTop" style="position:fixed;left:8px;right:8px;top:calc(8px + env(safe-area-inset-top));z-index:1001;background:#1f4e9c;color:#fff;border-radius:14px;padding:10px 12px;box-shadow:0 4px 14px rgba(0,0,0,.35);font-family:Poppins,system-ui,sans-serif">
        <div style="display:flex;align-items:center;gap:10px">
          <div id="dvArrow" style="flex:none;width:56px;height:56px"></div>
          <div style="min-width:0;flex:1">
            <div id="dvDist" style="font-size:1.6rem;font-weight:700;line-height:1.1"></div>
            <div id="dvMain" style="font-size:1.05rem;font-weight:600;line-height:1.25"></div>
          </div>
        </div>
        <div id="dvThen" style="font-size:.85rem;opacity:.9;margin-top:6px;display:none"></div>
        <button id="dvRestart" style="margin-top:8px;display:none;border:0;border-radius:10px;padding:8px 12px;font-weight:700;background:#fff;color:#1f4e9c">Start over from the beginning</button>
        <div id="dvGo" style="margin-top:8px;display:none"><a id="dvGoA" target="_blank" rel="noopener" style="display:inline-block;background:#fff;color:#1f4e9c;font-weight:700;border-radius:10px;padding:8px 12px;text-decoration:none">Directions in Google Maps</a></div>
      </div>
      <div style="position:fixed;left:8px;right:8px;bottom:calc(8px + env(safe-area-inset-bottom));z-index:1001;display:flex;gap:8px;align-items:center;font-family:Poppins,system-ui,sans-serif">
        <button id="dvExit" style="flex:none;border:0;border-radius:12px;padding:12px 14px;font-weight:700;background:#fff;color:#b3261e;box-shadow:0 2px 8px rgba(0,0,0,.3)">Exit</button>
        <div id="dvProg" style="flex:1;min-width:0;background:rgba(255,255,255,.95);border-radius:12px;padding:8px 10px;font-size:.8rem;color:#222;box-shadow:0 2px 8px rgba(0,0,0,.3)"></div>
        <button id="dvCenter" style="flex:none;border:0;border-radius:12px;padding:12px 12px;font-weight:700;background:#1f4e9c;color:#fff;display:none;box-shadow:0 2px 8px rgba(0,0,0,.3)">Re-center</button>
        <button id="dvMute" style="flex:none;border:0;border-radius:12px;padding:12px 12px;font-weight:700;background:#fff;color:#222;box-shadow:0 2px 8px rgba(0,0,0,.3)">Mute</button>
      </div>`;
    document.body.appendChild(ui);
    const $ = id => ui.querySelector('#' + id);
    setTimeout(() => map.invalidateSize(), 50);

    const ahead = L.polyline([], { color: '#6a3fb5', weight: 8, opacity: 0.85, interactive: false }).addTo(map);
    const rejoin = L.polyline([], { color: '#b3261e', weight: 4, dashArray: '6 8', interactive: false }).addTo(map);
    const nextPin = L.circleMarker([0, 0], { radius: 9, color: '#6a3fb5', weight: 4, fillColor: '#fff', fillOpacity: 1, interactive: false });
    const meIcon = deg => L.divIcon({ className: '', iconSize: [34, 34], iconAnchor: [17, 17],
      html: `<div style="width:34px;height:34px;transform:rotate(${deg || 0}deg)"><svg viewBox="0 0 34 34" width="34" height="34"><circle cx="17" cy="17" r="15" fill="#1a73e8" stroke="#fff" stroke-width="3"/>${deg == null ? '' : '<path d="M17 6l7 15-7-4-7 4z" fill="#fff"/>'}</svg></div>` });
    let me = null;

    function speak(txt) {
      if (muted || !('speechSynthesis' in window)) return;
      try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(txt); u.lang = 'en-US'; u.rate = 1; speechSynthesis.speak(u); } catch {}
    }
    window.__driveSay = speak; // for testing

    async function keepAwake() { try { if (navigator.wakeLock && !lock) { lock = await navigator.wakeLock.request('screen'); lock.addEventListener('release', () => { lock = null; }); } } catch {} }
    const onVis = () => { if (document.visibilityState === 'visible') keepAwake(); };
    document.addEventListener('visibilitychange', onVis);
    keepAwake();

    // Closest point on the loop to p within [lo, hi] (distance along the loop). Skips the jumps between parts.
    function nearest(p, lo, hi, hd) {
      let best = null;
      for (let i = 1; i < N; i++) {
        if (R.hop[i] || R.s[i] < lo || R.s[i - 1] > hi) continue;
        const a = R.m[i - 1], b = R.m[i], dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy;
        let f = L2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2 : 0; f = Math.max(0, Math.min(1, f));
        const d = Math.hypot(a[0] + f * dx - p[0], a[1] + f * dy - p[1]);
        let pen = d;
        if (hd != null && L2 > 4) { const diff = Math.abs(norm(bearing(a, b) - hd)); if (diff > 110) pen += 25; } // driving the other way
        const x = R.s[i - 1] + f * (R.s[i] - R.s[i - 1]);
        if (!best || pen < best.pen - 3 || (Math.abs(pen - best.pen) <= 3 && x < best.x)) best = { d, pen, x, i };
      }
      return best;
    }
    const llAt = x => { let i = 0; while (i < N - 1 && R.s[i + 1] < x) i++; const j = Math.min(i + 1, N - 1);
      const f = R.s[j] > R.s[i] ? (x - R.s[i]) / (R.s[j] - R.s[i]) : 0; return [R.ll[i][0] + (R.ll[j][0] - R.ll[i][0]) * f, R.ll[i][1] + (R.ll[j][1] - R.ll[i][1]) * f]; };
    let curPart = 0;
    const partOf = x => { for (let k = curPart; k < R.parts.length; k++) if (x < R.s[R.parts[k].i1] - 0.01 || k === R.parts.length - 1) return k; return R.parts.length - 1; };

    function drawAhead() {
      const pts = []; const pi = partOf(pos), end = R.parts[pi].i1;
      pts.push(llAt(pos));
      for (let i = 0; i <= end; i++) { if (R.s[i] <= pos) continue; if (R.s[i] > pos + 700) break; pts.push(R.ll[i]); }
      ahead.setLatLngs(pts);
    }

    function nextMan() { return R.man.find(m => m.s > pos + 3); }
    function update(ll) {
      const mv = nextMan();
      if (!mv) return;
      const d = mv.s - pos;
      const idx = R.man.indexOf(mv), mv2 = R.man[idx + 1];
      if (off) {
        $('dvArrow').innerHTML = arrowSvg({ type: 'end' });
        return;
      }
      $('dvArrow').innerHTML = arrowSvg(mv);
      $('dvDist').textContent = ftText(d);
      $('dvMain').textContent = words(mv, false);
      if (mv2 && mv2.s - mv.s < 150 && mv.type !== 'end' && mv.type !== 'part') { $('dvThen').style.display = ''; $('dvThen').textContent = 'Then ' + lc(words(mv2, false)); }
      else $('dvThen').style.display = 'none';
      $('dvGo').style.display = 'none';
      nextPin.setLatLng(R.ll[mv.i]); if (!map.hasLayer(nextPin)) nextPin.addTo(map);
      // speech
      const k = idx; said[k] = said[k] || {};
      const v = lastFixP && lastFixP.speed ? lastFixP.speed : 9;
      const nowAt = Math.max(30, v * 4), farAt = Math.max(150, v * 14);
      const prevS = idx > 0 ? R.man[idx - 1].s : -1e9;
      if (!said[k].now && d <= nowAt) {
        said[k].now = said[k].far = true;
        let txt = words(mv, true);
        if (mv2 && mv2.s - mv.s < 80 && mv.type !== 'end' && mv.type !== 'part') txt += ', then ' + lc(words(mv2, true));
        speak(txt);
      } else if (!said[k].far && d <= farAt && d > nowAt + 20 && mv.s - prevS > 60 && mv.type !== 'part' && mv.type !== 'end') {
        said[k].far = true; speak(`In ${ftText(d, true)}, ${lc(words(mv, true))}`);
      }
      $('dvProg').textContent = `${(pos / MI).toFixed(1)} of ${(R.s[N - 1] / MI).toFixed(1)} mi done` + (R.parts.length > 1 ? ` · part ${partOf(pos) + 1}/${R.parts.length}` : '');
    }

    function showRejoin(ll, target, why) {
      const p = P(ll), tp = P(target); const d = Math.hypot(tp[0] - p[0], tp[1] - p[1]);
      rejoin.setLatLngs([ll, target]);
      const leg = R.legs[R.legOf[nearest(tp, 0, 1e12).i]] || {};
      $('dvDist').textContent = ftText(d);
      $('dvMain').textContent = why === 'start' ? `Head to the start, on ${short(leg.name)}` : why === 'part' ? `Head to the next part, on ${short(leg.name)}` : `Off the loop. Rejoin on ${short(leg.name)}`;
      $('dvThen').style.display = 'none';
      $('dvArrow').innerHTML = arrowSvg({ type: 'end' });
      if (d > 250) { $('dvGo').style.display = ''; $('dvGoA').href = `https://www.google.com/maps/dir/?api=1&destination=${target[0].toFixed(5)},${target[1].toFixed(5)}&travelmode=driving`; }
      else $('dvGo').style.display = 'none';
      nextPin.setLatLng(target); if (!map.hasLayer(nextPin)) nextPin.addTo(map);
      if (!saidOff) { saidOff = true; speak(why === 'start' ? `Head to the start of the loop, on ${spoken(leg.name)}` : why === 'part' ? `Head to the next part of the area, on ${spoken(leg.name)}` : `You are off the loop. Rejoin on ${spoken(leg.name)}`); }
    }

    function onFix(fix) {
      const ll = [fix.coords.latitude, fix.coords.longitude], p = P(ll);
      // heading: from the phone when moving, else from the last few metres of movement
      if (fix.coords.heading != null && !isNaN(fix.coords.heading) && (fix.coords.speed || 0) > 1.5) heading = fix.coords.heading;
      else if (lastLL) { const q = P(lastLL); if (Math.hypot(p[0] - q[0], p[1] - q[1]) > 8) heading = bearing(q, p); }
      if (!lastLL || Math.hypot(p[0] - P(lastLL)[0], p[1] - P(lastLL)[1]) > 8) lastLL = ll;
      lastFixP = fix.coords;
      if (!me) me = L.marker(ll, { icon: meIcon(heading), interactive: false, zIndexOffset: 1000 }).addTo(map);
      else { me.setLatLng(ll); me.setIcon(meIcon(heading)); }
      if (follow) {
        let c = ll;
        if (heading != null) { const r = heading * Math.PI / 180, aheadM = 70; c = [ll[0] + Math.cos(r) * aheadM / 111320, ll[1] + Math.sin(r) * aheadM / (111320 * Math.cos(ll[0] * Math.PI / 180))]; }
        map.setView(c, Math.max(map.getZoom(), 17), { animate: true, duration: 0.6 });
      }
      if (fix.coords.accuracy > 60) { $('dvProg').textContent = 'Waiting for a better GPS signal...'; return; }
      const hd = (fix.coords.speed || 0) > 2 ? heading : null;
      let hit = nearest(p, pos - 60, pos + (started ? 500 : 300), hd);
      if (hit && hit.d > 35) hit = null;
      if (!hit && started) {
        // Somewhere else on the loop. A short skip ahead (a dead end seen from the corner) is taken at once.
        // A longer jump, or going back, only after several fixes in a row move forward along that spot,
        // so crossing a loop street further on does not skip everything in between.
        const far = nearest(p, 0, 1e12, hd);
        if (far && far.d <= 30) {
          if (far.x > pos && far.x - pos <= 800 && far.x >= R.s[R.parts[curPart].i0]) { hit = far; pending = null; }
          else {
            if (pending && far.x >= pending.x - 10 && far.x - pending.x < 200) { if (far.x - pending.x >= 3) { pending.n++; pending.x = far.x; } } else pending = { x: far.x, n: 1 }; // must be moving along it
            if (pending.n >= 4) { hit = far; pending = null; jumped = true; }
          }
        } else pending = null;
      } else if (hit) pending = null;
      if (hit) {
        if (!started) { started = true; $('dvRestart').style.display = 'none'; }
        const wasOff = off; off = 0; saidOff = false; rejoin.setLatLngs([]);
        if (jumped) { pos = hit.x; curPart = 0; jumped = false; Object.keys(said).forEach(k => delete said[k]); } else pos = Math.max(pos, hit.x);
        for (let k = 0; k < R.parts.length; k++) if (hit.i > R.parts[k].i0 && hit.i <= R.parts[k].i1) curPart = Math.max(curPart, k);
        if (wasOff) Object.keys(said).forEach(k => { if (R.man[k] && R.man[k].s <= pos) said[k] = { far: true, now: true }; });
        try { localStorage.setItem(key, String(pos)); } catch {}
        drawAhead(); update(ll);
      } else {
        off++;
        if (off >= 2 || !started) {
          const pi = curPart, atPartEnd = started && pos >= R.s[R.parts[pi].i1] - 30 && pi < R.parts.length - 1;
          let target, why;
          if (!started) { target = llAt(pos); why = 'start'; }
          else if (atPartEnd) { target = R.ll[R.parts[pi + 1].i0]; why = 'part'; }
          else { const n = nearest(p, pos, 1e12, null); target = llAt(n.x); why = 'off'; }
          showRejoin(ll, target, why);
        }
      }
    }

    map.on('dragstart', onDrag);
    function onDrag() { follow = false; $('dvCenter').style.display = ''; }
    $('dvCenter').onclick = () => { follow = true; $('dvCenter').style.display = 'none'; if (me) map.setView(me.getLatLng(), Math.max(map.getZoom(), 17)); };
    $('dvMute').onclick = () => { muted = !muted; $('dvMute').textContent = muted ? 'Unmute' : 'Mute'; if (muted) try { speechSynthesis.cancel(); } catch {} };
    $('dvExit').onclick = () => stop();

    function stop() {
      map.off('dragstart', onDrag);
      document.removeEventListener('visibilitychange', onVis);
      [ahead, rejoin, nextPin].forEach(l => { try { map.removeLayer(l); } catch {} });
      if (me) map.removeLayer(me);
      try { speechSynthesis.cancel(); } catch {}
      try { lock && lock.release(); } catch {}
      ui.remove(); document.body.style.overflow = '';
      mapEl.setAttribute('style', saved);
      setTimeout(() => map.invalidateSize(), 50);
      if (onExit) onExit();
    }

    function onErr(msg) { $('dvDist').textContent = 'No location'; $('dvMain').textContent = msg; }
    // first screen before any GPS fix
    $('dvArrow').innerHTML = arrowSvg({ type: 'end' });
    $('dvDist').textContent = 'Finding you...';
    $('dvMain').textContent = pos > 50 ? `Picking up where you left off, ${(pos / MI).toFixed(1)} mi into the loop.` : 'Keep this page open with the screen on. A car charger helps.';
    if (pos > 50) $('dvRestart').style.display = '';
    $('dvRestart').onclick = () => { pos = 0; try { localStorage.setItem(key, '0'); } catch {} $('dvRestart').style.display = 'none'; saidOff = false; Object.keys(said).forEach(k => delete said[k]); drawAhead(); $('dvMain').textContent = 'Starting from the beginning of the loop.'; };
    $('dvProg').textContent = `${(pos / MI).toFixed(1)} of ${(R.s[N - 1] / MI).toFixed(1)} mi done`;
    speak('Starting turn by turn. Keep this page open.');
    drawAhead();
    return { onFix, onErr, stop, _R: R, get pos() { return pos; } };
  };
  window.__driveBuild = build; // for testing
})();

// Printable route sheets. Shared by the volunteer route page and the organizer page.
// One sheet per route: header, OSM map with numbered markers and the driving line, then the checklist.
// Deliberately self-contained: no map library and no build step. Tiles come through /api/tile, which
  // identifies the app to OSM; hotlinking their tiles directly prints an "Access blocked" grid. Plain <img>
// elements and the overlay is inline SVG, because both print without "Background graphics" ticked.
(function () {
  const TILE = 256, MAPW = 720, MAPH_MAX = 820; // 720 CSS px = 7.5in at 96dpi, the printable width of letter with 0.5in margins
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // Pickup edition (Nov 4 2026): a stop is open while it reads "To pick up". Old delivery stops read "Needs delivery".
  const isDone = s => !!s.status && s.status !== 'To pick up' && s.status !== 'Needs delivery';

  const pullGroups = area => window.pullGroups(area); // from /pull.js
  const pullSheetHtml = area => `<div class="sh-pull"><b>Pick up these signs:</b>${pullGroups(area).map(g => `<div><span>${esc(g[0])}:</span> ${g[1].map(esc).join(' · ')}</div>`).join('')}</div>`;

  const lon2x = (lon, z) => ((lon + 180) / 360) * Math.pow(2, z) * TILE;
  const lat2y = (lat, z) => {
    const s = Math.sin(lat * Math.PI / 180);
    return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * Math.pow(2, z) * TILE;
  };

  function mapHeight(n) { return n <= 12 ? 380 : n <= 16 ? 330 : 290; } // keep the checklist on the same page

  // Biggest zoom where every stop still fits inside the box, with room for the markers.
  // Area maps (31 Oct): a fractional zoom, so the area fills the box instead of jumping down a whole tile level.
  // Tiles come from the next whole zoom up and are drawn slightly smaller, which keeps print sharp.
  function fitZoom(pts, w, h, pad) {
    const xs = pts.map(p => lon2x(p.lng, 0)), ys = pts.map(p => lat2y(p.lat, 0));
    const sx = Math.max(...xs) - Math.min(...xs) || 1e-9, sy = Math.max(...ys) - Math.min(...ys) || 1e-9;
    return Math.max(9, Math.min(17, Math.log2(Math.min((w - pad) / sx, (h - pad) / sy))));
  }
  function pickZoom(pts, w, h) {
    for (let z = 17; z >= 9; z--) {
      const xs = pts.map(p => lon2x(p.lng, z)), ys = pts.map(p => lat2y(p.lat, z));
      if (Math.max(...xs) - Math.min(...xs) <= w - 56 && Math.max(...ys) - Math.min(...ys) <= h - 56) return z;
    }
    return 9;
  }

  // Streets in ~60 m pieces, darker and thicker where more open signs are within 90 m (same rule as the route page).
  function heatStreets(turf, stops, xy) {
    const M = 111320, open = stops.filter(s => typeof s.lat === 'number'); // every known sign
    const dist = (a, b) => Math.hypot((a[0] - b[0]) * M, (a[1] - b[1]) * M * Math.cos(a[0] * Math.PI / 180));
    const style = n => n >= 3 ? ['#a83e00', 4.6, 0.95] : n === 2 ? ['#d25a00', 3.8, 0.92] : n === 1 ? ['#ec7a12', 3, 0.9] : ['#f5a65b', 1.8, 0.8];
    let out = '', glow = '';
    turf.streetsD.forEach(c => {
      let piece = [c[0]], len = 0;
      const flush = () => {
        if (piece.length < 2) return;
        const mid = piece[Math.floor(piece.length / 2)];
        const n = open.filter(s => dist(mid, [s.lat, s.lng]) <= 90).length, [col, w, op] = style(n);
        const pts = piece.map(xy).join(' ');
        if (n) glow += `<polyline points="${pts}" fill="none" stroke="#ff6a00" stroke-width="${n >= 3 ? 16 : n === 2 ? 12 : 9}" stroke-linecap="round" opacity="${n >= 3 ? 0.34 : n === 2 ? 0.27 : 0.2}"/>`;
        out += `<polyline points="${pts}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" opacity="${op}"/>`;
      };
      for (let i = 1; i < c.length; i++) {
        const d = dist(c[i - 1], c[i]), k = Math.max(1, Math.ceil(d / 60));
        for (let j = 1; j <= k; j++) {
          const f = j / k, q = [c[i - 1][0] + (c[i][0] - c[i - 1][0]) * f, c[i - 1][1] + (c[i][1] - c[i - 1][1]) * f];
          piece.push(q); len += d / k;
          if (len >= 60) { flush(); piece = [q]; len = 0; }
        }
      }
      flush();
    });
    return glow + out; // glow first, so it sits under the streets and the loop
  }

  // The suggested loop as a dashed purple line with arrows, the same loop the route page shows.
  function loopSvg(turf, z, left, top, h) {
    if (!window.turfLoops) return '';
    const px = q => [lon2x(q[1], z) - left, lat2y(q[0], z) - top];
    let out = '';
    window.turfLoops(turf).forEach((l, li) => {
      const p = l.map(px);
      out += `<polyline points="${p.map(q => q[0].toFixed(1) + ',' + q[1].toFixed(1)).join(' ')}" fill="none" stroke="#6a3fb5" stroke-width="1.6" stroke-dasharray="5 4" opacity="0.9"/>`;
      let run = 0;
      for (let k = 1; k < p.length; k++) {
        const dx = p[k][0] - p[k - 1][0], dy = p[k][1] - p[k - 1][1]; run += Math.hypot(dx, dy);
        if (run >= 80 && p[k][0] > 0 && p[k][0] < MAPW && p[k][1] > 0 && p[k][1] < h) {
          run = 0; const ang = Math.atan2(dy, dx) * 180 / Math.PI;
          out += `<path d="M5,0 L-4,-4 L-4,4 Z" fill="#6a3fb5" transform="translate(${p[k][0].toFixed(1)},${p[k][1].toFixed(1)}) rotate(${ang.toFixed(0)})"/>`;
        }
      }
      if (p.length && li === 0) out += `<g transform="translate(${p[0][0].toFixed(1)},${p[0][1].toFixed(1)})"><rect x="-17" y="-18" width="34" height="13" rx="6" fill="#6a3fb5"/><text x="0" y="-8" text-anchor="middle" font-size="9" font-weight="700" fill="#fff">Start</text></g>`;
    });
    return out;
  }
  // Road names along the edge of the area, so the border can be followed on paper.
  function borderSvg(turf, z, left, top, h) {
    if (!turf.borders || !window.decodePolyline) return '';
    const px = q => [lon2x(q[1], z) - left, lat2y(q[0], z) - top];
    const inBox = q => q[0] > 30 && q[0] < MAPW - 30 && q[1] > 14 && q[1] < h - 14;
    const ring = turf.polyD.reduce((m, r) => r.length > m.length ? r : m, turf.polyD[0]).map(px);
    const c = [ring.reduce((a, q) => a + q[0], 0) / ring.length, ring.reduce((a, q) => a + q[1], 0) / ring.length];
    let out = '';
    turf.borders.slice(0, 8).forEach(b => {
      // longest piece of this road that is on the map
      let best = null;
      b.p.forEach(e => {
        const p = window.decodePolyline(e).map(px).filter(inBox);
        let L = 0; for (let k = 1; k < p.length; k++) L += Math.hypot(p[k][0] - p[k - 1][0], p[k][1] - p[k - 1][1]);
        if (p.length > 1 && (!best || L > best.L)) best = { p, L };
      });
      if (!best || best.L < 70) return;
      const p = best.p; let run = 0, k = 1;
      for (; k < p.length; k++) { run += Math.hypot(p[k][0] - p[k - 1][0], p[k][1] - p[k - 1][1]); if (run >= best.L / 2) break; }
      k = Math.min(k, p.length - 1);
      let ang = Math.atan2(p[k][1] - p[k - 1][1], p[k][0] - p[k - 1][0]) * 180 / Math.PI;
      if (ang > 90) ang -= 180; if (ang < -90) ang += 180;
      let m = [(p[k][0] + p[k - 1][0]) / 2, (p[k][1] + p[k - 1][1]) / 2];
      // nudge the name just outside the area, away from its middle, so stop pins do not cover it
      const dx = p[k][0] - p[k - 1][0], dy = p[k][1] - p[k - 1][1], L = Math.hypot(dx, dy) || 1;
      let nx = -dy / L, ny = dx / L;
      if ((m[0] - c[0]) * nx + (m[1] - c[1]) * ny < 0) { nx = -nx; ny = -ny; }
      const mo = [m[0] + nx * 12, m[1] + ny * 12];
      if (inBox(mo)) m = mo;
      out += `<text transform="translate(${m[0].toFixed(1)},${m[1].toFixed(1)}) rotate(${ang.toFixed(0)})" text-anchor="middle" dy="4" font-size="12" font-weight="800" fill="#7a1010" stroke="#fff" stroke-width="3.5" paint-order="stroke" letter-spacing=".02em">${esc(b.n)}</text>`;
    });
    return out;
  }
  // Area maps: small dots (squares for large signs) so the streets stay readable. A stop number is printed
  // next to its dot only where it fits without overlapping another number or dot; the list below has every stop.
  function smallPins(pts) {
    const boxes = [], dots = pts.map(p => [p.x, p.y]);
    const hit = (b) => boxes.some(o => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1])
      || dots.some(d => d[0] > b[0] - 3 && d[0] < b[2] + 3 && d[1] > b[1] - 3 && d[1] < b[3] + 3);
    let marks = '', labels = '';
    pts.forEach(p => {
      const done = isDone(p.s), fill = done ? '#9bd3ad' : '#fff';
      marks += p.s.large
        ? `<rect x="${(p.x - 4).toFixed(1)}" y="${(p.y - 4).toFixed(1)}" width="8" height="8" fill="${done ? fill : '#383838'}" stroke="#383838" stroke-width="1.2"/>`
        : `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.6" fill="${fill}" stroke="#383838" stroke-width="1.4"/>`;
    });
    pts.forEach(p => {
      const t = String(p.s.stop), w = t.length * 5.6 + 2, H = 9;
      for (const [dx, dy, anchor] of [[6, -4, 'start'], [6, 9, 'start'], [-6, -4, 'end'], [-6, 9, 'end']]) {
        const x0 = anchor === 'start' ? p.x + dx : p.x + dx - w, y1 = p.y + dy, b = [x0, y1 - H, x0 + w, y1 + 1];
        if (b[0] < 2 || b[2] > MAPW - 2 || b[1] < 2) continue;
        if (!hit(b)) {
          boxes.push(b);
          labels += `<text x="${(p.x + dx).toFixed(1)}" y="${y1.toFixed(1)}" text-anchor="${anchor}" font-size="9" font-weight="700" fill="#222" stroke="#fff" stroke-width="2.5" paint-order="stroke">${t}</text>`;
          break;
        }
      }
    });
    return marks + labels;
  }

  const SHN = [[/\bStreet\b/g, 'St'], [/\bAvenue\b/g, 'Ave'], [/\bDrive\b/g, 'Dr'], [/\bRoad\b/g, 'Rd'], [/\bLane\b/g, 'Ln'], [/\bCourt\b/g, 'Ct'],
    [/\bCircle\b/g, 'Cir'], [/\bBoulevard\b/g, 'Blvd'], [/\bTrail\b/g, 'Trl'], [/\bPlace\b/g, 'Pl'], [/\bParkway\b/g, 'Pkwy'], [/\bTerrace\b/g, 'Ter'],
    [/ South$/, ' S'], [/ North$/, ' N'], [/ West$/, ' W'], [/ East$/, ' E'], [/^West /, 'W '], [/^East /, 'E ']];
  const shortName = n => SHN.reduce((s, [a, b]) => s.replace(a, b), n);
  // Streets numbered in the order the suggested loop first reaches them (short stubs at the border left out).
  function streetOrder(turf) {
    if (!turf || !turf.names || !turf.loops || !turf.streetsD) return [];
    const len = {}, first = {};
    turf.names.forEach((n, i) => {
      if (!n || !turf.streetsD[i]) return;
      const c = turf.streetsD[i]; let L = 0;
      for (let k = 1; k < c.length; k++) { const dy = (c[k][0] - c[k - 1][0]) * 111320, dx = (c[k][1] - c[k - 1][1]) * 111320 * Math.cos(c[k][0] * Math.PI / 180); L += Math.hypot(dx, dy); }
      const key = shortName(n); len[key] = (len[key] || 0) + L;
    });
    const out = [];
    turf.loops.forEach(seq => seq.forEach(si => {
      const i = Math.abs(si) - 1, n = turf.names[i]; if (!n) return;
      const key = shortName(n);
      if (len[key] >= 75 && !(key in first)) { first[key] = out.length + 1; out.push({ n: out.length + 1, name: key, idx: i }); }
    }));
    return out;
  }
  window.streetOrder = streetOrder;
  window.streetShortName = shortName; // also used to match hand-ticked streets to map pieces (coverage, 31 Oct)
  // The street numbers on the map: a small badge on each street where the loop first reaches it. A badge is
  // left off where it would cover another one; the numbered checklist below has every street.
  function streetNumbers(turf, z, left, top, h) {
    const px = q => [lon2x(q[1], z) - left, lat2y(q[0], z) - top];
    const boxes = []; let out = '';
    streetOrder(turf).forEach(o => {
      const c = turf.streetsD[o.idx].map(px), m = c[Math.floor(c.length / 2)];
      const t = String(o.n), w = t.length * 5.4 + 6, b = [m[0] - w / 2, m[1] - 6, m[0] + w / 2, m[1] + 6];
      if (b[0] < 2 || b[2] > MAPW - 2 || b[1] < 2 || b[3] > h - 2) return;
      if (boxes.some(x => b[0] < x[2] + 1 && b[2] > x[0] - 1 && b[1] < x[3] + 1 && b[3] > x[1] - 1)) return;
      boxes.push(b);
      out += `<g><rect x="${b[0].toFixed(1)}" y="${b[1].toFixed(1)}" width="${w.toFixed(1)}" height="12" rx="6" fill="#fff" stroke="#1f4e9c" stroke-width="1.2"/>`
        + `<text x="${m[0].toFixed(1)}" y="${(m[1] + 3.3).toFixed(1)}" text-anchor="middle" font-size="8.5" font-weight="800" fill="#1f4e9c">${t}</text></g>`;
    });
    return out;
  }

  // Every street name in the area, to tick off on paper.
  function streetList(turf) {
    const order = streetOrder(turf);
    if (!order.length) return '';
    return `<div class="sh-streets"><div class="sh-st-h">Streets in order (${order.length}). The numbers match the map. Tick each one off as you finish it.</div>
      <div class="sh-st-cols">${order.map(o => `<div>&#9744; <b>${o.n}</b> ${esc(o.name)}</div>`).join('')}</div></div>`;
  }

  // turf (optional, 29 Oct 2026): the route's area and its streets, from /api/turf via window.loadTurf.
  function mapHtml(stops, turf, hFit) {
    const stopPts = stops.filter(s => typeof s.lat === 'number' && typeof s.lng === 'number');
    // With an area, frame its biggest part; outlying stops still print in the list below.
    const ringArea = r => Math.abs(r.reduce((a, p, i) => { const q = r[(i + 1) % r.length]; return a + p[1] * q[0] - q[1] * p[0]; }, 0));
    const main = turf ? turf.polyD.reduce((m, r) => ringArea(r) > ringArea(m) ? r : m, turf.polyD[0]) : null;
    const pts = turf ? main.map(p => ({ lat: p[0], lng: p[1] })) : stopPts;
    if (pts.length < 1) return '<div class="sh-nomap">No map: these stops have no coordinates yet.</div>';
    // Area maps (31 Oct): as tall as the area's shape needs, up to most of a letter page (960 px printable),
    // so a tall area fills page one and a wide one leaves room for the street list underneath.
    let h = turf ? 440 : mapHeight(stops.length);
    if (turf) {
      const xs0 = pts.map(p => lon2x(p.lng, 0)), ys0 = pts.map(p => lat2y(p.lat, 0));
      const sx = Math.max(...xs0) - Math.min(...xs0) || 1e-9, sy = Math.max(...ys0) - Math.min(...ys0) || 1e-9;
      h = Math.round(Math.max(420, Math.min(MAPH_MAX, sy * (MAPW - 44) / sx + 44)));
    }
    if (hFit) h = hFit; // set by fitToPages() to keep a sheet from spilling a few lines onto another page
    const z = turf ? fitZoom(pts, MAPW, h, 44) : pickZoom(pts, MAPW, h);
    const zt = Math.min(17, Math.ceil(z - 1e-9)), k = Math.pow(2, z - zt), T = TILE * k; // tile zoom and drawn tile size
    const xs = pts.map(p => lon2x(p.lng, z)), ys = pts.map(p => lat2y(p.lat, z));
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const left = cx - MAPW / 2, top = cy - h / 2;                       // world pixel of the box's top-left
    const x0 = Math.floor(left / T), y0 = Math.floor(top / T);
    const x1 = Math.floor((left + MAPW) / T), y1 = Math.floor((top + h) / T);
    const max = Math.pow(2, zt);
    let tiles = '';
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (ty < 0 || ty >= max) continue;
        const wrapped = ((tx % max) + max) % max;
        tiles += `<img class="sh-tile" alt="" src="https://tile.openstreetmap.org/${zt}/${wrapped}/${ty}.png"`
              + ` style="left:${(tx * T - left).toFixed(2)}px;top:${(ty * T - top).toFixed(2)}px;width:${(T + 0.5).toFixed(2)}px;height:${(T + 0.5).toFixed(2)}px">`;
      }
    }
    const px = stops.map(s => (typeof s.lat === 'number' && typeof s.lng === 'number')
      ? { x: lon2x(s.lng, z) - left, y: lat2y(s.lat, z) - top, s } : null);
    const line = turf ? '' : px.filter(Boolean).map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const xy = q => `${(lon2x(q[1], z) - left).toFixed(1)},${(lat2y(q[0], z) - top).toFixed(1)}`;
    const area = turf ? turf.polyD.map(r => `<polygon points="${r.map(xy).join(' ')}" fill="rgba(31,78,156,0.07)" stroke="#1f4e9c" stroke-width="2"/>`).join('')
      + heatStreets(turf, stops, xy)
      + borderSvg(turf, z, left, top, h) : ''; // no loop on paper (30 Oct): the numbered street order is the guide
    const pins = turf ? streetNumbers(turf, z, left, top, h) : px.filter(Boolean).map(p => {
      const done = isDone(p.s);
      return `<g><circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="11" fill="${done ? '#cfe9d6' : '#fff'}" stroke="#383838" stroke-width="2"/>`
        + `<text x="${p.x.toFixed(1)}" y="${(p.y + 4).toFixed(1)}" text-anchor="middle" font-size="12" font-weight="700" fill="#383838">${p.s.stop}</text></g>`;
    }).join('');
    // The projection rides along on the element so the road line can land in the same frame.
    // The map is drawn at print size (720 px wide) inside .sh-inner and scaled down to fit narrower screens (fitMaps).
    return `<div class="sh-map" style="height:${h}px" data-h="${h}" data-z="${z}" data-left="${left}" data-top="${top}"${turf ? '' : ` data-coords="${esc(px.filter(Boolean).map(p => p.s.lng + ',' + p.s.lat).join(';'))}"`}>
      <div class="sh-inner" style="position:absolute;left:0;top:0;width:${MAPW}px;height:${h}px;transform-origin:0 0">
      ${tiles}
      <svg class="sh-pins" viewBox="0 0 ${MAPW} ${h}" width="${MAPW}" height="${h}">
        ${area}
        <polyline class="sh-line" points="${line}" fill="none" stroke="#383838" stroke-width="2.5" stroke-dasharray="7 5" opacity="0.85"/>
        ${pins}
      </svg>
      <div class="sh-credit">© OpenStreetMap contributors</div>
      </div>
    </div>`;
  }

  // Scale each map to the width it has: a phone screen or a padded sheet is narrower than the 720 px print map.
  // On paper the box is 7.5in = 720 px, so print always gets full size.
  function fitMaps(forPrint) {
    document.querySelectorAll('.sh-map').forEach(m => {
      const inner = m.querySelector('.sh-inner'), h = +m.dataset.h; if (!inner || !h) return;
      const k = forPrint ? 1 : Math.min(1, (m.clientWidth || MAPW) / MAPW);
      inner.style.transform = k < 1 ? `scale(${k})` : '';
      m.style.height = Math.round(h * k) + 'px';
    });
  }
  const printMq = window.matchMedia ? window.matchMedia('print') : null;
  if (printMq && printMq.addEventListener) printMq.addEventListener('change', e => fitMaps(e.matches));
  window.addEventListener('beforeprint', () => fitMaps(true));
  window.addEventListener('afterprint', () => fitMaps(false));
  window.addEventListener('resize', () => { if (!(printMq && printMq.matches)) fitMaps(false); });

  // Swap the straight dashed line for real roads when OSRM answers. It is a nicety, so a failure is silent.
  async function drawRoads(root) {
    const maps = [...root.querySelectorAll('.sh-map[data-coords]')];
    for (const m of maps) {
      const coords = m.dataset.coords;
      if (!coords || coords.split(';').length < 2) continue;
      try {
        const url = 'https://router.project-osrm.org/route/v1/driving/' + coords.split(';').join(';') + '?overview=full&geometries=geojson';
        const j = await fetch(url).then(r => r.ok ? r.json() : null);
        const geo = j && j.routes && j.routes[0] && j.routes[0].geometry;
        if (!geo || !geo.coordinates) continue;
        const poly = m.querySelector('.sh-line');
        // Reuse the exact projection the pins were drawn with, or the road line lands in a different frame.
        const z = +m.dataset.z, left = +m.dataset.left, top = +m.dataset.top;
        if (!Number.isFinite(z) || !poly) continue;
        const pts = geo.coordinates.map(([lon, lat]) => `${(lon2x(lon, z) - left).toFixed(1)},${(lat2y(lat, z) - top).toFixed(1)}`).join(' ');
        poly.setAttribute('points', pts);
        poly.setAttribute('stroke-dasharray', '');
        poly.setAttribute('opacity', '0.6');
      } catch (e) { /* straight line stands */ }
    }
  }

  // Pickup sheet: no names and no phone numbers, only where to go and what to pull.
  function rows(stops) {
    return stops.map(s => {
      const done = isDone(s);
      const addr = s.unit ? esc(s.address).replace(esc(s.unit), '<b>' + esc(s.unit) + '</b>') : esc(s.address);
      const note = [s.notes, s.driverNote].filter(Boolean).join(' · ');
      return `<tr class="${done ? 'sh-done' : ''}">
        <td class="sh-n">${s.stop}</td>
        <td class="sh-addr"><div class="sh-who">${addr}</div>${note ? `<div class="sh-note">${esc(note)}</div>` : ''}</td>
        <td class="sh-grab">${esc(s.grab || '')}</td>
        <td class="sh-box">${done ? (s.status === 'Picked up' ? '✓' : s.status === 'Keeping it' ? 'K' : '–') : ''}</td>
      </tr>`;
    }).join('');
  }

  function sheetHtml(r) {
    const openStops = r.stops.filter(s => !isDone(s));
    const signs = openStops.reduce((t, s) => t + (s.count || 0), 0), large = openStops.reduce((t, s) => t + (s.large || 0), 0);
    const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const foot = `<footer class="sh-foot">Marked something on paper? Text the organizer so the app matches. · ${esc(r.route)} · printed ${date}</footer>`;
    if (r.turf) {
      // Area sheet (30 Oct): map, then the streets in order. No address list; the glow shows where signs are.
      // Compact header (31 Oct) so the map gets the page.
      return `<section class="sh-sheet">
      <header class="sh-head sh-compact">
        <div><h2>${esc(r.route)}${r.volunteer ? ' · ' + esc(r.volunteer) : ''}</h2>
        <div class="sh-area">${esc(String(r.area || '').replace(/\s*\((includes|no) [^)]*\)\s*$/, ''))}</div></div>
        <div class="sh-vol"><span>Signs to pick up</span><b>${r.expectExtra ? `Expect about ${signs + r.expectExtra}` : `About ${signs}`}${large ? ', ' + large + ' large' : ''}</b>${r.expectExtra ? `<span class="sh-est">${signs} on your list + about ${r.expectExtra} more from other DFL campaigns (estimate)</span>` : ''}</div>
      </header>
      <div class="sh-howline">Drive every street inside the blue line, plus the border roads named in red, in the numbered order. Orange glow = more signs there.</div>
      ${pullSheetHtml(r.area)}
      ${(m => m + (!r._oneSheet && /data-h="(\d+)"/.exec(m) && +/data-h="(\d+)"/.exec(m)[1] > 640 ? streetList(r.turf).replace('class="sh-streets"', 'class="sh-streets sh-newpage"') : streetList(r.turf)))(mapHtml(r.stops, r.turf, r._h))}
      ${foot}
    </section>`;
    }
    return `<section class="sh-sheet">
      <header class="sh-head">
        <div><h2>${esc(r.route)} · ${esc(r.area || '')}</h2>
        <div class="sh-sub">${openStops.length} stop${openStops.length === 1 ? '' : 's'} to pick up · about ${signs} sign${signs === 1 ? '' : 's'}${large ? ', ' + large + ' large' : ''}${r.stops.length !== openStops.length ? ' · ' + (r.stops.length - openStops.length) + ' already done' : ''}</div>
        <div class="sh-sub">Grab any of these you pass that isn't listed, and write it at the bottom.</div></div>
        <div class="sh-vol"><span>Volunteer</span><b>${esc(r.volunteer || '')}</b></div>
      </header>
      ${pullSheetHtml(r.area)}
      ${mapHtml(r.stops, r.turf, r._h)}
      <table class="sh-tbl"><thead><tr><th>#</th><th>Address</th><th>Pick up</th><th>Done</th></tr></thead>
      <tbody>${rows(r.stops)}</tbody></table>
      <div class="sh-note" style="margin-top:8px">Found, not on the list: ________________________________________________________________</div>
      ${foot}
    </section>`;
  }

  // Show the sheets full screen, then let the person hit Print. Screen preview and paper are the same markup.
  // Page fit (31 Oct): lay each sheet out at print width off screen and measure it. If it runs a little past
  // a page (a few rows or just the footer), shrink the map until it fits; if it clearly needs more pages, leave it.
  const PAGE = 960, SLACK = 6; // letter with 0.5in margins = 10in = 960 CSS px
  function fitToPages(list) {
    const box = document.createElement('div');
    box.className = 'sh-measure';
    box.style.cssText = 'position:absolute;left:-20000px;top:0;width:720px;visibility:hidden';
    document.body.appendChild(box);
    const measure = r => {
      box.innerHTML = sheetHtml(r);
      const sec = box.firstElementChild; sec.style.cssText = 'width:720px;padding:0;margin:0;box-shadow:none';
      const st = sec.querySelector('.sh-newpage');
      return { total: sec.offsetHeight, page1: st ? st.offsetTop - sec.offsetTop : sec.offsetHeight, newpage: !!st };
    };
    for (const r of list) {
      try {
        const map = () => { box.innerHTML = sheetHtml(r); const m = box.querySelector('.sh-map'); return m ? +m.dataset.h : 0; };
        let h0 = map(); if (!h0) continue;
        const minH = r.turf ? 380 : 220;
        let m = measure(r);
        if (m.newpage) {
          // Tall area: page one is header and map, page two the streets. If everything fits on one page
          // with a map still at least 620 px, use one page instead.
          r._oneSheet = true; const one = measure(r); const need = one.total - PAGE + SLACK;
          if (need > 0 && h0 - need >= 620) { r._h = h0 - need; continue; }
          if (need <= 0) continue;
          r._oneSheet = false;
          // 3 Nov: header plus a tall map can run past page one, which pushed the map to page two and left page one
          // nearly blank. Shrink the map just enough that header and map share page one; streets still start page two.
          m = measure(r);
          if (m.page1 > PAGE - SLACK) r._h = Math.max(minH, h0 - (m.page1 - PAGE) - 3 * SLACK);
          continue;
        }
        const pages = Math.ceil((m.total - SLACK) / PAGE), over = m.total - (pages - 1) * PAGE;
        // the last page holds only a little: pull it back by shrinking the map
        if (pages > 1 && over < 260 && h0 - over - SLACK >= minH) { r._h = h0 - over - SLACK; m = measure(r); if (m.total > (pages - 1) * PAGE) r._h = Math.max(minH, r._h - (m.total - (pages - 1) * PAGE) - SLACK); }
      } catch (e) { /* the sheet prints as is */ }
    }
    box.remove();
  }

  window.openSheets = async function (routes, label) {
    const list = routes.filter(r => r.stops && r.stops.length);
    if (!list.length) return;
    // Areas first, so each sheet prints its shaded area and streets. Missing areas just print the old way.
    if (window.loadTurf) await Promise.all(list.map(async r => { try { r.turf = await window.loadTurf(r.route); } catch { r.turf = null; } }));
    fitToPages(list);
    const old = document.getElementById('sh-overlay'); if (old) old.remove();
    const el = document.createElement('div');
    el.id = 'sh-overlay';
    el.innerHTML = `<div class="sh-bar no-print">
        <button class="btn sm" id="sh-print">Print</button>
        <span class="sh-count">${list.length} sheet${list.length === 1 ? '' : 's'}${label ? ' · ' + esc(label) : ''}</span>
        <button class="btn ghost sm" id="sh-close">Close</button>
      </div><div class="sh-pages">${list.map(sheetHtml).join('')}</div>`;
    document.body.appendChild(el);
    document.body.classList.add('sh-open');
    el.querySelector('#sh-close').onclick = () => { el.remove(); document.body.classList.remove('sh-open'); };
    el.querySelector('#sh-print').onclick = () => { fitMaps(true); window.print(); }; // afterprint puts the screen size back
    fitMaps(false);
    drawRoads(el);
  };
})();

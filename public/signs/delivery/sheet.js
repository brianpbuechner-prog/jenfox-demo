// Printable route sheets. Shared by the volunteer route page and the organizer page.
// One sheet per route: header, OSM map with numbered markers and the driving line, then the checklist.
// Deliberately self-contained: no map library and no build step. Tiles come through /api/tile, which
  // identifies the app to OSM; hotlinking their tiles directly prints an "Access blocked" grid. Plain <img>
// elements and the overlay is inline SVG, because both print without "Background graphics" ticked.
(function () {
  const TILE = 256, MAPW = 720; // 720 CSS px = 7.5in at 96dpi, the printable width of letter with 0.5in margins
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const lon2x = (lon, z) => ((lon + 180) / 360) * Math.pow(2, z) * TILE;
  const lat2y = (lat, z) => {
    const s = Math.sin(lat * Math.PI / 180);
    return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * Math.pow(2, z) * TILE;
  };

  function mapHeight(n) { return n <= 12 ? 380 : n <= 16 ? 330 : 290; } // keep the checklist on the same page

  // Biggest zoom where every stop still fits inside the box, with room for the markers.
  function pickZoom(pts, w, h) {
    for (let z = 17; z >= 9; z--) {
      const xs = pts.map(p => lon2x(p.lng, z)), ys = pts.map(p => lat2y(p.lat, z));
      if (Math.max(...xs) - Math.min(...xs) <= w - 56 && Math.max(...ys) - Math.min(...ys) <= h - 56) return z;
    }
    return 9;
  }

  function mapHtml(stops) {
    const pts = stops.filter(s => typeof s.lat === 'number' && typeof s.lng === 'number');
    if (pts.length < 1) return '<div class="sh-nomap">No map: these stops have no coordinates yet.</div>';
    const h = mapHeight(stops.length), z = pickZoom(pts, MAPW, h);
    const xs = pts.map(p => lon2x(p.lng, z)), ys = pts.map(p => lat2y(p.lat, z));
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const left = cx - MAPW / 2, top = cy - h / 2;                       // world pixel of the box's top-left
    const x0 = Math.floor(left / TILE), y0 = Math.floor(top / TILE);
    const x1 = Math.floor((left + MAPW) / TILE), y1 = Math.floor((top + h) / TILE);
    const max = Math.pow(2, z);
    let tiles = '';
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (ty < 0 || ty >= max) continue;
        const wrapped = ((tx % max) + max) % max;
        tiles += `<img class="sh-tile" alt="" src="https://tile.openstreetmap.org/${z}/${wrapped}/${ty}.png"`
              + ` style="left:${Math.round(tx * TILE - left)}px;top:${Math.round(ty * TILE - top)}px">`;
      }
    }
    const px = stops.map(s => (typeof s.lat === 'number' && typeof s.lng === 'number')
      ? { x: lon2x(s.lng, z) - left, y: lat2y(s.lat, z) - top, s } : null);
    const line = px.filter(Boolean).map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const pins = px.filter(Boolean).map(p => {
      const done = p.s.status && p.s.status !== 'Needs delivery';
      return `<g><circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="11" fill="${done ? '#cfe9d6' : '#fff'}" stroke="#383838" stroke-width="2"/>`
        + `<text x="${p.x.toFixed(1)}" y="${(p.y + 4).toFixed(1)}" text-anchor="middle" font-size="12" font-weight="700" fill="#383838">${p.s.stop}</text></g>`;
    }).join('');
    // The projection rides along on the element so the road line can land in the same frame.
    return `<div class="sh-map" style="height:${h}px" data-z="${z}" data-left="${left}" data-top="${top}" data-coords="${esc(px.filter(Boolean).map(p => p.s.lng + ',' + p.s.lat).join(';'))}">
      ${tiles}
      <svg class="sh-pins" viewBox="0 0 ${MAPW} ${h}" width="${MAPW}" height="${h}">
        <polyline class="sh-line" points="${line}" fill="none" stroke="#383838" stroke-width="2.5" stroke-dasharray="7 5" opacity="0.85"/>
        ${pins}
      </svg>
      <div class="sh-credit">© OpenStreetMap contributors</div>
    </div>`;
  }

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

  function rows(stops) {
    return stops.map(s => {
      const done = s.status && s.status !== 'Needs delivery';
      const addr = s.unit ? esc(s.address).replace(esc(s.unit), '<b>' + esc(s.unit) + '</b>') : esc(s.address);
      const note = [s.notes, s.driverNote].filter(Boolean).join(' · ');
      return `<tr class="${done ? 'sh-done' : ''}">
        <td class="sh-n">${s.stop}</td>
        <td><div class="sh-who">${esc(s.name)}</div>${note ? `<div class="sh-note">${esc(note)}</div>` : ''}</td>
        <td class="sh-addr">${addr}</td>
        <td class="sh-sz">${esc(s.size || '')}</td>
        <td class="sh-ph">${esc(s.phone || '')}</td>
        <td class="sh-box">${done ? '✓' : ''}</td>
      </tr>`;
    }).join('');
  }

  function sheetHtml(r) {
    const open = r.stops.filter(s => !s.status || s.status === 'Needs delivery').length;
    const sizes = {};
    r.stops.forEach(s => { if (!s.status || s.status === 'Needs delivery') sizes[s.size || '?'] = (sizes[s.size || '?'] || 0) + 1; });
    const bySize = Object.entries(sizes).map(([k, v]) => `${v} ${k}`).join(' · ');
    return `<section class="sh-sheet">
      <header class="sh-head">
        <div><h2>${esc(r.route)} · ${esc(r.area || '')}</h2>
        <div class="sh-sub">${open} to deliver${bySize ? ' (' + esc(bySize) + ')' : ''}${r.stops.length !== open ? ' · ' + (r.stops.length - open) + ' already closed' : ''}</div></div>
        <div class="sh-vol"><span>Volunteer</span><b>${esc(r.volunteer || '')}</b></div>
      </header>
      ${mapHtml(r.stops)}
      <table class="sh-tbl"><thead><tr><th>#</th><th>Household</th><th>Address</th><th>Size</th><th>Phone</th><th>Done</th></tr></thead>
      <tbody>${rows(r.stops)}</tbody></table>
      <footer class="sh-foot">Marked something on paper? Text the organizer so the app matches. · ${esc(r.route)} · printed ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</footer>
    </section>`;
  }

  // Show the sheets full screen, then let the person hit Print. Screen preview and paper are the same markup.
  window.openSheets = function (routes, label) {
    const list = routes.filter(r => r.stops && r.stops.length);
    if (!list.length) return;
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
    el.querySelector('#sh-print').onclick = () => window.print();
    drawRoads(el);
  };
})();

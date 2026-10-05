/* Dead County: Last Light - procedural pixel-art tile/object renderer and chunk baking. */
(function () {
  'use strict';
  const DC = window.DC, W = DC.W, G = DC.G, O = DC.O, T = 16, N = W.N, CH = 16, PAD = 16, NC = W.NC;
  const Tl = (DC.tiles = {});
  const hash = DC.hash;
  const rect = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
  const GCOL = {
    [G.GRASS]: ['#3a4830', '#405034', '#36442d'], [G.DIRT]: ['#58493a', '#5e4e3d', '#524436'], [G.ROAD]: ['#2d2f33', '#303236', '#2a2c30'],
    [G.SIDEWALK]: ['#6a6a64', '#706f68', '#65655f'], [G.WOOD]: ['#6a4f38', '#6f5339', '#654a34'], [G.TILE]: ['#7d807c', '#868984', '#757874'],
    [G.CONCRETE]: ['#5d5e5b', '#626360', '#585956'], [G.DEEP]: ['#1d3646', '#1f3a4a', '#1a3140'], [G.SHALLOW]: ['#2c5063', '#305667', '#2a4a5c'],
    [G.GRAVEL]: ['#6e695f', '#757064', '#68645a'], [G.LEAVES]: ['#4a4a26', '#50502a', '#44441f'], [G.FARM]: ['#4a3826', '#503e2a', '#443422'],
    [G.CARPET]: ['#5a3d44', '#5f4249', '#55383f'], [G.BRIDGE]: ['#5b4630', '#614b33', '#55412d'], [G.PAD]: ['#4a4c52', '#4e5056', '#46484e'], [G.MUD]: ['#4a3d2c', '#50422f', '#443828'],
  };
  const WALLC = { house: ['#8b7b66', '#76828e', '#8a6f5c', '#7d8570', '#9a8e78'], shop: ['#80695a', '#6f7a80'], police: ['#4f607a'], fire: ['#8f4a40'], hospital: ['#aeb2ae'], warehouse: ['#6f726e'], gas: ['#8e7d52'], cabin: ['#6e4c30'], barn: ['#7a3e30'] };
  const CARCOL = ['#8a3a34', '#3a5a7a', '#6a6a6a', '#2e3a30', '#a89a60', '#d0d0cc', '#4a4a50', '#6a4a30'];
  function wallish(tx, ty) { if (!W.inb(tx, ty)) return false; const t = W.o[ty * N + tx]; return t === O.WALL || t === O.DOOR || t === O.WINDOW || t === O.BWALL || t === O.BGATE; }
  function wallColor(tx, ty) {
    const b = W.buildingAt(tx, ty); if (!b) return '#7a7468';
    const arr = WALLC[b.type] || WALLC.house; return arr[(b.id * 7) % arr.length];
  }
  Tl.wallColor = wallColor;
  function bType(tx, ty) { const b = W.buildingAt(tx, ty); return b ? b.type : 'house'; }
  function shade(col, f) { const n = parseInt(col.slice(1), 16); const r = Math.max(0, Math.min(255, ((n >> 16) & 255) * f)) | 0, g = Math.max(0, Math.min(255, ((n >> 8) & 255) * f)) | 0, b = Math.max(0, Math.min(255, (n & 255) * f)) | 0; return 'rgb(' + r + ',' + g + ',' + b + ')'; }
  Tl.shade = shade;

  // ---------- ground ----------
  function drawGround(c, gt, tx, ty, x, y) {
    const h = hash(tx, ty, 11), cols = GCOL[gt], base = cols[(h * 3) | 0];
    const indoor = W.isIndoor(tx, ty);
    rect(c, x, y, T, T, base);
    const h2 = hash(tx, ty, 23), h3 = hash(tx, ty, 37);
    switch (gt) {
      case G.GRASS: rect(c, x + ((h2 * 14) | 0), y + ((h3 * 14) | 0), 1, 2, '#52653d'); rect(c, x + ((h3 * 13) | 0), y + ((h2 * 12) | 0), 2, 1, '#2f3c27'); if (h > 0.8) rect(c, x + ((h2 * 12) | 0), y + ((h3 * 12) | 0), 1, 1, '#7a6a3a'); break;
      case G.DIRT: rect(c, x + ((h2 * 12) | 0), y + ((h3 * 12) | 0), 2, 1, '#6a5a46'); rect(c, x + ((h3 * 12) | 0), y + ((h2 * 12) | 0), 1, 1, '#463a2c'); break;
      case G.ROAD: {
        rect(c, x + ((h2 * 14) | 0), y + ((h3 * 14) | 0), 1, 1, '#3a3c40');
        const isH = (y0) => y0 === 112 || W.ROADS.includes(y0), isV = (x0) => x0 === 112 || W.ROADS.includes(x0);
        const roadAt = (ax, ay) => W.inb(ax, ay) && (W.g[ay * N + ax] === G.ROAD || W.g[ay * N + ax] === G.BRIDGE);
        const ch = isH(ty) && roadAt(tx - 1, ty) && roadAt(tx + 1, ty), cvv = isV(tx) && roadAt(tx, ty - 1) && roadAt(tx, ty + 1);
        if (ch && !cvv && tx % 6 < 3) rect(c, x, y + 7, T, 2, '#a89a45');
        else if (cvv && !ch && ty % 6 < 3) rect(c, x + 7, y, 2, T, '#a89a45');
        if (isH(ty + 1) && ty + 1 !== 0 && false) {}
        break;
      }
      case G.SIDEWALK: rect(c, x, y + 15, T, 1, '#55554f'); rect(c, x + 15, y, 1, T, '#55554f'); break;
      case G.WOOD: for (let k = 0; k < 4; k++) { rect(c, x, y + k * 4 + 3, T, 1, '#4e3826'); } rect(c, x + ((h2 * 12) | 0) + 1, y + ((h3 * 4) | 0) * 4, 1, 3, '#4e3826'); if (indoor) rect(c, x, y, T, T, 'rgba(0,0,0,0.22)'); break;
      case G.TILE: if ((tx + ty) % 2) rect(c, x, y, T, T, 'rgba(0,0,0,0.12)'); rect(c, x, y + 15, T, 1, 'rgba(0,0,0,.25)'); rect(c, x + 15, y, 1, T, 'rgba(0,0,0,.25)'); if (indoor) rect(c, x, y, T, T, 'rgba(0,0,0,0.2)'); break;
      case G.CONCRETE: rect(c, x + ((h2 * 12) | 0), y + ((h3 * 12) | 0), 3, 1, '#6a6b68'); if ((tx % 4 === 0) || (ty % 4 === 0)) rect(c, x, y, T, 1, 'rgba(0,0,0,.18)'); if (indoor) rect(c, x, y, T, T, 'rgba(0,0,0,0.25)'); break;
      case G.DEEP: rect(c, x + ((h2 * 10) | 0), y + ((h3 * 12) | 0), 4, 1, '#2a4d60'); break;
      case G.SHALLOW: rect(c, x + ((h2 * 10) | 0), y + ((h3 * 12) | 0), 5, 1, '#4a7486'); rect(c, x + ((h3 * 10) | 0), y + ((h2 * 12) | 0) + 1, 3, 1, '#223f50'); break;
      case G.GRAVEL: for (let k = 0; k < 4; k++) rect(c, x + ((hash(tx, ty, 50 + k) * 14) | 0), y + ((hash(tx, ty, 60 + k) * 14) | 0), 2, 1, k % 2 ? '#857f72' : '#58544b'); break;
      case G.LEAVES: for (let k = 0; k < 3; k++) rect(c, x + ((hash(tx, ty, 70 + k) * 14) | 0), y + ((hash(tx, ty, 80 + k) * 14) | 0), 2, 2, ['#7a5a2a', '#8a6a30', '#5a5a2a'][k]); break;
      case G.FARM: for (let k = 0; k < 4; k++) rect(c, x, y + k * 4 + 1, T, 1, '#3a2c1c'); break;
      case G.CARPET: rect(c, x, y, T, 1, 'rgba(0,0,0,.14)'); if (indoor) rect(c, x, y, T, T, 'rgba(0,0,0,0.2)'); break;
      case G.BRIDGE: for (let k = 0; k < 4; k++) rect(c, x, y + k * 4, T, 1, '#42321f'); rect(c, x, y, T, 2, 'rgba(0,0,0,.2)'); break;
      case G.PAD: { rect(c, x, y, T, T, base); rect(c, x + ((h2 * 12) | 0), y + 2, 2, 1, '#5c5e66'); break; }
    }
  }
  // shoreline shading handled lightly
  function drawShore(c, tx, ty, x, y) {
    const g0 = W.g[ty * N + tx];
    if (g0 !== G.DEEP && g0 !== G.SHALLOW) return;
    const nb = (dx, dy) => { const xx = tx + dx, yy = ty + dy; return W.inb(xx, yy) ? W.g[yy * N + xx] : g0; };
    const land = (gg) => gg !== G.DEEP && gg !== G.SHALLOW && gg !== G.BRIDGE;
    if (land(nb(0, -1))) rect(c, x, y, T, 2, 'rgba(120,110,80,.5)'); if (land(nb(0, 1))) rect(c, x, y + 14, T, 2, 'rgba(120,110,80,.5)');
    if (land(nb(-1, 0))) rect(c, x, y, 2, T, 'rgba(120,110,80,.5)'); if (land(nb(1, 0))) rect(c, x + 14, y, 2, T, 'rgba(120,110,80,.5)');
  }

  // ---------- objects ----------
  function isHoriz(tx, ty) {
    const h = wallish(tx - 1, ty) || wallish(tx + 1, ty), v = wallish(tx, ty - 1) || wallish(tx, ty + 1);
    if (h && !v) return true; if (v && !h) return false; return true;
  }
  function drawWall(c, tx, ty, x, y, col) {
    rect(c, x, y, T, T, col);
    const up = wallish(tx, ty - 1), dn = wallish(tx, ty + 1);
    // brick/siding pattern
    for (let k = 0; k < 4; k++) rect(c, x, y + k * 4 + 3, T, 1, 'rgba(0,0,0,.14)');
    rect(c, x + ((tx * 5 + ty * 3) % 4) * 4, y, 1, 4, 'rgba(0,0,0,.12)');
    if (!up) rect(c, x, y, T, 2, 'rgba(255,255,255,.22)');
    if (!dn) { rect(c, x, y + 11, T, 5, shade(col, 0.62)); rect(c, x, y + 11, T, 1, 'rgba(0,0,0,.35)'); }
    if (!wallish(tx - 1, ty)) rect(c, x, y, 1, T, 'rgba(255,255,255,.12)');
    if (!wallish(tx + 1, ty)) rect(c, x + 15, y, 1, T, 'rgba(0,0,0,.25)');
  }
  function planks(c, x, y, lv, horiz) {
    const n = Math.min(3, lv);
    for (let k = 0; k < n; k++) {
      if (horiz) { const yy = y + 2 + k * 4; rect(c, x + 1, yy, 14, 3, '#8a6a42'); rect(c, x + 1, yy, 14, 1, '#a8854f'); rect(c, x + 1, yy + 2, 14, 1, '#5a4228'); rect(c, x + 2, yy + 1, 1, 1, '#cfcfcf'); rect(c, x + 13, yy + 1, 1, 1, '#cfcfcf'); }
      else { const xx = x + 2 + k * 4; rect(c, xx, y + 1, 3, 14, '#8a6a42'); rect(c, xx, y + 1, 1, 14, '#a8854f'); rect(c, xx + 2, y + 1, 1, 14, '#5a4228'); rect(c, xx + 1, y + 2, 1, 1, '#cfcfcf'); rect(c, xx + 1, y + 12, 1, 1, '#cfcfcf'); }
    }
  }
  function drawDoor(c, tx, ty, x, y, i, wc) {
    const s = W.st.get(i) || {}, horiz = isHoriz(tx, ty);
    const fl = W.g[i];
    rect(c, x, y, T, T, wc);
    if (s.open || s.broken) {
      rect(c, x, y, T, T, '#3a2c20');
      if (horiz) { rect(c, x, y, 2, T, '#5a4028'); rect(c, x + 14, y, 2, T, '#5a4028'); if (s.broken) { rect(c, x + 2, y + 3, 3, 9, '#6a4a2c'); rect(c, x + 5, y + 8, 2, 5, '#5a3e24'); } else rect(c, x + 2, y + 1, 2, 14, '#7a5430'); }
      else { rect(c, x, y, T, 2, '#5a4028'); rect(c, x, y + 14, T, 2, '#5a4028'); if (s.broken) { rect(c, x + 3, y + 2, 9, 3, '#6a4a2c'); } else rect(c, x + 1, y + 2, 14, 2, '#7a5430'); }
    } else {
      if (horiz) { rect(c, x + 1, y + 1, 14, 14, '#4a3624'); rect(c, x + 2, y + 2, 12, 12, '#7b5632'); rect(c, x + 3, y + 3, 10, 4, '#8a6238'); rect(c, x + 3, y + 8, 10, 5, '#8a6238'); rect(c, x + 11, y + 8, 2, 2, '#d8c070'); }
      else { rect(c, x + 1, y + 1, 14, 14, '#4a3624'); rect(c, x + 2, y + 2, 12, 12, '#7b5632'); rect(c, x + 3, y + 3, 4, 10, '#8a6238'); rect(c, x + 8, y + 3, 5, 10, '#8a6238'); rect(c, x + 8, y + 11, 2, 2, '#d8c070'); }
      if (s.locked && !s.bar) rect(c, x + 7, y + 7, 2, 2, '#a83a32');
    }
    if (s.bar > 0) planks(c, x, y, s.bar, horiz);
    if (!wallish(tx, ty + 1) && horiz) rect(c, x, y + 15, T, 1, 'rgba(0,0,0,.4)');
  }
  function drawWindow(c, tx, ty, x, y, i, wc) {
    const s = W.st.get(i) || {}, horiz = isHoriz(tx, ty);
    drawWall(c, tx, ty, x, y, wc);
    const gx = horiz ? x + 2 : x + 4, gy = horiz ? y + 4 : y + 2, gw = horiz ? 12 : 8, gh = horiz ? 7 : 12;
    rect(c, gx - 1, gy - 1, gw + 2, gh + 2, '#3a2c20');
    if (s.broken) { rect(c, gx, gy, gw, gh, '#14181a'); rect(c, gx, gy, 3, 2, '#9ec2d0'); rect(c, gx + gw - 3, gy + gh - 2, 3, 2, '#9ec2d0'); rect(c, gx + 4, gy + 1, 2, 1, '#9ec2d0'); }
    else if (s.open) { rect(c, gx, gy, gw, gh, '#14181a'); rect(c, gx, gy, 3, gh, '#6a5a78'); }
    else { rect(c, gx, gy, gw, gh, '#7ea2b4'); rect(c, gx, gy, gw, 2, '#a8cad8'); rect(c, gx + (gw >> 1), gy, 1, gh, '#3a2c20'); rect(c, gx, gy + (gh >> 1), gw, 1, '#3a2c20'); }
    if (s.bar > 0) planks(c, x, y, s.bar, horiz);
  }
  function drawTreeBase(c, x, y, h) {
    c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.ellipse(x + 9, y + 12, 8, 4, 0, 0, 6.3); c.fill();
    rect(c, x + 6, y + 6, 4, 8, '#4a3626'); rect(c, x + 6, y + 6, 1, 8, '#5e4632');
  }
  function drawCanopy(c, x, y, tx, ty) {
    const h = hash(tx, ty, 91), kind = hash(tx, ty, 92);
    const pal = kind < 0.12 ? ['#6a5a22', '#7a6a28', '#8a7a30'] : kind < 0.3 ? ['#2d4228', '#375034', '#42603c'] : kind < 0.6 ? ['#2f4a2c', '#3a5a34', '#476a3e'] : ['#34502e', '#40603a', '#4e7044'];
    const cx = x + 8 + ((h * 4) | 0) - 2, cy = y + 4 + ((hash(tx, ty, 93) * 3) | 0), r = 9 + ((h * 3) | 0);
    c.fillStyle = pal[0]; c.beginPath(); c.arc(cx, cy, r, 0, 6.3); c.fill();
    c.fillStyle = pal[1]; c.beginPath(); c.arc(cx - 2, cy - 2, r - 3, 0, 6.3); c.fill();
    c.fillStyle = pal[2]; c.beginPath(); c.arc(cx - 3, cy - 3, r - 6, 0, 6.3); c.fill();
    c.fillStyle = 'rgba(0,0,0,.18)'; for (let k = 0; k < 4; k++) c.fillRect(cx - r + 3 + ((hash(tx, ty, 100 + k) * (r * 1.5)) | 0), cy + ((hash(tx, ty, 110 + k) * r * 0.8) | 0), 2, 1);
  }
  function drawFence(c, tx, ty, x, y) {
    const f = (dx, dy) => W.inb(tx + dx, ty + dy) && W.o[(ty + dy) * N + tx + dx] === O.FENCE;
    const l = f(-1, 0), r = f(1, 0), u = f(0, -1), d = f(0, 1);
    c.fillStyle = 'rgba(0,0,0,.2)'; c.fillRect(x, y + 11, T, 3);
    if (l || r || (!u && !d)) { rect(c, x + (l ? 0 : 6), y + 6, T - (l ? 0 : 6) - (r ? 0 : 6), 2, '#8a7656'); rect(c, x + (l ? 0 : 6), y + 10, T - (l ? 0 : 6) - (r ? 0 : 6), 2, '#8a7656'); }
    if (u || d) { rect(c, x + 7, y + (u ? 0 : 6), 2, T - (u ? 0 : 6) - (d ? 0 : 6), '#8a7656'); }
    rect(c, x + 6, y + 4, 4, 9, '#6a583e'); rect(c, x + 6, y + 4, 4, 1, '#a89470');
  }
  function drawCar(c, car, ox, oy) {
    const x = car.x * T - ox, y = car.y * T - oy, col = CARCOL[car.col % CARCOL.length];
    const hz = car.dir === 'h', L = car.len * T;
    const bw = hz ? L - 2 : T - 2, bh = hz ? T - 3 : L - 2, bx = hz ? x + 1 : x + 1, by = hz ? y + 1 : y + 1;
    c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(bx + 2, by + 3, bw, bh);
    rect(c, bx, by, bw, bh, shade(col, 0.55)); rect(c, bx, by, bw, bh - 2, col);
    rect(c, bx, by, bw, 1, 'rgba(255,255,255,.25)');
    const glass = '#2a3a46';
    if (car.type === 'truck') {
      if (hz) { rect(c, bx + bw - 12, by + 2, 9, bh - 6, glass); rect(c, bx + 3, by + 2, bw - 18, bh - 6, shade(col, 0.8)); rect(c, bx + 3, by + 2, bw - 18, 1, 'rgba(255,255,255,.2)'); }
    } else if (hz) { rect(c, bx + 7, by + 2, 6, bh - 6, glass); rect(c, bx + bw - 9, by + 2, 4, bh - 6, glass); rect(c, bx + 13, by + 2, bw - 22, bh - 6, shade(col, 0.85)); rect(c, bx + 1, by + 2, 1, 2, '#e0d090'); rect(c, bx + 1, by + bh - 5, 1, 2, '#e0d090'); rect(c, bx + bw - 2, by + 2, 1, 2, '#a02828'); rect(c, bx + bw - 2, by + bh - 5, 1, 2, '#a02828'); }
    else { rect(c, bx + 2, by + 7, bw - 6, 6, glass); rect(c, bx + 2, by + bh - 9, bw - 6, 4, glass); rect(c, bx + 2, by + 13, bw - 6, bh - 22, shade(col, 0.85)); rect(c, bx + 2, by + 1, 2, 1, '#e0d090'); rect(c, bx + bw - 5, by + 1, 2, 1, '#e0d090'); rect(c, bx + 2, by + bh - 2, 2, 1, '#a02828'); rect(c, bx + bw - 5, by + bh - 2, 2, 1, '#a02828'); }
    // wheels
    c.fillStyle = '#16171a';
    if (hz) { c.fillRect(bx + 4, by - 1, 5, 2); c.fillRect(bx + bw - 9, by - 1, 5, 2); c.fillRect(bx + 4, by + bh - 1, 5, 2); c.fillRect(bx + bw - 9, by + bh - 1, 5, 2); }
    else { c.fillRect(bx - 1, by + 4, 2, 5); c.fillRect(bx - 1, by + bh - 9, 2, 5); c.fillRect(bx + bw - 1, by + 4, 2, 5); c.fillRect(bx + bw - 1, by + bh - 9, 2, 5); }
  }

  function drawObj(c, t, tx, ty, x, y, i) {
    const h = hash(tx, ty, 5);
    switch (t) {
      case O.WALL: DC.art.wall(c, tx, ty, x, y, wallColor(tx, ty), bType(tx, ty)); break;
      case O.BWALL: DC.art.wall(c, tx, ty, x, y, '#7e5e3c', 'cabin', true); break;
      case O.DOOR: DC.art.door(c, tx, ty, x, y, W.st.get(i), isHoriz(tx, ty), wallColor(tx, ty), bType(tx, ty)); break;
      case O.BGATE: DC.art.door(c, tx, ty, x, y, W.st.get(i), isHoriz(tx, ty), '#7e5e3c', 'cabin'); break;
      case O.WINDOW: DC.art.window(c, tx, ty, x, y, W.st.get(i), isHoriz(tx, ty), wallColor(tx, ty), bType(tx, ty)); break;
      case O.TREE: DC.art.treeBase(c, x, y, tx, ty); break;
      case O.FENCE: DC.art.fence(c, tx, ty, x, y); break;
      case O.BUSH: DC.art.bush(c, x, y, tx, ty); break;
      case O.ROCK: DC.art.rock(c, x, y, tx, ty); break;
      case O.BED: case O.BBED: rect(c, x + 1, y + 1, 14, 14, '#4a3626'); rect(c, x + 2, y + 2, 12, 12, t === O.BED ? '#6a4a52' : '#52606a'); rect(c, x + 2, y + 2, 12, 4, '#d8d4c8'); rect(c, x + 3, y + 3, 4, 2, '#fff'); rect(c, x + 2, y + 7, 12, 1, 'rgba(0,0,0,.25)'); break;
      case O.HBED: rect(c, x + 1, y + 1, 14, 14, '#7a8088'); rect(c, x + 2, y + 2, 12, 12, '#cfd8dc'); rect(c, x + 3, y + 3, 5, 3, '#fff'); rect(c, x + 2, y + 8, 12, 5, '#7ea2b4'); break;
      case O.COUCH: rect(c, x + 1, y + 2, 14, 12, '#4a4034'); rect(c, x + 2, y + 6, 12, 7, '#6a5c48'); rect(c, x + 2, y + 3, 12, 3, '#54483a'); rect(c, x + 2, y + 8, 6, 1, 'rgba(0,0,0,.25)'); break;
      case O.TABLE: case O.BTABLE: rect(c, x + 2, y + 3, 12, 10, '#4a3626'); rect(c, x + 2, y + 2, 12, 10, '#8a6a46'); rect(c, x + 3, y + 3, 10, 1, '#a88858'); break;
      case O.CHAIR: case O.BCHAIR: rect(c, x + 4, y + 4, 8, 8, '#4a3626'); rect(c, x + 4, y + 3, 8, 8, '#7a5c3c'); rect(c, x + 4, y + 3, 8, 2, '#5a4228'); break;
      case O.SHELF: rect(c, x + 1, y + 2, 14, 12, '#4a3626'); rect(c, x + 2, y + 3, 12, 4, '#6a4e32'); rect(c, x + 2, y + 8, 12, 4, '#6a4e32'); for (let k = 0; k < 5; k++) { rect(c, x + 3 + k * 2, y + 4, 1, 2, ['#a83a32', '#3a5a8a', '#c8a02c', '#4a6a3a', '#8a6a9a'][(k + tx) % 5]); rect(c, x + 3 + k * 2, y + 9, 1, 2, ['#c8a02c', '#a83a32', '#4a6a3a', '#3a5a8a', '#8a6a9a'][(k + ty) % 5]); } break;
      case O.SHOPSHELF: rect(c, x, y + 2, T, 12, '#3e4046'); rect(c, x + 1, y + 3, 14, 4, '#585b62'); rect(c, x + 1, y + 8, 14, 4, '#585b62'); for (let k = 0; k < 7; k++) { rect(c, x + 2 + k * 2, y + 4, 2, 2, ['#c8a02c', '#a83a32', '#4a6a3a', '#3a5a8a', '#d8d4c8', '#8a5a2a', '#8a6a9a'][(k * 3 + tx + ty) % 7]); rect(c, x + 2 + k * 2, y + 9, 2, 2, ['#d8d4c8', '#3a5a8a', '#c8a02c', '#a83a32', '#4a6a3a', '#8a6a9a', '#8a5a2a'][(k * 2 + tx) % 7]); } break;
      case O.COUNTER: case O.CABINET: rect(c, x, y + 2, T, 13, '#3e3a36'); rect(c, x, y + 1, T, 11, '#8a8478'); rect(c, x, y + 1, T, 1, '#b4ac9c'); rect(c, x + 3, y + 12, 4, 2, '#2a2824'); rect(c, x + 9, y + 12, 4, 2, '#2a2824'); break;
      case O.FRIDGE: rect(c, x + 2, y + 1, 12, 14, '#b8bcbc'); rect(c, x + 2, y + 1, 12, 2, '#d8dcdc'); rect(c, x + 2, y + 7, 12, 1, '#7a7e7e'); rect(c, x + 11, y + 4, 1, 2, '#555'); rect(c, x + 11, y + 9, 1, 3, '#555'); rect(c, x + 13, y + 1, 1, 14, 'rgba(0,0,0,.25)'); break;
      case O.WARDROBE: rect(c, x + 1, y + 1, 14, 14, '#4a3626'); rect(c, x + 2, y + 2, 12, 12, '#6a4a30'); rect(c, x + 8, y + 2, 1, 12, '#3a2a1c'); rect(c, x + 6, y + 7, 1, 2, '#d8c070'); rect(c, x + 10, y + 7, 1, 2, '#d8c070'); break;
      case O.CRATE: case O.BSTORE: rect(c, x + 1, y + 2, 14, 13, '#4a3626'); rect(c, x + 2, y + 2, 12, 12, '#9a7a4a'); rect(c, x + 2, y + 2, 12, 2, '#b8955a'); rect(c, x + 2, y + 7, 12, 1, '#6a5030'); rect(c, x + 2, y + 2, 2, 12, '#7a5c36'); rect(c, x + 12, y + 2, 2, 12, '#7a5c36'); if (t === O.BSTORE) rect(c, x + 6, y + 5, 4, 3, '#d8c070'); break;
      case O.LOCKER: rect(c, x + 2, y + 1, 12, 14, '#3a4a5a'); rect(c, x + 3, y + 2, 10, 12, '#566878'); rect(c, x + 3, y + 4, 10, 1, '#2a3a48'); rect(c, x + 3, y + 7, 10, 1, '#2a3a48'); rect(c, x + 11, y + 9, 1, 2, '#c8c8c8'); break;
      case O.DESK: rect(c, x, y + 3, T, 12, '#3e2e20'); rect(c, x, y + 2, T, 11, '#7a5c3c'); rect(c, x + 2, y + 4, 6, 4, '#d8d4c8'); rect(c, x + 10, y + 4, 4, 3, '#2a3038'); break;
      case O.SINK: rect(c, x + 1, y + 4, 14, 10, '#c8ccc8'); rect(c, x + 3, y + 6, 10, 6, '#7a8890'); rect(c, x + 7, y + 3, 2, 3, '#888'); break;
      case O.TOILET: rect(c, x + 4, y + 2, 8, 4, '#d8dcd8'); rect(c, x + 3, y + 6, 10, 8, '#e0e4e0'); rect(c, x + 5, y + 8, 6, 4, '#9aa4a8'); break;
      case O.STOVE: rect(c, x + 1, y + 2, 14, 13, '#3a3c40'); rect(c, x + 2, y + 3, 12, 8, '#26282c'); for (const [a, b] of [[4, 5], [10, 5], [4, 9], [10, 9]]) rect(c, x + a, y + b, 3, 3, '#6a6c70'); rect(c, x + 3, y + 12, 10, 2, '#707378'); break;
      case O.DUMPSTER: rect(c, x, y + 2, T, 13, '#26382c'); rect(c, x + 1, y + 3, 14, 10, '#3a5440'); rect(c, x + 1, y + 3, 14, 2, '#4a6a50'); rect(c, x + 1, y + 7, 14, 1, '#26382c'); rect(c, x, y + 14, 3, 2, '#111'); rect(c, x + 13, y + 14, 3, 2, '#111'); break;
      case O.MEDCAB: rect(c, x + 2, y + 2, 12, 12, '#cfd4d4'); rect(c, x + 3, y + 3, 10, 10, '#e4e8e8'); rect(c, x + 7, y + 4, 2, 6, '#b83a32'); rect(c, x + 5, y + 6, 6, 2, '#b83a32'); break;
      case O.PUMP: rect(c, x + 3, y + 1, 10, 14, '#a83a32'); rect(c, x + 4, y + 2, 8, 4, '#d8d4c8'); rect(c, x + 4, y + 7, 8, 2, '#2a2a2a'); rect(c, x + 3, y + 1, 10, 1, '#d86a5a'); rect(c, x, y + 4, 3, 8, '#222'); break;
      case O.BARREL: c.fillStyle = '#2a2a30'; c.beginPath(); c.arc(x + 8, y + 9, 6.5, 0, 6.3); c.fill(); c.fillStyle = '#3a5a7a'; c.beginPath(); c.arc(x + 8, y + 8, 6, 0, 6.3); c.fill(); c.fillStyle = '#4a6e90'; c.beginPath(); c.arc(x + 8, y + 7, 4, 0, 6.3); c.fill(); rect(c, x + 3, y + 8, 10, 1, 'rgba(0,0,0,.3)'); break;
      case O.HAY: rect(c, x, y + 2, T, 13, '#8a6a2a'); rect(c, x + 1, y + 2, 14, 12, '#c8a44a'); for (let k = 0; k < 4; k++) rect(c, x + 2 + k * 3, y + 3 + (k % 2) * 2, 1, 8, '#a8843a'); rect(c, x + 1, y + 6, 14, 1, '#8a6a2a'); rect(c, x + 1, y + 10, 14, 1, '#8a6a2a'); break;
      case O.CROP: { const s = W.st.get(i); const ripe = s && s.ripe; for (let k = 0; k < 4; k++) { rect(c, x + 1 + k * 4, y + 4, 3, 8, ripe ? '#4a7a34' : '#3e5e2c'); rect(c, x + 2 + k * 4, y + 3, 1, 3, '#6a9a4a'); if (ripe) rect(c, x + 1 + k * 4, y + 12, 3, 2, s.kind === 'carrot' ? '#d07a2a' : '#a8884a'); } break; }
      case O.MAILBOX: rect(c, x + 6, y + 7, 4, 8, '#4a3626'); rect(c, x + 3, y + 3, 10, 6, '#4a5a7a'); rect(c, x + 3, y + 3, 10, 1, '#6a7a9a'); rect(c, x + 12, y + 2, 1, 4, '#a83a32'); break;
      case O.GUNCAB: rect(c, x + 1, y + 1, 14, 14, '#2a3038'); rect(c, x + 2, y + 2, 12, 12, '#3a4450'); rect(c, x + 3, y + 3, 4, 10, '#6a8a9a'); rect(c, x + 9, y + 3, 4, 10, '#6a8a9a'); rect(c, x + 7, y + 7, 2, 2, '#c8c8c8'); break;
      case O.BEACON: rect(c, x + 1, y + 12, 14, 3, '#3a3e44'); rect(c, x + 6, y + 3, 4, 10, '#7a8088'); rect(c, x + 4, y + 6, 8, 1, '#7a8088'); rect(c, x + 5, y + 9, 6, 1, '#7a8088'); rect(c, x + 7, y, 2, 4, '#9a9fa6'); rect(c, x + 1, y + 1, 5, 1, '#c8c8c8'); break;
      case O.CHECKGATE: rect(c, x, y + 4, T, 8, '#b8b8b8'); for (let k = 0; k < 4; k++) rect(c, x + k * 4, y + 4, 2, 8, '#b83a32'); rect(c, x, y + 4, T, 1, '#e8e8e8'); { const s = W.st.get(112 + 6 * N); if (s && s.open) { rect(c, x, y, T, T, '#3a3a38'); rect(c, x, y + 6, 4, 4, '#b83a32'); } } break;
      case O.LAMP: rect(c, x + 7, y + 4, 2, 11, '#33363a'); rect(c, x + 5, y + 2, 6, 3, '#4a4d52'); rect(c, x + 6, y + 4, 4, 1, '#e8d890'); break;
      case O.SANDBAG: for (let k = 0; k < 2; k++) for (let j = 0; j < 2; j++) { rect(c, x + k * 8 - (j ? 3 : 0), y + 3 + j * 6, 8, 5, '#9a8a60'); rect(c, x + k * 8 - (j ? 3 : 0), y + 3 + j * 6, 8, 1, '#b8a878'); rect(c, x + k * 8 - (j ? 3 : 0), y + 7 + j * 6, 8, 1, '#6a5c3c'); } break;
      case O.BSTAIRS: for (let k = 0; k < 4; k++) rect(c, x + 1, y + 2 + k * 3, 14, 2, k % 2 ? '#8a6a42' : '#a88854'); rect(c, x + 1, y + 13, 14, 2, '#4a3626'); break;
      case O.BBENCH: rect(c, x + 1, y + 3, 14, 11, '#4a3626'); rect(c, x + 1, y + 2, 14, 10, '#8a6e46'); rect(c, x + 2, y + 3, 5, 3, '#8a8f98'); rect(c, x + 9, y + 4, 4, 5, '#a83a32'); rect(c, x + 2, y + 8, 8, 1, '#5a4228'); break;
      case O.CAMPFIRE: { const s = W.st.get(i); for (let k = 0; k < 8; k++) { const a = k * 0.785; rect(c, x + 8 + Math.round(Math.cos(a) * 6) - 1, y + 8 + Math.round(Math.sin(a) * 5) - 1, 3, 3, '#6a6a68'); } rect(c, x + 4, y + 7, 8, 2, '#4a3626'); rect(c, x + 6, y + 5, 2, 7, '#5a4228'); if (!(s && s.fuel > 0)) { rect(c, x + 5, y + 7, 6, 3, '#2a2420'); } break; }
      case O.COLLECTOR: { rect(c, x + 2, y + 2, 12, 11, '#2c4a66'); rect(c, x + 3, y + 3, 10, 9, '#4a7aa0'); rect(c, x + 5, y + 5, 6, 5, '#2a4e70'); rect(c, x + 3, y + 3, 10, 1, '#7aa8c8'); rect(c, x + 6, y + 12, 4, 3, '#6a4a30'); break; }
      case O.SPIKES: for (let k = 0; k < 4; k++) { rect(c, x + 1 + k * 4, y + 2, 2, 12, '#6a5030'); rect(c, x + 1 + k * 4, y + 1, 2, 2, '#c8b890'); } rect(c, x, y + 8, T, 2, '#4a3626'); break;
      case O.TRIPWIRE: rect(c, x + 2, y + 8, 12, 1, '#c8c8c8'); rect(c, x + 3, y + 8, 3, 3, '#a0a0a0'); rect(c, x + 10, y + 8, 3, 3, '#a0a0a0'); rect(c, x + 1, y + 6, 2, 6, '#4a3626'); rect(c, x + 13, y + 6, 2, 6, '#4a3626'); break;
    }
    // stairs/door shadows etc
  }

  // ---------- chunk baking ----------
  const chunks = (Tl.chunks = new Map());
  function mkCanvas(w, h) { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; return cv; }
  function bake(cx, cy) {
    const key = cy * NC + cx, A = DC.art, Q = DC.gfx, cfg = Q.cfg, bs = cfg.bake, sz = Math.ceil((CH * T + PAD * 2) * bs);
    let ch = chunks.get(key);
    if (!ch || ch.base.width !== sz) { ch = { base: mkCanvas(sz, sz), over: null, ver: -1, cx, cy, bs }; chunks.set(key, ch); }
    const c = ch.base.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, sz, sz); c.setTransform(bs, 0, 0, bs, 0, 0);
    const x0 = cx * CH - 1, y0 = cy * CH - 1, x1 = cx * CH + CH, y1 = cy * CH + CH;
    const ox = cx * CH * T - PAD, oy = cy * CH * T - PAD, ok = (tx, ty) => tx >= 0 && ty >= 0 && tx < N && ty < N;
    // ground, blended edges, decals
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      if (!ok(tx, ty)) continue; const gt = W.g[ty * N + tx], px = tx * T - ox, py = ty * T - oy;
      A.ground(c, gt, tx, ty, px, py); A.edges(c, gt, tx, ty, px, py); if (cfg.decor > 0) A.decor(c, gt, tx, ty, px, py, cfg.decor);
    }
    // building and object shadows
    if (cfg.shadow > 0) for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      if (!ok(tx, ty)) continue; const t = W.o[ty * N + tx]; if (!t) continue; const px = tx * T - ox, py = ty * T - oy;
      if (t === O.WALL || t === O.BWALL || t === O.DOOR || t === O.WINDOW) {
        if (!wallish(tx, ty + 1)) { const g = c.createLinearGradient(0, py + T, 0, py + T + 7); g.addColorStop(0, 'rgba(0,0,0,.42)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(px, py + T, T + 3, 7); }
        if (!wallish(tx + 1, ty) && !W.isIndoor(tx + 1, ty)) { const g = c.createLinearGradient(px + T, 0, px + T + 6, 0); g.addColorStop(0, 'rgba(0,0,0,.3)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(px + T, py + 3, 6, T + 4); }
      } else if (t === O.LAMP) { Q.soft(c, px + 9, py + 14, 4, 2, 0.4); }
    }
    let hasTrees = false;
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      if (!ok(tx, ty)) continue;
      const i = ty * N + tx, t = W.o[i]; if (!t || t === O.CAR) continue;
      if (t === O.TREE) hasTrees = true;
      const px = tx * T - ox, py = ty * T - oy;
      if (cfg.shadow > 0) A.contact(c, t, px, py);
      if (!A.NO_POLISH.has(t)) A.polish(c, bs, px, py, (tc, ax, ay) => drawObj(tc, t, tx, ty, ax, ay, i)); else drawObj(c, t, tx, ty, px, py, i);
    }
    for (const car of W.cars) { if (car.x >= x0 - 3 && car.x <= x1 && car.y >= y0 - 3 && car.y <= y1) A.car(c, car, ox, oy); }
    if (hasTrees) {
      if (!ch.over || ch.over.width !== sz) ch.over = mkCanvas(sz, sz);
      const oc = ch.over.getContext('2d'); oc.setTransform(1, 0, 0, 1, 0, 0); oc.clearRect(0, 0, sz, sz); oc.setTransform(bs, 0, 0, bs, 0, 0);
      for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) { if (!ok(tx, ty)) continue; if (W.o[ty * N + tx] === O.TREE) A.canopy(oc, tx * T - ox, ty * T - oy, tx, ty); }
    } else ch.over = null;
    ch.ver = W.ver[key];
    return ch;
  }
  Tl.get = function (cx, cy, allowBake) {
    const key = cy * NC + cx, ch = chunks.get(key);
    if (ch && ch.ver === W.ver[key]) return ch;
    if (!allowBake) return ch || null;
    return bake(cx, cy);
  };
  Tl.unloadFar = function (pcx, pcy, r) {
    for (const [k, ch] of chunks) if (Math.abs(ch.cx - pcx) > r || Math.abs(ch.cy - pcy) > r) chunks.delete(k);
  };
  Tl.PAD = PAD; Tl.clear = function () { chunks.clear(); };
  Tl.drawGround = drawGround; Tl.CARCOL = CARCOL;
})();

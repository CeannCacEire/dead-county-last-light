/* Dead County: Last Light - terrain, decals, props and building art. Everything is drawn procedurally into baked chunk textures. */
(function () {
  'use strict';
  const DC = window.DC, W = DC.W, G = DC.G, O = DC.O, Q = DC.gfx, T = 16, N = W.N;
  const hash = DC.hash, vn = DC.vnoise, rr = Q.rr;
  const A = (DC.art = {});
  const rect = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
  const mix = Q.col.mix, shade = Q.col.shade;
  const gAt = (tx, ty) => (W.inb(tx, ty) ? W.g[ty * N + tx] : G.GRASS);
  const oAt = (tx, ty) => (W.inb(tx, ty) ? W.o[ty * N + tx] : 0);

  // ---------- palettes ----------
  const PAL = {
    lawn: ['#44603a', '#4f6e3f', '#3c5632'], meadow: ['#5b6a3a', '#6a7642', '#4f5e33'], forest: ['#2b3d2a', '#34482f', '#243525'], marsh: ['#3a4a3a', '#44564a', '#2f3e34'],
    dirt: ['#6a5640', '#755f46', '#5c4a37'], mud: ['#4a3b2b', '#54432f', '#40332a'], gravel: ['#7a756a', '#85806f', '#6c675d'],
    road: ['#2f3135', '#34363a', '#2b2d31'], side: ['#74736b', '#7c7b72', '#6c6b63'], conc: ['#63645f', '#6a6b66', '#5c5d59'], pad: ['#3d3f45', '#43454b', '#393b41'],
    farm: ['#54402b', '#5c4730', '#4a3825'], leaves: ['#5a4f2a', '#665a30', '#4e4524'], wood: ['#7a5a3c', '#84633f', '#6f5236'], tile: ['#8a8d88', '#92958f', '#80837e'],
    carpet: ['#684650', '#704d57', '#5f3f48'], bridge: ['#6a5136', '#725839', '#5f4830'], deep: ['#1b3446', '#1e3a4d', '#183041'], shallow: ['#2f586b', '#356275', '#2a4f61'],
  };
  const PRIO = {}; PRIO[G.DEEP] = 0; PRIO[G.SHALLOW] = 1; PRIO[G.MUD] = 2; PRIO[G.DIRT] = 3; PRIO[G.FARM] = 3; PRIO[G.GRAVEL] = 4; PRIO[G.GRASS] = 5; PRIO[G.LEAVES] = 6;
  const SOFT = new Set([G.DEEP, G.SHALLOW, G.MUD, G.DIRT, G.FARM, G.GRAVEL, G.GRASS, G.LEAVES]);
  const HARD = new Set([G.ROAD, G.SIDEWALK, G.CONCRETE, G.PAD, G.TILE, G.WOOD, G.CARPET, G.BRIDGE]);
  const BIOME_CACHE = new Map();

  // 0 lawn (town), 1 meadow (country), 2 forest, 3 marsh
  A.biome = function (tx, ty) {
    let trees = 0, water = 0, bld = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const x = tx + dx, y = ty + dy; if (!W.inb(x, y)) continue; const i = y * N + x;
      if (W.o[i] === O.TREE) trees++;
      const g = W.g[i]; if (g === G.SHALLOW || g === G.DEEP) water++; if (W.bl[i] > 0 || g === G.SIDEWALK || g === G.ROAD) bld++;
    }
    if (trees >= 6) return 2; if (water >= 3) return 3; if (bld >= 3) return 0; return 1;
  };
  const pal = (name) => PAL[name];
  function tone(arr, n) { return n < 0.5 ? mix(arr[2], arr[0], n * 2) : mix(arr[0], arr[1], (n - 0.5) * 2); }

  // ---------- ground ----------
  function patchNoise(c, tx, ty, x, y, amp, f) {
    for (let sy = 0; sy < 4; sy++) for (let sx = 0; sx < 4; sx++) {
      const v = vn((tx * 4 + sx) * f, (ty * 4 + sy) * f, 5) - 0.5;
      if (Math.abs(v) < 0.04) continue;
      c.fillStyle = v > 0 ? 'rgba(255,255,235,' + (v * amp) + ')' : 'rgba(0,0,0,' + (-v * amp * 1.2) + ')'; c.fillRect(x + sx * 4, y + sy * 4, 4, 4);
    }
  }
  function speckle(c, tx, ty, x, y, n, cols, sz, seed) {
    for (let k = 0; k < n; k++) { const h1 = hash(tx, ty, seed + k * 3), h2 = hash(tx, ty, seed + k * 3 + 1), h3 = hash(tx, ty, seed + k * 3 + 2); c.fillStyle = cols[(h3 * cols.length) | 0]; c.fillRect(x + ((h1 * (T - sz)) | 0), y + ((h2 * (T - sz)) | 0), sz, sz); }
  }
  function blade(c, x, y, h, col, lean) { c.strokeStyle = col; c.lineWidth = 0.7; c.beginPath(); c.moveTo(x, y); c.lineTo(x + lean, y - h); c.stroke(); }

  A.ground = function (c, gt, tx, ty, x, y) {
    const indoor = W.isIndoor(tx, ty), n1 = vn(tx * 0.17, ty * 0.17, 3), h = hash(tx, ty, 11), h2 = hash(tx, ty, 23), h3 = hash(tx, ty, 37);
    switch (gt) {
      case G.GRASS: {
        const b = A.biome(tx, ty), p = pal(['lawn', 'meadow', 'forest', 'marsh'][b]);
        rect(c, x, y, T, T, tone(p, n1)); patchNoise(c, tx, ty, x, y, 0.1, 0.09);
        const nb = b === 2 ? 5 : 9;
        for (let k = 0; k < nb; k++) {
          const bx = x + hash(tx, ty, 40 + k) * 15, by = y + 2 + hash(tx, ty, 60 + k) * 13, lt = hash(tx, ty, 80 + k);
          blade(c, bx, by, 2 + lt * 2.2, lt > 0.5 ? shade(p[1], 1.18) : shade(p[2], 0.85), (lt - 0.5) * 1.6);
        }
        if (b === 2) { speckle(c, tx, ty, x, y, 3, ['#4a3a24', '#5a4a2a', '#3a4a2a'], 2, 120); if (h > 0.86) { rect(c, x + 3 + ((h2 * 8) | 0), y + 4 + ((h3 * 7) | 0), 1.6, 1.6, '#c9c0a8'); } }
        else if (b === 1 && h > 0.72) { const fc = ['#e8e0c0', '#d8c050', '#b090c8', '#e08a8a'][(h2 * 4) | 0]; const fx = x + 3 + ((h2 * 10) | 0), fy = y + 3 + ((h3 * 10) | 0); rect(c, fx, fy, 1.4, 1.4, fc); rect(c, fx + 2.5, fy + 1.5, 1.2, 1.2, fc); }
        else if (b === 0 && h > 0.9) { rect(c, x + ((h2 * 12) | 0) + 1, y + ((h3 * 12) | 0) + 1, 1.4, 1.4, '#e8d84a'); }
        else if (b === 3) { if (h > 0.6) { blade(c, x + 4 + h2 * 8, y + 13, 5, '#5a6a44', 0.6); blade(c, x + 5 + h2 * 8, y + 13, 6, '#6a7a50', -0.5); } }
        if (h > 0.97) { c.fillStyle = 'rgba(0,0,0,.18)'; c.beginPath(); c.ellipse(x + 8, y + 10, 3, 1.8, 0, 0, 6.28); c.fill(); c.fillStyle = '#8c8a82'; c.beginPath(); c.ellipse(x + 8, y + 9, 2.6, 1.7, 0, 0, 6.28); c.fill(); }
        break;
      }
      case G.DIRT: rect(c, x, y, T, T, tone(PAL.dirt, n1)); patchNoise(c, tx, ty, x, y, 0.12, 0.11); speckle(c, tx, ty, x, y, 7, ['#8a7358', '#4a3a2a', '#6f5c44'], 1.4, 20); if (h > 0.9) { rect(c, x + 3, y + 5 + ((h2 * 6) | 0), 4, 1, 'rgba(0,0,0,.18)'); } break;
      case G.MUD: rect(c, x, y, T, T, tone(PAL.mud, n1)); patchNoise(c, tx, ty, x, y, 0.14, 0.13); if (h > 0.5) { c.fillStyle = 'rgba(30,22,16,.55)'; c.beginPath(); c.ellipse(x + 8 + (h2 - 0.5) * 6, y + 8 + (h3 - 0.5) * 6, 4 + h * 2, 2.4 + h2, 0, 0, 6.28); c.fill(); c.fillStyle = 'rgba(190,200,210,.18)'; c.beginPath(); c.ellipse(x + 7 + (h2 - 0.5) * 6, y + 7 + (h3 - 0.5) * 6, 2.4, 1, 0, 0, 6.28); c.fill(); } break;
      case G.GRAVEL: rect(c, x, y, T, T, tone(PAL.gravel, n1)); for (let k = 0; k < 9; k++) { const gx = x + hash(tx, ty, 50 + k) * 14, gy = y + hash(tx, ty, 70 + k) * 14, l = hash(tx, ty, 90 + k); c.fillStyle = l > 0.5 ? '#9a9486' : '#4e4a42'; c.beginPath(); c.ellipse(gx + 1, gy + 1, 1.3, 0.9, l * 3, 0, 6.28); c.fill(); } break;
      case G.LEAVES: rect(c, x, y, T, T, tone(PAL.leaves, n1)); for (let k = 0; k < 8; k++) { const lx = x + hash(tx, ty, 70 + k) * 14, ly = y + hash(tx, ty, 80 + k) * 14, l = hash(tx, ty, 100 + k); c.fillStyle = ['#8a6428', '#9a7430', '#6a5a28', '#7a4a22', '#5a6a2c'][(l * 5) | 0]; c.beginPath(); c.ellipse(lx + 1, ly + 1, 1.7, 0.9, l * 6, 0, 6.28); c.fill(); } break;
      case G.FARM: rect(c, x, y, T, T, tone(PAL.farm, n1)); for (let k = 0; k < 4; k++) { rect(c, x, y + k * 4, T, 1.4, '#6a5238'); rect(c, x, y + k * 4 + 2, T, 1.6, '#352618'); } speckle(c, tx, ty, x, y, 3, ['#7a6244', '#3a2c1c'], 1, 130); break;
      case G.ROAD: {
        rect(c, x, y, T, T, tone(PAL.road, n1)); patchNoise(c, tx, ty, x, y, 0.07, 0.15);
        speckle(c, tx, ty, x, y, 14, ['#42454a', '#25272a', '#4c4f55'], 1, 200);
        const isH = (y0) => y0 === 112 || W.ROADS.includes(y0), isV = (x0) => x0 === 112 || W.ROADS.includes(x0);
        const roadAt = (ax, ay) => W.inb(ax, ay) && (W.g[ay * N + ax] === G.ROAD || W.g[ay * N + ax] === G.BRIDGE);
        const ch = isH(ty) && roadAt(tx - 1, ty) && roadAt(tx + 1, ty), cv = isV(tx) && roadAt(tx, ty - 1) && roadAt(tx, ty + 1);
        if (ch && !cv && tx % 6 < 3) { rect(c, x, y + 7, T, 2, '#b3a24a'); rect(c, x, y + 7, T, 0.6, 'rgba(255,255,255,.25)'); }
        else if (cv && !ch && ty % 6 < 3) { rect(c, x + 7, y, 2, T, '#b3a24a'); rect(c, x + 7, y, 0.6, T, 'rgba(255,255,255,.25)'); }
        // edge lines against sidewalks
        const sw = (dx, dy) => gAt(tx + dx, ty + dy) === G.SIDEWALK;
        if (sw(0, -1)) rect(c, x, y, T, 1, 'rgba(220,220,210,.45)'); if (sw(0, 1)) rect(c, x, y + 15, T, 1, 'rgba(220,220,210,.45)');
        if (sw(-1, 0)) rect(c, x, y, 1, T, 'rgba(220,220,210,.45)'); if (sw(1, 0)) rect(c, x + 15, y, 1, T, 'rgba(220,220,210,.45)');
        break;
      }
      case G.SIDEWALK: rect(c, x, y, T, T, tone(PAL.side, n1)); patchNoise(c, tx, ty, x, y, 0.08, 0.2); rect(c, x, y + 15, T, 1, 'rgba(0,0,0,.28)'); rect(c, x + 15, y, 1, T, 'rgba(0,0,0,.28)'); rect(c, x, y, T, 0.8, 'rgba(255,255,255,.12)'); speckle(c, tx, ty, x, y, 4, ['#8b8a82', '#595850'], 1, 210); break;
      case G.CONCRETE: rect(c, x, y, T, T, tone(PAL.conc, n1)); patchNoise(c, tx, ty, x, y, 0.1, 0.16); if (tx % 4 === 0) rect(c, x, y, 0.9, T, 'rgba(0,0,0,.25)'); if (ty % 4 === 0) rect(c, x, y, T, 0.9, 'rgba(0,0,0,.25)'); speckle(c, tx, ty, x, y, 6, ['#74756f', '#4c4d49'], 1, 220); if (indoor) rect(c, x, y, T, T, 'rgba(0,0,0,.22)'); break;
      case G.PAD: rect(c, x, y, T, T, tone(PAL.pad, n1)); patchNoise(c, tx, ty, x, y, 0.08, 0.14); speckle(c, tx, ty, x, y, 9, ['#4d5058', '#2c2e33'], 1, 230); if (tx % 3 === 0) rect(c, x, y + 1, 1.2, 14, 'rgba(225,225,215,.55)'); break;
      case G.WOOD: {
        const rowo = (ty * 7) % 4; rect(c, x, y, T, T, tone(PAL.wood, n1));
        for (let k = 0; k < 4; k++) { const pl = hash(tx, ty * 4 + k, 311); c.fillStyle = pl > 0.5 ? 'rgba(255,230,190,' + (pl - 0.5) * 0.14 + ')' : 'rgba(0,0,0,' + (0.5 - pl) * 0.18 + ')'; c.fillRect(x, y + k * 4, T, 4); rect(c, x, y + k * 4 + 3, T, 1, 'rgba(30,18,8,.55)'); rect(c, x, y + k * 4, T, 0.6, 'rgba(255,235,200,.12)'); const jx = ((hash(tx, ty * 4 + k, 312) * 12) | 0) + 2; rect(c, x + jx, y + k * 4, 0.8, 3, 'rgba(30,18,8,.45)'); if (hash(tx, ty * 4 + k, 313) > 0.85) { c.fillStyle = 'rgba(40,24,10,.5)'; c.beginPath(); c.ellipse(x + 4 + k * 3, y + k * 4 + 1.6, 1.1, 0.6, 0, 0, 6.28); c.fill(); } }
        break;
      }
      case G.TILE: { const chk = (tx + ty) & 1; rect(c, x, y, T, T, tone(PAL.tile, n1)); if (chk) rect(c, x, y, T, T, 'rgba(0,0,0,.1)'); rect(c, x, y + 15, T, 1, 'rgba(0,0,0,.3)'); rect(c, x + 15, y, 1, T, 'rgba(0,0,0,.3)'); rect(c, x, y, T, 0.7, 'rgba(255,255,255,.18)'); if (h > 0.8) { c.fillStyle = 'rgba(0,0,0,.12)'; c.beginPath(); c.ellipse(x + 8, y + 8, 5, 3, 0, 0, 6.28); c.fill(); } break; }
      case G.CARPET: { rect(c, x, y, T, T, tone(PAL.carpet, n1)); for (let k = 0; k < 8; k++) rect(c, x, y + k * 2, T, 0.6, 'rgba(0,0,0,.1)'); if (h > 0.75) { c.fillStyle = 'rgba(30,10,10,.25)'; c.beginPath(); c.ellipse(x + 4 + h2 * 8, y + 4 + h3 * 8, 2.5, 1.8, 0, 0, 6.28); c.fill(); } break; }
      case G.BRIDGE: rect(c, x, y, T, T, tone(PAL.bridge, n1)); for (let k = 0; k < 4; k++) { rect(c, x, y + k * 4 + 3, T, 1, '#2e2216'); rect(c, x, y + k * 4, T, 0.6, 'rgba(255,230,190,.12)'); } rect(c, x, y, T, 1.6, 'rgba(0,0,0,.28)'); break;
      case G.DEEP: { rect(c, x, y, T, T, tone(PAL.deep, n1)); patchNoise(c, tx, ty, x, y, 0.1, 0.1); const wv = hash(tx, ty, 14); rect(c, x + wv * 8, y + h2 * 12, 5, 0.7, 'rgba(120,170,200,.22)'); break; }
      case G.SHALLOW: { rect(c, x, y, T, T, tone(PAL.shallow, n1)); patchNoise(c, tx, ty, x, y, 0.1, 0.1); rect(c, x + h * 8, y + h2 * 12, 6, 0.8, 'rgba(160,210,225,.28)'); if (h > 0.9) { c.fillStyle = '#3f6a3a'; c.beginPath(); c.ellipse(x + 8, y + 8, 3.4, 2.7, 0, 0, 6.28); c.fill(); c.fillStyle = '#e8d0e0'; c.fillRect(x + 8, y + 7, 1.2, 1.2); } break; }
      default: rect(c, x, y, T, T, '#444');
    }
    if (indoor) A.interiorFinish(c, gt, tx, ty, x, y);
  };

  // indoor ambient occlusion along walls
  A.interiorFinish = function (c, gt, tx, ty, x, y) {
    const wl = (dx, dy) => { const o = oAt(tx + dx, ty + dy); return o === O.WALL || o === O.WINDOW || o === O.DOOR || o === O.BWALL; };
    const ao = (x0, y0, x1, y1, w, h) => { const g = c.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, 'rgba(0,0,0,.42)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(x, y, w, h); };
    if (wl(0, -1)) { const g = c.createLinearGradient(0, y, 0, y + 7); g.addColorStop(0, 'rgba(0,0,0,.5)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(x, y, T, 7); }
    if (wl(0, 1)) { const g = c.createLinearGradient(0, y + T, 0, y + T - 4); g.addColorStop(0, 'rgba(0,0,0,.32)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(x, y + T - 4, T, 4); }
    if (wl(-1, 0)) { const g = c.createLinearGradient(x, 0, x + 5, 0); g.addColorStop(0, 'rgba(0,0,0,.4)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(x, y, 5, T); }
    if (wl(1, 0)) { const g = c.createLinearGradient(x + T, 0, x + T - 5, 0); g.addColorStop(0, 'rgba(0,0,0,.32)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(x + T - 5, y, 5, T); }
    // skirting board along the north wall
    if (wl(0, -1) && gt !== G.CARPET) rect(c, x, y + 7, T, 0.8, 'rgba(0,0,0,.3)');
  };

  // blended transitions between neighbouring terrain kinds
  const BASEC = {}; BASEC[G.GRASS] = '#46603a'; BASEC[G.DIRT] = '#6a5640'; BASEC[G.MUD] = '#4a3b2b'; BASEC[G.GRAVEL] = '#7a756a'; BASEC[G.LEAVES] = '#5a4f2a'; BASEC[G.FARM] = '#54402b'; BASEC[G.SHALLOW] = '#2f586b'; BASEC[G.DEEP] = '#1b3446';
  A.edges = function (c, gt, tx, ty, x, y) {
    const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    for (const [dx, dy] of dirs) {
      const n = gAt(tx + dx, ty + dy); if (n === gt) continue;
      const hd = (hash(tx, ty, 400 + dx * 3 + dy) * 3) | 0;
      if (SOFT.has(gt) && SOFT.has(n) && PRIO[n] > PRIO[gt] && gt !== G.DEEP && gt !== G.SHALLOW && n !== G.SHALLOW && n !== G.DEEP) {
        const col = BASEC[n], x0 = dx > 0 ? x + T : x, y0 = dy > 0 ? y + T : y;
        const g = c.createLinearGradient(x0, y0, x0 - dx * 5.5, y0 - dy * 5.5); g.addColorStop(0, col); g.addColorStop(0.45, mix(col, '#000000', 0)); g.addColorStop(1, 'rgba(0,0,0,0)');
        c.globalAlpha = 0.85; c.fillStyle = g; c.fillRect(x, y, T, T); c.globalAlpha = 1;
        c.fillStyle = col; for (let k = 0; k < 4; k++) { const s = hash(tx, ty, 420 + k + dx * 7 + dy * 5), r = 1 + hash(tx, ty, 430 + k) * 1.8; const px = dx ? (dx > 0 ? x + T - 1 - hash(tx, ty, 440 + k) * 5 : x + hash(tx, ty, 440 + k) * 5) : x + s * T; const py = dy ? (dy > 0 ? y + T - 1 - hash(tx, ty, 450 + k) * 5 : y + hash(tx, ty, 450 + k) * 5) : y + s * T; c.beginPath(); c.arc(px, py, r, 0, 6.28); c.fill(); }
      } else if (SOFT.has(gt) && HARD.has(n) && n !== G.WOOD && n !== G.TILE && n !== G.CARPET) {
        // soil lip where lawn meets pavement
        const lip = 'rgba(40,30,20,.35)';
        if (dy < 0) rect(c, x, y, T, 1.2, lip); else if (dy > 0) rect(c, x, y + T - 1.2, T, 1.2, lip); else if (dx < 0) rect(c, x, y, 1.2, T, lip); else rect(c, x + T - 1.2, y, 1.2, T, lip);
        if (gt === G.GRASS) { for (let k = 0; k < 3; k++) { const s = hash(tx, ty, 460 + k + dx + dy * 3) * 13 + 1; const bx = dx ? (dx > 0 ? x + T - 1 : x + 1) : x + s, by = dy ? (dy > 0 ? y + T - 1 : y + 1) : y + s; blade(c, bx, by, 2.4, '#5b7a45', -dx * 0.8); } }
      } else if (HARD.has(gt) && SOFT.has(n) && n !== G.DEEP && n !== G.SHALLOW) {
        // grit and dirt spilling over the paved edge
        c.fillStyle = 'rgba(' + (n === G.GRASS ? '60,80,44' : '90,72,52') + ',.55)';
        for (let k = 0; k < 3; k++) { const s = hash(tx, ty, 470 + k + dx * 5 + dy) * 14; const px = dx ? (dx > 0 ? x + T - 1.4 : x) : x + s, py = dy ? (dy > 0 ? y + T - 1.4 : y) : y + s; c.fillRect(px, py, 1.4 + hd * 0.4, 1.4); }
      } else if ((gt === G.DEEP || gt === G.SHALLOW) && n !== G.DEEP && n !== G.SHALLOW && n !== G.BRIDGE) {
        // shoreline foam and wet band
        const x0 = dx > 0 ? x + T : x, y0 = dy > 0 ? y + T : y, g = c.createLinearGradient(x0, y0, x0 - dx * 4, y0 - dy * 4);
        g.addColorStop(0, 'rgba(190,205,200,.5)'); g.addColorStop(1, 'rgba(190,205,200,0)'); c.fillStyle = g; c.fillRect(x, y, T, T);
      } else if (!(gt === G.DEEP || gt === G.SHALLOW) && (n === G.DEEP || n === G.SHALLOW)) {
        const x0 = dx > 0 ? x + T : x, y0 = dy > 0 ? y + T : y, g = c.createLinearGradient(x0, y0, x0 - dx * 4, y0 - dy * 4);
        g.addColorStop(0, 'rgba(25,24,18,.5)'); g.addColorStop(1, 'rgba(25,24,18,0)'); c.fillStyle = g; c.fillRect(x, y, T, T);
      }
    }
  };

  // ---------- decals (ground clutter) ----------
  A.puddleAt = function (tx, ty) { const g = gAt(tx, ty); if (g === G.ROAD || g === G.DIRT || g === G.MUD || g === G.SIDEWALK || g === G.PAD || g === G.CONCRETE) return hash(tx, ty, 333) < 0.07 && !oAt(tx, ty); return false; };
  A.decor = function (c, gt, tx, ty, x, y, density) {
    if (oAt(tx, ty)) return; const h = hash(tx, ty, 200) / Math.max(0.05, density), h2 = hash(tx, ty, 201), h3 = hash(tx, ty, 202), indoor = W.isIndoor(tx, ty);
    const crack = (len) => { c.strokeStyle = 'rgba(8,8,8,.55)'; c.lineWidth = 0.6; c.beginPath(); let px = x + h2 * 12 + 2, py = y + h3 * 12 + 2; c.moveTo(px, py); for (let k = 0; k < 4; k++) { px += (hash(tx, ty, 210 + k) - 0.4) * len; py += (hash(tx, ty, 220 + k) - 0.5) * len; c.lineTo(px, py); } c.stroke(); };
    if (indoor) {
      if (h < 0.04) { c.fillStyle = 'rgba(10,6,4,.3)'; c.beginPath(); c.ellipse(x + 8, y + 8, 3 + h2 * 3, 2 + h3 * 2, h * 20, 0, 6.28); c.fill(); }           // stain
      else if (h < 0.075) { rect(c, x + 3 + h2 * 6, y + 4 + h3 * 6, 4, 3, '#cfcabb'); rect(c, x + 4 + h2 * 6, y + 5 + h3 * 6, 3, 0.6, '#8a8678'); }              // paper
      else if (h < 0.095) { rect(c, x + 2 + h2 * 9, y + 3 + h3 * 9, 1, 1, 'rgba(210,235,245,.8)'); rect(c, x + 4 + h2 * 8, y + 4 + h3 * 8, 1.4, 0.8, 'rgba(210,235,245,.7)'); }
      else if (h < 0.105) crack(5);
      // doormat inside entrances
      const nb = [[0, -1], [0, 1], [-1, 0], [1, 0]]; for (const [dx, dy] of nb) if (oAt(tx + dx, ty + dy) === O.DOOR) { c.fillStyle = '#3b2e24'; rr(c, x + 2, y + 3, 12, 10, 1.5); c.fill(); c.fillStyle = '#5a463a'; rr(c, x + 3, y + 4, 10, 8, 1); c.fill(); rect(c, x + 4, y + 7, 8, 0.8, '#2c221b'); }
      return;
    }
    switch (gt) {
      case G.ROAD: if (h < 0.05) crack(7); else if (h < 0.075) { c.fillStyle = 'rgba(0,0,0,.15)'; c.fillRect(x + 2, y + 3, 10, 7); c.strokeStyle = 'rgba(0,0,0,.3)'; c.lineWidth = 0.5; c.strokeRect(x + 2, y + 3, 10, 7); } else if (h < 0.095) { c.fillStyle = 'rgba(8,8,10,.55)'; c.beginPath(); c.ellipse(x + 8, y + 8, 3 + h2 * 3, 2 + h3 * 2, h2 * 3, 0, 6.28); c.fill(); } else if (h < 0.105) { c.fillStyle = '#17181a'; c.beginPath(); c.arc(x + 8, y + 8, 4.2, 0, 6.28); c.fill(); c.strokeStyle = '#4a4c52'; c.lineWidth = 0.6; c.stroke(); for (let k = -2; k <= 2; k += 2) rect(c, x + 5, y + 8 + k * 0.9, 6, 0.5, '#4a4c52'); } else if (h < 0.125) { rect(c, x + 2 + h2 * 9, y + 3 + h3 * 9, 3.2, 2.2, '#b9b6a4'); } else if (h < 0.14) { c.fillStyle = 'rgba(100,70,30,.5)'; c.beginPath(); c.ellipse(x + 3 + h2 * 10, y + 13, 2.2, 1, 0.3, 0, 6.28); c.fill(); } break;
      case G.SIDEWALK: if (h < 0.04) crack(5); else if (h < 0.07) { blade(c, x + 3 + h2 * 9, y + 14, 3, '#5a7a3a', 0.8); blade(c, x + 4 + h2 * 9, y + 14, 4, '#6a8a44', -0.8); } else if (h < 0.09) { rect(c, x + 3 + h2 * 8, y + 4 + h3 * 8, 3, 2, '#bdb9a7'); } else if (h < 0.1) { rect(c, x + 5, y + 8, 2, 2, '#3a3a38'); } break;
      case G.CONCRETE: case G.PAD: if (h < 0.06) crack(6); else if (h < 0.1) { c.fillStyle = 'rgba(6,6,8,.4)'; c.beginPath(); c.ellipse(x + 8, y + 8, 4, 2.6, h2 * 3, 0, 6.28); c.fill(); } else if (h < 0.115) { rect(c, x + 3 + h2 * 8, y + 5 + h3 * 6, 3, 2, '#aaa798'); } break;
      case G.GRASS: { const b = A.biome(tx, ty); if (b === 2) { if (h < 0.08) { c.fillStyle = '#6a4a2a'; c.save(); c.translate(x + 8, y + 8); c.rotate(h2 * 3); c.fillRect(-5, -0.8, 10, 1.6); c.fillStyle = '#4a3220'; c.fillRect(-5, 0.2, 10, 0.8); c.restore(); } else if (h < 0.13) { c.fillStyle = '#d8d0b8'; c.fillRect(x + 4 + h2 * 8, y + 7 + h3 * 4, 1.2, 1.4); c.fillStyle = '#a84a34'; c.fillRect(x + 4 + h2 * 8 - 0.4, y + 6.6 + h3 * 4, 2, 1); } else if (h < 0.2) { c.strokeStyle = '#3f6a34'; c.lineWidth = 0.8; for (let k = 0; k < 5; k++) { c.beginPath(); c.moveTo(x + 8, y + 11); c.lineTo(x + 8 + Math.cos(k * 1.25 - 0.6) * 5, y + 11 - Math.sin(k * 1.25 + 0.5) * 4 - 1); c.stroke(); } } } else if (b === 0 && h < 0.03) { rect(c, x + 4 + h2 * 8, y + 5 + h3 * 6, 3, 2, '#b5b09a'); } break; }
      case G.DIRT: if (h < 0.05) { c.fillStyle = '#3c3024'; c.beginPath(); c.ellipse(x + 8, y + 8, 2.5, 1.5, h2 * 3, 0, 6.28); c.fill(); } else if (h < 0.1) { rect(c, x + 3, y + 4 + h2 * 6, 10, 1.2, 'rgba(0,0,0,.2)'); rect(c, x + 3, y + 8 + h3 * 4, 10, 1.2, 'rgba(0,0,0,.2)'); } break;
      case G.GRAVEL: if (h < 0.04) { rect(c, x + 3 + h2 * 8, y + 5 + h3 * 6, 2, 1.4, '#a7a395'); } break;
    }
  };

  // ---------- walls, doors, windows ----------
  const wallish = (tx, ty) => { const t = oAt(tx, ty); return t === O.WALL || t === O.DOOR || t === O.WINDOW || t === O.BWALL || t === O.BGATE; };
  A.wallish = wallish;
  const STYLE = { house: 'siding', shop: 'brick', police: 'brick', fire: 'brick', hospital: 'plaster', warehouse: 'metal', gas: 'plaster', cabin: 'log', barn: 'plank' };
  A.wall = function (c, tx, ty, x, y, col, type, rough) {
    const up = wallish(tx, ty - 1), dn = wallish(tx, ty + 1), lf = wallish(tx - 1, ty), rt = wallish(tx + 1, ty);
    const style = rough ? 'plank' : STYLE[type] || 'siding', h = hash(tx, ty, 6);
    const g = c.createLinearGradient(x, y, x + T, y + T); g.addColorStop(0, shade(col, 1.08)); g.addColorStop(1, shade(col, 0.92)); c.fillStyle = g; c.fillRect(x, y, T, T);
    const fh = dn ? 0 : 6, ty0 = y + T - fh; // front-face area
    // coping / top surface
    rect(c, x, y, T, 11 + (dn ? 5 : 0), shade(col, 1.0));
    patchNoise(c, tx, ty, x, y, 0.06, 0.2);
    if (!up) rect(c, x, y, T, 1.8, 'rgba(255,255,255,.28)');
    if (!lf) rect(c, x, y, 1, T, 'rgba(255,255,255,.14)'); if (!rt) rect(c, x + 15, y, 1, T, 'rgba(0,0,0,.28)');
    if (!dn) {
      const f = shade(col, 0.66); c.fillStyle = f; c.fillRect(x, y + 10, T, 6);
      switch (style) {
        case 'brick': for (let r = 0; r < 3; r++) { const off = (r + tx) % 2 ? 0 : 4; rect(c, x, y + 10 + r * 2 + 1.4, T, 0.5, 'rgba(0,0,0,.35)'); for (let k = -1; k < 4; k++) rect(c, x + off + k * 8, y + 10 + r * 2, 0.5, 2, 'rgba(0,0,0,.3)'); } break;
        case 'siding': for (let r = 0; r < 3; r++) { rect(c, x, y + 11 + r * 2, T, 0.6, 'rgba(0,0,0,.32)'); rect(c, x, y + 10 + r * 2, T, 0.5, 'rgba(255,255,255,.1)'); } break;
        case 'metal': for (let k = 0; k < 8; k++) { rect(c, x + k * 2, y + 10, 0.7, 6, 'rgba(0,0,0,.28)'); rect(c, x + k * 2 + 1, y + 10, 0.5, 6, 'rgba(255,255,255,.08)'); } break;
        case 'log': for (let r = 0; r < 3; r++) { rect(c, x, y + 10 + r * 2, T, 2, shade(col, 0.62 + r * 0.04)); rect(c, x, y + 10 + r * 2, T, 0.6, 'rgba(255,230,190,.16)'); rect(c, x, y + 11.6 + r * 2, T, 0.5, 'rgba(0,0,0,.4)'); } break;
        case 'plank': for (let k = 0; k < 4; k++) { rect(c, x + k * 4 + 3, y + 10, 0.7, 6, 'rgba(0,0,0,.4)'); } break;
        default: rect(c, x, y + 12, T, 0.6, 'rgba(0,0,0,.12)'); if (h > 0.6) rect(c, x + h * 10, y + 11, 3, 4, 'rgba(0,0,0,.08)'); break;
      }
      rect(c, x, y + 10, T, 0.9, 'rgba(0,0,0,.4)');                         // eave shadow
      rect(c, x, y + 15, T, 1, 'rgba(0,0,0,.5)');                           // foundation
      if (h > 0.9 && style !== 'log') { c.fillStyle = 'rgba(20,40,16,.3)'; c.fillRect(x + h * 8, y + 13, 2, 3); }   // moss at the base
    }
  };
  A.planks = function (c, x, y, lv, horiz) {
    const n = Math.min(3, lv);
    for (let k = 0; k < n; k++) {
      if (horiz) { const yy = y + 2 + k * 4.2; rect(c, x + 0.5, yy + 1, 15, 3, 'rgba(0,0,0,.3)'); c.fillStyle = '#8f6c42'; c.fillRect(x + 0.5, yy, 15, 3); rect(c, x + 0.5, yy, 15, 0.8, '#b08a55'); rect(c, x + 0.5, yy + 2.2, 15, 0.8, '#5a4228'); rect(c, x + 1.5, yy + 0.7, 1.2, 1.2, '#d0d0cc'); rect(c, x + 13, yy + 0.7, 1.2, 1.2, '#d0d0cc'); rect(c, x + 5 + k * 2, yy + 1, 3, 0.5, 'rgba(60,35,12,.5)'); }
      else { const xx = x + 2 + k * 4.2; rect(c, xx + 1, y + 0.5, 3, 15, 'rgba(0,0,0,.3)'); c.fillStyle = '#8f6c42'; c.fillRect(xx, y + 0.5, 3, 15); rect(c, xx, y + 0.5, 0.8, 15, '#b08a55'); rect(c, xx + 2.2, y + 0.5, 0.8, 15, '#5a4228'); rect(c, xx + 0.8, y + 1.5, 1.2, 1.2, '#d0d0cc'); rect(c, xx + 0.8, y + 12.5, 1.2, 1.2, '#d0d0cc'); }
    }
  };
  A.door = function (c, tx, ty, x, y, st, horiz, wc, type) {
    const s = st || {};
    A.wall(c, tx, ty, x, y, wc, type);
    if (s.open || s.broken) {
      c.fillStyle = '#17110d'; c.fillRect(x, y, T, T);
      const g = c.createLinearGradient(x, y, x + T, y + T); g.addColorStop(0, '#2a1f17'); g.addColorStop(1, '#120c09'); c.fillStyle = g; c.fillRect(x + 1, y + 1, 14, 14);
      if (horiz) { rect(c, x, y, 2, T, '#5a4028'); rect(c, x + 14, y, 2, T, '#5a4028'); if (s.broken) { c.save(); c.translate(x + 3, y + 4); c.rotate(0.3); rect(c, 0, 0, 3, 9, '#7a5430'); c.restore(); rect(c, x + 6, y + 10, 4, 1.5, '#6a4a2c'); rect(c, x + 9, y + 7, 2, 1, '#5a3e24'); } else { c.fillStyle = '#7b5632'; c.fillRect(x + 2, y + 1, 2.4, 14); rect(c, x + 2, y + 1, 0.8, 14, '#9a7044'); rect(c, x + 3.4, y + 8, 0.9, 1.2, '#d8c070'); } }
      else { rect(c, x, y, T, 2, '#5a4028'); rect(c, x, y + 14, T, 2, '#5a4028'); if (s.broken) { rect(c, x + 3, y + 3, 9, 3, '#7a5430'); rect(c, x + 8, y + 8, 5, 1.5, '#6a4a2c'); } else { c.fillStyle = '#7b5632'; c.fillRect(x + 1, y + 2, 14, 2.4); rect(c, x + 1, y + 2, 14, 0.8, '#9a7044'); } }
    } else {
      const woodc = type === 'police' || type === 'hospital' || type === 'warehouse' ? '#5a6a78' : '#7b5632';
      rect(c, x + 0.5, y + 0.5, 15, 15, '#2a1d12'); const g = c.createLinearGradient(x, y, x + T, y + T); g.addColorStop(0, shade(woodc, 1.18)); g.addColorStop(1, shade(woodc, 0.8)); c.fillStyle = g; c.fillRect(x + 1.5, y + 1.5, 13, 13);
      if (horiz) { rr(c, x + 3, y + 3, 4.4, 4.2, 0.6); c.strokeStyle = 'rgba(0,0,0,.38)'; c.lineWidth = 0.6; c.stroke(); rr(c, x + 8.6, y + 3, 4.4, 4.2, 0.6); c.stroke(); rr(c, x + 3, y + 8.6, 4.4, 4.4, 0.6); c.stroke(); rr(c, x + 8.6, y + 8.6, 4.4, 4.4, 0.6); c.stroke(); Q.circle(c, x + 12, y + 8, 1.1, '#e0c878'); rect(c, x + 11.4, y + 7.4, 0.6, 0.6, '#fff8d0'); }
      else { rr(c, x + 3, y + 3, 4.2, 4.4, 0.6); c.strokeStyle = 'rgba(0,0,0,.38)'; c.lineWidth = 0.6; c.stroke(); rr(c, x + 8.8, y + 3, 4.2, 4.4, 0.6); c.stroke(); rr(c, x + 3, y + 8.6, 4.2, 4.4, 0.6); c.stroke(); rr(c, x + 8.8, y + 8.6, 4.2, 4.4, 0.6); c.stroke(); Q.circle(c, x + 8, y + 12, 1.1, '#e0c878'); }
      if (s.locked && !s.bar) { rect(c, x + 6.4, y + 6.4, 3.2, 3.2, '#2a0f0c'); rect(c, x + 7, y + 7, 2, 2, '#c8423a'); }
    }
    if (s.bar > 0) A.planks(c, x, y, s.bar, horiz);
    if (!wallish(tx, ty + 1) && horiz) rect(c, x, y + 15, T, 1, 'rgba(0,0,0,.45)');
  };
  A.window = function (c, tx, ty, x, y, st, horiz, wc, type) {
    const s = st || {};
    A.wall(c, tx, ty, x, y, wc, type);
    const gx = horiz ? x + 2 : x + 4, gy = horiz ? y + 3.5 : y + 2, gw = horiz ? 12 : 8, gh = horiz ? 7.5 : 12;
    rect(c, gx - 1.2, gy - 1.2, gw + 2.4, gh + 2.4, '#e8e0d0'); rect(c, gx - 1.2, gy + gh + 1.2, gw + 2.4, 1, 'rgba(0,0,0,.35)');
    if (s.broken) { rect(c, gx, gy, gw, gh, '#0b0f12'); c.fillStyle = '#9ec2d0'; c.beginPath(); c.moveTo(gx, gy); c.lineTo(gx + 3.4, gy); c.lineTo(gx, gy + 3); c.fill(); c.beginPath(); c.moveTo(gx + gw, gy + gh); c.lineTo(gx + gw - 3, gy + gh); c.lineTo(gx + gw, gy + gh - 3.4); c.fill(); c.beginPath(); c.moveTo(gx + gw * 0.5, gy); c.lineTo(gx + gw * 0.5 + 2, gy + 1.5); c.lineTo(gx + gw * 0.5 - 1, gy + 2.2); c.fill(); }
    else if (s.open) { rect(c, gx, gy, gw, gh, '#0b0f12'); c.fillStyle = '#7a6a8a'; c.fillRect(gx, gy, 3, gh); rect(c, gx + 2.4, gy, 0.7, gh, '#a898b8'); }
    else {
      const g = c.createLinearGradient(gx, gy, gx + gw, gy + gh); g.addColorStop(0, '#a6cbdc'); g.addColorStop(0.5, '#6f98ac'); g.addColorStop(1, '#4a6c80'); c.fillStyle = g; c.fillRect(gx, gy, gw, gh);
      c.fillStyle = 'rgba(255,255,255,.34)'; c.beginPath(); c.moveTo(gx + 1, gy + gh); c.lineTo(gx + 4, gy); c.lineTo(gx + 6, gy); c.lineTo(gx + 3, gy + gh); c.fill();
      rect(c, gx + (gw >> 1) - 0.4, gy, 0.9, gh, '#e8e0d0'); rect(c, gx, gy + (gh >> 1) - 0.4, gw, 0.9, '#e8e0d0');
    }
    if (s.bar > 0) A.planks(c, x, y, s.bar, horiz);
  };

  // ---------- trees, shrubs, rocks, fences ----------
  A.treeBase = function (c, x, y, tx, ty) {
    const h = hash(tx, ty, 91);
    Q.soft(c, x + 11, y + 11, 11 + h * 2, 8, 0.38);
    c.fillStyle = '#17110c'; c.beginPath(); c.ellipse(x + 8, y + 12.5, 3.4, 2, 0, 0, 6.28); c.fill();
    const g = c.createLinearGradient(x + 5, 0, x + 11, 0); g.addColorStop(0, '#6a4e36'); g.addColorStop(0.5, '#52392a'); g.addColorStop(1, '#2e1f16'); c.fillStyle = g; rr(c, x + 5.6, y + 5, 4.8, 9, 1.6); c.fill();
    rect(c, x + 7, y + 6, 0.7, 7, 'rgba(255,230,190,.15)');
    c.fillStyle = '#4a3626'; c.beginPath(); c.moveTo(x + 5, y + 14); c.lineTo(x + 3.4, y + 15.4); c.lineTo(x + 7, y + 14.4); c.fill(); c.beginPath(); c.moveTo(x + 11, y + 14); c.lineTo(x + 12.8, y + 15.2); c.lineTo(x + 9, y + 14.4); c.fill();
  };
  A.canopy = function (c, x, y, tx, ty) {
    const h = hash(tx, ty, 91), kind = hash(tx, ty, 92), b = A.biome(tx, ty);
    const conifer = b === 2 && kind > 0.5, dead = kind < 0.05, autumn = kind >= 0.05 && kind < 0.14;
    const pal = autumn ? ['#7a4a1c', '#a8661e', '#c98a2a'] : conifer ? ['#1c3322', '#27442c', '#335a37'] : kind < 0.3 ? ['#2a4226', '#37542f', '#46683a'] : ['#2f4c2b', '#3c6034', '#4d763f'];
    const cx = x + 8 + ((h * 4) | 0) - 2, cy = y + 4 + ((hash(tx, ty, 93) * 3) | 0), r = 9 + ((h * 3) | 0);
    if (dead) { c.strokeStyle = '#3a2c20'; c.lineWidth = 1.2; c.lineCap = 'round'; for (let k = 0; k < 7; k++) { const a = k * 0.9 + h * 3, l = 6 + hash(tx, ty, 94 + k) * 5; c.beginPath(); c.moveTo(cx, cy + 3); c.lineTo(cx + Math.cos(a) * l, cy + 3 + Math.sin(a) * l); c.stroke(); } return; }
    if (conifer) {
      for (let k = 0; k < 4; k++) { const rk = r - k * 2.4; c.fillStyle = k % 2 ? pal[1] : pal[0]; c.beginPath(); const sp = 9; for (let j = 0; j <= sp * 2; j++) { const a = j / (sp * 2) * 6.2832, rad = j % 2 ? rk * 0.62 : rk; const px = cx + Math.cos(a) * rad, py = cy + Math.sin(a) * rad; if (j) c.lineTo(px, py); else c.moveTo(px, py); } c.fill(); }
      c.fillStyle = pal[2]; c.beginPath(); c.arc(cx - 1.6, cy - 1.6, 2.2, 0, 6.28); c.fill(); return;
    }
    // shadowed underside, then clustered leaf masses with sun-lit tops
    Q.circle(c, cx + 1.2, cy + 1.6, r, 'rgba(0,0,0,.22)');
    const lobes = 6; for (let k = 0; k < lobes; k++) { const a = k / lobes * 6.2832 + h * 6, lr = r * (0.52 + hash(tx, ty, 95 + k) * 0.18), px = cx + Math.cos(a) * r * 0.5, py = cy + Math.sin(a) * r * 0.48; Q.circle(c, px, py, lr, pal[0]); }
    Q.circle(c, cx, cy, r * 0.72, pal[0]);
    for (let k = 0; k < lobes; k++) { const a = k / lobes * 6.2832 + h * 6, px = cx + Math.cos(a) * r * 0.42 - 1, py = cy + Math.sin(a) * r * 0.4 - 1.2; Q.circle(c, px, py, r * 0.42, pal[1]); }
    Q.circle(c, cx - 2, cy - 2.4, r * 0.42, pal[2]);
    c.fillStyle = 'rgba(255,255,220,.13)'; c.beginPath(); c.arc(cx - 3, cy - 3.2, r * 0.22, 0, 6.28); c.fill();
    for (let k = 0; k < 8; k++) { c.fillStyle = k % 2 ? 'rgba(0,0,0,.2)' : 'rgba(210,235,170,.18)'; c.fillRect(cx - r + 2 + hash(tx, ty, 100 + k) * r * 1.6, cy - r * 0.6 + hash(tx, ty, 110 + k) * r * 1.4, 1.6, 1); }
  };
  A.bush = function (c, x, y, tx, ty) {
    const h = hash(tx, ty, 5); Q.soft(c, x + 9, y + 13, 7, 3.4, 0.35);
    const cols = ['#27402a', '#36563a', '#476f48'];
    Q.circle(c, x + 8, y + 9.4, 6.2, cols[0]); Q.circle(c, x + 5.4, y + 8, 4.4, cols[1]); Q.circle(c, x + 10.6, y + 8.6, 4.2, cols[1]); Q.circle(c, x + 7, y + 6.4, 3.8, cols[2]); Q.circle(c, x + 6.4, y + 5.8, 1.6, 'rgba(255,255,220,.15)');
    if (h > 0.6) for (let k = 0; k < 4; k++) rect(c, x + 4 + hash(tx, ty, 6 + k) * 8, y + 5 + hash(tx, ty, 9 + k) * 6, 1.5, 1.5, h > 0.8 ? '#e8e0d0' : '#b83a4a');
  };
  A.rock = function (c, x, y, tx, ty) {
    const h = hash(tx, ty, 5); Q.soft(c, x + 9, y + 13, 8, 3, 0.4);
    c.fillStyle = '#17181a'; c.beginPath(); c.moveTo(x + 1.2, y + 12); c.lineTo(x + 3, y + 5); c.lineTo(x + 8, y + 2.6); c.lineTo(x + 13, y + 5); c.lineTo(x + 15, y + 12); c.lineTo(x + 8, y + 14.4); c.fill();
    const g = c.createLinearGradient(x + 2, y + 3, x + 14, y + 13); g.addColorStop(0, '#9a9a94'); g.addColorStop(0.5, '#6e6e6c'); g.addColorStop(1, '#46464a'); c.fillStyle = g;
    c.beginPath(); c.moveTo(x + 2, y + 11.4); c.lineTo(x + 3.6, y + 5.6); c.lineTo(x + 8, y + 3.6); c.lineTo(x + 12.4, y + 5.6); c.lineTo(x + 14, y + 11.4); c.lineTo(x + 8, y + 13.4); c.fill();
    c.fillStyle = 'rgba(255,255,255,.22)'; c.beginPath(); c.moveTo(x + 4, y + 6); c.lineTo(x + 8, y + 4.2); c.lineTo(x + 8.4, y + 6.6); c.lineTo(x + 5, y + 8); c.fill();
    c.strokeStyle = 'rgba(0,0,0,.3)'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(x + 8.4, y + 6.6); c.lineTo(x + 10.4, y + 11.6); c.stroke();
    if (h > 0.5) { c.fillStyle = 'rgba(70,100,50,.6)'; c.beginPath(); c.ellipse(x + 11, y + 7, 2, 1, 0.4, 0, 6.28); c.fill(); }
  };
  A.fence = function (c, tx, ty, x, y) {
    const f = (dx, dy) => oAt(tx + dx, ty + dy) === O.FENCE, l = f(-1, 0), r = f(1, 0), u = f(0, -1), d = f(0, 1);
    c.fillStyle = 'rgba(0,0,0,.28)'; c.fillRect(x + 1, y + 12, T, 2.6);
    const picket = (px, py, w, hgt, vert) => { c.fillStyle = '#17110c'; c.fillRect(px - 0.4, py - 0.4, w + 0.8, hgt + 0.8); const g = c.createLinearGradient(px, py, px + w, py + (vert ? 0 : hgt)); g.addColorStop(0, '#b29a74'); g.addColorStop(1, '#7f6b4c'); c.fillStyle = g; c.fillRect(px, py, w, hgt); };
    if (l || r || (!u && !d)) { const x0 = x + (l ? 0 : 5), x1 = x + T - (r ? 0 : 5); rect(c, x0, y + 6.4, x1 - x0, 1.5, '#6a583e'); rect(c, x0, y + 10.2, x1 - x0, 1.5, '#6a583e'); for (let px = x0 + 1; px < x1 - 1; px += 3) picket(px, y + 3.6, 2, 9, true); rect(c, x0, y + 6.4, x1 - x0, 0.5, 'rgba(255,255,255,.18)'); }
    if (u || d) { const y0 = y + (u ? 0 : 5), y1 = y + T - (d ? 0 : 5); rect(c, x + 6.2, y0, 3.6, y1 - y0, '#6a583e'); rect(c, x + 6.2, y0, 0.7, y1 - y0, 'rgba(255,255,255,.2)'); }
    c.fillStyle = '#17110c'; c.fillRect(x + 5.4, y + 2.6, 5.2, 11.4); const g = c.createLinearGradient(x + 6, 0, x + 10, 0); g.addColorStop(0, '#b29a74'); g.addColorStop(1, '#6f5c40'); c.fillStyle = g; c.fillRect(x + 6, y + 3, 4, 10.6); rect(c, x + 5.4, y + 2.2, 5.2, 1.4, '#cdb68c');
  };

  // ---------- vehicles ----------
  const CARCOL = ['#8a3a34', '#3a5a7a', '#6a6a6a', '#2e3a30', '#a89a60', '#d0d0cc', '#4a4a50', '#6a4a30'];
  A.car = function (c, car, ox, oy) {
    const x = car.x * T - ox, y = car.y * T - oy, col = CARCOL[car.col % CARCOL.length], hz = car.dir === 'h', L = car.len * T;
    const bw = L - 2, bh = T - 3;
    Q.soft(c, hz ? x + L / 2 + 1 : x + 9, hz ? y + 10.5 : y + L / 2 + 3, hz ? L / 2 + 3 : 8, hz ? 6 : L / 2 + 1, 0.42);
    c.save();
    if (hz) c.translate(x + 1, y + 1.5); else { c.translate(x + T - 1.5, y + 1); c.rotate(Math.PI / 2); }
    // local frame: car faces -x, length bw, width bh
    const wheel = (wx, wy) => { c.fillStyle = '#0c0c0e'; rr(c, wx, wy, 4.6, 1.8, 0.8); c.fill(); };
    wheel(2.4, -0.9); wheel(bw - 7, -0.9); wheel(2.4, bh - 0.9); wheel(bw - 7, bh - 0.9);
    c.fillStyle = '#0c0c0e'; rr(c, -0.4, -0.4, bw + 0.8, bh + 0.8, 3); c.fill();
    const g = c.createLinearGradient(0, 0, 0, bh); g.addColorStop(0, shade(col, 1.2)); g.addColorStop(0.5, col); g.addColorStop(1, shade(col, 0.62)); c.fillStyle = g; rr(c, 0, 0, bw, bh, 2.6); c.fill();
    const glass = '#1e2c36', glassH = '#4a6a7e';
    if (car.type === 'truck') {
      c.fillStyle = shade(col, 0.82); rr(c, 1.2, 1, bw - 15, bh - 2, 1.2); c.fill(); rect(c, 1.5, 1.4, bw - 15.4, 0.8, 'rgba(255,255,255,.25)');
      for (let k = 0; k < 4; k++) rect(c, 4 + k * ((bw - 20) / 3), 1.2, 0.5, bh - 2.4, 'rgba(0,0,0,.28)');
      c.fillStyle = glass; rr(c, bw - 12.4, 1.6, 8, bh - 3.2, 1.4); c.fill(); rect(c, bw - 11.4, 2, 2, bh - 4, 'rgba(180,220,240,.28)');
      c.fillStyle = shade(col, 1.0); rr(c, bw - 15, 1.2, 3, bh - 2.4, 1); c.fill();
    } else {
      c.fillStyle = glass; rr(c, 6.6, 1.2, 5.4, bh - 2.4, 1.4); c.fill(); rr(c, bw - 9.6, 1.4, 4.2, bh - 2.8, 1.2); c.fill();
      c.fillStyle = glassH; c.beginPath(); c.moveTo(7.4, bh - 1.6); c.lineTo(8.8, 1.6); c.lineTo(9.8, 1.6); c.lineTo(8.4, bh - 1.6); c.fill();
      const rg = c.createLinearGradient(0, 0, 0, bh); rg.addColorStop(0, shade(col, 1.08)); rg.addColorStop(1, shade(col, 0.74)); c.fillStyle = rg; rr(c, 12.2, 1.2, bw - 22.4, bh - 2.4, 1.6); c.fill();
      rect(c, 13, 1.6, bw - 24, 0.7, 'rgba(255,255,255,.28)'); rect(c, 12.2, bh / 2, bw - 22, 0.5, 'rgba(0,0,0,.25)');
    }
    rect(c, 0.5, 1.4, 1.2, 2, '#f1e3a0'); rect(c, 0.5, bh - 3.4, 1.2, 2, '#f1e3a0'); rect(c, bw - 1.6, 1.4, 1.2, 2, '#b02828'); rect(c, bw - 1.6, bh - 3.4, 1.2, 2, '#b02828');
    rect(c, 3.2, -0.6, 1.4, 1, shade(col, 0.6)); rect(c, 3.2, bh - 0.4, 1.4, 1, shade(col, 0.6));
    if (hash(car.x, car.y, 3) > 0.55) { c.fillStyle = 'rgba(100,60,20,.35)'; c.beginPath(); c.ellipse(bw * 0.6, bh * 0.4, 3, 1.6, 0.3, 0, 6.28); c.fill(); }
    c.restore();
  };

  // ---------- contact shadows for furniture and props ----------
  const NO_SHADOW = new Set([O.WALL, O.DOOR, O.WINDOW, O.TREE, O.FENCE, O.BWALL, O.BGATE, O.BUSH, O.ROCK, O.CAR, O.TRIPWIRE, O.CROP]);
  A.contact = function (c, t, x, y) {
    if (NO_SHADOW.has(t)) return; const od = DC.OD[t]; if (!od || !od.s) return;
    const g = c.createLinearGradient(x, y + 10, x + 3, y + 17); g.addColorStop(0, 'rgba(0,0,0,.34)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(x + 0.5, y + 10, 16, 6.4);
  };

  // draw furniture-class objects via an offscreen pass: adds an outline and light/shade gradient so every prop reads clearly
  let tmp = null, tmp2 = null, tc = null, tc2 = null, tscale = 0;
  A.polish = function (c, bake, x, y, fn) {
    const s = bake, sz = Math.ceil((T + 4) * s);
    if (!tmp || tscale !== s) { tmp = document.createElement('canvas'); tmp2 = document.createElement('canvas'); tmp.width = tmp.height = tmp2.width = tmp2.height = sz; tc = tmp.getContext('2d'); tc2 = tmp2.getContext('2d'); tscale = s; }
    tc.setTransform(1, 0, 0, 1, 0, 0); tc.clearRect(0, 0, sz, sz); tc.setTransform(s, 0, 0, s, 0, 0);
    fn(tc, 2, 2);
    tc.save(); tc.globalCompositeOperation = 'source-atop';
    const g = tc.createLinearGradient(2, 2, 18, 18); g.addColorStop(0, 'rgba(255,255,255,.2)'); g.addColorStop(0.45, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,.26)'); tc.fillStyle = g; tc.fillRect(0, 0, T + 4, T + 4); tc.restore();
    tc2.setTransform(1, 0, 0, 1, 0, 0); tc2.clearRect(0, 0, sz, sz); tc2.drawImage(tmp, 0, 0); tc2.globalCompositeOperation = 'source-in'; tc2.fillStyle = 'rgba(8,8,10,.8)'; tc2.fillRect(0, 0, sz, sz); tc2.globalCompositeOperation = 'source-over';
    const px = x - 2, py = y - 2, w = sz / s;
    for (const [dx, dy] of [[-0.6, 0], [0.6, 0], [0, -0.6], [0, 0.6]]) c.drawImage(tmp2, px + dx, py + dy, w, w);
    c.drawImage(tmp, px, py, w, w);
  };
  A.NO_POLISH = new Set([O.WALL, O.DOOR, O.WINDOW, O.TREE, O.FENCE, O.BWALL, O.BGATE, O.BUSH, O.ROCK, O.CAR, O.TRIPWIRE, O.CROP, O.SPIKES]);
  A.PAL = PAL; A.CARCOL = CARCOL; A.patchNoise = patchNoise;
})();

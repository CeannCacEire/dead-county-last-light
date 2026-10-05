/* Dead County: Last Light - world data, procedural generation, collision, line of sight. */
(function () {
  'use strict';
  const DC = window.DC, G = DC.G, O = DC.O, OD = DC.OD;
  const W = (DC.W = {});
  const N = (W.N = 224), CH = (W.CH = 16), NC = (W.NC = N / CH);
  const ROADS = (W.ROADS = [56, 84, 112, 140, 168]);
  let g, o, bl, st, R, res;

  W.idx = (x, y) => y * N + x;
  W.inb = (x, y) => x >= 0 && y >= 0 && x < N && y < N;

  W.init = function (seed) {
    W.seed = seed >>> 0;
    R = DC.mulberry(W.seed);
    W.g = g = new Uint8Array(N * N); W.o = o = new Uint8Array(N * N); W.bl = bl = new Uint16Array(N * N);
    W.st = st = new Map(); W.alias = new Map(); W.buildings = []; W.cars = []; W.force = new Map();
    W.diff = new Map(); W.ver = new Uint16Array(NC * NC); W.houses = []; W.lamps = []; W.genDone = false;
    W.pois = []; W.pads = null; W.mast = null; W.gate = null; W.spawnAreas = [];
    res = new Uint8Array(N * N);
    generate();
    W.genDone = true;
  };

  // ---------- helpers ----------
  const rnd = (a, b) => a + Math.floor(R() * (b - a + 1));
  const fl = (v) => Math.floor(v);
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = fl(R() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function reserve(x, y, w, h, m) { m = m || 0; for (let yy = y - m; yy < y + h + m; yy++) for (let xx = x - m; xx < x + w + m; xx++) if (W.inb(xx, yy)) res[yy * N + xx] = 1; }
  function fillG(x, y, w, h, gt) { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (W.inb(xx, yy)) g[yy * N + xx] = gt; }
  function isFloor(t) { return t === G.WOOD || t === G.TILE || t === G.CARPET || t === G.CONCRETE; }

  function mkB(type, x, y, w, h, extra) {
    const b = Object.assign({ id: W.buildings.length, type, x, y, w, h, name: '', kind: '', alarm: false, powered: true, disc: false, door: null, roof: '#5a4a40', fl: G.WOOD, safe: false, alarmOn: 0, roofA: 1, label: '' }, extra || {});
    W.buildings.push(b); reserve(x, y, w, h, 1); return b;
  }
  function shell(b) {
    for (let yy = b.y; yy < b.y + b.h; yy++) for (let xx = b.x; xx < b.x + b.w; xx++) {
      const i = yy * N + xx; bl[i] = b.id + 1; o[i] = 0;
      if (xx === b.x || yy === b.y || xx === b.x + b.w - 1 || yy === b.y + b.h - 1) { o[i] = O.WALL; g[i] = G.CONCRETE; } else g[i] = b.fl;
    }
  }
  function setDoor(x, y, locked, bid, type, hp) {
    const i = y * N + x; o[i] = type || O.DOOR; g[i] = G.WOOD;
    st.set(i, { open: false, locked: !!locked, broken: false, hp: hp || 70, bar: 0, bhp: 0, bid });
  }
  function putDoor(b, side, off, locked) {
    let x, y, ix, iy;
    if (side === 'n') { x = b.x + fl(b.w / 2) + off; y = b.y; ix = x; iy = y + 1; }
    else if (side === 's') { x = b.x + fl(b.w / 2) + off; y = b.y + b.h - 1; ix = x; iy = y - 1; }
    else if (side === 'w') { x = b.x; y = b.y + fl(b.h / 2) + off; ix = x + 1; iy = y; }
    else { x = b.x + b.w - 1; y = b.y + fl(b.h / 2) + off; ix = x - 1; iy = y; }
    setDoor(x, y, locked, b.id);
    if (!b.door) b.door = { x, y, side, ix, iy }; else (b.doors2 = b.doors2 || []).push({ x, y, side, ix, iy });
    return { x, y };
  }
  function setWindow(x, y, locked, bid) {
    const i = y * N + x; o[i] = O.WINDOW; st.set(i, { open: false, locked: !!locked, broken: false, bar: 0, bhp: 0, bid });
  }
  function windows(b, sides, step, lockP) {
    const allD = [b.door].concat(b.doors2 || []).filter(Boolean);
    for (const s of sides) {
      if (s === 'n' || s === 's') {
        const y = s === 'n' ? b.y : b.y + b.h - 1;
        for (let x = b.x + 2; x < b.x + b.w - 2; x += step) {
          if (allD.some((d) => d.y === y && Math.abs(d.x - x) <= 1)) continue;
          if (o[y * N + x] === O.WALL) setWindow(x, y, R() < lockP, b.id);
        }
      } else {
        const x = s === 'w' ? b.x : b.x + b.w - 1;
        for (let y = b.y + 2; y < b.y + b.h - 2; y += step) {
          if (allD.some((d) => d.x === x && Math.abs(d.y - y) <= 1)) continue;
          if (o[y * N + x] === O.WALL) setWindow(x, y, R() < lockP, b.id);
        }
      }
    }
  }
  function nearDoor(x, y) {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const t = o[(y + dy) * N + x + dx]; if (t === O.DOOR || t === O.CHECKGATE) return true; }
    return false;
  }
  function wallAdj(x, y) {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const t = o[(y + dy) * N + x + dx]; if (t === O.WALL || t === O.WINDOW) return true; }
    return false;
  }
  function spots(b, x0, y0, x1, y1, wall) {
    const out = [];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * N + x;
      if (bl[i] !== b.id + 1 || o[i] || !isFloor(g[i]) || nearDoor(x, y)) continue;
      if (wall && !wallAdj(x, y)) continue;
      out.push([x, y]);
    }
    return shuffle(out);
  }
  function put(x, y, t) { const i = y * N + x; if (!o[i]) { o[i] = t; return true; } return false; }
  function furnish(b, list, x0, y0, x1, y1, wall) {
    const s = spots(b, x0, y0, x1, y1, wall !== false);
    let k = 0;
    for (const t of list) { if (k >= s.length) break; put(s[k][0], s[k][1], t); k++; }
  }
  function forceAt(x, y, items) { W.force.set(y * N + x, items); }
  function findObj(b, t) { for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) if (o[y * N + x] === t) return [x, y]; return null; }
  function wallLine(b, x0, y0, x1, y1) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = y * N + x; o[i] = O.WALL; g[i] = G.CONCRETE; bl[i] = b.id + 1; }
  }
  function innerDoor(b, x, y, locked) { setDoor(x, y, locked, b.id); }

  function connectCheck(b) {
    if (!b.door) return;
    const seen = new Uint8Array(N * N), q = [b.door.ix, b.door.iy];
    seen[b.door.iy * N + b.door.ix] = 1;
    while (q.length) {
      const y = q.pop(), x = q.pop();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, i = ny * N + nx;
        if (seen[i] || bl[i] !== b.id + 1) continue;
        const t = o[i];
        if (t && t !== O.DOOR && !(OD[t] && !OD[t].s)) continue;
        seen[i] = 1; q.push(nx, ny);
      }
    }
    for (let y = b.y + 1; y < b.y + b.h - 1; y++) for (let x = b.x + 1; x < b.x + b.w - 1; x++) {
      const i = y * N + x, t = o[i];
      if (t && OD[t] && t !== O.WALL && t !== O.DOOR && t !== O.WINDOW && OD[t].s) {
        let ok = false;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (seen[(y + dy) * N + x + dx]) ok = true;
        if (!ok) { o[i] = 0; W.force.delete(i); }
      }
    }
  }

  // ---------- building generators ----------
  function house(x, y, w, h, side, opt) {
    opt = opt || {};
    const b = mkB('house', x, y, w, h, { name: opt.name || 'House', fl: G.WOOD, roof: DC.pick(['#5a4640', '#4a4f56', '#5e5446', '#3f4a40', '#56423c'], R) });
    shell(b);
    putDoor(b, side, rnd(-1, 1), opt.lock !== undefined ? opt.lock : R() < 0.55);
    if (R() < 0.55) {
      const bs = side === 'n' ? 's' : side === 's' ? 'n' : side === 'e' ? 'w' : 'e';
      putDoor(b, bs, rnd(-1, 1), R() < 0.65);
    }
    const vert = w >= 8;
    let px = b.x + fl(w / 2);
    if (vert) {
      wallLine(b, px, b.y + 1, px, b.y + h - 2);
      const gy = rnd(b.y + 2, b.y + h - 3); innerDoor(b, px, gy, false);
      // carpet right room
      for (let yy = b.y + 1; yy < b.y + h - 1; yy++) for (let xx = px + 1; xx < b.x + w - 1; xx++) g[yy * N + xx] = G.CARPET;
    }
    windows(b, ['n', 's', 'e', 'w'], 3, 0.5);
    if (vert) {
      furnish(b, [O.FRIDGE, O.STOVE, O.COUNTER, O.CABINET, O.SINK, O.COUNTER, O.SHELF, O.COUCH], b.x + 1, b.y + 1, px - 1, b.y + h - 2);
      furnish(b, [O.BED, O.WARDROBE, O.DESK, O.TOILET, O.MEDCAB, O.SHELF, O.CHAIR], px + 1, b.y + 1, b.x + w - 2, b.y + h - 2);
      const cx = fl((b.x + 1 + px - 1) / 2), cy = fl(b.y + h / 2);
      if (!o[cy * N + cx] && !nearDoor(cx, cy)) put(cx, cy, O.TABLE);
    } else furnish(b, [O.BED, O.COUNTER, O.FRIDGE, O.WARDROBE, O.SHELF, O.CABINET, O.TOILET, O.STOVE], b.x + 1, b.y + 1, b.x + w - 2, b.y + h - 2);
    if (R() < 0.12) b.alarm = true;
    connectCheck(b);
    return b;
  }
  function shop(x, y, w, h, side, kind) {
    const names = { grocery: 'Corner Grocer', pharmacy: 'Pharmacy', hardware: 'Hardware & Supply', clothes: 'Thrift & Outfitters', conv: 'Quick Stop' };
    const b = mkB('shop', x, y, w, h, { name: names[kind], kind, fl: G.TILE, roof: '#4e5258' });
    shell(b);
    putDoor(b, side, 0, R() < 0.35);
    windows(b, [side], 2, 0.1); windows(b, [side === 'n' ? 's' : 'n'], 4, 0.4);
    const flip = side === 'n';
    const rows = flip ? [y + h - 3, y + h - 5] : [y + 2, y + 4];
    for (const ry of rows) for (let xx = x + 2; xx <= x + w - 3; xx++) { if ((xx - x) % 6 === 3) continue; put(xx, ry, O.SHOPSHELF); }
    const cy = flip ? y + 2 : y + h - 3;
    for (let k = 0; k < 4; k++) put(x + 2 + k, cy, O.COUNTER);
    furnish(b, [O.SHELF, O.CRATE, O.DESK], x + w - 4, y + 1, x + w - 2, y + h - 2);
    if (R() < 0.2) b.alarm = true;
    connectCheck(b);
    return b;
  }
  function police(x, y) {
    const w = 19, h = 11;
    const b = mkB('police', x, y, w, h, { name: 'County Police Station', fl: G.TILE, roof: '#2c3848' });
    shell(b); putDoor(b, 's', 0, false);
    windows(b, ['s', 'n'], 3, 0.2);
    // evidence room (NW corner)
    wallLine(b, x + 6, y + 1, x + 6, y + 4); wallLine(b, x + 1, y + 5, x + 6, y + 5);
    setDoor(x + 3, y + 5, true, b.id, O.DOOR, 140); st.get((y + 5) * N + x + 3).key = 'key_police';
    put(x + 1, y + 1, O.LOCKER); forceAt(x + 1, y + 1, [['transmitter', 1]]);
    put(x + 2, y + 1, O.LOCKER); put(x + 5, y + 1, O.GUNCAB); put(x + 4, y + 1, O.SHELF); put(x + 1, y + 3, O.CRATE);
    // cells (NE)
    wallLine(b, x + 12, y + 1, x + 12, y + 4); wallLine(b, x + 12, y + 5, x + 17, y + 5);
    innerDoor(b, x + 14, y + 5, true);
    put(x + 17, y + 1, O.LOCKER); put(x + 13, y + 1, O.LOCKER); put(x + 17, y + 4, O.CRATE);
    // offices
    const dk = [[x + 8, y + 2], [x + 10, y + 2], [x + 8, y + 4], [x + 10, y + 4]];
    dk.forEach((p) => put(p[0], p[1], O.DESK));
    const kf = shuffle(dk.slice());
    forceAt(kf[0][0], kf[0][1], [['key_police', 1]]);
    forceAt(kf[1][0], kf[1][1], [['keycard', 1]]);
    for (let k = 0; k < 5; k++) put(x + 5 + k, y + 7, O.COUNTER);
    furnish(b, [O.LOCKER, O.LOCKER, O.CABINET, O.SHELF, O.CHAIR], x + 13, y + 6, x + 17, y + 9);
    b.alarm = R() < 0.5; connectCheck(b);
    return b;
  }
  function fireStation(x, y) {
    const w = 20, h = 12;
    const b = mkB('fire', x, y, w, h, { name: 'Fire Station No. 4', fl: G.CONCRETE, roof: '#7a2e28' });
    shell(b);
    putDoor(b, 'n', -4, true); putDoor(b, 'n', -3, true); putDoor(b, 'n', -2, true); // bay doors
    const side = b.doors2.pop(); b.doors2.length = 0;
    putDoor(b, 'e', 0, false);
    windows(b, ['s'], 3, 0.3);
    wallLine(b, x + 13, y + 1, x + 13, y + 10); innerDoor(b, x + 13, y + 6, false);
    for (let yy = y + 1; yy < y + h - 1; yy++) for (let xx = x + 14; xx < x + w - 1; xx++) g[yy * N + xx] = G.WOOD;
    furnish(b, [O.LOCKER, O.LOCKER, O.LOCKER, O.CRATE, O.SHELF, O.LOCKER], x + 1, y + 6, x + 12, y + 10);
    furnish(b, [O.BED, O.BED, O.BED, O.COUNTER, O.FRIDGE, O.STOVE, O.TABLE, O.CABINET, O.SHELF], x + 14, y + 1, x + w - 2, y + h - 2);
    b.alarm = false; connectCheck(b);
    // yard: helipad + mast
    const ys = y + h + 1;
    fillG(x - 1, y + h, 25, 12, G.GRASS);
    const px = x + 7, py = ys + 5;
    for (let yy = -4; yy <= 4; yy++) for (let xx = -4; xx <= 4; xx++) if (xx * xx + yy * yy <= 17) g[(py + yy) * N + px + xx] = G.PAD;
    W.pads = { x: px, y: py };
    const mx = x + 18, my = ys + 3;
    o[my * N + mx] = O.BEACON; W.mast = { x: mx, y: my };
    st.set(my * N + mx, { parts: 0, active: false, t: 0, done: false });
    reserve(x - 1, y + h, 26, 13, 1);
    // yard fence
    for (let xx = x - 1; xx <= x + 24; xx++) { if (xx < 0) continue; fenceTile(xx, y + h + 10); }
    for (let yy = y + h; yy <= y + h + 10; yy++) { fenceTile(x - 1, yy); if (yy !== y + h + 5 && yy !== y + h + 6) fenceTile(x + 24, yy); }
    return b;
  }
  function fenceTile(x, y) { if (!W.inb(x, y)) return; const i = y * N + x; if (!o[i] && g[i] !== G.ROAD && g[i] !== G.SIDEWALK) o[i] = O.FENCE; }
  function hospital(x, y) {
    const w = 21, h = 14;
    const b = mkB('hospital', x, y, w, h, { name: 'St. Brigid Hospital', fl: G.TILE, roof: '#6a7078' });
    shell(b); putDoor(b, 'n', 0, false); putDoor(b, 's', 0, true);
    windows(b, ['n', 's'], 3, 0.25);
    wallLine(b, x + 1, y + 5, x + 5, y + 5); wallLine(b, x + 15, y + 5, x + 19, y + 5);
    wallLine(b, x + 6, y + 1, x + 6, y + 5); wallLine(b, x + 14, y + 1, x + 14, y + 5);
    innerDoor(b, x + 3, y + 5, true); innerDoor(b, x + 17, y + 5, false);
    wallLine(b, x + 1, y + 8, x + 19, y + 8);
    for (const dx of [3, 8, 13, 17]) innerDoor(b, x + dx, y + 8, dx === 8);
    for (const vx of [5, 10, 15]) wallLine(b, x + vx, y + 9, x + vx, y + 11);
    // storage room west north
    put(x + 1, y + 1, O.CRATE); forceAt(x + 1, y + 1, [['battpack', 1]]);
    put(x + 2, y + 1, O.MEDCAB); put(x + 4, y + 1, O.MEDCAB); put(x + 5, y + 3, O.CRATE); put(x + 1, y + 4, O.SHELF);
    put(x + 16, y + 1, O.HBED); put(x + 18, y + 1, O.HBED); put(x + 19, y + 4, O.MEDCAB);
    for (let k = 0; k < 4; k++) put(x + 8 + k, y + 3, O.COUNTER);
    for (let k = 0; k < 4; k++) { const rx = [1, 6, 11, 16][k]; put(b.x + rx + 1, y + 10, O.HBED); put(b.x + rx + 3, y + 10, O.HBED); put(b.x + rx + 3, y + 11, O.MEDCAB); }
    furnish(b, [O.CHAIR, O.CHAIR, O.CHAIR, O.CHAIR, O.MEDCAB], x + 1, y + 6, x + 19, y + 7);
    b.alarm = R() < 0.4; connectCheck(b);
    return b;
  }
  function gasStation(x, y) {
    const b = mkB('gas', x + 2, y + 1, 11, 7, { name: 'Roadside Gas & Go', kind: 'conv', fl: G.TILE, roof: '#8a6a30' });
    shell(b); putDoor(b, 's', 0, false);
    windows(b, ['s'], 2, 0.1); windows(b, ['n', 'e', 'w'], 3, 0.4);
    wallLine(b, b.x + 7, b.y + 1, b.x + 7, b.y + 5); innerDoor(b, b.x + 7, b.y + 3, true);
    for (let k = 0; k < 3; k++) put(b.x + 2 + k, b.y + 5, O.COUNTER);
    put(b.x + 2, b.y + 2, O.SHOPSHELF); put(b.x + 4, b.y + 2, O.SHOPSHELF); put(b.x + 5, b.y + 3, O.SHOPSHELF);
    put(b.x + 9, b.y + 1, O.CRATE); forceAt(b.x + 9, b.y + 1, [['jerry_full', 1]]);
    put(b.x + 9, b.y + 4, O.SHELF);
    fillG(x, y + 8, 23, 14, G.CONCRETE); reserve(x, y + 8, 23, 14, 0);
    for (let k = 0; k < 4; k++) { const px = x + 4 + k * 4; o[(y + 13) * N + px] = O.PUMP; o[(y + 13) * N + px + 1] = O.PUMP; st.set((y + 13) * N + px, { fuel: 1 }); W.lamps.push([px, y + 11]); }
    b.alarm = R() < 0.3; connectCheck(b);
    return b;
  }
  function warehouse(x, y, w, h, side, name) {
    const b = mkB('warehouse', x, y, w, h, { name: name || 'Freight Warehouse', fl: G.CONCRETE, roof: '#6a6a64' });
    shell(b);
    putDoor(b, side, -1, true); putDoor(b, side, 0, true);
    windows(b, [side === 'n' ? 's' : 'n'], 4, 0.6);
    const flip = side === 'n';
    for (let ry = y + 3; ry < y + h - 3; ry += 3) for (let xx = x + 2; xx < x + w - 2; xx++) { if ((xx - x) % 5 === 2 || (xx - x) % 5 === 3) continue; put(xx, ry, (xx + ry) % 3 ? O.CRATE : O.SHOPSHELF); }
    furnish(b, [O.LOCKER, O.CRATE, O.DESK, O.CRATE, O.BARREL], x + 1, y + 1, x + w - 2, y + h - 2);
    if (R() < 0.35) b.alarm = true;
    connectCheck(b); return b;
  }
  function cabin(x, y, name) {
    const b = mkB('cabin', x, y, 7, 6, { name: name || "Hunter's Cabin", fl: G.WOOD, roof: '#4a3e30', safe: false });
    reserve(x, y, 7, 6, 4); fillG(x - 3, y - 3, 13, 12, G.GRASS);
    for (let yy = y - 3; yy < y + 9; yy++) for (let xx = x - 3; xx < x + 10; xx++) { if (W.inb(xx, yy)) o[yy * N + xx] = 0; }
    shell(b); putDoor(b, 's', 0, false);
    windows(b, ['n', 'e', 'w'], 2, 0.3);
    furnish(b, [O.BED, O.STOVE, O.CABINET, O.CRATE, O.SHELF], x + 1, y + 1, x + 5, y + 4);
    b.alarm = false; connectCheck(b);
    return b;
  }

  function putCar(x, y, dir, len, col, type) {
    const tiles = [];
    for (let k = 0; k < len; k++) {
      const tx = dir === 'h' ? x + k : x, ty = dir === 'v' ? y + k : y;
      if (!W.inb(tx, ty)) return false;
      const i = ty * N + tx;
      if (o[i] || bl[i]) return false;
      const gt = g[i]; if (gt === G.DEEP || gt === G.SHALLOW) return false;
      if ((tx >> 4) !== (x >> 4) || (ty >> 4) !== (y >> 4)) return false;
      tiles.push(i);
    }
    tiles.forEach((i, k) => { o[i] = O.CAR; if (k) W.alias.set(i, tiles[0]); });
    W.cars.push({ x, y, dir, len, col, type: type || 'car', i: tiles[0], alarm: R() < 0.18, alarmOn: 0 });
    return true;
  }

  // ---------- master generation ----------
  function generate() {
    // base ground
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = y * N + x;
      g[i] = DC.vnoise(x / 9, y / 9, W.seed + 1) > 0.74 ? G.DIRT : G.GRASS;
    }
    // river
    const riverX = (y) => 36 + Math.round(7 * Math.sin(y / 22) + 4 * Math.sin(y / 9 + 1));
    W.riverX = riverX;
    for (let y = 0; y < N; y++) {
      const cx = riverX(y), ford = DC.vnoise(y / 7, 0, W.seed + 5) > 0.8 || y % 63 === 31;
      for (let dx = -3; dx <= 3; dx++) {
        const x = cx + dx; if (x < 0 || x >= N) continue;
        const i = y * N + x; g[i] = Math.abs(dx) <= 1 && !ford ? G.DEEP : G.SHALLOW;
        if (y >= 110 && y <= 114) g[i] = G.BRIDGE;
        res[i] = 1;
      }
    }
    // pond lake SE
    ellipse(170, 188, 9, 6, G.SHALLOW); ellipse(170, 188, 6, 3, G.DEEP);
    ellipse(70, 30, 7, 5, G.SHALLOW); ellipse(70, 30, 4, 2, G.DEEP);
    // roads
    const R0 = ROADS[0], R4 = ROADS[4];
    // county roads (full length)
    for (const c of [111, 112, 113]) for (let t = 0; t < N; t++) { setRoad(c, t); setRoad(t, c); }
    // town grid
    for (const rr of ROADS) {
      for (let t = R0 - 2; t <= R4 + 2; t++) {
        for (let k = -1; k <= 1; k++) { setRoad(rr + k, t); setRoad(t, rr + k); }
      }
    }
    // sidewalks
    for (const rr of ROADS) for (let t = R0 - 2; t <= R4 + 2; t++) for (const k of [-2, 2]) { sidewalk(rr + k, t); sidewalk(t, rr + k); }
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (g[y * N + x] === G.ROAD || g[y * N + x] === G.SIDEWALK || g[y * N + x] === G.BRIDGE) res[y * N + x] = 1;
    }
    // reserve road margins
    for (let t = 0; t < N; t++) for (let k = -3; k <= 3; k++) { resTile(111 + k, t); resTile(t, 111 + k); }

    // town blocks
    const layout = [
      ['H', 'H', 'P', 'H'],
      ['H', 'S1', 'POL', 'H'],
      ['WH', 'HOS', 'S2', 'FIRE'],
      ['H', 'GAS', 'H', 'WH2'],
    ];
    let safeDone = false;
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
      const x0 = ROADS[i] + 3, y0 = ROADS[j] + 3, t = layout[j][i];
      reserve(x0, y0, 23, 23, 0);
      if (t === 'H') {
        for (let k = 0; k < 4; k++) {
          const cx = x0 + (k % 2) * 12, cy = y0 + (k >> 1) * 12;
          const w = rnd(8, 10), h = rnd(7, 8);
          const north = k < 2;
          const hx = cx + 1 + rnd(0, 10 - w - 1 > 0 ? 10 - w - 1 : 0), hy = north ? cy + 1 : cy + 10 - h;
          const b = house(hx, hy, w, h, north ? 'n' : 's', {});
          // fence ring
          for (let xx = cx; xx <= cx + 10; xx++) for (const yy of [cy, cy + 10]) {
            const frontRow = north ? cy : cy + 10;
            if (yy === frontRow && Math.abs(xx - b.door.x) <= 1) continue;
            if (R() < 0.12) continue;
            fenceTile(xx, yy);
          }
          for (let yy = cy; yy <= cy + 10; yy++) for (const xx of [cx, cx + 10]) { if (R() < 0.15) continue; fenceTile(xx, yy); }
          if (R() < 0.7) tree(cx + rnd(1, 9), north ? cy + h + 2 : cy + 1);
          if (R() < 0.35) putCar(cx + rnd(1, 7), north ? cy + h + 3 : cy + 2, 'h', 2, rnd(0, 7), 'car');
          // mailbox
          const mx = b.door.x + 2, my = north ? cy - 1 : cy + 11;
          if (W.inb(mx, my) && g[my * N + mx] === G.SIDEWALK && !o[my * N + mx]) o[my * N + mx] = O.MAILBOX;
          // tag
          b.num = W.houses.length; W.houses.push(b);
          if (i === 0 && j === 1 && k === 2) makeSafehouse(b);
        }
      } else if (t === 'P') park(x0, y0);
      else if (t === 'S1') { shopLot(x0, y0, 'grocery', 'hardware'); }
      else if (t === 'S2') { shopLot(x0, y0, 'pharmacy', 'clothes'); }
      else if (t === 'POL') {
        const b = police(x0 + 2, y0 + 3);
        fillG(x0, y0 + 14, 23, 9, G.CONCRETE); parkingRow(x0 + 1, y0 + 16, 21); parkingRow(x0 + 1, y0 + 19, 21);
        fillG(x0, y0 + 12, 23, 2, G.CONCRETE);
      } else if (t === 'FIRE') fireStation(x0 + 1, y0 + 0);
      else if (t === 'HOS') {
        hospital(x0 + 1, y0 + 0); fillG(x0, y0 + 14, 23, 9, G.CONCRETE); parkingRow(x0 + 1, y0 + 17, 21); parkingRow(x0 + 1, y0 + 20, 21);
      } else if (t === 'GAS') gasStation(x0, y0);
      else if (t === 'WH') { warehouse(x0 + 1, y0 + 4, 21, 15, i === 0 ? 'e' : 'n', 'Granger Freight'); fillG(x0, y0, 23, 4, G.CONCRETE); }
      else if (t === 'WH2') { warehouse(x0 + 1, y0 + 4, 21, 15, 'n', 'Bulk Supply Depot'); fillG(x0, y0, 23, 4, G.CONCRETE); parkingRow(x0 + 1, y0 + 1, 21); }
    }
    // lamps
    for (let a = 0; a < 5; a++) for (let b2 = 0; b2 < 5; b2++) lamp(ROADS[a] + 2, ROADS[b2] + 2);
    for (let a = 0; a < 4; a++) for (const rr of [ROADS[0], ROADS[1], ROADS[2], ROADS[3], ROADS[4]]) { lamp(ROADS[a] + 14, rr + 2); lamp(rr + 2, ROADS[a] + 14); }

    farm();
    cabin(60, 178, "Hunter's Cabin"); cabin(176, 190, 'Lake Cabin'); cabin(146, 24, 'Ridge Cabin');
    W.cabins = W.buildings.filter((b) => b.type === 'cabin');
    // checkpoint (north) and sealed roads
    checkpoint();
    // vehicles along roads
    for (const lane of [111, 113]) {
      for (let t = 2; t < N - 2; t += 4) {
        const nearInt = ROADS.some((r) => Math.abs(t - r) <= 3) && t > 50 && t < 174;
        if (nearInt) continue;
        if (R() < (t > 50 && t < 174 ? 0.2 : 0.1)) putCar(t, lane, 'h', 2, rnd(0, 7), 'car');
        if (R() < (t > 50 && t < 174 ? 0.2 : 0.1)) putCar(lane, t, 'v', 2, rnd(0, 7), 'car');
      }
    }
    for (const rr of ROADS) for (let t = 58; t < 168; t += 4) {
      if (ROADS.some((r) => Math.abs(t - r) <= 3)) continue;
      if (R() < 0.12) putCar(t, rr - 1, 'h', 2, rnd(0, 7), 'car');
      if (R() < 0.12) putCar(rr + 1, t, 'v', 2, rnd(0, 7), 'car');
    }
    // forest, bushes, rocks
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = y * N + x;
      if (res[i] || bl[i] || o[i]) continue;
      const gt = g[i]; if (gt !== G.GRASS && gt !== G.DIRT && gt !== G.LEAVES) continue;
      const inTown = x > 50 && x < 174 && y > 50 && y < 174;
      if (inTown) continue;
      const f = DC.vnoise(x / 18, y / 18, W.seed + 2) * 0.7 + DC.vnoise(x / 6, y / 6, W.seed + 3) * 0.3;
      const hv = DC.hash(x, y, W.seed + 9);
      if (f > 0.5) g[i] = G.LEAVES;
      const dens = f > 0.52 ? 0.28 + (f - 0.52) * 2 : 0.012;
      if (hv < dens) o[i] = O.TREE;
      else if (hv < dens + 0.02) o[i] = O.BUSH;
      else if (hv > 0.9985) o[i] = O.ROCK;
    }
    // map border trees
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (x < 2 || y < 2 || x >= N - 2 || y >= N - 2) { const i = y * N + x; if (g[i] !== G.DEEP) o[i] = O.TREE; }
    }
    // clear trees overlapping reserved cabin/road; ensure road tiles free
    for (let i = 0; i < N * N; i++) if (o[i] === O.TREE && (g[i] === G.ROAD || g[i] === G.BRIDGE || g[i] === G.SIDEWALK)) o[i] = 0;
    // sealed road ends
    for (const side of ['e', 'w', 's']) sealRoad(side);
    // quest rock: lore notes forced
    W.houses.forEach((b, k) => { if (k % 5 === 2) { const c = findObj(b, O.DESK) || findObj(b, O.SHELF); if (c) forceAt(c[0], c[1], [['note', 1]]); } });
    buildingInit();
  }
  function ellipse(cx, cy, rx, ry, gt) { for (let y = cy - ry; y <= cy + ry; y++) for (let x = cx - rx; x <= cx + rx; x++) { const dx = (x - cx) / rx, dy = (y - cy) / ry; if (dx * dx + dy * dy <= 1 && W.inb(x, y)) { g[y * N + x] = gt; res[y * N + x] = 1; } } }
  function setRoad(x, y) { if (!W.inb(x, y)) return; const i = y * N + x; if (g[i] !== G.BRIDGE) g[i] = G.ROAD; }
  function sidewalk(x, y) { if (!W.inb(x, y)) return; const i = y * N + x; if (g[i] === G.ROAD || g[i] === G.BRIDGE) return; g[i] = G.SIDEWALK; }
  function resTile(x, y) { if (W.inb(x, y)) res[y * N + x] = 1; }
  function tree(x, y) { if (!W.inb(x, y)) return; const i = y * N + x; if (!o[i] && !bl[i] && (g[i] === G.GRASS || g[i] === G.DIRT || g[i] === G.LEAVES)) o[i] = O.TREE; }
  function lamp(x, y) { if (!W.inb(x, y)) return; const i = y * N + x; if (!o[i] && g[i] === G.SIDEWALK) { o[i] = O.LAMP; W.lamps.push([x, y]); } }
  function parkingRow(x, y, len) {
    for (let k = 0; k < len; k += 4) { if (R() < 0.55) putCar(x + k, y, 'h', 2, rnd(0, 7), 'car'); }
  }
  function shopLot(x0, y0, k1, k2) {
    fillG(x0, y0, 23, 23, G.GRASS);
    shop(x0 + 1, y0 + 1, 21, 9, 's', k1);
    shop(x0 + 1, y0 + 13, 21, 9, 'n', k2);
    fillG(x0, y0 + 10, 23, 3, G.CONCRETE);
    for (let k = 0; k < 20; k += 4) { if (R() < 0.5) putCar(x0 + 1 + k, y0 + 11, 'h', 2, rnd(0, 7), 'car'); }
  }
  function park(x0, y0) {
    fillG(x0, y0, 23, 23, G.GRASS);
    ellipse(x0 + 11, y0 + 11, 7, 5, G.SHALLOW); ellipse(x0 + 11, y0 + 11, 4, 3, G.DEEP);
    for (let t = 0; t < 23; t++) { g[(y0 + 11) * N + x0 + t] = g[(y0 + 11) * N + x0 + t] === G.GRASS ? G.GRAVEL : g[(y0 + 11) * N + x0 + t]; g[(y0 + t) * N + x0 + 11] = g[(y0 + t) * N + x0 + 11] === G.GRASS ? G.GRAVEL : g[(y0 + t) * N + x0 + 11]; }
    for (let k = 0; k < 45; k++) tree(x0 + rnd(0, 22), y0 + rnd(0, 22));
    for (let k = 0; k < 6; k++) { const x = x0 + rnd(2, 20), y = y0 + rnd(2, 20); if (!o[y * N + x] && g[y * N + x] === G.GRASS) o[y * N + x] = k % 2 ? O.TABLE : O.CHAIR; }
    const b = { name: 'Elm Park', type: 'park', x: x0, y: y0, w: 23, h: 23 }; W.pois.push({ x: x0 + 11, y: y0 + 11, t: 'park', n: 'Elm Park' });
  }
  function farm() {
    const fx = 176, fy = 64, fw = 38, fh = 38;
    reserve(fx - 2, fy - 2, fw + 4, fh + 4, 0);
    fillG(fx, fy, fw, fh, G.GRASS);
    for (let y = fy; y < fy + fh; y++) for (let x = fx; x < fx + fw; x++) o[y * N + x] = 0;
    for (let x = fx; x < fx + fw; x++) { fenceTile(x, fy); if (x < 186 || x > 188) fenceTile(x, fy + fh - 1); }
    for (let y = fy; y < fy + fh; y++) { fenceTile(fx, y); fenceTile(fx + fw - 1, y); }
    const fh1 = house(179, 67, 10, 8, 's', { name: 'Farmhouse', lock: false }); fh1.type = 'house'; fh1.farm = true; W.houses.push(fh1); fh1.num = W.houses.length - 1;
    const barn = warehouse(196, 67, 13, 10, 's', 'Hollis Barn'); barn.type = 'barn'; barn.kind = 'farm'; barn.roof = '#6e3a2e';
    for (let k = 0; k < 5; k++) { const x = 198 + k * 2, y = 70; if (!o[y * N + x]) o[y * N + x] = O.HAY; }
    for (let yy = 82; yy <= 96; yy += 2) for (let xx = 179; xx <= 202; xx++) { const i = yy * N + xx; g[i] = G.FARM; o[i] = O.CROP; st.set(i, { ripe: true, t: 0, kind: (xx + yy) % 2 ? 'potato' : 'carrot' }); }
    for (let yy = 81; yy <= 97; yy += 2) for (let xx = 179; xx <= 202; xx++) g[yy * N + xx] = G.FARM;
    ellipse(208, 90, 4, 3, G.SHALLOW); ellipse(208, 90, 2, 1, G.DEEP);
    for (let y = 102; y <= 111; y++) { g[y * N + 186] = G.DIRT; g[y * N + 187] = G.DIRT; g[y * N + 188] = G.DIRT; }
    for (let k = 0; k < 10; k++) tree(fx + rnd(1, 36), fy + rnd(1, 12));
    W.pois.push({ x: 188, y: 90, t: 'farm', n: 'Hollis Farm' });
    W.farm = { x: fx, y: fy, w: fw, h: fh };
  }
  function checkpoint() {
    for (let x = 108; x <= 116; x++) for (let y = 3; y <= 8; y++) { const i = y * N + x; if (o[i] === O.TREE) o[i] = 0; }
    for (let x = 106; x <= 118; x++) for (let y = 5; y <= 7; y++) { res[y * N + x] = 1; }
    for (const x of [111, 112, 113]) { const i = 6 * N + x; o[i] = O.CHECKGATE; }
    st.set(6 * N + 112, { open: false });
    W.gate = { x: 112, y: 6 };
    for (const x of [108, 109, 110, 114, 115, 116]) { o[6 * N + x] = O.SANDBAG; o[7 * N + x] = O.SANDBAG; g[6 * N + x] = G.GRAVEL; g[7 * N + x] = G.GRAVEL; }
    for (let y = 2; y < 6; y++) for (const x of [111, 112, 113]) { g[y * N + x] = G.ROAD; if (o[y * N + x] === O.TREE) o[y * N + x] = 0; }
    putCar(109, 9, 'h', 3, 6, 'truck'); putCar(114, 9, 'h', 3, 6, 'truck');
    W.pois.push({ x: 112, y: 7, t: 'gate', n: 'Quarantine Checkpoint' });
  }
  function sealRoad(side) {
    for (const c of [111, 112, 113]) {
      let x, y;
      if (side === 'e') { x = N - 5; y = c; } else if (side === 'w') { x = 4; y = c; } else { x = c; y = N - 5; }
      for (const d of [0, 1]) {
        const xx = side === 's' ? x : x + (side === 'e' ? -d : d), yy = side === 's' ? y - d : y;
        const i = yy * N + xx; if (g[i] === G.BRIDGE) continue; o[i] = O.SANDBAG;
      }
    }
  }
  function makeSafehouse(b) {
    b.safe = true; b.name = 'Safehouse (Maple Lane)'; b.roof = '#3e5240';
    const d = st.get(b.door.y * N + b.door.x); d.locked = true; d.key = 'key_safe';
    // clear back door lock; add boards on a couple windows
    let n = 0;
    for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) {
      const s = st.get(y * N + x);
      if (o[y * N + x] === O.WINDOW && n < 2) { s.bar = 1; s.bhp = 40; s.locked = true; n++; }
    }
    b.alarm = false;
    // supplies
    const c = findObj(b, O.CABINET) || findObj(b, O.COUNTER);
    // make sure there is a bed and crate in the safehouse
    const spotsList = spots(b, b.x + 1, b.y + 1, b.x + b.w - 2, b.y + b.h - 2, true);
    const hasBed = !!findObj(b, O.BED);
    if (!hasBed && spotsList.length) { put(spotsList[0][0], spotsList[0][1], O.BED); }
    const cr = spotsList.length > 2 ? spotsList[2] : null;
    if (cr) { put(cr[0], cr[1], O.CRATE); forceAt(cr[0], cr[1], [['beans', 2], ['water_clean', 1], ['bandage', 2], ['rag', 3], ['plank', 4], ['nails', 12]]); W.safeCrate = { x: cr[0], y: cr[1] }; }
    W.safehouse = b;
    connectCheck(b);
  }
  function buildingInit() {
    for (const b of W.buildings) {
      const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
      if (b.type !== 'house' && b.type !== 'cabin' && b.type !== 'barn') W.pois.push({ x: cx | 0, y: cy | 0, t: b.type, n: b.name, bid: b.id });
      else if (b.safe) W.pois.push({ x: cx | 0, y: cy | 0, t: 'safe', n: b.name, bid: b.id });
      else if (b.type === 'cabin') W.pois.push({ x: cx | 0, y: cy | 0, t: 'cabin', n: b.name, bid: b.id });
    }
  }

  // ---------- state and queries ----------
  W.getState = function (i) { const a = W.alias.get(i); return st.get(a !== undefined ? a : i); };
  W.origin = function (i) { const a = W.alias.get(i); return a !== undefined ? a : i; };
  W.buildingAt = function (tx, ty) { if (!W.inb(tx, ty)) return null; const v = bl[ty * N + tx]; return v ? W.buildings[v - 1] : null; };
  W.isIndoor = function (tx, ty) { if (!W.inb(tx, ty)) return false; const i = ty * N + tx; return bl[i] && isFloor(g[i]) && o[i] !== O.WALL; };
  W.blocked = function (tx, ty) {
    if (tx < 0 || ty < 0 || tx >= N || ty >= N) return true;
    const i = ty * N + tx, t = o[i];
    if (!t) return g[i] === G.DEEP;
    if (t === O.DOOR || t === O.BGATE) { const s = st.get(i); return !s || ((!s.open && !s.broken) || s.bar > 0); }
    if (t === O.WINDOW) { const s = st.get(i); return !s || ((!s.open && !s.broken) || s.bar > 0); }
    if (t === O.CHECKGATE) { const s = st.get(112 + 6 * N); return !(s && s.open); }
    return OD[t].s;
  };
  W.opaque = function (tx, ty) {
    if (tx < 0 || ty < 0 || tx >= N || ty >= N) return true;
    const i = ty * N + tx, t = o[i]; if (!t) return false;
    if (t === O.DOOR || t === O.BGATE) { const s = st.get(i); return !s || (!s.open && !s.broken) || s.bar > 0; }
    if (t === O.WINDOW) { const s = st.get(i); return s && s.bar > 0; }
    return OD[t].op;
  };
  W.markDirty = function (x, y) {
    const cx = x >> 4, cy = y >> 4;
    const bump = (a, b2) => { if (a >= 0 && b2 >= 0 && a < NC && b2 < NC) W.ver[b2 * NC + a]++; };
    bump(cx, cy);
    const lx = x & 15, ly = y & 15;
    if (lx < 2) bump(cx - 1, cy); if (lx > 13) bump(cx + 1, cy); if (ly < 2) bump(cx, cy - 1); if (ly > 13) bump(cx, cy + 1);
    if (lx < 2 && ly < 2) bump(cx - 1, cy - 1); if (lx > 13 && ly > 13) bump(cx + 1, cy + 1); if (lx < 2 && ly > 13) bump(cx - 1, cy + 1); if (lx > 13 && ly < 2) bump(cx + 1, cy - 1);
  };
  W.setTile = function (x, y, ot, gt) {
    const i = y * N + x;
    if (ot !== undefined && ot !== null) o[i] = ot;
    if (gt !== undefined && gt !== null) g[i] = gt;
    if (W.genDone) W.diff.set(i, [o[i], g[i]]);
    W.markDirty(x, y);
  };
  W.touch = function (x, y) { W.markDirty(x, y); const i = y * N + x; const s = st.get(i); if (s) s.dirty = 1; };
  // supercover-ish LOS between tiles (ignores endpoints)
  W.los = function (x0, y0, x1, y1) {
    let dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx - dy, x = x0, y = y0, n = 0;
    while (n++ < 80) {
      if (x === x1 && y === y1) return true;
      if (!(x === x0 && y === y0) && W.opaque(x, y)) return false;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 < dx) { err += dx; y += sy; }
    }
    return true;
  };
  W.wallsBetween = function (x0, y0, x1, y1) {
    let dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx - dy, x = x0, y = y0, c = 0, n = 0;
    while (n++ < 60) {
      if (x === x1 && y === y1) break;
      if (!(x === x0 && y === y0) && W.blocked(x, y) && o[y * N + x] !== O.TREE && o[y * N + x] !== O.FENCE) c++;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 < dx) { err += dx; y += sy; }
    }
    return c;
  };
  W.randFree = function (x0, y0, x1, y1, rnd2, pred) {
    for (let k = 0; k < 40; k++) {
      const x = fl(x0 + rnd2() * (x1 - x0)), y = fl(y0 + rnd2() * (y1 - y0));
      if (!W.inb(x, y) || W.blocked(x, y)) continue;
      if (pred && !pred(x, y)) continue;
      return [x, y];
    }
    return null;
  };
  W.applyDiff = function (arr) {
    for (const [i, a] of arr) { o[i] = a[0]; g[i] = a[1]; W.diff.set(i, a); }
    W.ver.fill(1);
  };
})();

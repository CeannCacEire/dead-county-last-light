/* Dead County: Last Light - zombie AI: states, senses, noise, flow fields, hordes, pooling. */
(function () {
  'use strict';
  const DC = window.DC, W = DC.W, O = DC.O, G = DC.G, T = 16, N = W.N;
  const Z = (DC.Z = {});
  const POOL = 520;
  Z.pool = []; Z.hordes = []; Z.active = []; Z.counts = { active: 0, alive: 0, dormant: 0 };
  for (let k = 0; k < POOL; k++) Z.pool.push({ alive: false });

  Z.TYPES = {
    shambler: { sight: 9, fov: 2.0, spd: 21, hp: 34, dmg: [6, 11], hear: 1.0, col: '#6f7f6a', w: 1 },
    walker: { sight: 11, fov: 2.2, spd: 29, hp: 44, dmg: [8, 13], hear: 1.0, col: '#7a8670', w: 1 },
    runner: { sight: 14, fov: 2.4, spd: 47, hp: 28, dmg: [6, 10], hear: 1.3, col: '#8a7a6a', w: 1 },
    brute: { sight: 8, fov: 1.8, spd: 17, hp: 105, dmg: [14, 20], hear: 0.8, col: '#5f6a66', w: 1 },
  };
  const rnd = Math.random;

  // ---------- movement helpers ----------
  function hitTiles(px, py, r) {
    const x0 = Math.floor((px - r) / T), x1 = Math.floor((px + r) / T), y0 = Math.floor((py - r) / T), y1 = Math.floor((py + r) / T);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (W.blocked(x, y)) return true;
    return false;
  }
  DC.hitTiles = hitTiles;
  DC.moveEnt = function (e, dx, dy, r) {
    let moved = false;
    if (dx) { const nx = e.x + dx; if (!hitTiles(nx, e.y, r)) { e.x = nx; moved = true; } }
    if (dy) { const ny = e.y + dy; if (!hitTiles(e.x, ny, r)) { e.y = ny; moved = true; } }
    return moved;
  };

  // ---------- flow fields (Dijkstra with tile costs) ----------
  const fields = new Map();
  function tileCost(x, y) {
    if (x < 0 || y < 0 || x >= N || y >= N) return -1;
    const i = y * N + x, t = W.o[i];
    if (!t) { const gt = W.g[i]; return gt === G.DEEP ? -1 : gt === G.SHALLOW ? 0.8 : 0; }
    if (t === O.DOOR || t === O.BGATE) { const s = W.st.get(i); if (!s) return -1; if ((s.open || s.broken) && !s.bar) return 0; return 5 + (s.locked ? 3 : 0) + s.bar * 9; }
    if (t === O.WINDOW) { const s = W.st.get(i); if (!s) return -1; if ((s.open || s.broken) && !s.bar) return 1.5; return 15 + s.bar * 9; }
    if (t === O.BWALL || t === O.SPIKES) return 16;
    if (t === O.BUSH || t === O.CROP || t === O.CAMPFIRE || t === O.BSTAIRS || t === O.TRIPWIRE) return 0.3;
    return DC.OD[t].s ? -1 : 0;
  }
  Z.tileCost = tileCost;
  const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.41], [-1, 1, 1.41], [1, -1, 1.41], [-1, -1, 1.41]];
  function computeField(tx, ty, r) {
    const sz = 2 * r + 1, dist = new Float64Array(sz * sz).fill(1e9);
    const hk = [], hv = [];
    const push = (k, v) => { let i = hk.length; hk.push(k); hv.push(v); while (i > 0) { const p = (i - 1) >> 1; if (hk[p] <= k) break; hk[i] = hk[p]; hv[i] = hv[p]; i = p; } hk[i] = k; hv[i] = v; };
    const pop = () => {
      const rk = hk[0], rv = hv[0], lk = hk.pop(), lv = hv.pop(); const n = hk.length;
      if (n) { let i = 0; for (;;) { let c = i * 2 + 1; if (c >= n) break; if (c + 1 < n && hk[c + 1] < hk[c]) c++; if (hk[c] >= lk) break; hk[i] = hk[c]; hv[i] = hv[c]; i = c; } hk[i] = lk; hv[i] = lv; }
      return [rk, rv];
    };
    dist[r * sz + r] = 0; push(0, r * sz + r);
    while (hk.length) {
      const [d, v] = pop(); if (d > dist[v]) continue;
      const lx = v % sz, ly = (v / sz) | 0, wx = tx - r + lx, wy = ty - r + ly;
      for (const [dx, dy, c] of DIRS) {
        const nx = lx + dx, ny = ly + dy; if (nx < 0 || ny < 0 || nx >= sz || ny >= sz) continue;
        const ww = wx + dx, wh = wy + dy, tc = tileCost(ww, wh); if (tc < 0) continue;
        if (dx && dy && (tileCost(wx + dx, wy) < 0 || tileCost(wx, wy + dy) < 0)) continue;
        const nd = d + c + tc, ni = ny * sz + nx;
        if (nd < dist[ni]) { dist[ni] = nd; push(nd, ni); }
      }
    }
    return { tx, ty, r, sz, dist, t: DC.S.rt };
  }
  Z.getField = function (tx, ty, r, ttl) {
    const k = tx + ',' + ty, f = fields.get(k);
    if (f && DC.S.rt - f.t < ttl) return f;
    const nf = computeField(tx, ty, r); fields.set(k, nf);
    if (fields.size > 10) { let oldest = null; for (const [kk, ff] of fields) if (!oldest || ff.t < oldest[1].t) oldest = [kk, ff]; fields.delete(oldest[0]); }
    return nf;
  };
  // next step pixel target from field; returns null when outside
  Z.fieldStep = function (f, px, py) {
    const tx = Math.floor(px / T), ty = Math.floor(py / T), lx = tx - f.tx + f.r, ly = ty - f.ty + f.r;
    if (lx < 0 || ly < 0 || lx >= f.sz || ly >= f.sz) return null;
    let best = f.dist[ly * f.sz + lx], bx = -1, by = -1;
    if (best >= 1e8) return null;
    for (const [dx, dy] of DIRS) {
      const nx = lx + dx, ny = ly + dy; if (nx < 0 || ny < 0 || nx >= f.sz || ny >= f.sz) continue;
      const d = f.dist[ny * f.sz + nx];
      if (d < best - 0.01) {
        if (dx && dy && (tileCost(tx + dx, ty) < 0 || tileCost(tx, ty + dy) < 0)) continue;
        best = d; bx = tx + dx; by = ty + dy;
      }
    }
    if (bx < 0) return { done: true };
    return { x: bx * T + 8, y: by * T + 8, tx: bx, ty: by };
  };

  // ---------- spawning ----------
  Z.spawn = function (x, y, type, o) {
    const z = Z.pool.find((q) => !q.alive); if (!z) return null;
    const T0 = Z.TYPES[type];
    Object.assign(z, { alive: true, x, y, vx: 0, vy: 0, face: rnd() * 6.28, type, hp: T0.hp, maxhp: T0.hp, state: 'idle', st: 1 + rnd() * 4, aw: 0, tx: x, ty: y, hx: x, hy: y,
      horde: -1, speedMul: 0.9 + rnd() * 0.2, lastX: x, lastY: y, lastSeen: -99, atkT: 0, stun: 0, pt: rnd() * 0.2, bashT: 0, bash: -1, look: 0, var: (rnd() * 4) | 0, stuck: 0, trailT: -1, anim: rnd() * 10, gT: rnd() * 8, sx: x, sy: y, lost: 0, hearT: 0, vis: false, dormant: false, flash: 0 }, o || {});
    return z;
  };
  Z.randType = function (night) {
    const r = rnd();
    const runner = 0.05 + (night ? 0.04 : 0) + DC.S.set.zombies * 0.01;
    if (r < runner) return 'runner'; if (r < runner + 0.05) return 'brute'; if (r < 0.5) return 'shambler'; return 'walker';
  };
  Z.spawnInitial = function () {
    const S = DC.S, pop = S.set.zombies, R = DC.mulberry(W.seed + 77);
    const safe = W.safehouse, sx = safe.x + 4, sy = safe.y + 4;
    const far = (x, y) => Math.hypot(x - sx, y - sy) > 18;
    let n = 0;
    // streets
    const streets = Math.round(80 * pop);
    for (let k = 0; k < streets; k++) {
      const p = W.randFree(56, 56, 168, 168, R, (x, y) => (W.g[y * N + x] === G.ROAD || W.g[y * N + x] === G.SIDEWALK) && !W.bl[y * N + x] && far(x, y) && !W.o[y * N + x]);
      if (p) { Z.spawn(p[0] * T + 8, p[1] * T + 8, Z.randType(), {}); n++; }
    }
    // indoors
    for (const b of W.buildings) {
      if (b.safe) continue;
      let c = b.type === 'house' || b.type === 'cabin' ? (R() < 0.45 ? 1 : 0) : b.type === 'shop' ? 1 + (R() < 0.5 ? 1 : 0) : b.type === 'hospital' ? 8 : b.type === 'police' ? 4 : b.type === 'fire' ? 2 : b.type === 'warehouse' || b.type === 'barn' ? 3 : 1;
      c = Math.round(c * pop + (R() < (c * pop) % 1 ? 0 : 0));
      for (let k = 0; k < c; k++) {
        const p = W.randFree(b.x + 1, b.y + 1, b.x + b.w - 1, b.y + b.h - 1, R, (x, y) => W.isIndoor(x, y) && !W.o[y * N + x]);
        if (p) { Z.spawn(p[0] * T + 8, p[1] * T + 8, Z.randType(), { state: 'idle' }); n++; }
      }
    }
    // countryside
    const cn = Math.round(46 * pop);
    for (let k = 0; k < cn; k++) {
      const p = W.randFree(6, 6, N - 6, N - 6, R, (x, y) => { const gt = W.g[y * N + x]; return (gt === G.GRASS || gt === G.LEAVES || gt === G.DIRT || gt === G.ROAD) && Math.hypot(x - sx, y - sy) > 30 && (x < 52 || x > 172 || y < 52 || y > 172); });
      if (p) { Z.spawn(p[0] * T + 8, p[1] * T + 8, Z.randType(), {}); n++; }
    }
    // hordes
    Z.hordes = [];
    const nodes = Z.nodes();
    const hc = Math.max(1, Math.round(3 * pop));
    for (let h = 0; h < hc + 1; h++) {
      const nd = nodes[Math.floor(R() * nodes.length)];
      if (Math.hypot(nd.x - sx, nd.y - sy) < 40 && h < hc) { h--; continue; }
      const hd = { id: h, x: nd.x * T + 8, y: nd.y * T + 8, node: nd, to: null, members: [], wait: 20 + R() * 60, spd: 5 + R() * 3 };
      Z.hordes.push(hd);
      const sizeH = Math.round((8 + R() * 6) * Math.max(0.6, pop));
      for (let k = 0; k < sizeH; k++) {
        const p = W.randFree(nd.x - 3, nd.y - 3, nd.x + 3, nd.y + 3, R, (x, y) => !W.o[y * N + x]);
        if (!p) continue;
        const z = Z.spawn(p[0] * T + 8, p[1] * T + 8, Z.randType(), { horde: h, state: 'wander' });
        if (z) { hd.members.push(z); n++; }
      }
    }
    return n;
  };
  // graph of road nodes for horde migration
  Z.nodes = function () {
    if (Z._nodes) return Z._nodes;
    const xs = [20, 56, 84, 112, 140, 168, 204], nodes = [];
    const onRoadV = (x) => x === 112 || W.ROADS.includes(x), onRoadH = (y) => y === 112 || W.ROADS.includes(y);
    for (const y of xs) for (const x of xs) if (onRoadV(x) && onRoadH(y)) { if ((x === 20 || x === 204 || y === 20 || y === 204) && !(x === 112 || y === 112)) continue; nodes.push({ x, y, nb: [] }); }
    for (const a of nodes) for (const b of nodes) {
      if (a === b) continue;
      const dx = Math.abs(a.x - b.x), dy = Math.abs(a.y - b.y);
      if ((dx === 0 || dy === 0) && (dx + dy) < 90) {
        // ensure adjacent in sorted list: no node between
        const mid = nodes.some((c) => c !== a && c !== b && ((a.x === b.x && c.x === a.x && c.y > Math.min(a.y, b.y) && c.y < Math.max(a.y, b.y)) || (a.y === b.y && c.y === a.y && c.x > Math.min(a.x, b.x) && c.x < Math.max(a.x, b.x))));
        const road = (a.x === b.x) ? onRoadV(a.x) && (a.x === 112 || (Math.min(a.y, b.y) >= 56 && Math.max(a.y, b.y) <= 168)) : onRoadH(a.y) && (a.y === 112 || (Math.min(a.x, b.x) >= 56 && Math.max(a.x, b.x) <= 168));
        if (!mid && road) a.nb.push(b);
      }
    }
    Z._nodes = nodes.filter((n) => n.nb.length); return Z._nodes;
  };
  function updateHordes(dt) { // dt in game seconds
    const S = DC.S;
    for (const h of Z.hordes) {
      if (h.wait > 0) { h.wait -= dt; continue; }
      if (!h.to) {
        let opts = h.node.nb.filter((n) => n !== h.prev);
        if (!opts.length) opts = h.node.nb;
        let pick = opts[Math.floor(rnd() * opts.length)];
        if (S.lastNoise && S.t - S.lastNoise.t < 240 && rnd() < 0.5) {
          let bd = 1e9; for (const o of opts) { const d = Math.hypot(o.x * T - S.lastNoise.x, o.y * T - S.lastNoise.y); if (d < bd) { bd = d; pick = o; } }
        }
        h.to = pick;
      }
      const tx = h.to.x * T + 8, ty = h.to.y * T + 8, d = Math.hypot(tx - h.x, ty - h.y);
      const step = h.spd * dt;
      if (d <= step) { h.x = tx; h.y = ty; h.prev = h.node; h.node = h.to; h.to = null; h.wait = 20 + rnd() * 90; } else { h.x += ((tx - h.x) / d) * step; h.y += ((ty - h.y) / d) * step; }
    }
  }

  // ---------- noise ----------
  // tin-can tripwire: rattles when anything walks through (cooldown per tile)
  DC.tripCheck = function (x, y, isPlayer) {
    const tx = Math.floor(x / T), ty = Math.floor(y / T), i = ty * N + tx;
    if (W.o[i] !== O.TRIPWIRE) return;
    const s = W.st.get(i); if (!s) return;
    const now = DC.S.rt; if (s.cd && now < s.cd) return; s.cd = now + 6;
    Z.noise(tx * T + 8, ty * T + 8, 22, 'tripwire'); DC.audio && DC.audio.sfx('can', tx * T + 8, ty * T + 8); DC.log(isPlayer ? 'You rattle the tripwire.' : 'A tripwire rattles nearby.', 'warn');
    if (s.hp === undefined) s.hp = 3; else s.hp--; if (s.hp <= 0) { W.setTile(tx, ty, 0); W.st.delete(i); }
  };
  Z.noise = function (x, y, r, src) {
    const S = DC.S; if (!S) return;
    if (r >= 12) S.lastNoise = { x, y, t: S.t, r };
    S.noiseLog.push({ x, y, r, t: S.rt, src });
    if (S.noiseLog.length > 24) S.noiseLog.shift();
    const rpx = r * T, ntx = Math.floor(x / T), nty = Math.floor(y / T);
    for (const z of Z.active) {
      if (!z.alive || z.state === 'chase' || z.state === 'attack') continue;
      const d = Math.hypot(z.x - x, z.y - y), tp = Z.TYPES[z.type];
      if (d > rpx * tp.hear * 1.05) continue;
      const walls = d > 24 ? W.wallsBetween(ntx, nty, Math.floor(z.x / T), Math.floor(z.y / T)) : 0;
      const eff = rpx * tp.hear * Math.pow(0.72, walls);
      if (d > eff) continue;
      const err = (d / T) * 0.5 * 1; // positional error in px
      z.state = 'hear'; z.hearT = 0.25 + rnd() * 0.7; z.tx = x + (rnd() - 0.5) * err * 2; z.ty = y + (rnd() - 0.5) * err * 2; z.sx = x; z.sy = y; z.st = 14; z.aw = Math.max(z.aw, 0.2);
      z.lastX = x; z.lastY = y;
      if (z.horde >= 0 && r >= 20) { const h = Z.hordes[z.horde]; if (h && h.wait > 8) h.wait = 8; }
    }
  };
  function alertNear(z, r) {
    for (const o of Z.active) {
      if (o === z || !o.alive || o.state === 'chase' || o.state === 'attack') continue;
      if (Math.hypot(o.x - z.x, o.y - z.y) < r * T && W.los(Math.floor(o.x / T), Math.floor(o.y / T), Math.floor(z.x / T), Math.floor(z.y / T))) {
        o.state = 'hear'; o.hearT = 0.3 + rnd() * 0.6; o.tx = DC.S.player.x; o.ty = DC.S.player.y; o.sx = o.tx; o.sy = o.ty; o.st = 12;
      }
    }
  }

  // ---------- damage to zombies ----------
  Z.hit = function (z, dmg, ax, ay, kb, opts) {
    opts = opts || {};
    const S = DC.S, P = S.player;
    const sneak = (z.state === 'idle' || z.state === 'wander' || z.state === 'return' || z.state === 'search' || (z.state === 'hear' && z.aw < 0.7)) && z.aw < 0.8;
    let d = dmg;
    if (sneak && opts.melee) { const from = Math.atan2(z.y - ay, z.x - ax); if (Math.abs(DC.angDiff(from, z.face)) < 1.3) { d *= 2.6; DC.log('Silent takedown.', 'good'); } }
    z.hp -= d; z.stun = Math.max(z.stun, 0.35 + kb / 60); z.flash = 0.15;
    const a = Math.atan2(z.y - ay, z.x - ax);
    DC.moveEnt(z, Math.cos(a) * kb * 0.5, Math.sin(a) * kb * 0.5, 4);
    if (z.state !== 'chase' && z.state !== 'attack') { z.state = 'chase'; z.aw = 1; z.lastSeen = S.rt; z.lastX = P.x; z.lastY = P.y; z.lost = 0; alertNear(z, 5); }
    DC.fx.hit(z.x, z.y, a);
    DC.audio && DC.audio.sfx('hit');
    if (z.hp <= 0) Z.kill(z, opts);
    return d;
  };
  Z.kill = function (z, opts) {
    z.alive = false; z.state = 'dead';
    const S = DC.S;
    S.stats.kills++;
    DC.fx.puff(z.x, z.y, 8);
    const b = S.bodies.find((q) => !q.alive) || S.bodies.reduce((a, c) => (a.t < c.t ? a : c));
    Object.assign(b, { alive: true, x: z.x, y: z.y, t: S.t, looted: false, face: z.face, var: z.var, items: null, type: z.type });
    if (z.horde >= 0) { const h = Z.hordes[z.horde]; if (h) h.members = h.members.filter((m) => m !== z); }
    DC.audio && DC.audio.sfx('zdie');
    DC.addXP && DC.addXP('melee', 6);
  };

  // ---------- main update ----------
  function canSee(z, P, sightMul) {
    const tp = Z.TYPES[z.type], dx = P.x - z.x, dy = P.y - z.y, d = Math.hypot(dx, dy), dt = d / T;
    let range = tp.sight * sightMul;
    if (z.state === 'chase') range *= 1.35;
    if (dt > range) return false;
    if (dt > 1.3 && z.state !== 'chase') {
      const a = Math.atan2(dy, dx); if (Math.abs(DC.angDiff(a, z.face)) > tp.fov / 2) return false;
    }
    return W.los(Math.floor(z.x / T), Math.floor(z.y / T), Math.floor(P.x / T), Math.floor(P.y / T));
  }
  function steerTo(z, tx, ty, speed, dt) {
    const dx = tx - z.x, dy = ty - z.y, d = Math.hypot(dx, dy);
    if (d < 1) return true;
    const sp = Math.min(speed * dt, d), ux = dx / d, uy = dy / d;
    const oldx = z.x, oldy = z.y;
    // avoid sliding into walls: try direct, then axis, then perpendicular
    let moved = DC.moveEnt(z, ux * sp, uy * sp, 4);
    if (!moved) { moved = DC.moveEnt(z, ux * sp, 0, 4) || DC.moveEnt(z, 0, uy * sp, 4); }
    const fa = Math.atan2(dy, dx); z.face += DC.angDiff(fa, z.face) * Math.min(1, dt * 8);
    z.stuck = (Math.abs(z.x - oldx) + Math.abs(z.y - oldy)) < sp * 0.2 ? z.stuck + dt : 0;
    z.vx = z.x - oldx; z.vy = z.y - oldy;
    return d < 5;
  }
  function pathTo(z, tx, ty, speed, dt, ttl) {
    const S = DC.S, ztx = Math.floor(z.x / T), zty = Math.floor(z.y / T), ttx = Math.floor(tx / T), tty = Math.floor(ty / T);
    const dist = Math.max(Math.abs(ztx - ttx), Math.abs(zty - tty));
    if (dist > 30) return steerTo(z, tx, ty, speed, dt);
    if (dist <= 1 && !W.blocked(ttx, tty)) return steerTo(z, tx, ty, speed, dt);
    const f = Z.getField(ttx, tty, 32, ttl || 0.5);
    const step = Z.fieldStep(f, z.x, z.y);
    if (!step) return steerTo(z, tx, ty, speed, dt);
    if (step.done) return steerTo(z, tx, ty, speed, dt);
    // blocked step => bash
    if (W.blocked(step.tx, step.ty)) {
      z.bash = step.ty * N + step.tx;
      const fa = Math.atan2(step.y - z.y, step.x - z.x); z.face += DC.angDiff(fa, z.face) * Math.min(1, dt * 8);
      // move to tile edge first
      const dd = Math.hypot(step.x - z.x, step.y - z.y);
      if (dd > 13) { steerTo(z, step.x, step.y, speed, dt); }
      else {
        z.bashT += dt;
        if (W.o[step.ty * N + step.tx] === O.SPIKES) { z.hp -= dt * 9; z.flash = 0.1; if (z.hp <= 0) { DC.log('Spikes put a zombie down.', 'good'); Z.kill(z, {}); return false; } }
        if (z.bashT > 0.9) { z.bashT = 0; DC.damageTile(step.tx, step.ty, 7 + rnd() * 5, 'zombie'); Z.noise(z.x, z.y, 9, 'bash'); }
      }
      return false;
    }
    z.bash = -1;
    return steerTo(z, step.x, step.y, speed, dt) && Math.hypot(tx - z.x, ty - z.y) < 6;
  }
  Z.pathTo = pathTo;
  function toSearch(z, x, y, t) { z.state = 'search'; z.st = t || 6 + rnd() * 4; z.sx = x; z.sy = y; z.tx = x; z.ty = y; z.look = 0; z.trailT = -1; }
  function followTrail(z) {
    const S = DC.S, tr = S.trail; let best = null;
    for (const p of tr) {
      if (p.t <= z.trailT || S.rt - p.t > 28) continue;
      if (Math.hypot(p.x - z.x, p.y - z.y) > 6 * T) continue;
      if (!best || p.t < best.t) best = p;
    }
    return best;
  }

  Z.update = function (dt, gdt) {
    const S = DC.S, P = S.player;
    const ptx = P.x, pty = P.y;
    // classify
    Z.active.length = 0; let alive = 0, dorm = 0;
    const actR = 52 * T, activeBand = actR * actR;
    for (const z of Z.pool) {
      if (!z.alive) continue; alive++;
      const dx = z.x - ptx, dy = z.y - pty;
      if (dx * dx + dy * dy < activeBand) { z.dormant = false; Z.active.push(z); } else { z.dormant = true; dorm++; }
    }
    Z.counts.alive = alive; Z.counts.active = Z.active.length; Z.counts.dormant = dorm;
    updateHordes(gdt);
    // sync dormant horde members occasionally
    S.zTick = (S.zTick || 0) - dt;
    if (S.zTick <= 0) {
      S.zTick = 2;
      for (const z of Z.pool) {
        if (!z.alive || !z.dormant || z.horde < 0) continue;
        const h = Z.hordes[z.horde]; if (!h) continue;
        if (Math.hypot(z.x - h.x, z.y - h.y) > 8 * T) {
          const p = W.randFree(Math.floor(h.x / T) - 3, Math.floor(h.y / T) - 3, Math.floor(h.x / T) + 3, Math.floor(h.y / T) + 3, Math.random, (x, y) => !W.o[y * N + x]);
          if (p) { z.x = p[0] * T + 8; z.y = p[1] * T + 8; }
        }
      }
      manageSpawns();
    }
    const sightMul = P.sightMul;
    for (const z of Z.active) { ai(z, P, dt, sightMul); if (z.alive) DC.tripCheck(z.x, z.y, false); }
    // separation
    for (let a = 0; a < Z.active.length; a++) {
      const za = Z.active[a];
      for (let b = a + 1; b < Z.active.length; b++) {
        const zb = Z.active[b], dx = zb.x - za.x, dy = zb.y - za.y;
        if (dx > 8 || dx < -8 || dy > 8 || dy < -8) continue;
        const d = Math.hypot(dx, dy); if (d < 0.01 || d > 7) continue;
        const push = (7 - d) * 0.25, ux = dx / d, uy = dy / d;
        DC.moveEnt(za, -ux * push, -uy * push, 4); DC.moveEnt(zb, ux * push, uy * push, 4);
      }
    }
  };
  function manageSpawns() {
    const S = DC.S, P = S.player;
    const target = Math.round(190 * S.set.zombies);
    if (Z.counts.alive >= target || Z.counts.alive >= POOL - 20) return;
    if (S.rt - (S.lastRespawn || 0) < 12) return; S.lastRespawn = S.rt;
    const px = Math.floor(P.x / T), py = Math.floor(P.y / T);
    for (let k = 0; k < 20; k++) {
      const a = rnd() * 6.28, d = 36 + rnd() * 18;
      const x = Math.floor(px + Math.cos(a) * d), y = Math.floor(py + Math.sin(a) * d);
      if (!W.inb(x, y) || x < 5 || y < 5 || x > N - 5 || y > N - 5 || W.blocked(x, y)) continue;
      if (W.bl[y * N + x]) continue;
      const z = Z.spawn(x * T + 8, y * T + 8, Z.randType(S.isNight), { state: 'wander' });
      if (z) { z.dormant = true; break; }
    }
  }

  function ai(z, P, dt, sightMul) {
    const S = DC.S, tp = Z.TYPES[z.type];
    z.anim += dt; z.flash = Math.max(0, z.flash - dt);
    if (z.stun > 0) { z.stun -= dt; return; }
    // perception
    z.pt -= dt;
    let sees = z.sees || false;
    if (z.pt <= 0) {
      z.pt = 0.14 + rnd() * 0.08;
      if (!P.dead && !P.sleepingSafe) {
        sees = canSee(z, P, sightMul); z.sees = sees;
        const d = Math.hypot(P.x - z.x, P.y - z.y) / T;
        if (sees) {
          z.aw += (0.25 + (1 - Math.min(1, d / (tp.sight * sightMul + 0.1))) * 1.6) * 0.2 * (P.crouch ? 0.8 : 1);
          if (d < 1.4) z.aw = 1;
          z.lastX = P.x; z.lastY = P.y; z.lastSeen = S.rt; z.lost = 0;
          if (z.aw >= 1 && z.state !== 'chase' && z.state !== 'attack') {
            z.state = 'chase'; z.aw = 1; DC.audio && DC.audio.groan(z.x, z.y, 1);
            if (rnd() < 0.5) alertNear(z, 6);
          } else if (z.aw > 0.3 && z.state !== 'chase' && z.state !== 'attack') { z.face += DC.angDiff(Math.atan2(P.y - z.y, P.x - z.x), z.face) * 0.5; }
        } else z.aw = Math.max(0, z.aw - 0.05);
      } else { z.sees = false; sees = false; }
    }
    const spd = tp.spd * z.speedMul * (S.isNight ? 1.08 : 1);
    switch (z.state) {
      case 'idle':
        z.st -= dt; z.face += Math.sin(z.anim * 0.7) * dt * 0.4;
        if (z.st <= 0) { pickWander(z); z.state = 'wander'; }
        break;
      case 'wander': {
        if (z.horde >= 0) { const h = Z.hordes[z.horde]; if (h && Math.hypot(z.tx - h.x, z.ty - h.y) > 5 * T) { z.tx = h.x + (rnd() - 0.5) * 4 * T; z.ty = h.y + (rnd() - 0.5) * 4 * T; } }
        const arrived = steerTo(z, z.tx, z.ty, spd * 0.5, dt);
        if (arrived || z.stuck > 1.2) { z.stuck = 0; if (rnd() < 0.5) { z.state = 'idle'; z.st = 2 + rnd() * 6; } else pickWander(z); }
        z.gT -= dt; if (z.gT <= 0) { z.gT = 6 + rnd() * 10; if (rnd() < 0.5) DC.audio && DC.audio.groan(z.x, z.y, 0.45); }
        break;
      }
      case 'hear': {
        if (z.hearT > 0) { z.hearT -= dt; z.face += DC.angDiff(Math.atan2(z.ty - z.y, z.tx - z.x), z.face) * Math.min(1, dt * 6); break; }
        z.st -= dt;
        const arrived = pathTo(z, z.tx, z.ty, spd * 0.8, dt, 1.5);
        if (arrived || z.st <= 0 || z.stuck > 2) toSearch(z, z.x, z.y, 6 + rnd() * 4);
        break;
      }
      case 'search': {
        z.st -= dt; z.look -= dt;
        const trail = followTrail(z);
        if (trail) { z.trailT = trail.t; z.tx = trail.x; z.ty = trail.y; z.st = Math.max(z.st, 3); }
        else if (z.look <= 0) { z.look = 1.2 + rnd() * 1.6; const a = rnd() * 6.28, r = (1 + rnd() * 3.5) * T; z.tx = z.sx + Math.cos(a) * r; z.ty = z.sy + Math.sin(a) * r; if (W.blocked(Math.floor(z.tx / T), Math.floor(z.ty / T))) { z.tx = z.x; z.ty = z.y; } }
        steerTo(z, z.tx, z.ty, spd * 0.6, dt);
        if (z.st <= 0) { z.state = 'return'; z.st = 14; }
        break;
      }
      case 'return': {
        z.st -= dt;
        let hx = z.hx, hy = z.hy;
        if (z.horde >= 0) { const h = Z.hordes[z.horde]; if (h) { hx = h.x + (rnd() - 0.5) * 2; hy = h.y; } }
        const d = Math.hypot(hx - z.x, hy - z.y);
        if (d < 3 * T || z.st <= 0 || z.stuck > 1.5) { z.state = 'wander'; z.aw = 0; pickWander(z); }
        else if (d > 30 * T) { z.hx = z.x; z.hy = z.y; z.state = 'wander'; pickWander(z); }
        else pathTo(z, hx, hy, spd * 0.55, dt, 1.5);
        break;
      }
      case 'chase': {
        if (!sees) z.lost += dt;
        const maxLost = z.type === 'runner' ? 8 : 6;
        if (z.lost > maxLost || P.dead) { toSearch(z, z.lastX, z.lastY, 7 + rnd() * 3); break; }
        const tx = sees ? P.x : z.lastX, ty = sees ? P.y : z.lastY;
        const dd = Math.hypot(P.x - z.x, P.y - z.y);
        if (sees && dd < 14 && !W.blocked(Math.floor(P.x / T), Math.floor(P.y / T)) && W.wallsBetween(Math.floor(z.x / T), Math.floor(z.y / T), Math.floor(P.x / T), Math.floor(P.y / T)) === 0) {
          z.state = 'attack'; z.atkT = 0; z.face = Math.atan2(P.y - z.y, P.x - z.x); break;
        }
        const arrived = pathTo(z, tx, ty, spd, dt, 0.35);
        if (arrived && !sees) { toSearch(z, z.x, z.y, 7); }
        if (z.stuck > 3) { z.stuck = 0; }
        z.gT -= dt; if (z.gT <= 0) { z.gT = 4 + rnd() * 4; DC.audio && DC.audio.groan(z.x, z.y, 0.8); }
        break;
      }
      case 'attack': {
        z.atkT += dt;
        z.face += DC.angDiff(Math.atan2(P.y - z.y, P.x - z.x), z.face) * Math.min(1, dt * 10);
        if (z.atkT > 0.5 && !z.struck) {
          z.struck = true;
          const dd = Math.hypot(P.x - z.x, P.y - z.y);
          if (dd < 19 && !P.dead) {
            const hitChance = 0.72 - (P.crouch ? 0.05 : 0);
            if (rnd() < hitChance) { const dm = tp.dmg[0] + rnd() * (tp.dmg[1] - tp.dmg[0]); DC.hurtPlayer(dm, 'a zombie', { scratch: 0.45, from: z }); }
            else DC.fx.text(P.x, P.y - 10, 'miss', '#9aa');
          }
        }
        if (z.atkT > 1.35) { z.struck = false; z.state = 'chase'; z.lost = 0; }
        break;
      }
    }
  }
  function pickWander(z) {
    for (let k = 0; k < 6; k++) {
      const a = rnd() * 6.28, r = (4 + rnd() * 9) * T;
      let tx = z.x + Math.cos(a) * r, ty = z.y + Math.sin(a) * r;
      if (z.horde >= 0) { const h = Z.hordes[z.horde]; if (h) { tx = h.x + (rnd() - 0.5) * 6 * T; ty = h.y + (rnd() - 0.5) * 6 * T; } }
      const x = Math.floor(tx / T), y = Math.floor(ty / T);
      if (!W.blocked(x, y)) { z.tx = tx; z.ty = ty; return; }
    }
    z.tx = z.x; z.ty = z.y;
  }
})();

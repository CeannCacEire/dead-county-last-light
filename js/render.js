/* Dead County: Last Light - canvas renderer: camera, entities, lighting, fog of war, weather, post effects, minimap. */
(function () {
  'use strict';
  const DC = window.DC, W = DC.W, Tl = DC.tiles, O = DC.O, G = DC.G, Q = DC.gfx, Sp = DC.sprites, A = DC.art, T = 16, N = W.N, NC = W.NC;
  const R = (DC.render = { cam: { x: 0, y: 0 }, zs: 3, vw: 160, vh: 280, zoom: 1, zoomT: 1, rs: 1, ready: false, baseZs: 2 });
  let cv, ctx, lcv, lctx, mcv, mctx, mmcv, mmctx, mmImg, fullCv, fullCtx, grainC, fogC;
  const VR = 18, VW = VR * 2 + 1, visArr = new Uint8Array(VW * VW);
  let visOx = 0, visOy = 0, shake = 0, fpsAcc = 0, fpsN = 0, fps = 60, frameMs = 0, mmT = 0, flick = 0, rt = 0, wet = 0, lowT = 0, hiT = 0, grainT = 0, grainOx = 0, grainOy = 0, hitPulse = 0;
  const rainP = [], leafP = [], moteP = [], splashP = [], roofPat = {};
  const ZMIN = 0.65, ZMAX = 1.8;

  R.init = function (canvas) {
    cv = canvas; ctx = cv.getContext('2d', { alpha: false });
    lcv = document.createElement('canvas'); lctx = lcv.getContext('2d');
    mcv = document.createElement('canvas'); mctx = mcv.getContext('2d');
    mmcv = document.createElement('canvas'); mmcv.width = mmcv.height = 80; mmctx = mmcv.getContext('2d'); mmImg = mmctx.createImageData(80, 80);
    R.minimapCanvas = mmcv;
    for (let k = 0; k < 200; k++) rainP.push({ x: Math.random(), y: Math.random(), s: 0.7 + Math.random() * 0.6, d: Math.random() });
    for (let k = 0; k < 36; k++) leafP.push({ x: Math.random(), y: Math.random(), s: 0.5 + Math.random(), r: Math.random() * 6, c: Math.random() });
    for (let k = 0; k < 32; k++) moteP.push({ x: Math.random(), y: Math.random(), s: Math.random(), p: Math.random() * 6 });
    for (let k = 0; k < 24; k++) splashP.push({ x: 0, y: 0, t: 1 });
    grainC = Q.noiseTile(96, 'grain'); fogC = Q.noiseTile(128, 'fog');
    Q.refresh(); R.zoomT = R.zoom = DC.clamp((DC.settings && DC.settings.zoomMul) || 1, ZMIN, ZMAX);
    R.ready = true; R.resize();
  };
  R.resize = function () {
    if (!cv) return;
    const w = cv.clientWidth || window.innerWidth, h = cv.clientHeight || window.innerHeight, cfg = Q.cfg;
    let zs = DC.settings.zoom > 0 ? DC.settings.zoom : Math.max(2, Math.round(Math.min(w, h) / (T * 13)));
    R.baseZs = Math.max(1.5, zs); R.cssW = w; R.cssH = h; R.rs = cfg.rs;
    cv.width = Math.max(2, Math.round(w * cfg.rs)); cv.height = Math.max(2, Math.round(h * cfg.rs));
    const ld = cfg.light >= 2 ? 3 : cfg.light === 1 ? 4 : 6;
    lcv.width = Math.max(8, Math.ceil(w / ld)); lcv.height = Math.max(8, Math.ceil(h / ld));
    applyZoom();
  };
  function applyZoom() {
    R.zs = R.baseZs * R.zoom; R.vw = R.cssW / R.zs; R.vh = R.cssH / R.zs; R.k = R.zs * R.rs;
  }
  R.setZoom = function (z, instant) {
    R.zoomT = DC.clamp(z, ZMIN, ZMAX); DC.settings.zoomMul = R.zoomT;
    if (instant) { R.zoom = R.zoomT; applyZoom(); }
  };
  R.nudgeZoom = function (f) { R.setZoom(R.zoomT * f); };
  R.screenToWorld = function (sx, sy) { return { x: R.cam.x + (sx - R.cssW / 2) / R.zs, y: R.cam.y + (sy - R.cssH / 2) / R.zs }; };
  R.worldToScreen = function (wx, wy) { return { x: (wx - R.cam.x) * R.zs + R.cssW / 2, y: (wy - R.cam.y) * R.zs + R.cssH / 2 }; };
  R.shake = function (a) { if (Q.cfg && Q.cfg.shake) shake = Math.max(shake, a); };
  R.hit = function () { hitPulse = 1; };
  R.snapCamera = function () { const P = DC.S.player; R.cam.x = P.x; R.cam.y = P.y; };
  R.isVis = function (tx, ty) { const i = tx - visOx, j = ty - visOy; if (i < 0 || j < 0 || i >= VW || j >= VW) return false; return visArr[j * VW + i] === 1; };

  // ---------- vision ----------
  function computeVision(S) {
    const P = S.player, px = P.x / T, py = P.y / T, ptx = Math.floor(px), pty = Math.floor(py);
    visOx = ptx - VR; visOy = pty - VR; visArr.fill(0);
    const rng = Math.min(VR - 1, S.visRange || 8);
    const NR = 280;
    for (let a = 0; a < NR; a++) {
      const ang = a / NR * 6.2832, dx = Math.cos(ang) * 0.4, dy = Math.sin(ang) * 0.4;
      let x = px, y = py;
      for (let t = 0; t < rng; t += 0.4) {
        const tx = Math.floor(x), ty = Math.floor(y), i = tx - visOx, j = ty - visOy;
        if (i < 0 || j < 0 || i >= VW || j >= VW) break;
        visArr[j * VW + i] = 1;
        if ((tx !== ptx || ty !== pty) && W.opaque(tx, ty)) break;
        x += dx; y += dy;
      }
    }
    // always see adjacent tiles
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) visArr[(pty + dy - visOy) * VW + (ptx + dx - visOx)] = 1;
    // fill gaps between rays
    const tmp = [];
    for (let j = 1; j < VW - 1; j++) for (let i = 1; i < VW - 1; i++) {
      if (visArr[j * VW + i]) continue;
      const tx = visOx + i, ty = visOy + j;
      let n = 0; for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) if (visArr[(j + b) * VW + i + a]) n++;
      if (n >= 5 || (n >= 3 && W.opaque(tx, ty) && (visArr[j * VW + i - 1] + visArr[j * VW + i + 1] + visArr[(j - 1) * VW + i] + visArr[(j + 1) * VW + i]) >= 1 && Math.hypot(tx - px, ty - py) < rng)) tmp.push(j * VW + i);
    }
    for (const k of tmp) visArr[k] = 1;
    // discover
    const d = S.disc; let nd = 0;
    for (let j = 0; j < VW; j++) for (let i = 0; i < VW; i++) {
      if (!visArr[j * VW + i]) continue; const tx = visOx + i, ty = visOy + j;
      if (tx < 0 || ty < 0 || tx >= N || ty >= N) continue;
      if (!d[ty * N + tx]) { d[ty * N + tx] = 1; nd++; const b = W.buildings[W.bl[ty * N + tx] - 1]; if (b && !b.disc && (W.isIndoor(tx, ty) || W.o[ty * N + tx] === O.DOOR)) { b.disc = true; DC.emit('discover', b); } }
    }
    return rng;
  }

  // ---------- main frame ----------
  const TOD = [[0, [8, 14, 38]], [4.6, [12, 18, 44]], [5.8, [58, 38, 66]], [7.2, [70, 48, 60]], [9, [44, 44, 58]], [16, [44, 44, 58]], [17.8, [86, 44, 36]], [19.2, [48, 24, 46]], [20.8, [10, 15, 38]], [24, [8, 14, 38]]];
  function todColor(hr) {
    for (let i = 1; i < TOD.length; i++) if (hr <= TOD[i][0]) { const a = TOD[i - 1], b = TOD[i], t = (hr - a[0]) / (b[0] - a[0]); return [a[1][0] + (b[1][0] - a[1][0]) * t, a[1][1] + (b[1][1] - a[1][1]) * t, a[1][2] + (b[1][2] - a[1][2]) * t]; }
    return TOD[0][1];
  }
  const wallAt = (tx, ty) => { const o = W.inb(tx, ty) ? W.o[ty * N + tx] : 0; return o === O.WALL; };
  function winList(b) {
    if (b._win) return b._win; const l = [];
    for (let ty = b.y; ty < b.y + b.h; ty++) for (let tx = b.x; tx < b.x + b.w; tx++) if (W.o[ty * N + tx] === O.WINDOW) l.push([tx, ty]);
    return (b._win = l);
  }

  R.frame = function (dt) {
    const S = DC.S; if (!S) return;
    const t0 = performance.now(); rt += dt; flick = 0.85 + Math.random() * 0.3;
    const cfg = Q.cfg, P = S.player, cam = R.cam;
    if (Math.abs(R.zoomT - R.zoom) > 0.002) { R.zoom += (R.zoomT - R.zoom) * (1 - Math.exp(-dt * 9)); applyZoom(); }
    const vw = R.vw, vh = R.vh, k = R.k;
    ctx.setTransform(k, 0, 0, k, 0, 0); ctx.imageSmoothingEnabled = false;
    // camera: look-ahead toward aim, mild lag while moving, clamped inside the world
    const inp = DC.inp, mv = Math.hypot(inp.move.x, inp.move.y) > 0.1 ? 1 : 0;
    const lead = P.aimT > 0 ? 14 : 4, lagk = cfg.lag ? (mv ? 4.2 : 5.5) : 12;
    const lx = P.x + Math.cos(P.aim) * lead + (cfg.lag ? inp.move.x * (inp.sprint ? 9 : 5) : 0), ly = P.y + Math.sin(P.aim) * lead + (cfg.lag ? inp.move.y * (inp.sprint ? 9 : 5) : 0);
    const kk = 1 - Math.exp(-dt * lagk);
    cam.x += (lx - cam.x) * kk; cam.y += (ly - cam.y) * kk;
    if (Math.abs(cam.x - P.x) > 220 || Math.abs(cam.y - P.y) > 220) { cam.x = P.x; cam.y = P.y; }
    cam.x = DC.clamp(cam.x, vw / 2, N * T - vw / 2); cam.y = DC.clamp(cam.y, vh / 2, N * T - vh / 2);
    shake = Math.max(0, shake - dt * 14);
    const sx = shake ? (Math.random() - 0.5) * shake : 0, sy = shake ? (Math.random() - 0.5) * shake : 0;
    const camX = Math.round((cam.x - vw / 2 + sx) * k) / k, camY = Math.round((cam.y - vh / 2 + sy) * k) / k;
    R.camX = camX; R.camY = camY;
    const rng = computeVision(S);
    ctx.fillStyle = '#0b0d0c'; ctx.fillRect(0, 0, vw + 1, vh + 1);
    // wetness follows rain (puddles, darker ground)
    wet += ((S.weather.rain > 0.25 ? 1 : 0) - wet) * Math.min(1, dt * (S.weather.rain > 0.25 ? 0.12 : 0.03));
    // chunks
    const CW = T * 16, cx0 = Math.max(0, Math.floor(camX / CW)), cx1 = Math.min(NC - 1, Math.floor((camX + vw) / CW)), cy0 = Math.max(0, Math.floor(camY / CW)), cy1 = Math.min(NC - 1, Math.floor((camY + vh) / CW));
    let bakes = 0; const overs = [];
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      let ch = Tl.get(cx, cy, false);
      if (!ch || ch.ver !== W.ver[cy * NC + cx]) { if (bakes < 2 || !ch) { ch = Tl.get(cx, cy, true); bakes++; } }
      if (!ch) continue;
      ctx.drawImage(ch.base, cx * CW - Tl.PAD - camX, cy * CW - Tl.PAD - camY, ch.base.width / ch.bs, ch.base.height / ch.bs);
      if (ch.over) overs.push(ch);
    }
    if (bakes < 1) { const pcx = Math.floor(P.x / CW), pcy = Math.floor(P.y / CW); outer: for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const x = pcx + dx, y = pcy + dy; if (x < 0 || y < 0 || x >= NC || y >= NC) continue; const ch = Tl.get(x, y, false); if (!ch || ch.ver !== W.ver[y * NC + x]) { Tl.get(x, y, true); break outer; } } }
    Tl.unloadFar(Math.floor(P.x / CW), Math.floor(P.y / CW), 2);
    const x0t = Math.floor(camX / T) - 1, y0t = Math.floor(camY / T) - 1, x1t = Math.ceil((camX + vw) / T) + 1, y1t = Math.ceil((camY + vh) / T) + 1;
    const view = (x, y, m) => x > camX - m && y > camY - m && x < camX + vw + m && y < camY + vh + m;
    const vis = (x, y) => R.isVis(Math.floor(x / T), Math.floor(y / T));
    Sp.marks.length = 0;
    const wind = S.weather.wind || 0;
    // ---- animated ground layer: wet sheen, puddles, water, grass ----
    if (wet > 0.02 && cfg.weather > 0.3) { ctx.fillStyle = 'rgba(8,14,22,' + (wet * 0.12) + ')'; ctx.fillRect(0, 0, vw + 1, vh + 1); }
    const ty0 = Math.max(0, y0t), ty1 = Math.min(N - 1, y1t), tx0 = Math.max(0, x0t), tx1 = Math.min(N - 1, x1t);
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const i = ty * N + tx, o = W.o[i], g = W.g[i], px = tx * T - camX, py = ty * T - camY;
      if (o) {
        if (o === O.CAMPFIRE) { const s = W.st.get(i); if (s && s.fuel > 0) drawFire(px + 8, py + 8); }
        else if (o === O.BEACON && beaconOn(i)) { if (((rt * 2) | 0) % 2) { ctx.fillStyle = '#ff3a30'; ctx.fillRect(px + 7, py, 2, 2); ctx.fillStyle = 'rgba(255,60,40,.25)'; ctx.beginPath(); ctx.arc(px + 8, py + 1, 5, 0, 6.28); ctx.fill(); } }
        else if (o === O.LAMP && S.flags.power && S.amb < 0.62) { ctx.fillStyle = '#fff1b8'; ctx.beginPath(); ctx.arc(px + 8, py + 4, 1.4, 0, 6.28); ctx.fill(); }
        continue;
      }
      if (g === G.DEEP || g === G.SHALLOW) {
        if (cfg.water) { const ph = rt * 0.9 + tx * 0.7 + ty * 0.45, wy = Math.sin(ph) * 3; ctx.fillStyle = 'rgba(190,225,240,' + (g === G.SHALLOW ? 0.2 : 0.13) + ')'; ctx.fillRect(px + 3 + Math.cos(ph * 0.7) * 2, py + 8 + wy, 7, 0.8); if (((tx * 13 + ty * 7) & 3) === 0) ctx.fillRect(px + 8 - Math.sin(ph) * 3, py + 3 - wy * 0.4, 4, 0.7); }
      } else if (g === G.GRASS && cfg.sway && DC.hash(tx, ty, 555) < 0.2 && R.isVis(tx, ty)) {
        const sw = Math.sin(rt * 1.6 + tx * 0.6 + ty * 0.35) * (0.7 + wind * 1.6), bx = px + 3 + DC.hash(tx, ty, 556) * 10, by = py + 12;
        ctx.strokeStyle = 'rgba(86,120,62,.9)'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + sw, by - 4.2); ctx.moveTo(bx + 1.4, by); ctx.lineTo(bx + 1.4 + sw * 1.2, by - 5.2); ctx.moveTo(bx - 1.2, by); ctx.lineTo(bx - 1.2 + sw * 0.8, by - 3.4); ctx.stroke();
      }
      if (wet > 0.15 && cfg.weather > 0.3 && A.puddleAt(tx, ty)) {
        const hh = DC.hash(tx, ty, 334), pr = 3.4 + hh * 3, cxp = px + 8, cyp = py + 8;
        ctx.fillStyle = 'rgba(70,92,112,' + (wet * 0.55) + ')'; ctx.beginPath(); ctx.ellipse(cxp, cyp, pr, pr * 0.62, hh * 3, 0, 6.28); ctx.fill();
        ctx.fillStyle = 'rgba(200,220,240,' + (wet * 0.22) + ')'; ctx.beginPath(); ctx.ellipse(cxp - 1, cyp - 0.8, pr * 0.55, pr * 0.22, hh * 3, 0, 6.28); ctx.fill();
        if (S.weather.rain > 0.25) { const rp = (rt * 1.3 + hh * 5) % 1; ctx.strokeStyle = 'rgba(210,225,240,' + (0.5 * (1 - rp)) + ')'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.ellipse(cxp + (hh - 0.5) * 3, cyp, 0.6 + rp * 2.8, 0.3 + rp * 1.5, 0, 0, 6.28); ctx.stroke(); }
      }
    }
    // bodies
    for (const b of S.bodies) if (b.alive && view(b.x, b.y, 14) && vis(b.x, b.y)) Sp.body(ctx, b, b.x - camX, b.y - camY, rt);
    // ground items
    for (const g of DC.groundPool) if (g.alive && view(g.x, g.y, 10) && vis(g.x, g.y)) {
      const x = g.x - camX, y = g.y - camY, pulse = 0.5 + 0.5 * Math.sin(rt * 3 + g.x);
      Q.soft(ctx, x, y + 3.6, 6, 2.4, 0.5);
      ctx.fillStyle = 'rgba(255,230,150,' + (0.1 + pulse * 0.1) + ')'; ctx.beginPath(); ctx.arc(x, y, 7.5 + pulse, 0, 6.28); ctx.fill();
      ctx.drawImage(DC.iconCanvas(g.it.id), x - 6.5, y - 7.5 - pulse * 0.6, 13, 13);
      if (((rt * 3 + g.x) | 0) % 5 === 0) { ctx.fillStyle = '#fff6c0'; ctx.fillRect(x + 4, y - 7, 1, 1); }
    }
    for (const t of S.thrown) { const k2 = Math.min(1, t.t), x = P.x + (t.tx - P.x) * k2 - camX, y = P.y + (t.ty - P.y) * k2 - camY - Math.sin(k2 * 3.14) * 10; Q.soft(ctx, P.x + (t.tx - P.x) * k2 - camX, P.y + (t.ty - P.y) * k2 - camY + 2, 3, 1.4, 0.4); ctx.fillStyle = '#d4d4d0'; ctx.beginPath(); ctx.arc(x, y, 1.8, 0, 6.28); ctx.fill(); }
    for (const c of S.clocks) { const x = c.x - camX, y = c.y - camY; Q.soft(ctx, x, y + 3, 5, 2, 0.4); ctx.fillStyle = '#7a2a24'; Q.rr(ctx, x - 3.4, y - 3.4, 6.8, 6.8, 1.4); ctx.fill(); ctx.fillStyle = '#e8e8e0'; ctx.beginPath(); ctx.arc(x, y, 2.4, 0, 6.28); ctx.fill(); if (((rt * 8) | 0) % 2) { ctx.strokeStyle = '#e8d050'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.arc(x, y, 5.5, 0, 6.28); ctx.stroke(); } }
    // power units beside emergency buildings
    drawGenerators(S, camX, camY, view, dt);
    // build ghost
    if (S.build) {
      const b = S.build, x = b.tx * T - camX, y = b.ty * T - camY, ok = b.valid;
      ctx.fillStyle = ok ? 'rgba(110,200,110,.32)' : 'rgba(210,70,60,.38)'; Q.rr(ctx, x + 0.5, y + 0.5, T - 1, T - 1, 2); ctx.fill();
      ctx.strokeStyle = ok ? '#8fe08f' : '#e0604a'; ctx.lineWidth = 1; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.1)'; ctx.lineWidth = 0.5; const gx = Math.floor(P.x / T), gy = Math.floor(P.y / T); ctx.beginPath();
      for (let a = -4; a <= 5; a++) { ctx.moveTo((gx + a) * T - camX, (gy - 4) * T - camY); ctx.lineTo((gx + a) * T - camX, (gy + 5) * T - camY); ctx.moveTo((gx - 4) * T - camX, (gy + a) * T - camY); ctx.lineTo((gx + 5) * T - camX, (gy + a) * T - camY); }
      ctx.stroke();
    }
    // focus bracket
    const f = S.focus; if (f && !P.dead) {
      const fxx = f.kind === 'tile' ? f.tx * T - camX : f.x - camX - 8, fyy = f.kind === 'tile' ? f.ty * T - camY : f.y - camY - 8, a = 0.65 + 0.35 * Math.sin(rt * 6), e = Math.sin(rt * 6) * 0.6;
      ctx.strokeStyle = 'rgba(255,232,150,' + a + ')'; ctx.lineWidth = 1.1; ctx.lineCap = 'round';
      for (const [ax, ay, sxn, syn] of [[0, 0, 1, 1], [16, 0, -1, 1], [0, 16, 1, -1], [16, 16, -1, -1]]) { ctx.beginPath(); ctx.moveTo(fxx + ax - sxn * e + sxn * 4, fyy + ay - syn * e); ctx.lineTo(fxx + ax - sxn * e, fyy + ay - syn * e); ctx.lineTo(fxx + ax - sxn * e, fyy + ay - syn * e + syn * 4); ctx.stroke(); }
    }
    // noise rings
    if (DC.settings.noiseRing) for (const n of S.noiseLog) {
      const age = S.rt - n.t; if (age > 0.9 || age < 0) continue; if (n.src === 'step' && n.r < 2) continue;
      const rr = n.r * T * Math.min(1, age / 0.5); ctx.strokeStyle = 'rgba(240,200,90,' + (0.4 * (1 - age / 0.9)) + ')'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(n.x - camX, n.y - camY, rr, 0, 6.3); ctx.stroke();
    }
    // entities y-sorted
    const ents = [];
    for (const z of DC.Z.pool) { if (!z.alive || z.dormant) continue; if (!view(z.x, z.y, 16)) { z.vis = false; continue; } const v = vis(z.x, z.y); z.vis = v; if (v) ents.push({ y: z.y, k: 0, o: z }); }
    for (const a of S.animals) if (view(a.x, a.y, 12) && vis(a.x, a.y)) ents.push({ y: a.y, k: 1, o: a });
    for (const n of S.npcs) if (view(n.x, n.y, 12) && vis(n.x, n.y)) ents.push({ y: n.y, k: 2, o: n });
    ents.push({ y: P.y, k: 3, o: P });
    ents.sort((a, b) => a.y - b.y);
    for (const e of ents) {
      const x = e.o.x - camX, y = e.o.y - camY;
      if (e.k === 0) Sp.zombie(ctx, e.o, x, y, rt); else if (e.k === 1) Sp.animal(ctx, e.o, x, y, rt); else if (e.k === 2) Sp.npc(ctx, e.o, x, y, rt); else {
        if (!P.dead) Sp.player(ctx, P, x, y, rt); else Sp.corpsePlayer(ctx, x, y);
      }
    }
    // helicopter
    if (S.heli) drawHeli(S.heli, camX, camY);
    // canopies sway a little in the wind
    const swayOn = cfg.sway;
    for (const ch of overs) {
      const o = swayOn ? Math.sin(rt * 0.9 + ch.cx * 1.7 + ch.cy * 2.3) * (0.35 + wind * 0.9) : 0;
      ctx.drawImage(ch.over, ch.cx * CW - Tl.PAD - camX + o, ch.cy * CW - Tl.PAD - camY, ch.over.width / ch.bs, ch.over.height / ch.bs);
    }
    // roofs
    for (const b of W.buildings) {
      const bx = b.x * T, by = b.y * T, bw = b.w * T, bh = b.h * T;
      if (bx > camX + vw || by > camY + vh || bx + bw < camX || by + bh < camY) continue;
      const target = P.inBld === b ? 0 : 1; b.roofA += (target - b.roofA) * Math.min(1, dt * 7);
      if (b.roofA < 0.02) continue;
      drawRoof(b, camX, camY, S);
    }
    // particles
    drawParticles(camX, camY, vw, vh);
    for (const tr of DC.fx.tracers) { ctx.strokeStyle = 'rgba(255,240,170,' + (tr.t / 0.09) + ')'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(tr.x1 - camX, tr.y1 - camY); ctx.lineTo(tr.x2 - camX, tr.y2 - camY); ctx.stroke(); }
    // aim indicator
    if (!P.dead && !S.build && !S.sleeping && (S.rt - P.aimT < 1.4 || DC.inp.aim.active)) {
      const ax = P.x - camX + Math.cos(P.aim) * 22, ay = P.y - camY + Math.sin(P.aim) * 22; ctx.save(); ctx.translate(ax, ay); ctx.rotate(P.aim);
      ctx.strokeStyle = 'rgba(240,230,200,.7)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-1, -3); ctx.lineTo(2.5, 0); ctx.lineTo(-1, 3); ctx.stroke(); ctx.restore();
    }
    // light, fog of war, weather, post
    renderLight(S, camX, camY, rng, dt);
    renderFog(S, camX, camY, x0t, y0t, x1t, y1t, rng);
    renderWeather(S, dt, camX, camY);
    ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center';
    for (const m of Sp.marks) { ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillText(m[2], m[0] + 0.7, m[1] + 0.7); ctx.fillStyle = m[3]; ctx.fillText(m[2], m[0], m[1]); }
    for (const t of DC.fx.texts) if (t.a) { ctx.globalAlpha = Math.min(1, t.life * 2); ctx.fillStyle = '#000'; ctx.fillText(t.s, t.x - camX + 0.7, t.y - camY + 0.7); ctx.fillStyle = t.col; ctx.fillText(t.s, t.x - camX, t.y - camY); }
    ctx.globalAlpha = 1;
    postFX(S, dt);
    mmT -= dt; if (mmT <= 0) { mmT = 0.25; drawMinimap(S); }
    // adaptive quality: step down if the frame rate stays low, step back up when it recovers
    frameMs += (performance.now() - t0 - frameMs) * 0.1; fpsAcc += dt; fpsN++;
    if (fpsAcc >= 0.5) { fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; adaptQuality(); }
    R.fps = fps; R.ms = frameMs;
  };
  function adaptQuality() {
    if (!DC.settings.autoQuality || DC.settings.gfx !== 'auto' || document.hidden) { lowT = 0; return; }
    if (fps < 34) { lowT += 0.5; if (lowT > 5 && (Q.autoDrop || 0) < 3) { Q.autoDrop = (Q.autoDrop || 0) + 1; lowT = 0; Q.refresh(true); DC.log('Graphics adjusted for smoother play.', 'info'); } } else lowT = Math.max(0, lowT - 0.25);
  }

  function drawFire(x, y) {
    const t = rt * 9, f = 1 + Math.sin(t) * 0.12;
    ctx.fillStyle = 'rgba(255,140,40,.16)'; ctx.beginPath(); ctx.arc(x, y - 2, 9 * f, 0, 6.28); ctx.fill();
    for (const [r, col, dy] of [[4.4, '#c8441a', 0], [3.4, '#f08a24', -1], [2.2, '#ffd25a', -1.6], [1.1, '#fff4c0', -2]]) { ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(x + Math.sin(t * 0.8 + r) * 0.6, y + dy - 1.5, r * 0.8 * f, r * 1.25 * (0.9 + Math.random() * 0.18), 0, 0, 6.28); ctx.fill(); }
    if (Math.random() < 0.05) DC.fx.smoke && DC.fx.smoke(x + camXs(), y - 6 + camYs()); if (Math.random() < 0.03) DC.fx.spark && DC.fx.spark(x + camXs(), y - 4 + camYs(), 1);
  }
  const camXs = () => R.camX, camYs = () => R.camY;

  const GEN = {};
  function drawGenerators(S, camX, camY, view, dt) {
    for (const b of W.buildings) {
      if (b.type !== 'hospital' && b.type !== 'police' && b.type !== 'fire') continue;
      const gx = (b.x + b.w) * T + 1, gy = (b.y + b.h - 2) * T + 2; if (!view(gx, gy, 20)) continue;
      const ok = W.inb(b.x + b.w, b.y + b.h - 2) && !W.o[(b.y + b.h - 2) * N + b.x + b.w] && W.g[(b.y + b.h - 2) * N + b.x + b.w] !== G.DEEP;
      if (!ok) continue;
      const on = !S.flags.power, x = gx - camX, y = gy - camY; b._gen = { x: gx + 7, y: gy + 5, on };
      Q.soft(ctx, x + 8, y + 12, 9, 3.4, 0.45);
      ctx.fillStyle = '#16181a'; Q.rr(ctx, x - 0.5, y - 0.5, 15, 11, 2); ctx.fill();
      const g = ctx.createLinearGradient(x, y, x, y + 10); g.addColorStop(0, '#8a8f58'); g.addColorStop(1, '#4e5230'); ctx.fillStyle = g; Q.rr(ctx, x, y, 14, 10, 1.6); ctx.fill();
      ctx.fillStyle = '#2a2c28'; ctx.fillRect(x + 1.5, y + 2, 7, 5); ctx.fillStyle = '#6a6c64'; for (let k = 0; k < 4; k++) ctx.fillRect(x + 2 + k * 1.6, y + 2.4, 0.7, 4.2);
      ctx.fillStyle = on ? '#6fe070' : '#4a2a26'; ctx.fillRect(x + 10, y + 2, 2, 2); ctx.fillStyle = '#1a1a1c'; ctx.fillRect(x + 10, y + 5.5, 2.4, 3);
      if (on && Math.random() < 0.06 * dt * 60) DC.fx.smoke && DC.fx.smoke(gx + 12, gy - 1);
    }
  }
  function drawHeli(h, camX, camY) {
    const hx = h.x - camX, hy = h.y - camY;
    Q.soft(ctx, hx + 4, hy + 14, 26, 8, 0.4);
    ctx.fillStyle = '#10161a'; Q.rr(ctx, hx - 17, hy - 9, 35, 16, 6); ctx.fill();
    const g = ctx.createLinearGradient(hx, hy - 8, hx, hy + 6); g.addColorStop(0, '#5a6a58'); g.addColorStop(1, '#2a352c'); ctx.fillStyle = g; Q.rr(ctx, hx - 16, hy - 8, 33, 14, 5); ctx.fill();
    ctx.fillStyle = '#1b2a34'; Q.rr(ctx, hx + 7, hy - 6, 8, 10, 3); ctx.fill(); ctx.fillStyle = 'rgba(160,210,230,.4)'; ctx.fillRect(hx + 8.4, hy - 5, 2, 7);
    ctx.fillStyle = '#2f3a2e'; ctx.fillRect(hx - 34, hy - 2.4, 19, 3); ctx.fillStyle = '#3d4a3a'; ctx.fillRect(hx - 12, hy - 7, 14, 4);
    const ra = rt * 30; ctx.strokeStyle = 'rgba(210,214,214,.5)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(hx - Math.cos(ra) * 30, hy - 1 - Math.sin(ra) * 30); ctx.lineTo(hx + Math.cos(ra) * 30, hy - 1 + Math.sin(ra) * 30); ctx.moveTo(hx - Math.cos(ra + 1.57) * 30, hy - 1 - Math.sin(ra + 1.57) * 30); ctx.lineTo(hx + Math.cos(ra + 1.57) * 30, hy - 1 + Math.sin(ra + 1.57) * 30); ctx.stroke();
    ctx.fillStyle = '#e8e8e0'; ctx.beginPath(); ctx.arc(hx, hy - 1, 2, 0, 6.28); ctx.fill();
    if (((rt * 2) | 0) % 2) { ctx.fillStyle = '#ff4030'; ctx.fillRect(hx - 34, hy - 3.4, 1.6, 1.6); }
  }

  const SM = { 'smoke': 1 };
  function drawParticles(camX, camY, vw, vh) {
    const lim = Q.cfg.part;
    let drawn = 0, cap = Math.round(240 * lim) + 20;
    for (const p of DC.fx.p) {
      if (!p.a) continue; const x = p.x - camX, y = p.y - camY; if (x < -6 || y < -6 || x > vw + 6 || y > vh + 6) continue;
      if (++drawn > cap) break;
      const a = Math.min(1, p.life / p.max * (p.kind === 2 ? 0.6 : 1.4));
      if (p.kind === 2) { const s = p.size * (1.2 + (1 - p.life / p.max) * 2.4); ctx.globalAlpha = a * 0.5; ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(x, y, s * 0.7, 0, 6.28); ctx.fill(); }
      else if (p.kind === 3) { ctx.globalAlpha = a; ctx.strokeStyle = p.col; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - (p.vx || 0) * 0.03, y - (p.vy || 0) * 0.03); ctx.stroke(); ctx.fillStyle = 'rgba(255,200,100,.3)'; ctx.beginPath(); ctx.arc(x, y, 1.6, 0, 6.28); ctx.fill(); }
      else { ctx.globalAlpha = a; ctx.fillStyle = p.col; const s = p.size; ctx.fillRect(x - s / 2, y - s / 2, s, s); }
    }
    ctx.globalAlpha = 1;
  }

  function beaconOn(i) { const s = W.st.get(i); return !!(s && s.active); }

  // ---------- roofs ----------
  const ROOFC = {};
  function roofPattern(col, type) {
    const key = col + type; if (roofPat[key]) return roofPat[key];
    const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d'), sh = Q.col.shade;
    x.fillStyle = col; x.fillRect(0, 0, 32, 32);
    if (type === 'warehouse' || type === 'fire' || type === 'barn') { for (let k = 0; k < 8; k++) { x.fillStyle = k % 2 ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.14)'; x.fillRect(k * 4, 0, 2, 32); } }
    else if (type === 'hospital' || type === 'gas' || type === 'police' || type === 'shop') { x.fillStyle = 'rgba(0,0,0,.08)'; for (let n = 0; n < 40; n++) x.fillRect((n * 37) % 32, (n * 53) % 32, 2, 2); x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(0, 0, 32, 1); x.fillRect(0, 0, 1, 32); x.fillStyle = 'rgba(255,255,255,.07)'; x.fillRect(1, 1, 31, 1); }
    else { for (let r = 0; r < 8; r++) { x.fillStyle = 'rgba(0,0,0,.24)'; x.fillRect(0, r * 4 + 3, 32, 1); x.fillStyle = 'rgba(255,255,255,.09)'; x.fillRect(0, r * 4, 32, 1); for (let n = 0; n < 5; n++) { x.fillStyle = (r + n) % 3 ? 'rgba(0,0,0,.12)' : 'rgba(255,255,255,.05)'; x.fillRect(((n * 7 + r * 3) % 8) * 4, r * 4, 4, 3); x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(((n * 7 + r * 5) % 8) * 4, r * 4, 1, 3); } } }
    const p = ctx.createPattern(c, 'repeat'); if (p.setTransform && window.DOMMatrix) p.setTransform(new DOMMatrix().scale(0.5)); return (roofPat[key] = p);
  }
  function drawRoof(b, camX, camY, S) {
    const bx = b.x * T, by = b.y * T, bw = b.w * T, bh = b.h * T, h = DC.hash(b.id, b.x, 17);
    ctx.globalAlpha = b.roofA; ctx.save(); ctx.translate(-camX, -camY);
    const rx = bx + T, ry = by + T, rw = bw - 2 * T, rh = bh - 2 * T;
    // drop shadow on the surroundings (already baked for walls); the roof itself
    ctx.fillStyle = roofPattern(b.roof, b.type); ctx.fillRect(rx, ry, rw, rh);
    const g = ctx.createLinearGradient(rx, ry, rx + rw, ry + rh); g.addColorStop(0, 'rgba(255,255,255,.1)'); g.addColorStop(0.5, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.22)'); ctx.fillStyle = g; ctx.fillRect(rx, ry, rw, rh);
    ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(rx, ry, rw, 1.6); ctx.fillRect(rx, ry, 1.6, rh);
    ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fillRect(rx, ry + rh - 1.4, rw, 1.4); ctx.fillRect(rx + rw - 1.4, ry, 1.4, rh);
    if (b.type === 'house' || b.type === 'cabin') {
      ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(rx, ry + rh / 2 - 0.8, rw, 1.6); ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fillRect(rx, ry + rh / 2 + 0.8, rw, 0.8);
      const cx = rx + 8 + h * (rw - 22), cy = ry + 5; ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(cx + 1, cy + 1.6, 6, 8); ctx.fillStyle = '#5c4a42'; ctx.fillRect(cx, cy, 6, 8); ctx.fillStyle = '#7a6258'; ctx.fillRect(cx, cy, 6, 1.6); ctx.fillStyle = '#1a1412'; ctx.fillRect(cx + 1.4, cy + 1.6, 3.2, 3);
    } else if (b.type === 'shop' || b.type === 'warehouse' || b.type === 'gas' || b.type === 'hospital' || b.type === 'police' || b.type === 'fire') {
      for (let n = 0; n < 2; n++) { const ax = rx + 6 + ((h * 7 + n * 0.5) % 1) * (rw - 22), ay = ry + 5 + n * 12; if (ay + 10 > ry + rh) continue; ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(ax + 1, ay + 1.6, 9, 8); ctx.fillStyle = '#9a9ea0'; ctx.fillRect(ax, ay, 9, 8); ctx.fillStyle = '#6a6e70'; ctx.fillRect(ax + 1.4, ay + 1.4, 6.2, 5.2); ctx.fillStyle = '#2a2c2e'; ctx.beginPath(); ctx.arc(ax + 4.5, ay + 4, 2.3, 0, 6.28); ctx.fill(); }
      if (b.name && (b.type === 'shop' || b.type === 'gas' || b.type === 'police' || b.type === 'fire' || b.type === 'hospital')) {
        const label = b.name.replace(/\s+No\.\s*\d+/, '').toUpperCase().slice(0, 18);
        ctx.font = 'bold 6px sans-serif'; ctx.textAlign = 'center'; const tw = Math.min(rw - 6, ctx.measureText(label).width + 8), sx = rx + rw / 2 - tw / 2, sy = ry + rh - 11;
        ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(sx + 1, sy + 1.6, tw, 8); ctx.fillStyle = b.type === 'police' ? '#27384f' : b.type === 'fire' ? '#7e2b24' : b.type === 'hospital' ? '#2f6a68' : b.type === 'gas' ? '#8a6a24' : '#3a3f48'; ctx.fillRect(sx, sy, tw, 8); ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(sx, sy, tw, 1);
        ctx.fillStyle = '#f2ecd8'; ctx.fillText(label, rx + rw / 2, sy + 5.9);
      }
      if (b.type === 'hospital') { const cx = bx + (bw >> 1), cy = by + (bh >> 1) - 4; ctx.fillStyle = 'rgba(240,240,236,.92)'; ctx.fillRect(cx - 7, cy - 7, 14, 14); ctx.fillStyle = '#c8402e'; ctx.fillRect(cx - 2, cy - 6, 4, 12); ctx.fillRect(cx - 6, cy - 2, 12, 4); }
      if (b.type === 'fire' || b.type === 'police') { ctx.fillStyle = 'rgba(255,255,255,.32)'; ctx.fillRect(bx + (bw >> 1) - 6, by + (bh >> 1) - 1, 12, 2); }
    }
    if (!S.flags.power && (b.type === 'hospital' || b.type === 'police' || b.type === 'fire')) { const p = 0.5 + 0.5 * Math.sin(rt * 5); ctx.fillStyle = 'rgba(' + (b.type === 'police' ? '60,100,255' : '255,50,40') + ',' + (p * 0.5) + ')'; ctx.beginPath(); ctx.arc(rx + rw - 6, ry + 6, 3, 0, 6.28); ctx.fill(); }
    ctx.restore(); ctx.globalAlpha = 1;
  }

  // ---------- lighting and colour grading ----------
  function renderLight(S, camX, camY, rng, dt) {
    const P = S.player, vw = R.vw, vh = R.vh, cfg = Q.cfg, w = S.weather;
    const amb = P.indoors ? S.ambIn : S.amb, hr = (S.t / 60) % 24;
    let dark = Math.pow(1 - amb, 1.15) * 0.9;
    dark = Math.min(0.88, dark + (w.rain * 0.08) + w.fog * 0.05);
    if (S.sleeping) dark = Math.min(0.97, dark + 0.3);
    // daylight colour grade (cheap tint layers; stronger tiers add more)
    if (cfg.grade && !P.indoors) {
      const tint = todColor(hr), day = Math.max(0, 1 - dark * 2.2);
      if (day > 0.05) {
        const warm = (hr > 6 && hr < 9.5) || (hr > 15.5 && hr < 19) ? 0.1 : 0.03;
        ctx.fillStyle = 'rgba(255,198,120,' + (warm * day) + ')'; ctx.fillRect(0, 0, vw + 1, vh + 1);
      }
      if (w.rain > 0.1 || w.fog > 0.1) { ctx.fillStyle = 'rgba(70,86,100,' + (Math.min(0.2, w.rain * 0.14 + w.fog * 0.08) * Math.max(0.3, 1 - dark)) + ')'; ctx.fillRect(0, 0, vw + 1, vh + 1); }
    }
    if (dark < 0.02) return;
    const lw = lcv.width / vw, lh = lcv.height / vh;
    lctx.setTransform(1, 0, 0, 1, 0, 0); lctx.globalCompositeOperation = 'source-over'; lctx.clearRect(0, 0, lcv.width, lcv.height);
    lctx.setTransform(lw, 0, 0, lh, 0, 0);
    const tc = todColor(hr); lctx.fillStyle = 'rgba(' + (tc[0] | 0) + ',' + (tc[1] | 0) + ',' + (tc[2] | 0) + ',' + dark + ')'; lctx.fillRect(0, 0, vw + 1, vh + 1);
    lctx.globalCompositeOperation = 'destination-out';
    const glow = (x, y, r, a, hard) => { x -= camX; y -= camY; if (x < -r || y < -r || x > vw + r || y > vh + r) return; const g = lctx.createRadialGradient(x, y, r * (hard || 0.15), x, y, r); g.addColorStop(0, 'rgba(0,0,0,' + a + ')'); g.addColorStop(1, 'rgba(0,0,0,0)'); lctx.fillStyle = g; lctx.fillRect(x - r, y - r, r * 2, r * 2); };
    const warms = [];   // [x, y, r, a, rgb] colour passes drawn additively afterwards
    glow(P.x, P.y, 46, 0.85);
    const h = P.hand, full = cfg.light >= 1;
    if (P.ownLight > 0 && h) {
      const L = DC.ITEMS[h.id].light;
      if (L.fire) { glow(P.x, P.y, L.r * flick, 0.95); warms.push([P.x, P.y, 46 * flick, 0.22, '255,150,60']); }
      else if (full) {
        glow(P.x, P.y, 34, 0.9);
        lctx.save(); lctx.translate(P.x - camX, P.y - camY); lctx.rotate(P.aim); const g = lctx.createRadialGradient(0, 0, 4, 0, 0, L.r + 20); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.7, 'rgba(0,0,0,.8)'); g.addColorStop(1, 'rgba(0,0,0,0)'); lctx.fillStyle = g; lctx.beginPath(); lctx.moveTo(0, 0); lctx.arc(0, 0, L.r + 20, -0.42, 0.42); lctx.closePath(); lctx.fill(); lctx.restore();
        warms.push([P.x + Math.cos(P.aim) * 36, P.y + Math.sin(P.aim) * 36, 40, 0.1, '230,240,255']);
      } else glow(P.x, P.y, L.r * 0.7, 0.9);
    }
    const x0 = Math.floor(camX / T) - 6, y0 = Math.floor(camY / T) - 6, x1 = Math.ceil((camX + vw) / T) + 6, y1 = Math.ceil((camY + vh) / T) + 6;
    for (const l of W.lamps) {
      if (l[0] < x0 || l[0] > x1 || l[1] < y0 || l[1] > y1) continue;
      if (S.flags.power && W.o[l[1] * N + l[0]] === O.LAMP) {
        const fl = 1 - (DC.hash(l[0], l[1], 9) > 0.8 ? Math.max(0, Math.sin(rt * 17 + l[0]) * Math.sin(rt * 5.3 + l[1])) * 0.35 : 0);
        glow(l[0] * T + 8, l[1] * T + 4, 58 * fl, 0.85); warms.push([l[0] * T + 8, l[1] * T + 6, 44 * fl, 0.16, '255,190,100']);
      }
    }
    for (let ty = Math.max(0, y0); ty <= Math.min(N - 1, y1); ty++) for (let tx = Math.max(0, x0); tx <= Math.min(N - 1, x1); tx++) {
      const o = W.o[ty * N + tx]; if (!o) continue;
      if (o === O.CAMPFIRE) { const s = W.st.get(ty * N + tx); if (s && s.fuel > 0) { glow(tx * T + 8, ty * T + 8, 78 * flick, 1); warms.push([tx * T + 8, ty * T + 8, 62 * flick, 0.24, '255,140,50']); } }
      else if (o === O.BEACON && beaconOn(ty * N + tx)) glow(tx * T + 8, ty * T + 4, 40, 0.7);
    }
    for (const b of W.buildings) {
      if (b.x * T > camX + vw + 40 || b.y * T > camY + vh + 40 || (b.x + b.w) * T < camX - 40 || (b.y + b.h) * T < camY - 40) continue;
      if (S.flags.power && b.powered !== false && P.inBld === b) { lctx.fillStyle = 'rgba(0,0,0,.55)'; lctx.fillRect(b.x * T - camX, b.y * T - camY, b.w * T, b.h * T); warms.push([P.x, P.y, 70, 0.07, '255,176,96']); }
      if (full && S.flags.power && b.powered !== false && P.inBld !== b && (b.type !== 'house' || DC.hash(b.id, 3, 77) > 0.55)) {
        for (const [wx, wy] of winList(b)) { if (!R.isVis(wx, wy) && !S.disc[wy * N + wx]) continue; const st = W.st.get(wy * N + wx); if (st && st.broken) continue; glow(wx * T + 8, wy * T + 12, 22, 0.55); warms.push([wx * T + 8, wy * T + 10, 20, 0.18, '255,204,120']); }
      }
      if (!S.flags.power && b._gen && b._gen.on) { glow(b._gen.x, b._gen.y, 60, 0.7); warms.push([b._gen.x, b._gen.y, 50, 0.16, '255,190,110']); for (const [wx, wy] of winList(b)) { glow(wx * T + 8, wy * T + 12, 18, 0.35); } }
      else if (!S.flags.power && (b.type === 'hospital' || b.type === 'police' || b.type === 'fire') && b.door && full) {
        const ph = 0.5 + 0.5 * Math.sin(rt * 4 + b.id); glow(b.door.x * T + 8, b.door.y * T + 8, 36, 0.4 * ph); warms.push([b.door.x * T + 8, b.door.y * T + 8, 34, 0.26 * ph, b.type === 'police' ? '70,110,255' : '255,50,40']);
      }
    }
    for (const a of S.alarms) { if (!(a.alarmOn > 0) || ((rt * 4) | 0) % 2) continue; if (a.w !== undefined) { glow((a.x + a.w / 2) * T, (a.y + a.h / 2) * T, 50, 0.5); } else { glow((a.x + 1) * T, (a.y + 0.5) * T, 34, 0.7); warms.push([(a.x + 1) * T, (a.y + 0.5) * T, 34, 0.3, '255,170,40']); } }
    if (S.heli) { glow(S.heli.x, S.heli.y, 80, 0.7); warms.push([S.heli.x + 20, S.heli.y + 10, 70, 0.1, '240,248,255']); }
    if (DC.fx.light) { glow(DC.fx.light.x, DC.fx.light.y, 50, 1); warms.push([DC.fx.light.x, DC.fx.light.y, 40, 0.3, '255,230,160']); }
    lctx.globalCompositeOperation = 'source-over'; lctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = true; ctx.drawImage(lcv, 0, 0, vw, vh); ctx.imageSmoothingEnabled = false;
    if (dark > 0.2 && cfg.grade) {
      ctx.globalCompositeOperation = 'lighter';
      for (const [x, y, r, a, rgb] of warms) { const xx = x - camX, yy = y - camY; if (xx < -r || yy < -r || xx > vw + r || yy > vh + r) continue; const g = ctx.createRadialGradient(xx, yy, 0, xx, yy, r); g.addColorStop(0, 'rgba(' + rgb + ',' + (a * dark) + ')'); g.addColorStop(1, 'rgba(' + rgb + ',0)'); ctx.fillStyle = g; ctx.fillRect(xx - r, yy - r, r * 2, r * 2); }
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  function renderFog(S, camX, camY, x0t, y0t, x1t, y1t, rng) {
    const mw = x1t - x0t + 1, mh = y1t - y0t + 1; if (mcv.width !== mw || mcv.height !== mh) { mcv.width = mw; mcv.height = mh; }
    const img = mctx.createImageData(mw, mh), d = img.data, P = S.player, px = P.x / T, py = P.y / T, disc = S.disc;
    for (let j = 0; j < mh; j++) for (let i = 0; i < mw; i++) {
      const tx = x0t + i, ty = y0t + j, o = (j * mw + i) * 4; let a;
      if (tx < 0 || ty < 0 || tx >= N || ty >= N) a = 255;
      else if (R.isVis(tx, ty)) { const dd = Math.hypot(tx + 0.5 - px, ty + 0.5 - py); const e = rng * 0.7; a = dd > e ? Math.min(210, (dd - e) / (rng * 0.3 + 0.01) * 210) : 0; if (disc[ty * N + tx] === 0) a = 0; }
      else a = disc[ty * N + tx] ? 150 : 238;
      d[o] = 4; d[o + 1] = 6; d[o + 2] = 10; d[o + 3] = a;
    }
    mctx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true; ctx.drawImage(mcv, x0t * T - camX, y0t * T - camY, mw * T, mh * T); ctx.imageSmoothingEnabled = false;
  }

  // ---------- weather ----------
  function renderWeather(S, dt, camX, camY) {
    const w = S.weather, vw = R.vw, vh = R.vh, P = S.player, cfg = Q.cfg, wk = cfg.weather;
    // drifting mist: scrolling noise layers (more at night, dawn and in fog)
    const hr = (S.t / 60) % 24, night = hr < 5.5 || hr > 20 ? 0.35 : (hr < 7 || hr > 18.5) ? 0.2 : 0.04;
    const mist = Math.min(0.55, (w.fog * 0.5 + night * 0.4) * (P.indoors ? 0.2 : 1));
    if (cfg.fogL && mist > 0.02) {
      ctx.imageSmoothingEnabled = true; const sc = 2.2, sz = 128 * sc;
      for (let l = 0; l < 2; l++) {
        const ox = -((camX * (0.15 + l * 0.1) + rt * (3 + l * 2.5 + w.wind * 6)) % sz + sz) % sz, oy = -((camY * (0.15 + l * 0.1) + rt * (1.5 + l)) % sz + sz) % sz;
        ctx.globalAlpha = mist * (l ? 0.5 : 0.8);
        for (let x = ox - sz; x < vw; x += sz) for (let y = oy - sz; y < vh; y += sz) ctx.drawImage(fogC, x, y, sz, sz);
      }
      ctx.globalAlpha = 1; ctx.imageSmoothingEnabled = false;
    } else if (w.fog > 0.05) { ctx.fillStyle = 'rgba(150,160,160,' + (w.fog * 0.2) + ')'; ctx.fillRect(0, 0, vw + 1, vh + 1); }
    if (w.rain > 0.05 && !P.indoors && wk > 0) {
      ctx.lineCap = 'round'; const n = Math.floor(rainP.length * w.rain * Math.min(1, wk)), sl = 3 + w.wind * 6;
      ctx.lineWidth = 0.55; ctx.strokeStyle = 'rgba(190,205,225,' + (0.2 + w.rain * 0.2) + ')'; ctx.beginPath();
      for (let k = 0; k < n; k++) {
        const r = rainP[k]; r.y += dt * 2.4 * r.s; r.x -= dt * 0.25 * w.wind * r.s; if (r.y > 1) { r.y = 0; r.x = Math.random() * 1.2; if (k % 9 === 0) { const sp = splashP[(k / 9 | 0) % splashP.length]; sp.x = camX + Math.random() * vw; sp.y = camY + Math.random() * vh; sp.t = 0; } } if (r.x < 0) r.x += 1.2;
        const x = r.x * vw, y = r.y * vh, len = 4 + sl * 0.5 + r.d * 3; ctx.moveTo(x, y); ctx.lineTo(x - sl * 0.35, y + len);
      }
      ctx.stroke();
      ctx.lineWidth = 0.5; for (const sp of splashP) { sp.t += dt * 2.6; if (sp.t >= 1) continue; ctx.strokeStyle = 'rgba(205,220,236,' + (0.5 * (1 - sp.t)) + ')'; ctx.beginPath(); ctx.ellipse(sp.x - camX, sp.y - camY, 0.5 + sp.t * 2.4, 0.25 + sp.t * 1.2, 0, 0, 6.28); ctx.stroke(); }
    } else if (w.rain > 0.05 && P.indoors) {
      ctx.fillStyle = 'rgba(30,40,60,' + w.rain * 0.08 + ')'; ctx.fillRect(0, 0, vw + 1, vh + 1);
      if (wk > 0.5) { ctx.strokeStyle = 'rgba(160,185,210,.1)'; ctx.lineWidth = 0.5; ctx.beginPath(); const s = (rt * 14) % 24; for (let k = 0; k < 8; k++) { const x = (k * 53 + 11) % vw; ctx.moveTo(x, (s + k * 31) % vh); ctx.lineTo(x - 1, ((s + k * 31) % vh) + 4); } ctx.stroke(); }
    }
    // wind-blown leaves (outdoors)
    if (!P.indoors && wk > 0.5 && (w.wind > 0.25 || w.rain < 0.1)) {
      const n = Math.floor(leafP.length * Math.min(1, 0.25 + w.wind * 1.2) * Math.min(1, wk));
      for (let k = 0; k < n; k++) { const l = leafP[k]; l.x += dt * (0.05 + w.wind * 0.22) * l.s; l.y += dt * (0.015 + Math.sin(rt + l.r) * 0.01) * l.s; l.r += dt * 3 * l.s; if (l.x > 1.1) { l.x = -0.1; l.y = Math.random(); } if (l.y > 1.1) l.y = -0.1; ctx.fillStyle = l.c > 0.6 ? 'rgba(140,100,40,.8)' : l.c > 0.3 ? 'rgba(110,120,50,.8)' : 'rgba(90,100,60,.8)'; ctx.save(); ctx.translate(l.x * vw, l.y * vh); ctx.rotate(l.r); ctx.fillRect(-1.2, -0.6, 2.4, 1.2); ctx.restore(); }
    }
    // dust motes drifting in interiors
    if (P.indoors && wk > 0.3) {
      ctx.fillStyle = 'rgba(255,240,210,.35)'; const n = Math.floor(moteP.length * Math.min(1, cfg.part));
      for (let k = 0; k < n; k++) { const m = moteP[k]; m.p += dt * 0.6; m.y -= dt * 0.012 * (0.4 + m.s); m.x += Math.sin(m.p) * dt * 0.01; if (m.y < -0.05) { m.y = 1.05; m.x = Math.random(); } const a = 0.2 + 0.2 * Math.sin(m.p * 2); ctx.globalAlpha = a; ctx.fillRect(m.x * vw, m.y * vh, 0.9, 0.9); }
      ctx.globalAlpha = 1;
    }
  }

  // ---------- post processing: vignette, grain, danger tint ----------
  function dangerLevel(S) {
    const P = S.player; let n = 0;
    for (const z of DC.Z.pool) { if (!z.alive || z.dormant) continue; const d = Math.hypot(z.x - P.x, z.y - P.y); if (d < 150 && (z.state === 'chase' || z.state === 'attack')) n += 1; else if (d < 70) n += 0.4; }
    return Math.min(1, n / 5);
  }
  function postFX(S, dt) {
    const P = S.player, vw = R.vw, vh = R.vh, cfg = Q.cfg;
    if (P.dmgFlash > 0) { ctx.fillStyle = 'rgba(150,24,20,' + Math.min(0.42, P.dmgFlash * 0.5) + ')'; ctx.fillRect(0, 0, vw + 1, vh + 1); }
    hitPulse = Math.max(0, hitPulse - dt * 5);
    if (hitPulse > 0 && cfg.shake) { ctx.fillStyle = 'rgba(255,255,255,' + (hitPulse * 0.07) + ')'; ctx.fillRect(0, 0, vw + 1, vh + 1); }
    if (!cfg.post) { if (S.lightning > 0) { ctx.fillStyle = 'rgba(220,230,255,' + Math.min(0.5, S.lightning * 0.6) + ')'; ctx.fillRect(0, 0, vw + 1, vh + 1); } return; }
    hiT -= dt; if (hiT <= 0) { hiT = 0.3; R.danger = dangerLevel(S); }
    const danger = R.danger || 0, low = Math.max(0, 1 - P.hp / 40) * 0.5 + (P.stress > 70 ? (P.stress - 70) / 100 : 0) + (P.fatigue > 80 ? (P.fatigue - 80) / 100 : 0);
    const dk = (S.amb < 0.35 ? 0.1 : 0);
    const a = 0.4 + low * 0.4 + danger * 0.22 + dk + (S.sleeping ? 0.4 : 0);
    const vg = ctx.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * (0.36 - danger * 0.06), vw / 2, vh / 2, Math.max(vw, vh) * 0.72);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(' + (low > 0.3 || danger > 0.4 ? '30,0,0' : '0,0,0') + ',' + Math.min(0.85, a) + ')');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, vw + 1, vh + 1);
    if (cfg.grain && grainC) {
      grainT -= dt; if (grainT <= 0) { grainT = 0.09; grainOx = Math.random() * 96; grainOy = Math.random() * 96; }
      ctx.globalAlpha = 0.045 + (S.amb < 0.4 ? 0.025 : 0); ctx.globalCompositeOperation = 'overlay';
      const gs = 48;
      for (let x = -grainOx * gs / 96; x < vw; x += gs) for (let y = -grainOy * gs / 96; y < vh; y += gs) ctx.drawImage(grainC, x, y, gs, gs);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    }
    if (S.lightning > 0) { ctx.fillStyle = 'rgba(220,230,255,' + Math.min(0.55, S.lightning * 0.7) + ')'; ctx.fillRect(0, 0, vw + 1, vh + 1); }
  }

  // ---------- minimap ----------
  const MMC = { [G.ROAD]: [70, 72, 78], [G.SIDEWALK]: [112, 112, 104], [G.DEEP]: [30, 60, 84], [G.SHALLOW]: [48, 88, 112], [G.GRASS]: [50, 66, 42], [G.DIRT]: [84, 70, 52], [G.GRAVEL]: [100, 96, 88], [G.LEAVES]: [70, 70, 38], [G.FARM]: [88, 66, 40], [G.BRIDGE]: [96, 76, 52], [G.CONCRETE]: [88, 88, 84], [G.PAD]: [84, 86, 94], [G.WOOD]: [112, 84, 56], [G.TILE]: [120, 124, 120], [G.CARPET]: [104, 72, 80], [G.MUD]: [74, 62, 44] };
  function tileColor(i) {
    const o = W.o[i];
    if (o === O.WALL || o === O.BWALL) return [190, 170, 130]; if (o === O.DOOR || o === O.BGATE) return [220, 150, 70]; if (o === O.WINDOW) return [150, 180, 190];
    if (o === O.TREE) return [28, 48, 30]; if (o === O.CAR) return [110, 100, 100]; if (o === O.FENCE) return [110, 96, 70];
    return MMC[W.g[i]] || [60, 60, 60];
  }
  function drawMinimap(S) {
    const P = S.player, d = mmImg.data, ptx = Math.floor(P.x / T), pty = Math.floor(P.y / T), disc = S.disc;
    for (let j = 0; j < 80; j++) for (let i = 0; i < 80; i++) {
      const tx = ptx - 40 + i, ty = pty - 40 + j, o = (j * 80 + i) * 4;
      if (tx < 0 || ty < 0 || tx >= N || ty >= N || !disc[ty * N + tx]) { d[o] = 8; d[o + 1] = 10; d[o + 2] = 10; d[o + 3] = 255; continue; }
      const c = tileColor(ty * N + tx), v = R.isVis(tx, ty) ? 1 : 0.62; d[o] = c[0] * v; d[o + 1] = c[1] * v; d[o + 2] = c[2] * v; d[o + 3] = 255;
    }
    mmctx.putImageData(mmImg, 0, 0);
    const mark = (tx, ty, col, s) => { const x = tx - ptx + 40, y = ty - pty + 40; if (x < 1 || y < 1 || x > 78 || y > 78) return; mmctx.fillStyle = col; mmctx.fillRect(x - (s >> 1), y - (s >> 1), s, s); };
    const sf = W.safehouse; if (sf) mark(sf.x + (sf.w >> 1), sf.y + (sf.h >> 1), '#4fd0e0', 4);
    for (const p of W.pois) if (disc[p.y * N + p.x]) mark(p.x, p.y, '#e8c050', 3);
    for (const z of DC.Z.pool) if (z.alive && z.vis && !z.dormant) mark(Math.floor(z.x / T), Math.floor(z.y / T), '#e0503a', 2);
    for (const n of S.npcs) if (R.isVis(Math.floor(n.x / T), Math.floor(n.y / T))) mark(Math.floor(n.x / T), Math.floor(n.y / T), '#6fb86f', 3);
    const a = P.aim; mmctx.fillStyle = '#fff'; mmctx.beginPath(); mmctx.moveTo(40 + Math.cos(a) * 4, 40 + Math.sin(a) * 4); mmctx.lineTo(40 + Math.cos(a + 2.5) * 3, 40 + Math.sin(a + 2.5) * 3); mmctx.lineTo(40 + Math.cos(a - 2.5) * 3, 40 + Math.sin(a - 2.5) * 3); mmctx.fill();
  }
  // full map: returns a canvas
  R.fullMap = function () {
    const S = DC.S; if (!fullCv) { fullCv = document.createElement('canvas'); fullCv.width = fullCv.height = N * 2; fullCtx = fullCv.getContext('2d'); }
    const img = fullCtx.createImageData(N, N), d = img.data, disc = S.disc;
    for (let i = 0; i < N * N; i++) { const o = i * 4; if (!disc[i]) { d[o] = 10; d[o + 1] = 12; d[o + 2] = 12; d[o + 3] = 255; continue; } const c = tileColor(i); d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255; }
    const tmp = document.createElement('canvas'); tmp.width = tmp.height = N; tmp.getContext('2d').putImageData(img, 0, 0);
    fullCtx.imageSmoothingEnabled = false; fullCtx.drawImage(tmp, 0, 0, N * 2, N * 2);
    const c = fullCtx, P = S.player;
    c.font = 'bold 9px monospace'; c.textAlign = 'center';
    const lab = (tx, ty, s, col) => { c.fillStyle = '#000'; c.fillText(s, tx * 2 + 1, ty * 2 + 1); c.fillStyle = col; c.fillText(s, tx * 2, ty * 2); };
    for (const b of W.buildings) if (b.disc && b.name && b.type !== 'house') lab(b.x + (b.w >> 1), b.y + (b.h >> 1), b.name.replace(/\s+No\.\s*\d+/, '').slice(0, 14), '#e8d890');
    const sf = W.safehouse; if (sf) { c.fillStyle = '#4fd0e0'; c.fillRect((sf.x + (sf.w >> 1)) * 2 - 4, (sf.y + (sf.h >> 1)) * 2 - 4, 8, 8); lab(sf.x + (sf.w >> 1), sf.y - 1, 'SAFEHOUSE', '#4fd0e0'); }
    if (W.mast && S.disc[W.mast.y * N + W.mast.x]) lab(W.mast.x, W.mast.y - 2, 'MAST', '#e8a050');
    if (W.gate && S.disc[(W.gate.y + 1) * N + W.gate.x]) lab(W.gate.x, W.gate.y + 4, 'CHECKPOINT', '#e8a050');
    c.fillStyle = '#fff'; c.beginPath(); const px = P.x / T * 2, py = P.y / T * 2, a = P.aim; c.moveTo(px + Math.cos(a) * 7, py + Math.sin(a) * 7); c.lineTo(px + Math.cos(a + 2.5) * 5, py + Math.sin(a + 2.5) * 5); c.lineTo(px + Math.cos(a - 2.5) * 5, py + Math.sin(a - 2.5) * 5); c.fill();
    return fullCv;
  };
  R.overlayText = function () {
    const S = DC.S, Z = DC.Z; if (!S) return '';
    return 'FPS ' + R.fps.toFixed(0) + '  frame ' + R.ms.toFixed(1) + 'ms\ngraphics ' + Q.level + '  scale ' + R.k.toFixed(2) + '  zoom x' + R.zoom.toFixed(2) + '  view ' + R.vw.toFixed(0) + 'x' + R.vh.toFixed(0) + '\nzombies alive ' + Z.counts.alive + ' active ' + Z.counts.active + ' dormant ' + Z.counts.dormant + '\nchunks ' + Tl.chunks.size + '  particles ' + DC.fx.count + '\nplayer ' + (S.player.x / T).toFixed(1) + ',' + (S.player.y / T).toFixed(1) + '  noise ' + S.player.noiseR.toFixed(1) + '\nvis ' + (S.visRange || 0).toFixed(1) + '  amb ' + S.amb.toFixed(2) + '  t ' + DC.fmtClock(S.t);
  };
})();

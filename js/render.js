/* Dead County: Last Light - canvas renderer: camera, entities, lighting, fog of war, weather, minimap. */
(function () {
  'use strict';
  const DC = window.DC, W = DC.W, Tl = DC.tiles, O = DC.O, G = DC.G, T = 16, N = W.N, NC = W.NC;
  const R = (DC.render = { cam: { x: 0, y: 0 }, zs: 3, vw: 160, vh: 280 });
  let cv, ctx, lcv, lctx, mcv, mctx, mmcv, mmctx, mmImg, fullCv, fullCtx;
  const VR = 18, VW = VR * 2 + 1, visArr = new Uint8Array(VW * VW);
  let visOx = 0, visOy = 0, shake = 0, fpsAcc = 0, fpsN = 0, fps = 60, frameMs = 0, mmT = 0, flick = 0, rainP = [], rt = 0;
  const roofPat = {};

  R.init = function (canvas) {
    cv = canvas; ctx = cv.getContext('2d', { alpha: false });
    lcv = document.createElement('canvas'); lctx = lcv.getContext('2d');
    mcv = document.createElement('canvas'); mctx = mcv.getContext('2d');
    mmcv = document.createElement('canvas'); mmcv.width = mmcv.height = 80; mmctx = mmcv.getContext('2d'); mmImg = mmctx.createImageData(80, 80);
    R.minimapCanvas = mmcv;
    for (let k = 0; k < 140; k++) rainP.push({ x: Math.random(), y: Math.random(), s: 0.7 + Math.random() * 0.6 });
    R.resize();
  };
  R.resize = function () {
    const w = cv.clientWidth || window.innerWidth, h = cv.clientHeight || window.innerHeight;
    let zs = DC.settings.zoom > 0 ? DC.settings.zoom : Math.max(2, Math.round(Math.min(w, h) / (T * 13)));
    zs = Math.max(1.5, zs);
    R.zs = zs; R.cssW = w; R.cssH = h;
    R.vw = Math.ceil(w / zs); R.vh = Math.ceil(h / zs);
    cv.width = R.vw; cv.height = R.vh; lcv.width = R.vw; lcv.height = R.vh;
    ctx.imageSmoothingEnabled = false;
  };
  R.screenToWorld = function (sx, sy) { return { x: R.cam.x + (sx - R.cssW / 2) / R.zs, y: R.cam.y + (sy - R.cssH / 2) / R.zs }; };
  R.worldToScreen = function (wx, wy) { return { x: (wx - R.cam.x) * R.zs + R.cssW / 2, y: (wy - R.cam.y) * R.zs + R.cssH / 2 }; };
  R.shake = function (a) { shake = Math.max(shake, a); };
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

  // ---------- sprites ----------
  function outlineRect(c, x, y, w, h, col) { c.fillStyle = '#0a0a0a'; c.fillRect(x - 1, y - 1, w + 2, h + 2); c.fillStyle = col; c.fillRect(x, y, w, h); }
  function bodyColor(P) { const b = P.equip.body; if (b) return DC.ITEMS[b.id].ic[1]; return '#58626e'; }
  function drawPlayer(c, P, x, y, S) {
    const crouch = P.crouch, sc = crouch ? 0.88 : 1, anim = P.anim || 0, mv = P.moved > 0.2;
    c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(x, y + 3, 6, 3.2, 0, 0, 6.3); c.fill();
    c.save(); c.translate(x, y); c.rotate(P.face || 0); c.scale(sc, sc);
    const leg = mv ? Math.sin(anim * 1.6) * 3 : 0;
    c.fillStyle = '#0a0a0a'; c.fillRect(-4 + leg, -4, 5, 3); c.fillRect(-4 - leg, 1, 5, 3);
    c.fillStyle = P.equip.legs ? DC.ITEMS[P.equip.legs.id].ic[1] : '#3a3e48'; c.fillRect(-3 + leg, -3, 4, 2); c.fillRect(-3 - leg, 2, 4, 2);
    outlineRect(c, -3, -5, 6, 10, bodyColor(P));
    c.fillStyle = 'rgba(255,255,255,.15)'; c.fillRect(-2, -4, 1, 8);
    if (P.equip.back) { c.fillStyle = '#2a2a2e'; c.fillRect(-5, -4, 3, 8); c.fillStyle = DC.ITEMS[P.equip.back.id].ic[1]; c.fillRect(-5, -3, 2, 6); }
    // arms and weapon
    let swing = 0; if (P.swing) { const k = P.swing.t / P.swing.dur; swing = (k - 0.35) * 2.2; }
    c.fillStyle = '#0a0a0a'; c.fillRect(1, -6, 6, 3); c.fillRect(1, 3, 6, 3);
    c.fillStyle = '#c9a283'; c.fillRect(2, -5, 5, 1); c.fillRect(2, 4, 5, 1);
    const h = P.hand; if (h) {
      const d = DC.ITEMS[h.id]; c.save(); c.translate(5, 4); c.rotate(P.swing ? swing : 0);
      const len = d.wp ? 6 + (d.wp.rng || 20) * 0.28 : 6; const col = d.ic[1];
      if (d.wp && d.wp.ranged) { c.fillStyle = '#0a0a0a'; c.fillRect(0, -1, 8, 3); c.fillStyle = '#44484e'; c.fillRect(1, 0, 7, 1); }
      else { c.fillStyle = '#0a0a0a'; c.fillRect(0, -1.5, len + 1, 3); c.fillStyle = col; c.fillRect(0, -0.5, len, 1.2); c.fillStyle = d.ic[2]; c.fillRect(len - 2, -1, 2, 2); }
      c.restore();
    }
    // head
    c.fillStyle = '#0a0a0a'; c.beginPath(); c.arc(1, 0, 4.4, 0, 6.3); c.fill();
    c.fillStyle = '#c9a283'; c.beginPath(); c.arc(1, 0, 3.4, 0, 6.3); c.fill();
    c.fillStyle = P.equip.head ? DC.ITEMS[P.equip.head.id].ic[1] : '#3a2a20'; c.beginPath(); c.arc(0, 0, 3.4, 1.6, 4.7); c.fill();
    c.restore();
  }
  const ZCOL = [['#566349', '#4a3e34', '#3a4a5a'], ['#5f6a52', '#5a3a34', '#44444a'], ['#6a7060', '#3a4438', '#5a5030'], ['#566a5a', '#4a4a3a', '#583a44']];
  function drawZombie(c, z, x, y, S) {
    const sc = z.type === 'brute' ? 1.4 : z.type === 'runner' ? 0.92 : 1, alert = z.state === 'chase' || z.state === 'attack';
    const col = ZCOL[z.var % 4], anim = z.anim || 0;
    c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(x, y + 3, 6 * sc, 3.2 * sc, 0, 0, 6.3); c.fill();
    c.save(); c.translate(x, y); c.rotate((z.face || 0) + Math.sin(anim * 0.8) * (z.type === 'runner' ? 0.05 : 0.12)); c.scale(sc, sc);
    const leg = Math.sin(anim * (z.type === 'runner' ? 2.2 : 1.2)) * 2.5;
    c.fillStyle = '#0a0a0a'; c.fillRect(-4 + leg, -4, 5, 3); c.fillRect(-4 - leg, 1, 5, 3);
    c.fillStyle = col[2]; c.fillRect(-3 + leg, -3, 4, 2); c.fillRect(-3 - leg, 2, 4, 2);
    const flash = z.flash > 0;
    outlineRect(c, -3, -5, 6, 10, flash ? '#e8e8e0' : col[1]);
    c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(-2, -2, 3, 1); c.fillRect(0, 2, 2, 1);
    const reach = alert ? 8 : 5;
    c.fillStyle = '#0a0a0a'; c.fillRect(1, -6.5, reach, 3); c.fillRect(1, 3.5, reach, 3);
    c.fillStyle = flash ? '#fff' : col[0]; c.fillRect(2, -5.5, reach - 1, 1.3); c.fillRect(2, 4.5, reach - 1, 1.3);
    c.fillStyle = '#0a0a0a'; c.beginPath(); c.arc(0.5, 0, 4.4, 0, 6.3); c.fill();
    c.fillStyle = flash ? '#fff' : col[0]; c.beginPath(); c.arc(0.5, 0, 3.4, 0, 6.3); c.fill();
    c.fillStyle = '#2a2a24'; c.fillRect(-2.5, -1.5, 2.5, 3);
    c.fillStyle = alert ? '#e8d050' : '#a8a888'; c.fillRect(2, -2, 1, 1); c.fillRect(2, 1, 1, 1);
    c.restore();
    if (z.state === 'hear' || z.state === 'search') this_marks.push([x, y - 12 * sc, '?', '#e8d050']);
    else if (alert) this_marks.push([x, y - 12 * sc, '!', '#e0503a']);
  }
  let this_marks = [];
  function drawNPC(c, n, x, y) {
    c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(x, y + 3, 6, 3, 0, 0, 6.3); c.fill();
    c.save(); c.translate(x, y); c.rotate(n.face || 0);
    const cols = { marta: '#a86a3a', dale: '#4a6a8a', jun: '#7a4a7a' }, bc = cols[n.id] || '#6a6a3a';
    if (n.sleeping) c.rotate(1.57);
    outlineRect(c, -3, -5, 6, 10, bc); c.fillStyle = '#0a0a0a'; c.beginPath(); c.arc(1, 0, 4.4, 0, 6.3); c.fill(); c.fillStyle = '#d0a888'; c.beginPath(); c.arc(1, 0, 3.4, 0, 6.3); c.fill(); c.fillStyle = '#d8d8d8'; c.beginPath(); c.arc(0, 0, 3.4, 1.6, 4.7); c.fill();
    c.restore();
    c.fillStyle = '#6fb86f'; c.fillRect(x - 1, y - 11, 3, 3); c.fillStyle = '#0a0a0a'; c.fillRect(x, y - 10, 1, 1);
  }
  function drawAnimal(c, a, x, y) {
    const w = Math.sin(a.anim * 6) * (a.moving ? 1 : 0.4);
    c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(x, y + 2, 5, 2.5, 0, 0, 6.3); c.fill();
    c.save(); c.translate(x, y); c.rotate(a.face || 0);
    if (a.kind === 'dog') { c.fillStyle = '#0a0a0a'; c.fillRect(-5, -3, 10, 6); c.fillStyle = '#8a6a44'; c.fillRect(-4, -2, 8, 4); c.fillStyle = '#6a4e30'; c.fillRect(-1, -2, 3, 4); c.fillStyle = '#0a0a0a'; c.fillRect(4, -2.5, 4, 5); c.fillStyle = '#8a6a44'; c.fillRect(4, -1.5, 3, 3); c.fillStyle = '#3a2a1a'; c.fillRect(7, -1, 1, 2); c.fillStyle = '#8a6a44'; c.fillRect(-7, -1 + w, 3, 1.5); if (a.follow) { c.fillStyle = '#b83a32'; c.fillRect(3, -3, 1, 6); } }
    else if (a.kind === 'cat') { c.fillStyle = '#0a0a0a'; c.fillRect(-4, -2.5, 8, 5); c.fillStyle = '#6a6a72'; c.fillRect(-3, -1.5, 6, 3); c.fillStyle = '#0a0a0a'; c.fillRect(3, -2.5, 3, 5); c.fillStyle = '#6a6a72'; c.fillRect(3, -1.5, 2, 3); c.fillRect(-6, -1 + w, 3, 1); }
    else { c.fillStyle = '#0a0a0a'; c.fillRect(-3, -3, 6, 6); c.fillStyle = '#e8e4d8'; c.fillRect(-2, -2, 4, 4); c.fillStyle = '#0a0a0a'; c.fillRect(2, -1.5, 3, 3); c.fillStyle = '#e8e4d8'; c.fillRect(2, -0.5, 2, 2); c.fillStyle = '#c8402a'; c.fillRect(3, -1, 1, 1); c.fillStyle = '#d8a030'; c.fillRect(5, 0, 1, 1); }
    c.restore();
    if (a.alert > 0) this_marks.push([x, y - 9, '!', '#e0503a']);
  }
  function drawBody(c, b, x, y) {
    c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(x, y + 1, 7, 4, 0, 0, 6.3); c.fill();
    c.save(); c.translate(x, y); c.rotate(b.face || 0);
    const col = ZCOL[(b.var || 0) % 4]; c.fillStyle = '#0a0a0a'; c.fillRect(-7, -4, 12, 8); c.fillStyle = col[1]; c.fillRect(-6, -3, 10, 6); c.fillStyle = col[2]; c.fillRect(-9, -2, 4, 4); c.fillStyle = '#0a0a0a'; c.beginPath(); c.arc(6, 0, 3.8, 0, 6.3); c.fill(); c.fillStyle = col[0]; c.beginPath(); c.arc(6, 0, 3, 0, 6.3); c.fill();
    c.restore();
    if (!b.looted) { c.fillStyle = 'rgba(232,208,120,' + (0.5 + 0.4 * Math.sin(rt * 4)) + ')'; c.fillRect(x - 1, y - 8, 2, 2); }
  }

  // ---------- main frame ----------
  R.frame = function (dt) {
    const S = DC.S; if (!S) return;
    const t0 = performance.now(); rt += dt; flick = 0.85 + Math.random() * 0.3;
    const P = S.player, cam = R.cam, vw = R.vw, vh = R.vh;
    // camera
    const lx = P.x + Math.cos(P.aim) * (P.aimT > 0 ? 14 : 4), ly = P.y + Math.sin(P.aim) * (P.aimT > 0 ? 14 : 4);
    const k = 1 - Math.exp(-dt * 6);
    cam.x += (lx - cam.x) * k; cam.y += (ly - cam.y) * k;
    if (Math.abs(cam.x - P.x) > 220 || Math.abs(cam.y - P.y) > 220) { cam.x = P.x; cam.y = P.y; }
    shake = Math.max(0, shake - dt * 14);
    const sx = shake ? (Math.random() - 0.5) * shake : 0, sy = shake ? (Math.random() - 0.5) * shake : 0;
    const camX = Math.round(cam.x - vw / 2 + sx), camY = Math.round(cam.y - vh / 2 + sy);
    R.camX = camX; R.camY = camY;
    const rng = computeVision(S);
    ctx.fillStyle = '#0b0d0c'; ctx.fillRect(0, 0, vw, vh);
    // chunks
    const cx0 = Math.max(0, Math.floor(camX / (T * 16)) - 0), cx1 = Math.min(NC - 1, Math.floor((camX + vw) / (T * 16))), cy0 = Math.max(0, Math.floor(camY / (T * 16))), cy1 = Math.min(NC - 1, Math.floor((camY + vh) / (T * 16)));
    let bakes = 0; const overs = [];
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      let ch = Tl.get(cx, cy, false);
      if (!ch || ch.ver !== W.ver[cy * NC + cx]) { if (bakes < 3 || !ch) { ch = Tl.get(cx, cy, true); bakes++; } }
      if (!ch) continue;
      ctx.drawImage(ch.base, cx * T * 16 - Tl.PAD - camX, cy * T * 16 - Tl.PAD - camY);
      if (ch.over) overs.push(ch);
    }
    // prefetch neighbours
    if (bakes < 1) { const pcx = Math.floor(P.x / (T * 16)), pcy = Math.floor(P.y / (T * 16)); outer: for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const x = pcx + dx, y = pcy + dy; if (x < 0 || y < 0 || x >= NC || y >= NC) continue; const ch = Tl.get(x, y, false); if (!ch || ch.ver !== W.ver[y * NC + x]) { Tl.get(x, y, true); break outer; } } }
    Tl.unloadFar(Math.floor(P.x / (T * 16)), Math.floor(P.y / (T * 16)), 3);
    const x0t = Math.floor(camX / T) - 1, y0t = Math.floor(camY / T) - 1, x1t = Math.ceil((camX + vw) / T) + 1, y1t = Math.ceil((camY + vh) / T) + 1;
    const view = (x, y, m) => x > camX - m && y > camY - m && x < camX + vw + m && y < camY + vh + m;
    const vis = (x, y) => R.isVis(Math.floor(x / T), Math.floor(y / T));
    this_marks = [];
    // dynamic state overlays: campfires, tripwire etc drawn in base; flames dynamic
    for (let ty = Math.max(0, y0t); ty <= Math.min(N - 1, y1t); ty++) for (let tx = Math.max(0, x0t); tx <= Math.min(N - 1, x1t); tx++) {
      const o = W.o[ty * N + tx]; if (o === O.CAMPFIRE) { const s = W.st.get(ty * N + tx); if (s && s.fuel > 0) { const x = tx * T - camX + 8, y = ty * T - camY + 8; ctx.fillStyle = '#e8641e'; ctx.fillRect(x - 3, y - 4 - Math.random() * 2, 6, 6); ctx.fillStyle = '#f0b030'; ctx.fillRect(x - 2, y - 3, 4, 4); ctx.fillStyle = '#fff0a0'; ctx.fillRect(x - 1, y - 1, 2, 2); } }
      else if (o === O.BEACON && beaconOn(ty * N + tx)) { const x = tx * T - camX + 8, y = ty * T - camY; if (((rt * 2) | 0) % 2) { ctx.fillStyle = '#ff3a30'; ctx.fillRect(x - 1, y, 2, 2); } }
      else if (o === O.LAMP && S.amb < 0.55 && W.flagLamp !== false && S.flags.power) { ctx.fillStyle = '#ffe9a0'; ctx.fillRect(tx * T - camX + 7, ty * T - camY + 3, 2, 2); }
    }
    // bodies
    for (const b of S.bodies) if (b.alive && view(b.x, b.y, 12) && vis(b.x, b.y)) drawBody(ctx, b, b.x - camX, b.y - camY);
    // ground items
    for (const g of DC.groundPool) if (g.alive && view(g.x, g.y, 10) && vis(g.x, g.y)) {
      const x = Math.round(g.x - camX), y = Math.round(g.y - camY);
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(x - 5, y + 3, 10, 2);
      ctx.drawImage(DC.iconCanvas(g.it.id), x - 6, y - 7, 12, 12);
      if (((rt * 3 + g.x) | 0) % 5 === 0) { ctx.fillStyle = '#fff6c0'; ctx.fillRect(x + 4, y - 7, 1, 1); }
    }
    // thrown, clocks
    for (const t of S.thrown) { const k2 = Math.min(1, t.t), x = P.x + (t.tx - P.x) * k2 - camX, y = P.y + (t.ty - P.y) * k2 - camY - Math.sin(k2 * 3.14) * 10; ctx.fillStyle = '#c8c8c8'; ctx.fillRect(x - 1.5, y - 1.5, 3, 3); }
    for (const c of S.clocks) { const x = c.x - camX, y = c.y - camY; ctx.fillStyle = '#a83a32'; ctx.fillRect(x - 3, y - 3, 6, 6); ctx.fillStyle = '#e8e8e0'; ctx.fillRect(x - 2, y - 2, 4, 4); if (((rt * 8) | 0) % 2) { ctx.strokeStyle = '#e8d050'; ctx.strokeRect(x - 5.5, y - 5.5, 11, 11); } }
    // build ghost
    if (S.build) {
      const b = S.build, x = b.tx * T - camX, y = b.ty * T - camY, ok = b.valid;
      ctx.fillStyle = ok ? 'rgba(110,200,110,.35)' : 'rgba(210,70,60,.4)'; ctx.fillRect(x, y, T, T);
      ctx.strokeStyle = ok ? '#8fe08f' : '#e0604a'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, T - 1, T - 1);
      ctx.strokeStyle = 'rgba(255,255,255,.12)'; const gx = Math.floor(P.x / T), gy = Math.floor(P.y / T);
      for (let a = -4; a <= 5; a++) { ctx.beginPath(); ctx.moveTo((gx + a) * T - camX + 0.5, (gy - 4) * T - camY); ctx.lineTo((gx + a) * T - camX + 0.5, (gy + 5) * T - camY); ctx.stroke(); ctx.beginPath(); ctx.moveTo((gx - 4) * T - camX, (gy + a) * T - camY + 0.5); ctx.lineTo((gx + 5) * T - camX, (gy + a) * T - camY + 0.5); ctx.stroke(); }
    }
    // focus
    const f = S.focus; if (f && !P.dead) {
      const fxx = f.kind === 'tile' ? f.tx * T - camX : f.x - camX - 8, fyy = f.kind === 'tile' ? f.ty * T - camY : f.y - camY - 8, a = 0.6 + 0.4 * Math.sin(rt * 6);
      ctx.fillStyle = 'rgba(255,230,140,' + a + ')';
      for (const [ax, ay] of [[0, 0], [13, 0], [0, 13], [13, 13]]) { ctx.fillRect(fxx + ax, fyy + ay, 3, 1); ctx.fillRect(fxx + ax + (ax ? 2 : 0), fyy + ay + (ay ? -2 : 0), 1, 3); }
    }
    // noise rings
    if (DC.settings.noiseRing) for (const n of S.noiseLog) {
      const age = S.rt - n.t; if (age > 0.9 || age < 0) continue; if (n.src === 'step' && n.r < 2) continue;
      const rr = n.r * T * Math.min(1, age / 0.5); ctx.strokeStyle = 'rgba(240,200,90,' + (0.35 * (1 - age / 0.9)) + ')'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(n.x - camX, n.y - camY, rr, 0, 6.3); ctx.stroke();
    }
    // entities y-sorted
    const ents = [];
    for (const z of DC.Z.pool) { if (!z.alive || z.dormant) { continue; } if (z.flash > 0) {} if (!view(z.x, z.y, 14)) { z.vis = false; continue; } const v = vis(z.x, z.y); z.vis = v; if (v) ents.push({ y: z.y, k: 0, o: z }); }
    for (const a of S.animals) if (view(a.x, a.y, 10) && vis(a.x, a.y)) ents.push({ y: a.y, k: 1, o: a });
    for (const n of S.npcs) if (view(n.x, n.y, 10) && vis(n.x, n.y)) ents.push({ y: n.y, k: 2, o: n });
    ents.push({ y: P.y, k: 3, o: P });
    ents.sort((a, b) => a.y - b.y);
    for (const e of ents) {
      const x = Math.round(e.o.x - camX), y = Math.round(e.o.y - camY);
      if (e.k === 0) drawZombie(ctx, e.o, x, y, S); else if (e.k === 1) drawAnimal(ctx, e.o, x, y); else if (e.k === 2) drawNPC(ctx, e.o, x, y); else {
        if (!P.dead) drawPlayer(ctx, P, x, y, S); else { ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(x - 6, y - 2, 12, 5); ctx.fillStyle = '#58626e'; ctx.fillRect(x - 5, y - 2, 9, 4); }
      }
    }
    // helicopter
    if (S.heli) { const hx = S.heli.x - camX, hy = S.heli.y - camY; ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(hx - 18, hy - 5, 40, 16); ctx.fillStyle = '#2f3a2e'; ctx.fillRect(hx - 16, hy - 8, 32, 14); ctx.fillStyle = '#4a5a48'; ctx.fillRect(hx - 14, hy - 7, 24, 5); ctx.fillStyle = '#1a2428'; ctx.fillRect(hx + 8, hy - 6, 6, 8); ctx.fillStyle = '#2f3a2e'; ctx.fillRect(hx - 32, hy - 3, 18, 3); const ra = rt * 30; ctx.strokeStyle = 'rgba(200,200,200,.5)'; ctx.beginPath(); ctx.moveTo(hx - Math.cos(ra) * 24, hy - 1 - Math.sin(ra) * 24 * 0.5); ctx.lineTo(hx + Math.cos(ra) * 24, hy - 1 + Math.sin(ra) * 24 * 0.5); ctx.stroke(); ctx.beginPath(); ctx.moveTo(hx + Math.sin(ra) * 24, hy - 1 - Math.cos(ra) * 12); ctx.lineTo(hx - Math.sin(ra) * 24, hy - 1 + Math.cos(ra) * 12); ctx.stroke(); }
    // canopies (trees)
    for (const ch of overs) ctx.drawImage(ch.over, ch.cx * T * 16 - Tl.PAD - camX, ch.cy * T * 16 - Tl.PAD - camY);
    // roofs
    for (const b of W.buildings) {
      const bx = b.x * T, by = b.y * T, bw = b.w * T, bh = b.h * T;
      if (bx > camX + vw || by > camY + vh || bx + bw < camX || by + bh < camY) continue;
      const target = P.inBld === b ? 0 : 1; b.roofA += (target - b.roofA) * Math.min(1, dt * 7);
      if (b.roofA < 0.02) continue;
      const pat = roofPattern(b.roof);
      ctx.globalAlpha = b.roofA;
      ctx.save(); ctx.translate(-camX, -camY); ctx.fillStyle = pat; ctx.fillRect(bx + T, by + T, bw - 2 * T, bh - 2 * T);
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(bx + T, by + T, bw - 2 * T, 2); ctx.fillRect(bx + T, by + T, 2, bh - 2 * T);
      ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(bx + T, by + bh - T - 2, bw - 2 * T, 2);
      // ridge
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(bx + T, by + (bh >> 1), bw - 2 * T, 1);
      if (b.type === 'fire' || b.type === 'police' || b.type === 'hospital') { ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(bx + (bw >> 1) - 6, by + (bh >> 1) - 1, 12, 3); if (b.type === 'hospital') { ctx.fillStyle = '#c8402e'; ctx.fillRect(bx + (bw >> 1) - 1, by + (bh >> 1) - 6, 3, 12); ctx.fillRect(bx + (bw >> 1) - 6, by + (bh >> 1) - 1, 12, 3); } }
      ctx.restore(); ctx.globalAlpha = 1;
    }
    // particles
    for (const p of DC.fx.p) {
      if (!p.a) continue; const x = p.x - camX, y = p.y - camY; if (x < -4 || y < -4 || x > vw + 4 || y > vh + 4) continue;
      const a = Math.min(1, p.life / p.max * (p.kind === 2 ? 0.6 : 1.4)); ctx.globalAlpha = a; ctx.fillStyle = p.col; const s = p.size * (p.kind === 2 ? 1 + (1 - p.life / p.max) : 1); ctx.fillRect(x - s / 2, y - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
    for (const tr of DC.fx.tracers) { ctx.strokeStyle = 'rgba(255,240,170,' + (tr.t / 0.09) + ')'; ctx.beginPath(); ctx.moveTo(tr.x1 - camX, tr.y1 - camY); ctx.lineTo(tr.x2 - camX, tr.y2 - camY); ctx.stroke(); }
    // aim indicator
    if (!P.dead && !S.build && !S.sleeping && (S.rt - P.aimT < 1.4 || DC.inp.aim.active)) {
      const ax = P.x - camX + Math.cos(P.aim) * 22, ay = P.y - camY + Math.sin(P.aim) * 22; ctx.save(); ctx.translate(ax, ay); ctx.rotate(P.aim); ctx.fillStyle = 'rgba(240,230,200,.6)'; ctx.fillRect(0, -1, 3, 2); ctx.fillRect(-2, -3, 2, 1); ctx.fillRect(-2, 2, 2, 1); ctx.restore();
    }
    // light + fog
    renderLight(S, camX, camY, rng);
    renderFog(S, camX, camY, x0t, y0t, x1t, y1t, rng);
    renderWeather(S, dt);
    // marks (?, !) above fog
    ctx.font = 'bold 8px monospace'; ctx.textAlign = 'center';
    for (const m of this_marks) { ctx.fillStyle = '#000'; ctx.fillText(m[2], m[0] + 1, m[1] + 1); ctx.fillStyle = m[3]; ctx.fillText(m[2], m[0], m[1]); }
    for (const t of DC.fx.texts) if (t.a) { ctx.globalAlpha = Math.min(1, t.life * 2); ctx.fillStyle = '#000'; ctx.fillText(t.s, t.x - camX + 1, t.y - camY + 1); ctx.fillStyle = t.col; ctx.fillText(t.s, t.x - camX, t.y - camY); }
    ctx.globalAlpha = 1;
    // vignette + damage
    if (P.dmgFlash > 0) { ctx.fillStyle = 'rgba(160,20,20,' + Math.min(0.45, P.dmgFlash * 0.5) + ')'; ctx.fillRect(0, 0, vw, vh); }
    const low = Math.max(0, 1 - P.hp / 40) * 0.5 + (P.stress > 70 ? (P.stress - 70) / 100 : 0);
    const vg = ctx.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.35, vw / 2, vh / 2, Math.max(vw, vh) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,' + (0.45 + low * 0.4 + (S.sleeping ? 0.4 : 0)) + ')');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, vw, vh);
    if (S.lightning > 0) { ctx.fillStyle = 'rgba(220,230,255,' + Math.min(0.7, S.lightning * 0.8) + ')'; ctx.fillRect(0, 0, vw, vh); }
    // minimap
    mmT -= dt; if (mmT <= 0) { mmT = 0.25; drawMinimap(S); }
    // perf
    frameMs += (performance.now() - t0 - frameMs) * 0.1; fpsAcc += dt; fpsN++;
    if (fpsAcc >= 0.5) { fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; }
    R.fps = fps; R.ms = frameMs;
  };

  function beaconOn(i) { const s = W.st.get(i); return !!(s && s.active); }
  function roofPattern(col) {
    if (roofPat[col]) return roofPat[col];
    const c = document.createElement('canvas'); c.width = c.height = 16; const x = c.getContext('2d');
    x.fillStyle = col; x.fillRect(0, 0, 16, 16);
    for (let k = 0; k < 4; k++) { x.fillStyle = 'rgba(0,0,0,.2)'; x.fillRect(0, k * 4 + 3, 16, 1); x.fillStyle = 'rgba(255,255,255,.06)'; x.fillRect(0, k * 4, 16, 1); x.fillStyle = 'rgba(0,0,0,.15)'; x.fillRect((k * 7) % 16, k * 4, 1, 3); }
    return (roofPat[col] = ctx.createPattern(c, 'repeat'));
  }

  function renderLight(S, camX, camY, rng) {
    const P = S.player, vw = R.vw, vh = R.vh;
    const amb = P.indoors ? S.ambIn : S.amb;
    let dark = Math.pow(1 - amb, 1.15) * 0.9;
    dark = Math.min(0.88, dark + (S.weather.rain * 0.08) + S.weather.fog * 0.05);
    if (S.sleeping) dark = Math.min(0.97, dark + 0.3);
    if (dark < 0.02) return;
    lctx.globalCompositeOperation = 'source-over'; lctx.clearRect(0, 0, vw, vh);
    const hr = (S.t / 60) % 24; const dusk = (hr > 17 && hr < 21) || (hr > 4.5 && hr < 7.5);
    lctx.fillStyle = dusk ? 'rgba(26,18,32,' + dark + ')' : 'rgba(6,10,24,' + dark + ')'; lctx.fillRect(0, 0, vw, vh);
    lctx.globalCompositeOperation = 'destination-out';
    const glow = (x, y, r, a, hard) => { x -= camX; y -= camY; if (x < -r || y < -r || x > vw + r || y > vh + r) return; const g = lctx.createRadialGradient(x, y, r * (hard || 0.15), x, y, r); g.addColorStop(0, 'rgba(0,0,0,' + a + ')'); g.addColorStop(1, 'rgba(0,0,0,0)'); lctx.fillStyle = g; lctx.fillRect(x - r, y - r, r * 2, r * 2); };
    glow(P.x, P.y, 46, 0.85);
    const h = P.hand;
    if (P.ownLight > 0 && h) {
      const L = DC.ITEMS[h.id].light;
      if (L.fire) glow(P.x, P.y, L.r * flick, 0.95); else {
        glow(P.x, P.y, 34, 0.9);
        lctx.save(); lctx.translate(P.x - camX, P.y - camY); lctx.rotate(P.aim); const g = lctx.createRadialGradient(0, 0, 4, 0, 0, L.r + 20); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.7, 'rgba(0,0,0,.8)'); g.addColorStop(1, 'rgba(0,0,0,0)'); lctx.fillStyle = g; lctx.beginPath(); lctx.moveTo(0, 0); lctx.arc(0, 0, L.r + 20, -0.42, 0.42); lctx.closePath(); lctx.fill(); lctx.restore();
      }
    }
    // campfires / lamps / buildings
    const x0 = Math.floor(camX / T) - 6, y0 = Math.floor(camY / T) - 6, x1 = Math.ceil((camX + vw) / T) + 6, y1 = Math.ceil((camY + vh) / T) + 6;
    for (const l of W.lamps) { if (l[0] < x0 || l[0] > x1 || l[1] < y0 || l[1] > y1) continue; if (S.flags.power && W.o[l[1] * N + l[0]] === O.LAMP) glow(l[0] * T + 8, l[1] * T + 4, 58, 0.85); }
    for (let ty = Math.max(0, y0); ty <= Math.min(N - 1, y1); ty++) for (let tx = Math.max(0, x0); tx <= Math.min(N - 1, x1); tx++) {
      const o = W.o[ty * N + tx]; if (o === O.CAMPFIRE) { const s = W.st.get(ty * N + tx); if (s && s.fuel > 0) glow(tx * T + 8, ty * T + 8, 78 * flick, 1); }
      else if (o === O.BEACON && beaconOn(ty * N + tx)) glow(tx * T + 8, ty * T + 4, 40, 0.7);
    }
    if (S.flags.power) for (const b of W.buildings) {
      if (b.x * T > camX + vw || b.y * T > camY + vh || (b.x + b.w) * T < camX || (b.y + b.h) * T < camY) continue;
      if (b.powered === false || (P.inBld !== b && b.type === 'house' && !b.lit)) continue;
      if (P.inBld === b) { lctx.fillStyle = 'rgba(0,0,0,.55)'; lctx.fillRect(b.x * T - camX, b.y * T - camY, b.w * T, b.h * T); }
    }
    for (const a of S.alarms) { if (!(a.alarmOn > 0) || ((rt * 4) | 0) % 2) continue; if (a.w !== undefined) glow((a.x + a.w / 2) * T, (a.y + a.h / 2) * T, 50, 0.5); else glow((a.x + 1) * T, (a.y + 0.5) * T, 34, 0.7); }
    if (S.heli && S.heli.landed || S.heli) glow(S.heli.x, S.heli.y, 80, 0.7);
    if (DC.fx.light) glow(DC.fx.light.x, DC.fx.light.y, 50, 1);
    lctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(lcv, 0, 0);
    // warm color glow
    ctx.globalCompositeOperation = 'lighter';
    const warm = (x, y, r, a) => { x -= camX; y -= camY; if (x < -r || y < -r || x > vw + r || y > vh + r) return; const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(255,150,60,' + a + ')'); g.addColorStop(1, 'rgba(255,150,60,0)'); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); };
    if (dark > 0.25) {
      for (let ty = Math.max(0, y0); ty <= Math.min(N - 1, y1); ty++) for (let tx = Math.max(0, x0); tx <= Math.min(N - 1, x1); tx++) { if (W.o[ty * N + tx] === O.CAMPFIRE) { const s = W.st.get(ty * N + tx); if (s && s.fuel > 0) warm(tx * T + 8, ty * T + 8, 60 * flick, 0.22 * dark); } }
      if (P.ownLight > 0 && h && DC.ITEMS[h.id].light.fire) warm(P.x, P.y, 44 * flick, 0.2 * dark);
      if (P.ownLight > 0 && h && !DC.ITEMS[h.id].light.fire) { ctx.fillStyle = 'rgba(255,255,230,0)'; }
      for (const l of W.lamps) if (S.flags.power && l[0] >= x0 && l[0] <= x1 && l[1] >= y0 && l[1] <= y1) warm(l[0] * T + 8, l[1] * T + 4, 40, 0.1 * dark);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function renderFog(S, camX, camY, x0t, y0t, x1t, y1t, rng) {
    const mw = x1t - x0t + 1, mh = y1t - y0t + 1; if (mcv.width !== mw || mcv.height !== mh) { mcv.width = mw; mcv.height = mh; }
    const img = mctx.createImageData(mw, mh), d = img.data, P = S.player, px = P.x / T, py = P.y / T, disc = S.disc;
    for (let j = 0; j < mh; j++) for (let i = 0; i < mw; i++) {
      const tx = x0t + i, ty = y0t + j, o = (j * mw + i) * 4; let a;
      if (tx < 0 || ty < 0 || tx >= N || ty >= N) a = 255;
      else if (R.isVis(tx, ty)) { const dd = Math.hypot(tx + 0.5 - px, ty + 0.5 - py); const e = rng * 0.7; a = dd > e ? Math.min(210, (dd - e) / (rng * 0.3 + 0.01) * 210) : 0; if (disc[ty * N + tx] === 0) a = 0; }
      else a = disc[ty * N + tx] ? 150 : 238;
      d[o] = 4; d[o + 1] = 6; d[o + 2] = 9; d[o + 3] = a;
    }
    mctx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true; ctx.drawImage(mcv, x0t * T - camX + 0, y0t * T - camY + 0, mw * T, mh * T); ctx.imageSmoothingEnabled = false;
  }

  function renderWeather(S, dt) {
    const w = S.weather, vw = R.vw, vh = R.vh, P = S.player;
    if (w.fog > 0.05) { ctx.fillStyle = 'rgba(150,160,160,' + (w.fog * 0.28) + ')'; ctx.fillRect(0, 0, vw, vh); }
    if (w.rain > 0.05 && !P.indoors) {
      ctx.strokeStyle = 'rgba(170,190,215,' + (0.25 + w.rain * 0.25) + ')'; ctx.lineWidth = 1; ctx.beginPath();
      const n = Math.floor(rainP.length * w.rain), sl = 3 + w.wind * 6;
      for (let k = 0; k < n; k++) { const r = rainP[k]; r.y += dt * 2.2 * r.s; r.x -= dt * 0.25 * w.wind * r.s; if (r.y > 1) { r.y = 0; r.x = Math.random() * 1.2; } if (r.x < 0) r.x += 1.2; const x = r.x * vw, y = r.y * vh; ctx.moveTo(x, y); ctx.lineTo(x - sl * 0.4, y + 5 + sl * 0.5); }
      ctx.stroke();
    } else if (w.rain > 0.05 && P.indoors) { ctx.fillStyle = 'rgba(30,40,60,' + w.rain * 0.08 + ')'; ctx.fillRect(0, 0, vw, vh); }
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
  R.debugText = function () {
    const S = DC.S, Z = DC.Z; if (!S) return '';
    return 'FPS ' + R.fps.toFixed(0) + '  frame ' + R.ms.toFixed(1) + 'ms\nzoom ' + R.zs + '  view ' + R.vw + 'x' + R.vh + '\nzombies alive ' + Z.counts.alive + ' active ' + Z.counts.active + ' dormant ' + Z.counts.dormant + '\nchunks ' + Tl.chunks.size + '  particles ' + DC.fx.count + '\nplayer ' + (S.player.x / T).toFixed(1) + ',' + (S.player.y / T).toFixed(1) + '  noise ' + S.player.noiseR.toFixed(1) + '\nvis ' + (S.visRange || 0).toFixed(1) + '  amb ' + S.amb.toFixed(2) + '  t ' + DC.fmtClock(S.t);
  };
})();

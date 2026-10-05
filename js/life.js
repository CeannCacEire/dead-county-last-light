/* Dead County: Last Light - particles/fx, friendly animals, neutral survivors (NPCs). */
(function () {
  'use strict';
  const DC = window.DC, W = DC.W, T = 16, N = W.N, I = DC.ITEMS;
  const rnd = Math.random;

  // ---------- particle pool ----------
  const fx = (DC.fx = {});
  const PN = 480;
  fx.p = []; for (let k = 0; k < PN; k++) fx.p.push({ a: false });
  fx.texts = []; for (let k = 0; k < 24; k++) fx.texts.push({ a: false });
  fx.tracers = [];
  fx.count = 0;
  let pi = 0;
  function emit(x, y, vx, vy, life, col, size, kind, g) {
    let p = null;
    for (let k = 0; k < 8; k++) { const c = fx.p[pi]; pi = (pi + 1) % PN; if (!c.a) { p = c; break; } }
    if (!p) { p = fx.p[pi]; pi = (pi + 1) % PN; }
    p.a = true; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.life = life; p.max = life; p.col = col; p.size = size; p.kind = kind || 0; p.g = g || 0;
  }
  fx.emit = emit;
  fx.hit = function (x, y, a) {
    const gore = DC.settings.gore;
    const n = 6;
    for (let k = 0; k < n; k++) {
      const s = 25 + rnd() * 45, aa = a + (rnd() - 0.5) * 1.2;
      emit(x, y, Math.cos(aa) * s, Math.sin(aa) * s, 0.35 + rnd() * 0.25, gore ? (rnd() < 0.5 ? '#6a1f1f' : '#8a3030') : (rnd() < 0.5 ? '#9a9a90' : '#c8c8b8'), 1.5, 1);
    }
  };
  fx.puff = function (x, y, n) { for (let k = 0; k < n; k++) emit(x + (rnd() - 0.5) * 6, y + (rnd() - 0.5) * 6, (rnd() - 0.5) * 20, (rnd() - 0.5) * 20 - 6, 0.7 + rnd() * 0.5, '#6a6a60', 2.2, 2); };
  fx.spark = function (x, y, n) { for (let k = 0; k < n; k++) { const a = rnd() * 6.28, s = 30 + rnd() * 50; emit(x, y, Math.cos(a) * s, Math.sin(a) * s, 0.25 + rnd() * 0.2, rnd() < 0.5 ? '#ffd070' : '#ff9a40', 1.3, 3); } };
  fx.glass = function (x, y) { for (let k = 0; k < 14; k++) { const a = rnd() * 6.28, s = 20 + rnd() * 50; emit(x, y, Math.cos(a) * s, Math.sin(a) * s, 0.5 + rnd() * 0.4, rnd() < 0.5 ? '#bfe0ee' : '#8fb8c8', 1.3, 3); } };
  fx.dust = function (x, y) { emit(x, y, (rnd() - 0.5) * 6, -3, 0.5, '#8a8272', 1.5, 2); };
  fx.smoke = function (x, y) { emit(x + (rnd() - 0.5) * 2, y, (rnd() - 0.5) * 4, -12 - rnd() * 6, 1.4 + rnd() * 0.8, '#55524c', 2.5, 2); };
  fx.flash = function (x, y) { emit(x, y, 0, 0, 0.07, '#ffe9a8', 4, 3); fx.light = { x, y, t: 0.08 }; };
  fx.tracer = function (x1, y1, x2, y2) { fx.tracers.push({ x1, y1, x2, y2, t: 0.09 }); };
  fx.text = function (x, y, s, col) { const t = fx.texts.find((q) => !q.a) || fx.texts[0]; t.a = true; t.x = x; t.y = y; t.s = s; t.col = col || '#fff'; t.life = 0.9; };
  fx.update = function (dt) {
    let c = 0;
    for (const p of fx.p) {
      if (!p.a) continue; c++;
      p.life -= dt; if (p.life <= 0) { p.a = false; continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= Math.pow(0.12, dt * (p.kind === 2 ? 0.3 : 1)); p.vy *= Math.pow(0.12, dt * (p.kind === 2 ? 0.3 : 1));
    }
    fx.count = c;
    for (const t of fx.texts) if (t.a) { t.life -= dt; t.y -= 14 * dt; if (t.life <= 0) t.a = false; }
    for (let k = fx.tracers.length - 1; k >= 0; k--) { fx.tracers[k].t -= dt; if (fx.tracers[k].t <= 0) fx.tracers.splice(k, 1); }
    if (fx.light) { fx.light.t -= dt; if (fx.light.t <= 0) fx.light = null; }
  };

  // ---------- life ----------
  const Life = (DC.Life = {});
  Life.init = function () {
    const S = DC.S, R = DC.mulberry(W.seed + 303);
    S.animals = []; S.npcs = [];
    const mk = (kind, x, y) => S.animals.push({ kind, x: x * T + 8, y: y * T + 8, tx: x * T + 8, ty: y * T + 8, t: rnd() * 3, trust: kind === 'dog' ? 0 : 5, fed: 0, face: 0, follow: false, anim: rnd() * 5, egg: kind === 'chicken' ? rnd() < 0.5 : false, petT: 0, alert: 0 });
    // chickens at the farm
    for (let k = 0; k < 7; k++) { const p = W.randFree(179, 76, 200, 81, R, (x, y) => !W.o[y * N + x]); if (p) mk('chicken', p[0], p[1]); }
    // cats near houses
    for (let k = 0; k < 6; k++) { const h = W.houses[Math.floor(R() * W.houses.length)]; if (!h || h.safe) continue; const p = W.randFree(h.x - 2, h.y - 2, h.x + h.w + 2, h.y + h.h + 2, R, (x, y) => !W.o[y * N + x] && !W.bl[y * N + x]); if (p) mk('cat', p[0], p[1]); }
    // dogs: town streets and country
    for (let k = 0; k < 5; k++) { const p = W.randFree(60, 60, 166, 166, R, (x, y) => W.g[y * N + x] === DC.G.SIDEWALK && !W.o[y * N + x]); if (p) mk('dog', p[0], p[1]); }
    // dog near the safehouse
    const sf = W.safehouse; const sp = W.randFree(sf.x - 4, sf.y + sf.h, sf.x + sf.w + 4, sf.y + sf.h + 6, R, (x, y) => !W.o[y * N + x] && !W.bl[y * N + x]); if (sp) mk('dog', sp[0], sp[1]);
    // survivors
    DC.NPCS.forEach((def) => {
      const [kind, idx] = def.home.split(':');
      let b = kind === 'house' ? W.houses.filter((h) => !h.safe && !h.farm)[+idx] : W.buildings.filter((q) => q.type === 'warehouse')[+idx];
      if (!b) return;
      b.npc = true;
      const p = W.randFree(b.x + 1, b.y + 1, b.x + b.w - 1, b.y + b.h - 1, R, (x, y) => W.isIndoor(x, y) && !W.o[y * N + x]);
      if (p) S.npcs.push({ def, id: def.id, x: p[0] * T + 8, y: p[1] * T + 8, home: b, trust: 10, hunger: 60, tx: p[0] * T + 8, ty: p[1] * T + 8, t: 2, face: 0, anim: 0, gift: false, hinted: 0, talks: 0, fed: 0 });
    });
  };
  Life.update = function (dt) {
    const S = DC.S, P = S.player;
    for (const a of S.animals) {
      const dp = Math.hypot(P.x - a.x, P.y - a.y);
      if (dp > 60 * T && !a.follow) continue;
      a.anim += dt; a.t -= dt; a.petT = Math.max(0, a.petT - dt); a.alert = Math.max(0, a.alert - dt);
      let sp = 0;
      if (a.follow && a.kind === 'dog') {
        if (dp > 26) { a.tx = P.x + (rnd() - 0.5) * 16; a.ty = P.y + (rnd() - 0.5) * 16; sp = dp > 90 ? 62 : 34; }
        if (dp > 400) { a.x = P.x - 20; a.y = P.y; }
        // warn about nearby chasers
        for (const z of DC.Z.active) if (z.alive && z.state === 'chase' && Math.hypot(z.x - P.x, z.y - P.y) < 12 * T) { a.alert = 2; break; }
      } else {
        if (a.t <= 0) { a.t = 2 + rnd() * 5; if (rnd() < 0.55) { const ang = rnd() * 6.28, r = (2 + rnd() * 6) * T; a.tx = a.x + Math.cos(ang) * r; a.ty = a.y + Math.sin(ang) * r; } else { a.tx = a.x; a.ty = a.y; } }
        // flee from sprinting player / zombies for chicken and cat
        if ((a.kind === 'chicken' || a.kind === 'cat') && dp < 3.2 * T && P.stance === 'sprint') { const ang = Math.atan2(a.y - P.y, a.x - P.x); a.tx = a.x + Math.cos(ang) * 60; a.ty = a.y + Math.sin(ang) * 60; sp = 52; }
        else sp = a.kind === 'dog' ? 26 : 20;
        if (a.kind === 'dog' && a.trust > 10 && dp < 8 * T && dp > 22) { a.tx = P.x; a.ty = P.y; sp = 24; }
      }
      const dx = a.tx - a.x, dy = a.ty - a.y, d = Math.hypot(dx, dy);
      if (d > 3 && sp) { const m = Math.min(d, sp * dt); a.face = Math.atan2(dy, dx); a.moving = true; if (!DC.moveEnt(a, dx / d * m, dy / d * m, 3)) { a.t = 0; } } else a.moving = false;
      if (a.kind === 'chicken' && S.dayChanged) a.egg = rnd() < 0.6;
    }
    for (const n of S.npcs) {
      n.anim += dt; n.t -= dt;
      const hr = (S.t / 60) % 24;
      n.sleeping = hr >= 22.5 || hr < 6;
      if (n.sleeping) continue;
      if (n.t <= 0) {
        n.t = 3 + rnd() * 6;
        const b = n.home; const p = W.randFree(b.x + 1, b.y + 1, b.x + b.w - 1, b.y + b.h - 1, Math.random, (x, y) => W.isIndoor(x, y) && !W.o[y * N + x]);
        if (p && rnd() < 0.7) { n.tx = p[0] * T + 8; n.ty = p[1] * T + 8; } else { n.tx = n.x; n.ty = n.y; }
      }
      const dx = n.tx - n.x, dy = n.ty - n.y, d = Math.hypot(dx, dy);
      if (d > 3) { const m = Math.min(d, 18 * dt); n.face = Math.atan2(dy, dx); n.moving = true; if (!DC.moveEnt(n, dx / d * m, dy / d * m, 4)) n.t = 0; } else n.moving = false;
    }
  };
  Life.hourly = function () {
    const S = DC.S;
    for (const n of S.npcs) { n.hunger = Math.max(0, n.hunger - 2.2); if (n.hunger < 15) n.trust = Math.max(0, n.trust - 0.5); }
    for (const a of S.animals) a.fed = Math.max(0, a.fed - 1);
  };
  Life.pet = function (a) {
    const S = DC.S, P = S.player;
    if (a.petT > 0) { DC.log('Give it a moment.', 'info'); return; }
    a.petT = 10; a.trust = Math.min(100, a.trust + 4); P.stress = Math.max(0, P.stress - 8);
    DC.log(a.kind === 'dog' ? 'The dog leans into your hand.' : a.kind === 'cat' ? 'The cat purrs, just barely.' : 'The chicken clucks. Nervously.', 'good');
    DC.audio.sfx(a.kind === 'cat' ? 'purr' : 'pet');
    if (a.kind === 'chicken' && a.egg && a.trust >= 5) { a.egg = false; const it = DC.makeItem('egg', 1, Math.random); if (!DC.giveItem(it)) DC.dropAt(it, P.x, P.y); DC.log('Found a fresh egg.', 'good'); DC.emit('inv'); }
    if (a.kind === 'dog' && a.trust >= 50 && !a.follow) { a.follow = true; DC.log('The dog will follow you now.', 'good'); }
  };
  Life.feed = function (a) {
    const P = DC.S.player, h = P.hand; if (!h || I[h.id].cat !== 'food') return;
    if (a.fed > 6) { DC.log('It is full.', 'info'); return; }
    a.fed += 6; a.trust = Math.min(100, a.trust + 14); DC.removeItem(h, 1); DC.log('The ' + a.kind + ' eats gratefully.', 'good'); DC.audio.sfx('eat'); DC.emit('inv');
    if (a.kind === 'dog' && a.trust >= 40 && !a.follow) { a.follow = true; DC.log('The dog trusts you. It follows.', 'good'); }
  };
  Life.gift = function (n, it) {
    const d = I[it.id]; let v = 0;
    if (d.fd) v += (d.fd.h || 0) * 0.5; if (d.dr) v += 8; if (d.med) v += 10; if (d.cat === 'water') v += 6;
    if (d.fd && d.fd.sick) v *= 0.3;
    if (v <= 0) v = 1;
    n.trust = Math.min(100, n.trust + Math.min(20, v)); n.hunger = Math.min(100, n.hunger + (d.fd ? d.fd.h : 5));
    DC.removeItem(it, 1); DC.S.stats.gifts++; DC.emit('inv');
  };
})();

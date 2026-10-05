/* Dead County: Last Light - player movement, combat, interaction, building, item use. */
(function () {
  'use strict';
  const DC = window.DC, W = DC.W, O = DC.O, G = DC.G, OD = DC.OD, I = DC.ITEMS, T = 16, N = W.N;
  const Pl = (DC.Player = {});
  const FISTS = { dmg: [3, 5], rng: 13, arc: 0.7, cd: 0.55, st: 6, nz: 3, kb: 6, dur: 0 };
  const rnd = Math.random;

  DC.log = function (msg, kind) { DC.emit('log', msg, kind || 'info'); if (DC.S && DC.S.logHist) { DC.S.logHist.push([DC.S.t, msg]); if (DC.S.logHist.length > 80) DC.S.logHist.shift(); } };
  DC.addXP = function (id, amt) {
    const P = DC.S.player, sk = P.skills[id]; if (!sk || sk.lvl >= 10) return;
    let m = 1; if (P.traits.includes('learner')) m *= 1.4; if (P.traits.includes('slow')) m *= 0.75;
    sk.xp += amt * m;
    while (sk.lvl < 10 && sk.xp >= DC.xpNeed(sk.lvl)) {
      sk.xp -= DC.xpNeed(sk.lvl); sk.lvl++;
      DC.log(DC.SKILLS.find((s) => s.id === id).n + ' increased to ' + sk.lvl + '.', 'good'); DC.audio && DC.audio.sfx('levelup');
      DC.checkRecipes && DC.checkRecipes(true);
    }
  };
  DC.hasRecipe = function (r) {
    const P = DC.S.player, un = r.un;
    if (un === 'start') return true;
    if (P.known[r.id]) return true;
    if (un.skill && P.skills[un.skill].lvl >= un.lvl) return true;
    return false;
  };
  DC.checkRecipes = function (announce) {
    const P = DC.S.player;
    for (const r of DC.RECIPES.concat(DC.BUILDS)) {
      if (!P.known[r.id] && DC.hasRecipe(r) && r.un !== 'start') { P.known[r.id] = 1; if (announce) DC.log('New recipe: ' + r.n, 'good'); }
    }
  };

  // ---------- damage ----------
  Pl.protection = function () {
    const e = DC.S.player.equip, p = (s) => (e[s] ? I[e[s].id].prot || 0 : 0);
    return Math.min(0.75, p('body') + p('legs') * 0.5 + p('feet') * 0.2 + p('head') * 0.3);
  };
  DC.hurtPlayer = function (dmg, src, o) {
    const S = DC.S, P = S.player; if (P.dead) return;
    o = o || {};
    const prot = o.ignoreArmor ? 0 : Pl.protection();
    dmg *= (1 - prot);
    P.hp -= dmg; P.dmgFlash = 0.45; P.stress = Math.min(100, P.stress + 10); S.stats.damage += dmg;
    P.pain = Math.min(100, P.pain + dmg * 1.4);
    if (o.from) { const a = Math.atan2(P.y - o.from.y, P.x - o.from.x); DC.moveEnt(P, Math.cos(a) * 3, Math.sin(a) * 3, 4); }
    if (rnd() < (o.scratch || 0) * (1 - prot * 0.8)) {
      P.bleed = Math.min(3, P.bleed + 1); P.infRisk = Math.min(0.9, P.infRisk + 0.3);
      DC.log('You are bleeding.', 'bad');
    }
    if (rnd() < (o.sprain || 0)) { P.sprain = 1; DC.log('You twist your ankle.', 'bad'); }
    DC.audio && DC.audio.sfx('hurt');
    DC.fx.text(P.x, P.y - 12, '-' + Math.round(dmg), '#e0705a');
    Pl.cancelAct('hurt');
    S.lastHurt = src;
    if (P.hp <= 0) Pl.die(o.cause || ('killed by ' + src));
  };
  Pl.die = function (cause) {
    const S = DC.S, P = S.player; if (P.dead) return;
    P.hp = 0; P.dead = true; S.dead = { cause, t: S.t };
    DC.audio && DC.audio.sfx('death');
    DC.emit('death');
  };

  // ---------- tiles damage (zombies and player) ----------
  DC.damageTile = function (tx, ty, dmg, src) {
    const i = ty * N + tx, t = W.o[i], s = W.st.get(i); if (!s) return;
    if (t === O.DOOR || t === O.BGATE || t === O.WINDOW) {
      if (s.bar > 0) {
        s.bhp -= dmg; s.bar = Math.max(0, Math.ceil(s.bhp / 40)); if (s.bar === 0) s.bhp = 0;
        DC.audio && DC.audio.sfx('plank', tx * T, ty * T); if (src === 'player') DC.fx.spark(tx * T + 8, ty * T + 8, 4);
        if (s.bar === 0 && src === 'zombie') DC.log('A barricade gives way.', 'bad');
      } else if (t === O.WINDOW) {
        s.hp = (s.hp === undefined ? 30 : s.hp) - dmg;
        if (s.hp <= 0) { s.broken = true; s.open = true; DC.audio && DC.audio.sfx('glass', tx * T, ty * T); DC.fx.glass(tx * T + 8, ty * T + 8); DC.Z.noise(tx * T + 8, ty * T + 8, 22, 'glass'); if (src === 'player') DC.alarmCheck(s.bid, 'window'); else DC.log('A window shatters.', 'bad'); }
        else DC.audio && DC.audio.sfx('thud', tx * T, ty * T);
      } else {
        s.hp -= dmg; DC.audio && DC.audio.sfx('thud', tx * T, ty * T);
        if (s.hp <= 0) { s.broken = true; s.open = true; DC.audio && DC.audio.sfx('doorbreak', tx * T, ty * T); DC.Z.noise(tx * T + 8, ty * T + 8, 20, 'doorbreak'); if (src === 'player') DC.alarmCheck(s.bid, 'door'); else DC.log('A door splinters open.', 'bad'); }
      }
      s.dirty = 1; W.markDirty(tx, ty);
    } else if (t === O.BWALL || t === O.SPIKES) {
      s.hp = (s.hp === undefined ? 80 : s.hp) - dmg; DC.audio && DC.audio.sfx('plank', tx * T, ty * T);
      if (s.hp <= 0) { W.setTile(tx, ty, 0); W.st.delete(i); DC.log('A wall collapses.', 'bad'); }
    }
  };
  DC.alarmCheck = function (bid, how) {
    const b = W.buildings[bid]; if (b && b.alarm && !b.alarmOn) DC.triggerAlarm(b);
  };
  DC.triggerAlarm = function (b) {
    b.alarmOn = 70; DC.S.stats.alarms++; DC.log('An alarm starts blaring at ' + b.name + '.', 'bad'); DC.audio && DC.audio.sfx('alarmstart');
    DC.S.alarms.push(b);
  };

  // ---------- stances / movement ----------
  const SPEED = { walk: 38, sprint: 68, crouch: 24, sneak: 12 };
  Pl.update = function (dt) {
    DC.tripCheck(DC.S.player.x, DC.S.player.y, true);
    const S = DC.S, P = S.player, inp = DC.inp;
    if (P.dead) return;
    P.dmgFlash = Math.max(0, P.dmgFlash - dt);
    P.atkCd = Math.max(0, P.atkCd - dt);
    // sleeping handled elsewhere
    let mx = inp.move.x, my = inp.move.y, mag = Math.min(1, Math.hypot(mx, my));
    if (S.sleeping) { mx = my = mag = 0; }
    if (S.act && S.act.noMove) { mx = my = mag = 0; }
    const sprintWant = inp.sprint && mag > 0.2;
    const crouch = P.crouch;
    if (P.exhausted && P.stam > 22) P.exhausted = false;
    let stance = 'idle';
    if (mag > 0.1) {
      if (crouch) stance = (mag < 0.55 || inp.sprint) ? 'sneak' : 'crouch';
      else if (sprintWant && P.stam > 0 && !P.exhausted && !(P.bleed > 2)) stance = 'sprint';
      else stance = 'walk';
    }
    P.stance = stance;
    // speed
    let sp = 0;
    if (stance !== 'idle') sp = SPEED[stance === 'crouch' ? 'crouch' : stance];
    if (stance === 'walk') sp *= 0.55 + 0.45 * Math.min(1, mag / 0.8);
    const tx = Math.floor(P.x / T), ty = Math.floor(P.y / T), gi = ty * N + tx;
    const gt = W.g[gi], gi2 = DC.GINFO[gt], ot = W.o[gi];
    sp *= gi2.sp;
    if (ot === O.WINDOW) sp *= 0.45; if (ot === O.BUSH || ot === O.CROP) sp *= 0.75;
    const over = Math.max(0, DC.carryWeight() / DC.carryCap() - 1);
    sp *= 1 - Math.min(0.5, over * 0.9);
    if (P.sprain > 0) sp *= 0.7;
    if (P.fatigue > 80) sp *= 0.88; if (P.hp < 25) sp *= 0.88;
    if (P.hunger < 10 || P.thirst < 10) sp *= 0.92;
    if (P.stamMod) sp *= P.stamMod;
    if (mag > 0.1) {
      const ang = Math.atan2(my, mx);
      const nx = Math.cos(ang), ny = Math.sin(ang);
      const dx = nx * sp * dt, dy = ny * sp * dt;
      const ox = P.x, oy = P.y;
      DC.moveEnt(P, dx, dy, 4.2);
      P.moved = Math.hypot(P.x - ox, P.y - oy);
      P.face += DC.angDiff(ang, P.face) * Math.min(1, dt * 12);
      // footsteps & noise
      P.stepAcc += P.moved;
      const stepLen = stance === 'sprint' ? 20 : stance === 'sneak' ? 11 : 14;
      if (P.stepAcc >= stepLen) {
        P.stepAcc = 0;
        const r = Pl.stepNoise(stance, gt);
        P.noiseR = r;
        DC.audio && DC.audio.step(gi2.snd, stance, ot === O.WINDOW, { g: gt, inj: P.hp < 45 || P.pain > 40 || P.limp, enc: DC.carryWeight() > DC.carryCap() * 0.85 });
        if (r > 0.5) DC.Z.noise(P.x, P.y, r, 'step');
        S.stats.dist += stepLen / T;
      }
    } else P.moved = 0;
    P.noiseR *= Math.pow(0.4, dt); if (P.noiseR < 0.3) P.noiseR = 0;
    // stamina
    const sMax = P.maxStam;
    if (stance === 'sprint') {
      P.stam -= (19 + over * 20) * (1 - P.skills.fit.lvl * 0.035) * dt;
      if (P.stam <= 0) { P.stam = 0; P.exhausted = true; DC.log('You are out of breath.', 'warn'); }
      P.fatigueAdd = (P.fatigueAdd || 0) + dt * 0.35;
    } else {
      let reg = (stance === 'idle' ? 15 : stance === 'sneak' ? 11 : 9) * (1 + P.skills.fit.lvl * 0.04) * (P.traits.includes('athletic') ? 1.3 : 1);
      reg *= 1 - P.pain / 250; reg *= P.fatigue > 85 ? 0.6 : 1; reg *= P.hunger < 8 ? 0.5 : 1; reg *= P.stress > 85 ? 0.7 : 1;
      P.stam = Math.min(sMax, P.stam + reg * dt);
    }
    // aim
    const aimIdle = S.rt - P.aimT > 1.8;
    if (inp.aim.active) { P.aim = inp.aim.angle; P.aimT = S.rt; P.face += DC.angDiff(P.aim, P.face) * Math.min(1, dt * 14); }
    else if (aimIdle && mag > 0.1) P.aim = P.face;
    // trail
    S.trailT = (S.trailT || 0) - dt;
    if (S.trailT <= 0 && mag > 0.1) { S.trailT = 0.45; S.trail.push({ x: P.x, y: P.y, t: S.rt }); if (S.trail.length > 70) S.trail.shift(); }
    // animation
    P.anim += (stance === 'idle' ? 0 : dt * (stance === 'sprint' ? 11 : 7));
    // building mode, focus, actions
    Pl.updateAct(dt);
    S.focusT = (S.focusT || 0) - dt;
    if (S.focusT <= 0) { S.focusT = 0.08; Pl.updateFocus(); }
    if (S.build) Pl.updateBuild();
    // swing
    if (P.swing) {
      P.swing.t += dt;
      if (!P.swing.done && P.swing.t >= P.swing.hitAt) { P.swing.done = true; Pl.resolveMelee(P.swing.wp, P.swing.item); }
      if (P.swing.t >= P.swing.dur) P.swing = null;
    }
    if (inp.attackEdge) { inp.attackEdge = false; if (!S.build) Pl.attack(); }
    else if (inp.attackHeld && !S.build && P.atkCd <= 0) Pl.attack();
    // light flicker timers for hand items
    const h = P.hand;
    if (h && I[h.id].light && h.d !== undefined) {
      if (I[h.id].light.fire || P.lightOn) {
        h.d -= dt * (I[h.id].light.fire ? 1 : 0.6) / (S.dayScale || 1);
        if (h.d <= 0) { h.d = 0; if (I[h.id].light.fire) { DC.log('Your torch burns out.', 'warn'); DC.removeItem(h); } else { P.lightOn = false; DC.log('Flashlight battery is dead.', 'warn'); } }
      }
    }
  };
  Pl.stepNoise = function (stance, gt) {
    const P = DC.S.player, S = DC.S;
    let r = { sprint: 13, walk: 6.5, crouch: 3, sneak: 1.2 }[stance];
    r *= DC.GINFO[gt].nz;
    const wx = S.weather.type;
    r *= wx === 'storm' ? 0.55 : wx === 'rain' ? 0.75 : 1;
    r *= 1 - P.skills.stealth.lvl * 0.035;
    if (P.traits.includes('lightfoot')) r *= 0.8; if (P.traits.includes('clumsy')) r *= 1.25;
    const f = P.equip.feet; if (f) r *= I[f.id].quiet || 1;
    if (P.equip.back && I[P.equip.back.id].noisy) r *= 1.1;
    if (DC.carryWeight() > DC.carryCap()) r *= 1.2;
    if (P.stress > 80) r *= 1.1;
    return r;
  };

  // ---------- combat ----------
  Pl.weapon = function () {
    const h = DC.S.player.hand;
    if (h && I[h.id].wp) return I[h.id].wp;
    return FISTS;
  };
  Pl.attack = function () {
    const S = DC.S, P = S.player; if (P.atkCd > 0 || P.dead || S.sleeping) return;
    const h = P.hand, d = h && I[h.id];
    if (S.act) Pl.cancelAct('attack');
    // throw
    if (h && d.throw) { Pl.throwItem(h); return; }
    const wp = d && d.wp ? d.wp : FISTS;
    if (P.stam < 3) { DC.log('Too tired to swing.', 'warn'); return; }
    P.atkCd = wp.cd * (1 + P.fatigue / 300) * (1 - P.skills.melee.lvl * 0.012);
    P.stam = Math.max(0, P.stam - wp.st * (1 - P.skills.melee.lvl * 0.03));
    if (wp.ranged) {
      const ammo = DC.allItems().find((i) => i.id === wp.ammo);
      if (!ammo) { DC.audio && DC.audio.sfx('empty'); DC.log('Out of ammunition.', 'warn'); P.atkCd = 0.4; return; }
      DC.removeItem(ammo, 1);
      Pl.shoot(wp, h); return;
    }
    P.swing = { t: 0, hitAt: 0.11, dur: 0.32, wp, item: h, done: false, a: P.aim };
    P.face = P.aim;
    DC.audio && DC.audio.sfx('swing');
    DC.Z.noise(P.x, P.y, wp.nz * (1 - P.skills.stealth.lvl * 0.02), 'attack');
  };
  Pl.resolveMelee = function (wp, item) {
    const S = DC.S, P = S.player;
    let a = P.aim;
    const list = DC.Z.active.filter((z) => z.alive);
    // aim assist
    if (DC.settings.aimAssist) {
      let best = null, bd = 1e9;
      for (const z of list) { const dx = z.x - P.x, dy = z.y - P.y, d = Math.hypot(dx, dy); if (d > wp.rng + 8) continue; const da = Math.abs(DC.angDiff(Math.atan2(dy, dx), a)); if (da < 0.65 && d < bd) { bd = d; best = z; } }
      if (best) { a = Math.atan2(best.y - P.y, best.x - P.x); P.aim = a; P.face = a; P.swing && (P.swing.a = a); }
    }
    const hits = [];
    for (const z of list) {
      const dx = z.x - P.x, dy = z.y - P.y, d = Math.hypot(dx, dy);
      if (d > wp.rng + 5) continue;
      if (Math.abs(DC.angDiff(Math.atan2(dy, dx), a)) > wp.arc) continue;
      if (W.wallsBetween(Math.floor(P.x / T), Math.floor(P.y / T), Math.floor(z.x / T), Math.floor(z.y / T)) > 0) continue;
      hits.push([d, z]);
    }
    hits.sort((p, q) => p[0] - q[0]);
    let landed = 0;
    const maxT = wp.arc >= 0.7 ? 2 : 1;
    let acc = 0.82 + P.skills.melee.lvl * 0.02 - (P.stress > 70 ? 0.12 : 0) - (P.fatigue > 70 ? 0.08 : 0) - P.pain / 500;
    for (const [, z] of hits.slice(0, maxT)) {
      if (rnd() > acc) { DC.fx.text(z.x, z.y - 10, 'miss', '#9aa'); continue; }
      let dm = wp.dmg[0] + rnd() * (wp.dmg[1] - wp.dmg[0]);
      dm *= 1 + P.skills.melee.lvl * 0.06; if (P.traits.includes('strong')) dm *= 1.15; if (P.traits.includes('weak')) dm *= 0.85;
      if (P.stam < 12) dm *= 0.7;
      DC.Z.hit(z, dm, P.x, P.y, wp.kb || 6, { melee: true });
      landed++; DC.addXP('melee', 3);
      if (item && DC.maxDur(item)) { item.d -= wp.dur > 100 ? 0.5 : 1; if (item.d <= 0) { DC.log('Your ' + I[item.id].name + ' broke.', 'bad'); DC.audio && DC.audio.sfx('break'); DC.removeItem(item); DC.emit('inv'); break; } }
    }
    if (!landed) DC.audio && DC.audio.sfx('whiff');
  };
  Pl.shoot = function (wp, item) {
    const S = DC.S, P = S.player;
    let a = P.aim + (rnd() - 0.5) * (0.04 + P.stress / 700 + P.pain / 900 + (P.stance === 'sprint' ? 0.15 : 0));
    DC.audio && DC.audio.sfx('shot');
    DC.Z.noise(P.x, P.y, wp.nz, 'gunshot');
    DC.fx.flash(P.x + Math.cos(a) * 10, P.y + Math.sin(a) * 10);
    const ox = P.x, oy = P.y, ux = Math.cos(a), uy = Math.sin(a);
    let best = null, bd = wp.rng;
    for (const z of DC.Z.active) {
      if (!z.alive) continue;
      const dx = z.x - ox, dy = z.y - oy, along = dx * ux + dy * uy; if (along < 0 || along > bd) continue;
      const perp = Math.abs(dx * uy - dy * ux); if (perp > 6) continue;
      if (W.wallsBetween(Math.floor(ox / T), Math.floor(oy / T), Math.floor(z.x / T), Math.floor(z.y / T)) > 0) continue;
      best = z; bd = along;
    }
    // stop at wall
    let endD = best ? bd : wp.rng;
    for (let d = 8; d < endD; d += 4) { if (W.opaque(Math.floor((ox + ux * d) / T), Math.floor((oy + uy * d) / T))) { endD = d; best = null; break; } }
    DC.fx.tracer(ox + ux * 8, oy + uy * 8, ox + ux * endD, oy + uy * endD);
    if (best) { DC.Z.hit(best, wp.dmg[0] + rnd() * (wp.dmg[1] - wp.dmg[0]), ox, oy, wp.kb, {}); }
    if (item && item.d !== undefined) { item.d -= 1; if (item.d <= 0) { DC.log('The pistol jams for good.', 'bad'); DC.removeItem(item); DC.emit('inv'); } }
    P.stress = Math.min(100, P.stress + 2);
  };
  Pl.throwItem = function (it) {
    const S = DC.S, P = S.player;
    P.atkCd = 0.6; P.stam = Math.max(0, P.stam - 4);
    let d = 0; const a = P.aim;
    for (d = 8; d < 6 * T; d += 4) if (W.blocked(Math.floor((P.x + Math.cos(a) * d) / T), Math.floor((P.y + Math.sin(a) * d) / T))) { d -= 8; break; }
    const x = P.x + Math.cos(a) * d, y = P.y + Math.sin(a) * d;
    S.thrown.push({ x: P.x, y: P.y, tx: x, ty: y, t: 0, id: it.id });
    DC.removeItem(it, 1);
    DC.audio && DC.audio.sfx('swing'); DC.emit('inv');
    if (P.hand !== it && DC.countItem(it.id) > 0) P.hand = DC.allItems().find((q) => q.id === it.id) || null;
  };
  Pl.updateThrown = function (dt) {
    const S = DC.S;
    for (let k = S.thrown.length - 1; k >= 0; k--) {
      const t = S.thrown[k]; t.t += dt * 2.2;
      if (t.t >= 1) {
        DC.Z.noise(t.tx, t.ty, 17, 'thrown'); DC.audio && DC.audio.sfx(t.id === 'stone' ? 'thud' : 'glass', t.tx, t.ty);
        DC.fx.puff(t.tx, t.ty, 5); S.thrown.splice(k, 1);
        DC.log('Something clatters in the distance.', 'info');
      }
    }
    for (let k = S.clocks.length - 1; k >= 0; k--) {
      const c = S.clocks[k]; c.t -= dt; c.n = (c.n || 0) - dt;
      if (c.n <= 0) { c.n = 1.4; DC.Z.noise(c.x, c.y, 20, 'clock'); DC.audio && DC.audio.sfx('clock', c.x, c.y); }
      if (c.t <= 0) S.clocks.splice(k, 1);
    }
  };

  // ---------- interaction ----------
  const hasKey = (s) => !s.key || DC.countItem(s.key) > 0;
  function inside(bid) { const P = DC.S.player; const b = W.buildingAt(Math.floor(P.x / T), Math.floor(P.y / T)); return b && b.id === bid && W.isIndoor(Math.floor(P.x / T), Math.floor(P.y / T)); }
  Pl.updateFocus = function () {
    const S = DC.S, P = S.player;
    if (P.dead) { S.focus = null; return; }
    if (S.build) { S.focus = null; return; }
    const fx = P.x + Math.cos(P.aim) * 9, fy = P.y + Math.sin(P.aim) * 9;
    const px = P.x, py = P.y;
    let best = null, bs = 1e9;
    const consider = (f, d) => { const sc = d + (f.bias || 0); if (sc < bs) { bs = sc; best = f; } };
    for (const g of DC.groundPool) if (g.alive) { const d = Math.hypot(g.x - px, g.y - py); if (d < 20) consider({ kind: 'ground', ref: g, x: g.x, y: g.y }, d - 4); }
    for (const b of S.bodies) if (b.alive && !b.looted) { const d = Math.hypot(b.x - px, b.y - py); if (d < 22) consider({ kind: 'body', ref: b, x: b.x, y: b.y }, d); }
    for (const n of S.npcs) { const d = Math.hypot(n.x - px, n.y - py); if (d < 30) consider({ kind: 'npc', ref: n, x: n.x, y: n.y }, d - 6); }
    for (const a of S.animals) { const d = Math.hypot(a.x - px, a.y - py); if (d < 26) consider({ kind: 'animal', ref: a, x: a.x, y: a.y }, d - 3); }
    const tx0 = Math.floor(px / T), ty0 = Math.floor(py / T);
    for (let ty = ty0 - 2; ty <= ty0 + 2; ty++) for (let tx = tx0 - 2; tx <= tx0 + 2; tx++) {
      if (!W.inb(tx, ty)) continue;
      const i = ty * N + tx, t = W.o[i]; if (!t) continue;
      if (!Pl.interactable(t)) continue;
      // nearest point on tile
      const cx = DC.clamp(px, tx * T, tx * T + T), cy = DC.clamp(py, ty * T, ty * T + T);
      const d = Math.hypot(cx - px, cy - py); if (d > 17) continue;
      const dfront = Math.hypot(tx * T + 8 - fx, ty * T + 8 - fy);
      consider({ kind: 'tile', tx, ty, i, o: t, x: tx * T + 8, y: ty * T + 8 }, d * 0.7 + dfront * 0.5 + (t === O.TREE ? 4 : 0));
    }
    if (S.heli && S.heli.landed && W.pads) {
      const hx = W.pads.x * T + 8, hy = W.pads.y * T + 8, dd = Math.hypot(hx - px, hy - py);
      if (dd < 44 && (!best || dd < 30)) best = { kind: 'heli', x: hx, y: hy };
    }
    if (best) { best.acts = Pl.actionsFor(best); if (!best.acts.length) best = null; }
    S.focus = best;
  };
  Pl.interactable = function (t) {
    return t === O.DOOR || t === O.WINDOW || t === O.BGATE || (OD[t].c && true) || t === O.SINK || t === O.BED || t === O.BBED || t === O.HBED || t === O.COUCH || t === O.BBENCH || t === O.STOVE || t === O.CAMPFIRE || t === O.COLLECTOR || t === O.PUMP || t === O.CROP || t === O.TREE || t === O.ROCK || t === O.BEACON || t === O.CHECKGATE || t === O.BWALL || t === O.SPIKES || t === O.BTABLE || t === O.BCHAIR || t === O.TRIPWIRE || t === O.BSTAIRS;
  };
  function act(id, label, dur, fn, o) { return Object.assign({ id, label, dur: dur || 0, run: fn }, o || {}); }
  Pl.actionsFor = function (f) {
    const S = DC.S, P = S.player, acts = [];
    if (f.kind === 'ground') {
      acts.push(act('pickup', 'Pick up ' + DC.itemName(f.ref.it), 0, () => {
        const it = f.ref.it; if (DC.giveItem(it)) { f.ref.alive = false; DC.audio.sfx('pickup'); DC.log('Picked up ' + I[it.id].name + '.'); S.stats.looted++; DC.emit('inv'); } else DC.log('No room in your pack.', 'warn');
      }));
      return acts;
    }
    if (f.kind === 'body') {
      acts.push(act('lootbody', 'Search body', 1.6, () => {
        f.ref.looted = true;
        const rng = Math.random;
        const items = rng() < 0.55 ? DC.rollLoot(rng() < 0.5 ? 'bedroom' : 'living', rng, 1) : [];
        if (!items.length) DC.log('Nothing useful.', 'info');
        for (const it of items) { if (!DC.giveItem(it)) DC.dropAt(it, f.ref.x, f.ref.y); DC.log('Found ' + I[it.id].name + '.', 'good'); }
        DC.addXP('scav', 4); DC.emit('inv');
      }, { hold: 1, noise: [2, 1], sfx: 'rustle' }));
      return acts;
    }
    if (f.kind === 'heli') { acts.push(act('board', 'Board helicopter', 2.5, () => DC.Sys.win('beacon'), { hold: 1, sfx: 'heli' })); return acts; }
    if (f.kind === 'npc') { acts.push(act('talk', 'Talk to ' + f.ref.def.n.split(' ')[0], 0, () => DC.emit('talk', f.ref))); return acts; }
    if (f.kind === 'animal') {
      const hasFood = P.hand && I[P.hand.id].cat === 'food';
      if (hasFood) acts.push(act('feed', 'Feed ' + f.ref.kind, 0, () => DC.Life.feed(f.ref)));
      acts.push(act('pet', 'Pet ' + f.ref.kind, 0, () => DC.Life.pet(f.ref)));
      return acts;
    }
    const { tx, ty, i, o: t } = f, s = W.getState(i), od = OD[t];
    const bid = s && s.bid;
    if (t === O.DOOR || t === O.BGATE || t === O.WINDOW) {
      const isWin = t === O.WINDOW, nm = isWin ? 'window' : t === O.BGATE ? 'gate' : 'door';
      if (s.bar > 0) {
        acts.push(act('unbar', 'Remove barricade', 3.5, () => { Pl.unbarricade(tx, ty); }, { hold: 1, need: 'hammer|pry', noise: [8, 1.1], sfx: 'plank' }));
        acts.push(act('break', 'Smash barricade', 0, null, { hold: 1, breakTile: 1 }));
      } else if (s.broken) {
        if (isWin) acts.push(act('climb', 'Climb through', 0, () => Pl.climb(tx, ty)));
      } else if (s.open) {
        acts.push(act('close', 'Close ' + nm, 0, () => Pl.toggleDoor(tx, ty, false)));
        if (isWin) acts.push(act('climb', 'Climb through', 0, () => Pl.climb(tx, ty)));
      } else if (s.locked) {
        const key = s.key && DC.countItem(s.key) > 0;
        const ins = bid !== undefined && inside(bid) && !s.key;
        if (key || ins) acts.push(act('unlock', 'Unlock ' + nm, 0, () => Pl.setLock(tx, ty, false)));
        if (DC.hasTool('pick')) acts.push(act('pick', 'Pick lock', 6, () => Pl.pickLock(tx, ty), { hold: 1, noise: [3, 1.5], sfx: 'pick' }));
        const panel = DC.countItem('panel') > 0, mats = DC.countItem('plank') >= 2 && DC.countItem('nails') >= 3 && DC.hasTool('hammer');
        acts.push(act('bar', 'Barricade ' + nm, 4 * Pl.buildMul(), () => Pl.barricade(tx, ty), { hold: 1, noise: [11, 1.0], sfx: 'hammer', disabled: s.bar >= 3 || !(panel || mats), why: s.bar >= 3 ? 'Fully barricaded' : 'Need panel, or 2 planks + 3 nails + hammer' }));
        acts.push(act('break', 'Break ' + nm, 0, null, { hold: 1, breakTile: 1 }));
      } else {
        acts.push(act('open', 'Open ' + nm, 0, () => Pl.toggleDoor(tx, ty, true)));
        if (!isWin || true) acts.push(act('lock', 'Lock ' + nm, 0, () => Pl.setLock(tx, ty, true), { need2: !s.key || DC.countItem(s.key) > 0 || (bid !== undefined && inside(bid)) }));
        acts[acts.length - 1].disabled = !acts[acts.length - 1].need2;
        const panel = DC.countItem('panel') > 0, mats = DC.countItem('plank') >= 2 && DC.countItem('nails') >= 3 && DC.hasTool('hammer');
        acts.push(act('bar', 'Barricade ' + nm, 4 * Pl.buildMul(), () => Pl.barricade(tx, ty), { hold: 1, noise: [11, 1.0], sfx: 'hammer', disabled: s.bar >= 3 || !(panel || mats), why: s.bar >= 3 ? 'Fully barricaded' : 'Need panel, or 2 planks + 3 nails + hammer' }));
        acts.push(act('break', 'Break ' + nm, 0, null, { hold: 1, breakTile: 1 }));
      }
      return acts;
    }
    if (od.c) {
      const cs = W.st.get(W.origin(i));
      const searched = cs && cs.searched;
      const g = od.c;
      const dur = (1.1 + g.w * g.h * 0.09) / (1 + P.skills.scav.lvl * 0.08);
      if (t === O.CAR) { acts.push(act('search', searched ? 'Open vehicle' : 'Search vehicle', searched ? 0 : dur, () => Pl.openContainer(tx, ty), { hold: !searched, noise: [3, 1.2], sfx: 'rustle' })); }
      else acts.push(act('search', searched || t === O.BSTORE ? 'Open ' + od.n.toLowerCase() : 'Search ' + od.n.toLowerCase(), searched || t === O.BSTORE ? 0 : dur, () => Pl.openContainer(tx, ty), { hold: !(searched || t === O.BSTORE), noise: [3, 1.2], sfx: 'rustle' }));
      if (t === O.BSTORE) acts.push(act('dismantle', 'Dismantle', 5, () => Pl.dismantle(tx, ty), { hold: 1, noise: [7, 1], sfx: 'plank', need: 'hammer|pry' }));
      return acts;
    }
    switch (t) {
      case O.SINK:
        if (S.flags.water) {
          acts.push(act('fill', 'Fill empty bottles', 1.5, () => {
            let n = 0; for (const it of DC.allItems().filter((q) => q.id === 'bottle_empty')) { const nb = DC.makeItem('water_clean', 1); nb.u = nb.u; DC.removeItem(it, 1); if (!DC.giveItem(nb)) DC.dropAt(nb, P.x, P.y); n++; }
            if (n) { DC.log('Filled ' + n + ' bottle' + (n > 1 ? 's' : '') + '.', 'good'); DC.audio.sfx('water'); } else DC.log('No empty bottles.', 'warn'); DC.emit('inv');
          }, { hold: 1, sfx: 'water' }));
          acts.push(act('drink', 'Drink from tap', 2, () => { P.thirst = Math.min(100, P.thirst + 40); DC.log('You drink from the tap.', 'info'); DC.audio.sfx('drink'); }, { hold: 1, sfx: 'water' }));
        } else acts.push(act('dry', 'Tap runs dry', 0, () => DC.log('The water supply has failed.', 'warn')));
        return acts;
      case O.BED: case O.BBED: case O.HBED: case O.COUCH:
        acts.push(act('sleep', 'Rest / sleep', 0, () => DC.Sys.startSleep(t === O.BBED || t === O.BED || t === O.HBED ? 1 : 0.65)));
        return acts;
      case O.BBENCH: acts.push(act('craft', 'Use workbench', 0, () => DC.emit('openCraft', 'bench'))); return acts;
      case O.STOVE:
        acts.push(act('cook', S.flags.power ? 'Cook at stove' : 'Stove (no power)', 0, () => { if (S.flags.power) DC.emit('openCraft', 'heat'); else DC.log('The electric stove is dead.', 'warn'); }));
        return acts;
      case O.CAMPFIRE: {
        const fire = W.getState(i) || {};
        if (!(fire.fuel > 0)) acts.push(act('light', 'Light campfire', 1.5, () => Pl.lightFire(tx, ty), { hold: 1 }));
        else acts.push(act('cookf', 'Cook at fire', 0, () => DC.emit('openCraft', 'heat')));
        acts.push(act('fuel', 'Add fuel', 0, () => Pl.addFuel(tx, ty)));
        acts.push(act('dismantle', 'Dismantle', 3, () => Pl.dismantle(tx, ty), { hold: 1 }));
        return acts;
      }
      case O.COLLECTOR: {
        const s2 = W.getState(i) || { w: 0 };
        acts.push(act('collect', 'Collect water (' + Math.floor(s2.w || 0) + ')', 1.5, () => Pl.collect(tx, ty), { hold: 1, sfx: 'water' }));
        acts.push(act('dismantle', 'Dismantle', 3, () => Pl.dismantle(tx, ty), { hold: 1 }));
        return acts;
      }
      case O.PUMP:
        acts.push(act('siphon', 'Siphon fuel', 7, () => Pl.siphon(tx, ty), { hold: 1, need: null, noise: [6, 2], sfx: 'water' })); return acts;
      case O.CROP: {
        const cs = W.getState(i);
        if (cs && cs.ripe) acts.push(act('harvest', 'Harvest ' + cs.kind, 1.4, () => Pl.harvest(tx, ty), { hold: 1, sfx: 'rustle' }));
        else acts.push(act('grow', 'Growing...', 0, () => DC.log('Not ripe yet.', 'info')));
        return acts;
      }
      case O.TREE:
        if (DC.hasTool('chop')) acts.push(act('chop', 'Chop tree', 6, () => Pl.chop(tx, ty), { hold: 1, noise: [12, 1.1], sfx: 'chop' }));
        acts.push(act('sticks', 'Gather sticks', 2.5, () => Pl.gatherSticks(tx, ty), { hold: 1, noise: [2, 1.5], sfx: 'rustle' }));
        return acts;
      case O.ROCK: acts.push(act('stones', 'Gather stones', 2, () => { const it = DC.makeItem('stone', 1 + (rnd() < 0.5 ? 1 : 0)); if (!DC.giveItem(it)) DC.dropAt(it, P.x, P.y); DC.log('Found stones.'); DC.audio.sfx('pickup'); DC.emit('inv'); }, { hold: 1 })); return acts;
      case O.BEACON: Pl.beaconActions(acts, f); return acts;
      case O.CHECKGATE:
        acts.push(act('gate', DC.countItem('keycard') ? 'Use keycard: open the checkpoint' : 'Gate locked (needs keycard)', 0, () => { if (DC.countItem('keycard')) DC.Sys.checkpointEscape(); else DC.log('A card reader blinks red. You need a keycard.', 'warn'); }));
        return acts;
      case O.BWALL: case O.SPIKES: case O.BTABLE: case O.BCHAIR:
        acts.push(act('dismantle', 'Dismantle', 4, () => Pl.dismantle(tx, ty), { hold: 1, noise: [7, 1], sfx: 'plank', need: 'hammer|pry' })); return acts;
      default: return acts;
    }
  };

  // ---- actions implementation ----
  Pl.buildMul = function () { const P = DC.S.player; return (1 - P.skills.build.lvl * 0.05) * (P.traits.includes('handy') ? 0.75 : 1); };
  Pl.toggleDoor = function (tx, ty, open) {
    const i = ty * N + tx, s = W.st.get(i); if (!s) return;
    if (open) {
      if (W.o[i] === O.WINDOW && s.bar) return;
      s.open = true; DC.audio.sfx('dooropen', tx * T, ty * T); DC.Z.noise(tx * T + 8, ty * T + 8, 4, 'door');
      const b = W.buildings[s.bid]; if (b && !b.disc) { b.disc = true; DC.emit('discover', b); }
    } else {
      // can't close on a zombie
      for (const z of DC.Z.active) if (z.alive && Math.floor(z.x / T) === tx && Math.floor(z.y / T) === ty) { DC.log('Something is in the way.', 'warn'); return; }
      if (Math.floor(DC.S.player.x / T) === tx && Math.floor(DC.S.player.y / T) === ty) { DC.log('You are standing in it.', 'warn'); return; }
      s.open = false; DC.audio.sfx('doorclose', tx * T, ty * T); DC.Z.noise(tx * T + 8, ty * T + 8, 5, 'door');
    }
    s.dirty = 1; W.markDirty(tx, ty);
  };
  Pl.setLock = function (tx, ty, lock) {
    const s = W.st.get(ty * N + tx); s.locked = lock; s.dirty = 1; DC.audio.sfx(lock ? 'lock' : 'unlock', tx * T, ty * T);
    DC.log(lock ? 'Locked.' : 'Unlocked.'); W.markDirty(tx, ty);
  };
  Pl.pickLock = function (tx, ty) {
    const P = DC.S.player, s = W.st.get(ty * N + tx);
    const ch = 0.55 + P.skills.stealth.lvl * 0.04 + P.skills.scav.lvl * 0.02;
    if (rnd() < ch) { s.locked = false; s.dirty = 1; DC.log('Click. Unlocked.', 'good'); DC.audio.sfx('lock', tx * T, ty * T); DC.addXP('stealth', 8); }
    else { DC.log('The pick slips. Try again.', 'warn'); const pin = DC.allItems().find((q) => q.id === 'pins'); if (pin && rnd() < 0.4) DC.removeItem(pin, 1); }
    W.markDirty(tx, ty);
  };
  Pl.barricade = function (tx, ty) {
    const P = DC.S.player, s = W.st.get(ty * N + tx);
    if (s.bar >= 3) return;
    if (DC.countItem('panel') > 0) DC.consume('panel', 1);
    else if (DC.countItem('plank') >= 2 && DC.countItem('nails') >= 3 && DC.hasTool('hammer')) { DC.consume('plank', 2); DC.consume('nails', 3); }
    else { DC.log('Not enough materials.', 'warn'); return; }
    s.bar++; s.bhp = (s.bhp || 0) + 40 + P.skills.build.lvl * 4; s.open = false; s.dirty = 1;
    DC.log('Barricaded (' + s.bar + '/3).', 'good'); DC.addXP('build', 10); DC.S.stats.barricades++; W.markDirty(tx, ty); DC.emit('inv');
  };
  Pl.unbarricade = function (tx, ty) {
    const s = W.st.get(ty * N + tx); if (!s.bar) return;
    s.bar--; s.bhp = s.bar * 40; s.dirty = 1;
    if (rnd() < 0.6) { const it = DC.makeItem('plank', 1); if (!DC.giveItem(it)) DC.dropAt(it, DC.S.player.x, DC.S.player.y); }
    DC.log('Barricade removed.'); W.markDirty(tx, ty); DC.emit('inv');
  };
  Pl.climb = function (tx, ty) {
    const P = DC.S.player, dx = tx * T + 8 - P.x, dy = ty * T + 8 - P.y;
    const a = Math.abs(dx) > Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)];
    P.x = tx * T + 8 + a[0] * 12; P.y = ty * T + 8 + a[1] * 12;
    DC.Z.noise(P.x, P.y, 5, 'climb'); DC.audio.sfx('climb');
  };
  Pl.openContainer = function (tx, ty) {
    const S = DC.S, c = DC.getContainer(tx, ty); if (!c) return;
    if (!c.st.searched) {
      c.st.searched = true; S.stats.searched++; DC.addXP('scav', 5 + c.grid.items.length);
      const b = W.buildingAt(tx, ty); if (b && !b.disc) { b.disc = true; DC.emit('discover', b); }
      const car = W.cars.find((q) => q.i === W.origin(ty * N + tx));
      if (car && car.alarm && !car.alarmOn) { car.alarmOn = 45; DC.log('A car alarm wails!', 'bad'); DC.S.alarms.push(car); DC.audio.sfx('alarmstart'); }
      if (!c.grid.items.length) DC.log(c.name + ': empty.', 'info');
    }
    S.openC = c; DC.audio.sfx('open'); DC.emit('openLoot', c);
  };
  Pl.dismantle = function (tx, ty) {
    const i = ty * N + tx, t = W.o[i], P = DC.S.player;
    const def = DC.BUILDS.find((b) => b.o === t);
    if (t === O.BSTORE) { const c = DC.getContainer(tx, ty); if (c.grid.items.length) { DC.log('Empty it first.', 'warn'); return; } }
    if (def) for (const [id, q] of def.mats) { const n = Math.floor(q / 2); if (n > 0 && id !== 'sheet') { const it = DC.makeItem(id, n); if (!DC.giveItem(it)) DC.dropAt(it, P.x, P.y); } }
    W.setTile(tx, ty, 0); W.st.delete(i); DC.log('Dismantled.'); DC.emit('inv');
  };
  Pl.lightFire = function (tx, ty) {
    if (!DC.hasTool('fire')) { DC.log('You need a lighter or matches.', 'warn'); return; }
    const l = DC.allItems().find((q) => I[q.id].tl && I[q.id].tl.includes('fire') && q.id !== 'torch');
    const fuel = DC.allItems().find((q) => q.id === 'stick' || q.id === 'log' || q.id === 'newspaper');
    if (!fuel) { DC.log('You need fuel: sticks or a log.', 'warn'); return; }
    const s = W.getState(ty * N + tx) || (W.st.set(ty * N + tx, {}), W.st.get(ty * N + tx));
    s.fuel = (s.fuel || 0) + (fuel.id === 'log' ? 240 : fuel.id === 'stick' ? 70 : 25); DC.removeItem(fuel, 1);
    if (l && l.d !== undefined) { l.d -= 1; if (l.d <= 0 && l.id !== 'matches') { DC.removeItem(l); DC.log('The lighter runs dry.', 'warn'); } else if (l.d <= 0) DC.removeItem(l); }
    s.dirty = 1; DC.log('The fire catches.', 'good'); DC.audio.sfx('fire'); DC.emit('inv');
  };
  Pl.addFuel = function (tx, ty) {
    const fuel = DC.allItems().find((q) => q.id === 'log') || DC.allItems().find((q) => q.id === 'stick');
    const s = W.getState(ty * N + tx) || (W.st.set(ty * N + tx, {}), W.st.get(ty * N + tx));
    if (!fuel) { DC.log('No logs or sticks.', 'warn'); return; }
    if (!(s.fuel > 0)) { DC.log('Light it first.', 'warn'); return; }
    s.fuel += fuel.id === 'log' ? 240 : 70; DC.removeItem(fuel, 1); s.dirty = 1; DC.log('You feed the fire.'); DC.emit('inv');
  };
  Pl.collect = function (tx, ty) {
    const P = DC.S.player, s = W.getState(ty * N + tx); let n = 0;
    for (const it of DC.allItems().filter((q) => q.id === 'bottle_empty')) {
      if (!s || s.w < 4) break;
      const nb = DC.makeItem('water_dirty', 1); DC.removeItem(it, 1); if (!DC.giveItem(nb)) DC.dropAt(nb, P.x, P.y); s.w -= 4; n++;
    }
    if (n) DC.log('Collected ' + n + ' bottle(s) of murky water. Purify before drinking.', 'good'); else DC.log(s && s.w >= 4 ? 'You need empty bottles.' : 'Not enough water collected yet.', 'warn');
    DC.emit('inv');
  };
  Pl.siphon = function (tx, ty) {
    const e = DC.allItems().find((q) => q.id === 'jerry_empty'); const s = W.getState(ty * N + tx);
    if (!e) { DC.log('You need an empty jerry can.', 'warn'); return; }
    if (!s || !s.fuel) { DC.log('The tank is dry.', 'warn'); return; }
    s.fuel = 0; s.dirty = 1; DC.removeItem(e, 1); const f = DC.makeItem('jerry_full', 1); if (!DC.giveItem(f)) DC.dropAt(f, DC.S.player.x, DC.S.player.y);
    DC.log('Filled a fuel can.', 'good'); DC.emit('inv');
  };
  Pl.harvest = function (tx, ty) {
    const s = W.getState(ty * N + tx), P = DC.S.player; if (!s || !s.ripe) return;
    s.ripe = false; s.t = DC.S.t + 2880 + rnd() * 1440; s.dirty = 1;
    const it = DC.makeItem(s.kind, 1 + (rnd() < 0.5 ? 1 : 0), Math.random); if (!DC.giveItem(it)) DC.dropAt(it, P.x, P.y);
    DC.log('Harvested ' + I[s.kind].name + '.', 'good'); DC.addXP('scav', 3); DC.emit('inv'); W.markDirty(tx, ty);
  };
  Pl.chop = function (tx, ty) {
    const P = DC.S.player, i = ty * N + tx; W.treeHp = W.treeHp || new Map();
    const hp = (W.treeHp.get(i) || 3) - 1;
    const log = DC.makeItem('log', 1); if (!DC.giveItem(log)) DC.dropAt(log, P.x, P.y);
    if (rnd() < 0.5) { const s = DC.makeItem('stick', 2); if (!DC.giveItem(s)) DC.dropAt(s, P.x, P.y); }
    const h = P.hand; if (h && I[h.id].wp && DC.maxDur(h)) { h.d -= 2; if (h.d <= 0) { DC.log('Your tool broke.', 'bad'); DC.removeItem(h); } }
    if (hp <= 0) { W.treeHp.delete(i); W.setTile(tx, ty, 0); DC.log('The tree falls.'); } else W.treeHp.set(i, hp);
    DC.log('Got a log.', 'good'); DC.addXP('build', 4); DC.emit('inv'); W.markDirty(tx, ty);
  };
  Pl.gatherSticks = function (tx, ty) {
    const P = DC.S.player;
    if (rnd() < 0.7) { const s = DC.makeItem('stick', 1 + (rnd() < 0.4 ? 1 : 0)); if (!DC.giveItem(s)) DC.dropAt(s, P.x, P.y); DC.log('Gathered sticks.'); DC.audio.sfx('pickup'); } else DC.log('Nothing but leaves.');
    DC.emit('inv');
  };
  Pl.beaconActions = function (acts, f) {
    const S = DC.S, ms = W.getState(f.i), need = [['transmitter', 'Transmitter Core'], ['battpack', 'Signal Battery Pack'], ['jerry_full', 'Fuel Can']];
    if (ms.active) { acts.push(act('info', 'Beacon is transmitting', 0, () => DC.log('Hold out until the rescue arrives.', 'info'))); return; }
    const have = need.filter((n) => DC.countItem(n[0]) > 0 || (ms.parts & (1 << need.indexOf(n))));
    acts.push(act('install', 'Install parts (' + (have.length) + '/3)', 3, () => {
      for (let k = 0; k < 3; k++) if (DC.countItem(need[k][0]) > 0 && !(ms.parts & (1 << k))) { DC.consume(need[k][0], 1); ms.parts |= 1 << k; DC.log('Installed: ' + need[k][1] + '.', 'good'); DC.audio.sfx('craft'); }
      DC.emit('inv'); DC.emit('objectives');
    }, { hold: 1, noise: [10, 1], sfx: 'hammer' }));
    if (ms.parts === 7) acts.unshift(act('activate', 'ACTIVATE BEACON', 2, () => DC.Sys.activateBeacon(), { hold: 1, sfx: 'hammer' }));
  };
  Pl.cancelAct = function (why) {
    const S = DC.S; if (!S.act) return;
    if (why === 'hurt' || why === 'move' || why === 'attack') DC.log('Interrupted.', 'warn');
    S.act = null; DC.emit('actEnd');
  };
  Pl.startAct = function (a, f) {
    const S = DC.S, P = S.player;
    if (a.disabled) { DC.log(a.why || 'Cannot do that.', 'warn'); return; }
    if (a.need && !DC.hasTool(a.need)) { DC.log('You need a tool: ' + a.need.replace('|', ' or ') + '.', 'warn'); return; }
    if (!a.dur && !a.breakTile) { a.run && a.run(); return; }
    if (a.breakTile) { S.act = { label: 'Breaking...', dur: 99, t: 0, hold: true, breakTile: f, hit: 0, id: 'break', auto: false, grace: 2.5 }; return; }
    S.act = { id: a.id, label: a.label, dur: a.dur, t: 0, hold: !!a.hold && !DC.settings.holdToggle, run: a.run, noise: a.noise, nz: 0, sfx: a.sfx, sfxT: 0, auto: false, grace: a.hold ? 2.5 : 0 };
    if (a.hold && !DC.settings.holdToggle && !DC.inp.actHeld) DC.log('Hold the action button to continue.', 'info');
  };
  Pl.startGeneric = function (label, dur, run, o) {
    DC.S.act = Object.assign({ id: 'gen', label, dur, t: 0, hold: false, run, auto: true, noMove: false }, o || {});
  };
  Pl.updateAct = function (dt) {
    const S = DC.S, P = S.player, a = S.act, inp = DC.inp;
    if (!a) {
      // start from input
      if (inp.actEdge) {
        inp.actEdge = false;
        if (S.build) { Pl.startBuild(); return; }
        if (S.focus && S.focus.acts.length) Pl.startAct(S.focus.acts[0], S.focus);
      }
      if (inp.menuEdge) { inp.menuEdge = false; if (S.focus && S.focus.acts.length) DC.emit('actMenu', S.focus); }
      return;
    }
    inp.actEdge = false;
    // moving cancels (except when crafting auto not blocked)
    if (Math.hypot(inp.move.x, inp.move.y) > 0.45 && !a.keepMove) { Pl.cancelAct('move'); return; }
    if (inp.actHeld) a.grace = 0; else if (a.grace > 0) a.grace -= dt;
    const graceOn = a.grace > 0;
    if (a.hold && !inp.actHeld && !a.breakTile && !graceOn) { S.act = null; return; }
    if (a.breakTile) {
      if (!inp.actHeld && !DC.settings.holdToggle && !graceOn) { S.act = null; return; }
      a.hit -= dt;
      if (a.hit <= 0) {
        const f = a.breakTile, wp = Pl.weapon(), h = P.hand;
        a.hit = 0.85; const dmg = ((wp.dmg[0] + wp.dmg[1]) / 2) * (1 + P.skills.melee.lvl * 0.04) * 0.9 * (wp === FISTS ? 0.5 : 1);
        DC.damageTile(f.tx, f.ty, dmg, 'player'); DC.Z.noise(P.x, P.y, 14, 'break'); P.face = Math.atan2(f.y - P.y, f.x - P.x); P.aim = P.face;
        P.swing = { t: 0, hitAt: 9, dur: 0.3, wp, done: true, a: P.aim };
        DC.audio.sfx('thud'); P.stam = Math.max(0, P.stam - wp.st * 0.4);
        if (h && h.d !== undefined && wp.dur) { h.d -= 0.6; if (h.d <= 0) { DC.log('Your ' + I[h.id].name + ' broke.', 'bad'); DC.removeItem(h); } }
        const s = W.st.get(f.i); if (!s || s.broken || (!s.bar && s.open)) S.act = null;
      }
      return;
    }
    a.t += dt;
    if (a.noise) { a.nz -= dt; if (a.nz <= 0) { a.nz = a.noise[1]; DC.Z.noise(P.x, P.y, a.noise[0], 'work'); } }
    if (a.sfx) { a.sfxT -= dt; if (a.sfxT <= 0) { a.sfxT = 0.55; DC.audio.sfx(a.sfx); } }
    if (a.t >= a.dur) { const run = a.run; S.act = null; run && run(); DC.emit('actEnd'); }
  };

  // ---------- building ----------
  Pl.enterBuild = function (def) {
    const S = DC.S; S.build = { def, tx: 0, ty: 0, valid: false, manual: null, why: '' };
    if (S.act) Pl.cancelAct(); DC.emit('buildMode', true);
    DC.log('Build mode: ' + def.n + '. Aim to place, hold Action to build.', 'info');
  };
  Pl.exitBuild = function () { DC.S.build = null; DC.emit('buildMode', false); };
  Pl.buildReach = 3.6 * T;
  Pl.updateBuild = function () {
    const S = DC.S, P = S.player, b = S.build, inp = DC.inp;
    if (inp.aim.tap) { // tap to place cursor
      const tx = Math.floor(inp.aim.tap.wx / T), ty = Math.floor(inp.aim.tap.wy / T);
      b.manual = { tx, ty }; inp.aim.tap = null;
    }
    if (inp.aim.active && inp.aim.moved) b.manual = null;
    if (b.manual) { b.tx = b.manual.tx; b.ty = b.manual.ty; }
    else { const a = P.aim; b.tx = Math.floor((P.x + Math.cos(a) * 21) / T); b.ty = Math.floor((P.y + Math.sin(a) * 21) / T); }
    const cx = b.tx * T + 8, cy = b.ty * T + 8;
    if (Math.hypot(cx - P.x, cy - P.y) > Pl.buildReach + 8) { b.valid = false; b.why = 'Too far'; return; }
    const r = Pl.canBuild(b.def, b.tx, b.ty); b.valid = r === true; b.why = r === true ? '' : r;
    if (b.valid && !Pl.hasMats(b.def)) { b.valid = false; b.why = 'Missing materials'; }
  };
  Pl.hasMats = function (def) { return def.mats.every(([id, q]) => DC.countItem(id) >= q); };
  Pl.canBuild = function (def, tx, ty) {
    if (!W.inb(tx, ty) || tx < 3 || ty < 3 || tx > N - 4 || ty > N - 4) return 'Out of bounds';
    const i = ty * N + tx, gt = W.g[i], ot = W.o[i];
    if (gt === G.DEEP || gt === G.SHALLOW) return 'Water';
    if (ot) return 'Occupied';
    if (def.ground !== undefined && (gt === G.WOOD || gt === G.TILE || gt === G.CARPET)) return 'Already floored';
    if (gt === G.ROAD && def.o === O.CAMPFIRE) return 'Not on the road';
    const P = DC.S.player;
    const o2 = def.o && OD[def.o].s;
    if (o2 || def.ground === undefined) {
      if (Math.abs(P.x - (tx * T + 8)) < 11 && Math.abs(P.y - (ty * T + 8)) < 11) return 'Player in the way';
      for (const z of DC.Z.active) if (z.alive && Math.floor(z.x / T) === tx && Math.floor(z.y / T) === ty) return 'Occupied by zombie';
      for (const n of DC.S.npcs) if (Math.floor(n.x / T) === tx && Math.floor(n.y / T) === ty) return 'Occupied';
      for (const a of DC.S.animals) if (Math.floor(a.x / T) === tx && Math.floor(a.y / T) === ty) return 'Occupied';
    }
    return true;
  };
  Pl.startBuild = function () {
    const S = DC.S, b = S.build;
    if (!b.valid) { DC.log(b.why || 'Cannot build here.', 'warn'); return; }
    const def = b.def, tx = b.tx, ty = b.ty;
    S.act = { id: 'build', label: 'Building ' + def.n, dur: def.t * Pl.buildMul(), t: 0, hold: !DC.settings.holdToggle, noise: [12, 1.1], nz: 0, sfx: 'hammer', sfxT: 0, run: () => {
      if (Pl.canBuild(def, tx, ty) !== true || !Pl.hasMats(def)) { DC.log('Could not finish building.', 'warn'); return; }
      for (const [id, q] of def.mats) DC.consume(id, q);
      if (def.ground !== undefined) W.setTile(tx, ty, null, def.ground);
      else { W.setTile(tx, ty, def.o, null); Pl.initBuilt(def, tx, ty); }
      DC.S.stats.built++; if (def.id === 'bbed') DC.S.stats.builtBed = 1; if (def.id === 'bstore') DC.S.stats.builtStore = 1; DC.addXP('build', 12 + def.t); DC.addXP('craft', 3);
      DC.log(def.n + ' built.', 'good'); DC.audio.sfx('build'); DC.emit('inv');
    } };
  };
  Pl.initBuilt = function (def, tx, ty) {
    const i = ty * N + tx, P = DC.S.player;
    if (def.o === O.BGATE) W.st.set(i, { open: false, locked: false, broken: false, hp: 70 + P.skills.build.lvl * 5, bar: 0, bhp: 0, bid: undefined, built: 1, dirty: 1 });
    else if (def.o === O.BWALL || def.o === O.SPIKES) W.st.set(i, { hp: 80 + P.skills.build.lvl * 6, dirty: 1 });
    else if (def.o === O.COLLECTOR) W.st.set(i, { w: 0, dirty: 1 });
    else if (def.o === O.CAMPFIRE) W.st.set(i, { fuel: 0, dirty: 1 });
    else if (def.o === O.TRIPWIRE) W.st.set(i, { dirty: 1 });
  };

  // ---------- item use ----------
  DC.useItem = function (it) {
    const S = DC.S, P = S.player, d = I[it.id]; if (P.dead) return;
    const sk = DC.spoil(it);
    if (d.fd || (d.dr && it.u)) {
      if (d.fd && (!d.dr)) {
        const f = d.fd; let mul = 1;
        if (d.cook === undefined && it.id.endsWith('_c')) mul = 1 + P.skills.cook.lvl * 0.04;
        if (P.hunger >= 98 && (f.h || 0) > 0 && !(f.t > 0 && P.thirst < 90)) { DC.log("You aren't hungry.", 'info'); return; }
        P.hunger = Math.min(100, P.hunger + (f.h || 0) * mul); P.thirst = Math.max(0, Math.min(100, P.thirst + (f.t || 0)));
        P.stress = Math.max(0, P.stress + (f.st || 0));
        let sick = f.sick || 0;
        if (sk >= 1) sick = Math.max(sick, 0.85); else if (sk >= 0.7) sick = Math.max(sick, 0.15);
        if (P.traits.includes('stomach')) sick *= 2;
        if (sick && rnd() < sick) { P.sick = Math.max(P.sick, 1); DC.log('That did not sit well.', 'bad'); }
        DC.audio.sfx('eat'); DC.log('You eat the ' + d.name.toLowerCase() + '.'); S.stats.eaten++;
        DC.removeItem(it, 1); DC.addXP('cook', 1);
      } else if (d.dr) {
        if (P.thirst >= 98) { DC.log("You aren't thirsty.", 'info'); return; }
        P.thirst = Math.min(100, P.thirst + d.dr.t);
        if (d.dr.sick && rnd() < d.dr.sick * (P.traits.includes('stomach') ? 1.6 : 1)) { P.sick = Math.max(P.sick, 1); DC.log('The water tastes foul. Your stomach turns.', 'bad'); }
        it.u--; DC.audio.sfx('drink');
        if (it.u <= 0) { const e = DC.makeItem('bottle_empty', 1); DC.removeItem(it, 1); if (!DC.giveItem(e)) DC.dropAt(e, P.x, P.y); }
      }
      DC.emit('inv'); return;
    }
    if (d.med) {
      const m = d.med, aid = P.skills.aid.lvl; let used = false;
      if (m.bleed) { if (P.bleed > 0) { P.bleed = Math.max(0, P.bleed - (rnd() < m.bleed + aid * 0.03 ? P.bleed : 1)); used = true; DC.log(P.bleed ? 'The bleeding slows.' : 'Bleeding stopped.', 'good'); } }
      if (m.heal && P.hp < P.maxhp) { P.hp = Math.min(P.maxhp, P.hp + m.heal * (1 + aid * 0.08)); used = true; }
      if (m.clean) { if (P.infRisk > 0) used = true; P.infRisk = 0; } else if (m.bleed && used) P.infRisk *= 0.6;
      if (m.sprain && P.sprain) { P.sprain = 0; used = true; DC.log('Your ankle feels steadier.', 'good'); }
      if (m.pain) { P.painkill = 5; P.pain = Math.max(0, P.pain - 40); used = true; DC.log('The pain dulls.', 'good'); }
      if (m.disinfect) { if (P.infRisk > 0 || P.infect) { P.infRisk = 0; used = true; DC.log('Wounds disinfected.', 'good'); } }
      if (m.cure) { if (P.infect > 0) { P.infect = 0; P.infRisk = 0; used = true; DC.log('The fever breaks.', 'good'); } else if (P.sick > 0) { P.sick = 0; used = true; } }
      if (!used) { DC.log('No need to use that now.', 'info'); return; }
      DC.audio.sfx('bandage'); DC.addXP('aid', 6); S.stats.medUsed++;
      if (d.uses) { it.u--; if (it.u <= 0) DC.removeItem(it, 1); } else DC.removeItem(it, 1);
      DC.emit('inv'); return;
    }
    if (d.slot) { DC.equipSlot(it); return; }
    if (d.book) {
      if (it.rd) { DC.log('You have already studied this.', 'info'); return; }
      it.rd = 1; DC.addXP(d.book.skill, d.book.xp); for (const r of d.book.learn) { P.known[r] = 1; DC.log('Learned: ' + (DC.RECIPES.concat(DC.BUILDS).find((q) => q.id === r) || {}).n + '.', 'good'); }
      DC.log('You study ' + d.name + '. ' + d.book.txt, 'good'); DC.audio.sfx('page'); DC.emit('inv'); return;
    }
    if (it.id === 'note') {
      const k = Math.floor((it.uid * 7) % DC.LORE.length); S.journal.notes[k] = 1; DC.log('Note added to your journal.', 'good'); DC.audio.sfx('page'); DC.removeItem(it, 1); DC.emit('journal'); return;
    }
    if (it.id === 'map') { DC.Sys.revealMap(); DC.removeItem(it, 1); DC.log('The map fills in the town layout.', 'good'); DC.audio.sfx('page'); return; }
    if (it.id === 'battery') {
      const tgt = DC.allItems().concat(P.hand ? [P.hand] : []).find((q) => (I[q.id].tl && (I[q.id].tl.includes('light') && !I[q.id].light.fire || I[q.id].tl.includes('radio'))) && q.d < DC.maxDur(q));
      if (!tgt) { DC.log('Nothing needs batteries.', 'info'); return; }
      tgt.d = DC.maxDur(tgt); DC.removeItem(it, 1); DC.log('Fresh batteries in the ' + I[tgt.id].name.toLowerCase() + '.', 'good'); DC.audio.sfx('click'); DC.emit('inv'); return;
    }
    if (it.id === 'water_tabs') {
      const w = DC.allItems().find((q) => q.id === 'water_dirty'); if (!w) { DC.log('No murky water to purify.', 'info'); return; }
      const nw = DC.makeItem('water_clean', 1); nw.u = w.u; DC.removeItem(w, 1); DC.removeItem(it, 1); DC.giveItem(nw); DC.log('Water purified.', 'good'); DC.emit('inv'); return;
    }
    if (it.id === 'duct_tape') {
      const h = P.hand; if (!h || !DC.maxDur(h) || h.d >= DC.maxDur(h)) { DC.log('Equip a damaged tool or weapon first.', 'info'); return; }
      h.d = Math.min(DC.maxDur(h), h.d + DC.maxDur(h) * 0.3); it.d -= 20; if (it.d <= 0) DC.removeItem(it, 1); DC.log('Patched with tape.', 'good'); DC.audio.sfx('tape'); DC.emit('inv'); return;
    }
    if (it.id === 'alarm_clock') { S.clocks.push({ x: P.x, y: P.y, t: 22 }); DC.removeItem(it, 1); DC.log('You set the alarm clock ringing and back away.', 'info'); DC.emit('inv'); return; }
    if (it.id === 'radio') { S.radioOn = !S.radioOn; DC.log(S.radioOn ? 'Radio on. Static...' : 'Radio off.'); DC.audio.sfx('click'); return; }
    if (d.wp || d.tl || d.throw || d.light) { DC.equipHand(it); if (it.id === 'flashlight') { P.lightOn = P.hand === it; if (P.lightOn && it.d <= 0) { P.lightOn = false; DC.log('Dead batteries.', 'warn'); } } return; }
    DC.log(d.name + ': nothing to do with it.', 'info');
  };
})();

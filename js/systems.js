/* Dead County: Last Light - game state, clock, weather, survival needs, services, objectives. */
(function () {
  'use strict';
  const DC = window.DC, W = DC.W, I = DC.ITEMS, G = DC.G, O = DC.O, T = 16, N = W.N;
  const Sys = (DC.Sys = {});
  const rnd = Math.random;
  const clamp = DC.clamp;

  Sys.defaultSet = function (preset) { return Object.assign({}, DC.PRESETS[preset || 'normal']); };

  // ---------- new game ----------
  Sys.newGame = function (cfg) {
    const seed = cfg.seed || ((Math.random() * 4294967295) >>> 0);
    const set = Object.assign(Sys.defaultSet(cfg.preset), cfg.set || {});
    DC.S = { v: DC.SAVE_VERSION, mode: cfg.mode || 'story', preset: cfg.preset || 'normal', set, seed, t: 7.5 * 60, rt: 0, flags: { power: true, water: true }, stats: {}, journal: { notes: {}, ev: [] }, logHist: [], alarms: [], thrown: [], clocks: [], noiseLog: [], trail: [], bodies: [], animals: [], npcs: [], weather: { type: 'clear', rain: 0, wind: 0.2, fog: 0, next: 300 }, obj: { done: {} }, radioOn: false, sleeping: null, act: null, build: null, focus: null, openC: null, dead: null, won: null };
    const S = DC.S;
    for (const k of ['kills', 'dist', 'searched', 'looted', 'crafted', 'built', 'barricades', 'eaten', 'medUsed', 'damage', 'alarms', 'gifts', 'purified', 'sleeps']) S.stats[k] = 0;
    for (let k = 0; k < 50; k++) S.bodies.push({ alive: false, x: 0, y: 0, t: 0 });
    DC.groundPool.forEach((g) => (g.alive = false));
    S.ground = DC.groundPool;
    W.init(seed);
    S.disc = new Uint8Array(N * N);
    makePlayer(cfg);
    DC.Life.init();
    DC.Z.hordes = []; DC.Z.pool.forEach((z) => (z.alive = false));
    DC.Z.spawnInitial();
    S.nextWeather = 240;
    Sys.scheduleServices();
    DC.checkRecipes(false);
    S.startedAt = Date.now();
    DC.log('Dawn, Day 1. The county is quiet. It will not stay that way.', 'info');
    return S;
  };
  Sys.scheduleServices = function () {
    const S = DC.S, s = S.set;
    S.powerAt = (s.powerDay - 1) * 1440 + 360 + Math.floor(rnd() * 900);
    S.waterAt = (s.waterDay - 1) * 1440 + 480 + Math.floor(rnd() * 600);
    S.nextEvent = S.t + 120;
    S.nextRadio = S.t + 180;
  };
  function makePlayer(cfg) {
    const S = DC.S, b = W.safehouse;
    const traits = cfg.traits || [];
    const occ = DC.OCCUPATIONS.find((o) => o.id === cfg.occ) || DC.OCCUPATIONS[0];
    const skills = {}; for (const s of DC.SKILLS) skills[s.id] = { lvl: 0, xp: 0 };
    for (const k in occ.sk) skills[k].lvl = occ.sk[k];
    const P = (S.player = {
      name: cfg.name || 'Survivor', occ: occ.id, traits, x: b.door.ix * T + 8, y: b.door.iy * T + 8, face: -1.57, aim: -1.57, aimT: -9,
      maxhp: traits.includes('fragile') ? 80 : 100, hp: 0, hunger: 82, thirst: 82, stam: 100, maxStam: 100 * (1 + (traits.includes('athletic') ? 0.2 : 0) - (traits.includes('unfit') ? 0.2 : 0)), fatigue: 12, stress: 12, temp: 36.6, wet: 0,
      bleed: 0, pain: 0, painkill: 0, sprain: 0, infRisk: 0, infect: 0, sick: 0, crouch: false, stance: 'idle', exhausted: false, dead: false, equip: {}, hand: null, hot: [null, null, null, null, null, null],
      pockets: new DC.Grid(4, 2), skills, known: {}, stepAcc: 0, noiseR: 0, moved: 0, anim: 0, atkCd: 0, swing: null, dmgFlash: 0, lightOn: false, sightMul: 1, vis: 0.5, indoors: false, inBld: null, pain2: 0,
    });
    P.hp = P.maxhp; P.stam = P.maxStam;
    const eq = (id) => { const it = DC.makeItem(id, 1); P.equip[I[id].slot] = it; };
    eq('tshirt'); eq('jeans'); eq('sneakers');
    const give = (id, q) => { const it = DC.makeItem(id, q); if (!DC.giveItem(it)) DC.dropAt(it, P.x, P.y); return it; };
    give('key_safe', 1); give('water_clean', 1); give('bandage', 1); give('beans', 1);
    for (const [id, q] of occ.kit) {
      const d = I[id];
      if (d.slot) { const it = DC.makeItem(id, 1); const old = P.equip[d.slot]; P.equip[d.slot] = it; } else give(id, q);
    }
    if (!DC.allItems().some((i) => I[i.id].wp && !I[i.id].wp.ranged)) give('pan', 1);
    // hotbar
    const weapon = DC.allItems().find((i) => I[i.id].wp); if (weapon) { P.hand = weapon; P.hot[0] = weapon.uid; }
    let slot = 1; for (const it of DC.allItems()) { if (slot >= 6) break; if (it === weapon) continue; const d = I[it.id]; if (d.fd || d.med || d.dr || d.tl || d.light) P.hot[slot++] = it.uid; }
    S.disc.fill(0);
  }

  // ---------- time ----------
  Sys.hour = () => (DC.S.t / 60) % 24;
  Sys.day = () => Math.floor(DC.S.t / 1440) + 1;
  Sys.dayScale = () => 1440 / (DC.S.set.dayLen * 60);
  function ambientAt(hr) {
    if (hr < 5 || hr >= 21) return 0.1;
    if (hr < 7) return 0.1 + 0.9 * ((hr - 5) / 2);
    if (hr < 18) return 1;
    return 1 - 0.9 * ((hr - 18) / 3);
  }
  Sys.ambient = function () {
    const S = DC.S, w = S.weather;
    let a = ambientAt(Sys.hour());
    a *= w.type === 'storm' ? 0.55 : w.type === 'rain' ? 0.72 : w.type === 'fog' ? 0.82 : w.type === 'cloud' ? 0.88 : 1;
    return Math.max(0.08, a);
  };

  // ---------- weather ----------
  function pickWeather() {
    const S = DC.S, k = S.set.weather;
    const tbl = [['clear', Math.max(0.1, 0.5 - 0.15 * k)], ['cloud', 0.25], ['rain', 0.16 * k], ['fog', 0.06 * k], ['storm', 0.04 * k * k]];
    if (k <= 0.5) tbl[4][1] = 0;
    return DC.wpick(tbl);
  }
  function updateWeather(gm, dt) {
    const S = DC.S, w = S.weather;
    S.nextWeather -= gm;
    if (S.nextWeather <= 0) {
      const old = w.type; w.type = pickWeather(); S.nextWeather = 150 + rnd() * 300;
      if (w.type !== old) { const msg = { rain: 'Rain begins to fall.', storm: 'A storm rolls in.', fog: 'Fog settles over the county.', clear: 'The sky clears.', cloud: 'Clouds gather.' }[w.type]; DC.log(msg, 'info'); }
    }
    const tr = w.type === 'rain' ? 0.6 : w.type === 'storm' ? 1 : 0, tf = w.type === 'fog' ? 0.8 : w.type === 'rain' ? 0.15 : 0, tw = w.type === 'storm' ? 0.9 : w.type === 'rain' ? 0.45 : 0.2;
    w.rain += (tr - w.rain) * Math.min(1, dt * 0.25); w.fog += (tf - w.fog) * Math.min(1, dt * 0.12); w.wind += (tw - w.wind) * Math.min(1, dt * 0.2);
    if (w.type === 'storm') { S.thunderT = (S.thunderT === undefined ? 10 : S.thunderT) - dt; if (S.thunderT <= 0) { S.thunderT = 14 + rnd() * 35; S.lightning = 0.35; S.thunderAt = 0.4 + rnd() * 2; } }
    if (S.thunderAt !== undefined) { S.thunderAt -= dt; if (S.thunderAt <= 0) { S.thunderAt = undefined; DC.audio.sfx('thunder'); } }
    if (S.lightning > 0) S.lightning -= dt;
  }
  Sys.airTemp = function () {
    const S = DC.S, hr = Sys.hour(), d = Sys.day();
    let t = 9 + 5.5 * Math.sin(((hr - 9.5) * Math.PI) / 12);
    t -= Math.min(7, d * 0.28) * (S.set.weather > 1 ? 1.4 : 1);
    t += S.weather.type === 'storm' ? -3 : S.weather.type === 'rain' ? -2 : S.weather.type === 'fog' ? -1 : S.weather.type === 'clear' && hr > 11 && hr < 17 ? 1.5 : 0;
    return t;
  };

  // ---------- survival tick ----------
  function nearFire() {
    const P = DC.S.player, tx = Math.floor(P.x / T), ty = Math.floor(P.y / T);
    for (let y = ty - 4; y <= ty + 4; y++) for (let x = tx - 4; x <= tx + 4; x++) {
      if (!W.inb(x, y) || W.o[y * N + x] !== O.CAMPFIRE) continue;
      const s = W.st.get(y * N + x); if (s && s.fuel > 0) return Math.hypot(x * T + 8 - P.x, y * T + 8 - P.y) / T;
    }
    return 99;
  }
  Sys.nearHeat = function () { // station check for crafting
    const P = DC.S.player, tx = Math.floor(P.x / T), ty = Math.floor(P.y / T);
    for (let y = ty - 3; y <= ty + 3; y++) for (let x = tx - 3; x <= tx + 3; x++) {
      if (!W.inb(x, y)) continue;
      const o = W.o[y * N + x];
      if (o === O.CAMPFIRE) { const s = W.st.get(y * N + x); if (s && s.fuel > 0) return true; }
      if (o === O.STOVE && DC.S.flags.power) return true;
    }
    return false;
  };
  Sys.nearBench = function () {
    const P = DC.S.player, tx = Math.floor(P.x / T), ty = Math.floor(P.y / T);
    for (let y = ty - 3; y <= ty + 3; y++) for (let x = tx - 3; x <= tx + 3; x++) if (W.inb(x, y) && W.o[y * N + x] === O.BBENCH) return true;
    return false;
  };
  function survival(gm) { // gm game minutes
    const S = DC.S, P = S.player, set = S.set;
    const need = set.needs, hr = Sys.hour();
    const active = P.stance === 'sprint' ? 2.2 : P.stance === 'idle' ? 0.9 : 1.25;
    const slp = S.sleeping ? 0.5 : 1;
    P.hunger = Math.max(0, P.hunger - gm / 60 * 1.45 * need * active * slp * (P.traits.includes('hardy') ? 0.85 : 1));
    P.thirst = Math.max(0, P.thirst - gm / 60 * 2.7 * need * active * slp * (P.sick ? 1.6 : 1));
    if (!S.sleeping) P.fatigue = Math.min(100, P.fatigue + gm / 60 * 4.3 * need * (P.traits.includes('insomniac') ? 1.25 : 1) + (P.fatigueAdd || 0) * 0.5);
    P.fatigueAdd = 0;
    // temperature
    const air = Sys.airTemp(), indoor = P.indoors, fire = nearFire();
    let warm = 0; for (const s in P.equip) if (P.equip[s]) warm += I[P.equip[s].id].warm || 0;
    if (P.traits.includes('hardy')) warm += 3;
    const feel = air + warm + (indoor ? 5 : 0) + (fire < 5 ? 9 - fire : 0) - P.wet * 6 - (indoor ? 0 : S.weather.wind * 3) + (S.sleeping ? 1.5 : 0) + (P.stance === 'sprint' ? 2 : 0);
    let target = 36.6 + clamp((feel - 13) * 0.14, -7, 1.2) + (P.infect ? 1.4 : 0);
    P.temp += (target - P.temp) * Math.min(1, gm * 0.012);
    P.feel = feel;
    // wetness
    const rainy = S.weather.rain > 0.2 && !indoor;
    if (rainy) { let rp = 1; const bc = P.equip.body; if (bc) rp -= I[bc.id].rain || 0; P.wet = Math.min(1, P.wet + gm * 0.03 * S.weather.rain * Math.max(0.1, rp)); }
    else P.wet = Math.max(0, P.wet - gm * (indoor ? 0.012 : 0.004) * (fire < 5 ? 3 : 1));
    // health effects
    let dmg = 0, cause = '';
    const add = (v, c) => { if (v > 0) { dmg += v; cause = c; } };
    if (P.bleed > 0) add(0.34 * P.bleed * gm, 'blood loss');
    if (P.thirst <= 0) add(0.55 * gm, 'dehydration');
    if (P.hunger <= 0) add(0.28 * gm, 'starvation');
    if (P.temp < 35) add((35 - P.temp) * 0.25 * gm, 'exposure to the cold');
    if (P.temp > 39.2) add(0.2 * gm, 'fever');
    if (P.infect > 0) { P.infect += gm / 60; add((0.06 + Math.min(0.3, P.infect * 0.01)) * gm, 'infection'); }
    if (P.sick > 0) { P.sick = Math.max(0, P.sick - gm / 180); P.thirst = Math.max(0, P.thirst - gm * 0.03); add(0.03 * gm, 'food poisoning'); }
    if (P.infRisk > 0 && P.bleed === 0) { if (rnd() < gm / 60 * P.infRisk * 0.12) { P.infect = 0.01; P.infRisk = 0; DC.log('A wound feels hot and swollen. Infection.', 'bad'); } }
    if (dmg > 0) { P.hp -= dmg; S.lastDmgCause = cause; if (P.hp <= 0) DC.Player.die(cause); }
    else if (P.hunger > 35 && P.thirst > 35 && P.bleed === 0 && P.hp < P.maxhp && P.temp > 35.5 && !P.infect) P.hp = Math.min(P.maxhp, P.hp + gm * (S.sleeping ? 0.14 : 0.04) * (1 + P.skills.aid.lvl * 0.03));
    // pain & sprain recover
    P.painkill = Math.max(0, P.painkill - gm / 60);
    P.pain = Math.max(0, P.pain - gm * (P.painkill > 0 ? 1.0 : 0.08));
    if (P.sprain) { P.sprainT = (P.sprainT || 0) + gm; if (P.sprainT > 1440) { P.sprain = 0; P.sprainT = 0; DC.log('Your ankle has healed.', 'good'); } }
    // fatigue collapse
    if (P.fatigue >= 100 && !S.sleeping) { DC.log('You collapse from exhaustion.', 'bad'); Sys.startSleep(0.4, true); }
    // warnings
    warn('hunger', P.hunger < 25, 'You are getting hungry.'); warn('thirst', P.thirst < 25, 'You are thirsty.');
    warn('cold', P.temp < 35.8, 'You are shivering.'); warn('tired', P.fatigue > 75, 'You are exhausted. Find a place to sleep.');
  }
  const warned = {};
  function warn(k, cond, msg) { if (cond && !warned[k]) { warned[k] = 1; DC.log(msg, 'warn'); } else if (!cond) warned[k] = 0; }

  function stressTick(dt) {
    const S = DC.S, P = S.player; let d = 0, seen = 0, chasing = 0;
    for (const z of DC.Z.active) {
      if (!z.alive) continue;
      const dd = Math.hypot(z.x - P.x, z.y - P.y) / T;
      if (z.state === 'chase' || z.state === 'attack') { if (dd < 12) chasing++; }
      if (z.vis && dd < 12) seen++;
    }
    d += Math.min(2, seen * 0.5) + Math.min(3, chasing * 1.5);
    if (S.amb < 0.3 && !P.indoors && !P.lightOn) d += 0.15;
    if (P.hp < 30) d += 0.2; if (P.pain > 50) d += 0.1;
    if (S.weather.type === 'storm') d += 0.05;
    if (d === 0) { d = -(P.indoors ? 0.35 : 0.2) * (S.sleeping ? 3 : 1); if (S.amb > 0.5) d -= 0.1; }
    if (d > 0 && P.traits.includes('anxious')) d *= 1.5;
    P.stress = clamp(P.stress + d * dt, 0, 100);
    P.chased = chasing > 0;
  }

  // ---------- perception ----------
  Sys.perception = function () {
    const S = DC.S, P = S.player, tx = Math.floor(P.x / T), ty = Math.floor(P.y / T);
    const b = W.buildingAt(tx, ty); P.inBld = b; P.indoors = !!(b && W.isIndoor(tx, ty));
    let amb = Sys.ambient();
    S.amb = amb;
    if (P.indoors) amb = Math.min(amb, S.flags.power ? 0.72 : 0.52); // interiors are darker
    if (P.indoors && S.flags.power && S.amb < 0.5) amb = 0.55;
    S.ambIn = amb;
    const hand = P.hand, hl = hand && I[hand.id].light && ((I[hand.id].light.fire) || P.lightOn) ? 0.45 : 0;
    P.ownLight = hl;
    const lf = clamp(amb + hl, 0.08, 1);
    let sm = (0.35 + 0.65 * lf);
    sm *= { sprint: 1.3, walk: 1, crouch: 0.72, sneak: 0.45, idle: 1 }[P.stance];
    if (P.stance === 'idle') sm *= 0.78;
    const w = S.weather; sm *= 1 - w.fog * 0.45 - w.rain * 0.18;
    sm *= 1 - P.skills.stealth.lvl * 0.03; if (P.indoors) sm *= 0.85;
    P.sightMul = sm; P.vis = clamp(sm / 1.3, 0, 1);
    // vision range in tiles for fog of war
    let vr = 4.8 + 11.2 * clamp(amb + hl * 1.1, 0.1, 1);
    vr *= 1 - w.fog * 0.45 - w.rain * 0.12; if (P.traits.includes('myopic')) vr *= 0.82; if (P.traits.includes('keen')) vr *= 1.12;
    const st = W.o[ty * N + tx] === O.BSTAIRS; if (st) vr += 3;
    S.visRange = Math.max(4, vr);
  };

  // ---------- services & events ----------
  function services() {
    const S = DC.S;
    if (S.flags.power && S.t >= S.powerAt) { S.flags.power = false; DC.log('The lights flicker and die. The grid is down.', 'bad'); DC.audio.sfx('powerdown'); S.journal.ev.push([S.t, 'Power failure.']); }
    if (S.flags.water && S.t >= S.waterAt) { S.flags.water = false; DC.log('The taps cough and run dry. Water supply has failed.', 'bad'); S.journal.ev.push([S.t, 'Water supply failure.']); }
  }
  function events(gm) {
    const S = DC.S, P = S.player;
    if (S.t >= S.nextEvent) {
      S.nextEvent = S.t + 150 + rnd() * 300;
      const k = rnd(), a = rnd() * 6.28, d = (30 + rnd() * 50) * T;
      const x = clamp(P.x + Math.cos(a) * d, 100, N * T - 100), y = clamp(P.y + Math.sin(a) * d, 100, N * T - 100);
      if (k < 0.4) { DC.Z.noise(x, y, 34, 'distant'); DC.audio.sfx('distantshot'); DC.log('Gunfire, far off.', 'info'); }
      else if (k < 0.7) { DC.Z.noise(x, y, 28, 'distant'); DC.audio.sfx('siren'); DC.log('A siren wails somewhere in town, then dies.', 'info'); }
      else { DC.audio.sfx('heli'); DC.log('A helicopter passes overhead. It does not stop.', 'info'); }
    }
    if (S.radioOn && S.t >= S.nextRadio) {
      const r = DC.allItems().concat(P.hand ? [P.hand] : []).find((q) => q.id === 'radio');
      if (!r || r.d <= 0) { S.radioOn = false; DC.log('The radio dies.', 'warn'); }
      else {
        r.d -= 6; S.nextRadio = S.t + 70 + rnd() * 90;
        let msg = DC.pick(DC.RADIO);
        if (rnd() < 0.55 && DC.Z.hordes.length) {
          let best = null, bd = 1e9;
          for (const h of DC.Z.hordes) { if (!h.members.length) continue; const d = Math.hypot(h.x - P.x, h.y - P.y); if (d < bd) { bd = d; best = h; } }
          if (best) { const ang = Math.atan2(best.y - P.y, best.x - P.x), dirs = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'], dir = dirs[(Math.round(ang / (Math.PI / 4)) + 8) % 8]; msg = 'Unconfirmed report: a large group moving ' + (bd / T > 50 ? 'far to the ' : 'nearby, to the ') + dir + '.'; }
        }
        DC.log('Radio: ' + msg, 'radio'); DC.audio.sfx('radio'); S.journal.ev.push([S.t, 'Radio: ' + msg]);
      }
    }
  }
  function alarmsTick(dt) {
    const S = DC.S;
    for (let k = S.alarms.length - 1; k >= 0; k--) {
      const a = S.alarms[k];
      a.alarmOn -= dt; a.apulse = (a.apulse || 0) - dt;
      const isB = a.w !== undefined; const ax = isB ? (a.x + a.w / 2) * T : (a.x + 1) * T, ay = isB ? (a.y + a.h / 2) * T : (a.y + 0.5) * T;
      if (a.apulse <= 0) { a.apulse = 1.8; DC.Z.noise(ax, ay, isB ? 40 : 30, 'alarm'); DC.audio.sfx('alarm', ax, ay); }
      if (a.alarmOn <= 0) { a.alarmOn = 0; S.alarms.splice(k, 1); }
    }
  }
  function slowTick() { // 1 Hz housekeeping
    const S = DC.S, P = S.player;
    for (const [i, s] of W.st) {
      const o = W.o[i];
      if (o === O.CAMPFIRE && s.fuel > 0) { s.fuel -= 1 * Sys.dayScale(); s.dirty = 1; if (s.fuel <= 0) { s.fuel = 0; W.markDirty(i % N, (i / N) | 0); } }
      else if (o === O.COLLECTOR && S.weather.rain > 0.3) { s.w = Math.min(12, (s.w || 0) + 0.012 * S.weather.rain * Sys.dayScale()); s.dirty = 1; }
      else if (o === O.CROP && !s.ripe && S.t >= s.t) { s.ripe = true; s.dirty = 1; W.markDirty(i % N, (i / N) | 0); }
    }
    // discover buildings
    for (const b of W.buildings) {
      if (b.disc) continue;
      if (Math.abs(b.x - P.x / T) > 40 || Math.abs(b.y - P.y / T) > 40) continue;
      const d = b.door; if (d && S.disc[d.y * N + d.x]) { b.disc = true; DC.emit('discover', b); }
    }
    // lamps and bodies
    for (const bd of S.bodies) if (bd.alive && S.t - bd.t > 900) bd.alive = false;
    objectives();
  }

  // ---------- sleeping ----------
  Sys.startSleep = function (q, forced) {
    const S = DC.S, P = S.player;
    if (!forced) {
      if (P.fatigue < 25 && P.hp >= P.maxhp - 5) { DC.log("You aren't tired enough to sleep.", 'info'); return; }
      for (const z of DC.Z.active) if (z.alive && (z.state === 'chase' || z.state === 'attack') && Math.hypot(z.x - P.x, z.y - P.y) < 18 * T) { DC.log('You cannot rest with them this close.', 'warn'); return; }
      if (P.chased) { DC.log('You are too frightened to sleep.', 'warn'); return; }
    }
    S.sleeping = { q, t0: S.t, forced };
    if (S.act) DC.Player.cancelAct();
    DC.log('You lie down...', 'info'); S.stats.sleeps++; DC.emit('sleep', true);
  };
  Sys.wake = function (why) {
    const S = DC.S; if (!S.sleeping) return;
    S.sleeping = null; DC.emit('sleep', false); DC.log(why || 'You wake up.', 'info');
    DC.audio.sfx('wake');
  };
  function sleepTick(gm, dt) {
    const S = DC.S, P = S.player, sl = S.sleeping;
    const cold = P.feel !== undefined && P.feel < 6;
    P.fatigue = Math.max(0, P.fatigue - gm / 60 * 12 * sl.q * (cold ? 0.4 : 1));
    P.stress = Math.max(0, P.stress - gm / 60 * 12 * sl.q);
    if (S.t - sl.t0 > 90 && P.fatigue <= 5) Sys.wake('You wake, rested.');
    else if (P.hunger < 6 || P.thirst < 6) Sys.wake('Hunger and thirst wake you.');
    else if (P.temp < 34.8) Sys.wake('The cold wakes you.');
    else if (!sl.forced || S.t - sl.t0 > 240) {
      for (const n of S.noiseLog) {
        if (S.rt - n.t > 0.2) continue;
        if (n.src !== 'step' && Math.hypot(n.x - P.x, n.y - P.y) < n.r * T * 0.6 && Math.hypot(n.x - P.x, n.y - P.y) > 5) { Sys.wake('A sound wakes you.'); return; }
      }
    }
    for (const z of DC.Z.active) if (z.alive && z.state === 'chase' && Math.hypot(z.x - P.x, z.y - P.y) < 12 * T) { Sys.wake('They are coming!'); break; }
  }

  // ---------- objectives ----------
  Sys.objectiveList = function () {
    const S = DC.S, P = S.player, D = S.obj.done, list = [];
    const ms = W.mast ? W.getState(W.mast.y * N + W.mast.x) : null;
    const has = (id) => DC.countItem(id) > 0 || (ms && ms.parts & { transmitter: 1, battpack: 2, jerry_full: 4 }[id]);
    const L = (id, group, text, done, hint) => list.push({ id, group, text, done: !!done, hint });
    if (S.mode === 'story') {
      L('b_t', 'Route A: Signal Beacon', 'Find a Transmitter Core (police evidence room)', has('transmitter'), 'Evidence room key is in a police desk.');
      L('b_b', 'Route A: Signal Beacon', 'Find a Signal Battery Pack (hospital supply room)', has('battpack'), 'The hospital store room is locked.');
      L('b_f', 'Route A: Signal Beacon', 'Find a full Fuel Can (gas station)', has('jerry_full'), 'Check the back room or siphon a pump.');
      L('b_i', 'Route A: Signal Beacon', 'Install all parts on the signal mast (fire station yard)', ms && ms.parts === 7);
      L('b_a', 'Route A: Signal Beacon', 'Activate the beacon and hold out until rescue', ms && (ms.active || ms.done));
      L('b_e', 'Route A: Signal Beacon', 'Board the rescue helicopter', S.won && S.won.how === 'beacon');
      L('c_k', 'Route B: Quarantine Checkpoint', 'Find the checkpoint keycard (police station)', DC.countItem('keycard') > 0 || (S.won && S.won.how === 'checkpoint'));
      L('c_e', 'Route B: Quarantine Checkpoint', 'Walk north and use the keycard at the gate', S.won && S.won.how === 'checkpoint');
      L('e_d', 'Route C: Endurance', 'Survive 21 days (day ' + Sys.day() + ')', S.won && S.won.how === 'endurance');
    } else {
      L('s_7', 'Survival milestones', 'Survive 7 days', Sys.day() > 7); L('s_14', 'Survival milestones', 'Survive 14 days', Sys.day() > 14); L('s_30', 'Survival milestones', 'Survive 30 days', Sys.day() > 30);
    }
    const barr = countBarricades();
    L('x_s', 'Optional goals', 'Fortify your safehouse (3+ barricaded openings)', barr >= 3);
    L('x_b', 'Optional goals', 'Build a bed and a storage crate', S.stats.builtBed && S.stats.builtStore);
    L('x_w', 'Optional goals', 'Make water safe to drink', S.stats.purified > 0);
    L('x_n', 'Optional goals', 'Earn a survivor\'s trust (40+)', S.npcs.some((n) => n.trust >= 40));
    L('x_a', 'Optional goals', 'Befriend a dog', S.animals.some((a) => a.follow));
    L('x_k', 'Optional goals', 'Reach level 3 in any skill', DC.SKILLS.some((s) => P.skills[s.id].lvl >= 3));
    for (const o of list) { if (o.done && !D[o.id]) { D[o.id] = 1; DC.log('Objective complete: ' + o.text, 'good'); DC.audio.sfx('levelup'); } }
    return list;
  };
  function countBarricades() {
    const b = W.safehouse; let n = 0;
    for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) { const s = W.st.get(y * N + x); if (s && s.bar > 0 && (W.o[y * N + x] === O.DOOR || W.o[y * N + x] === O.WINDOW)) n++; }
    return n;
  }
  function objectives() {
    const S = DC.S;
    Sys.objectiveList();
    if (S.mode === 'story' && Sys.day() >= 22 && !S.won) Sys.win('endurance');
  }
  Sys.win = function (how) {
    const S = DC.S; if (S.won || S.dead) return;
    S.won = { how, t: S.t }; DC.audio.sfx('win'); DC.emit('win');
  };
  Sys.checkpointEscape = function () {
    const st = W.getState(W.gate.y * N + W.gate.x); if (st) { st.open = true; st.dirty = 1; W.markDirty(W.gate.x, W.gate.y); }
    DC.audio.sfx('gate'); Sys.win('checkpoint');
  };
  Sys.activateBeacon = function () {
    const S = DC.S, ms = W.getState(W.mast.y * N + W.mast.x);
    ms.active = true; ms.t0 = S.t; ms.wave = 0; ms.dirty = 1;
    S.beaconUntil = S.t + 180;
    DC.log('THE BEACON IS LIVE. They will hear it. Hold out for three hours.', 'bad'); DC.audio.sfx('beacon');
    S.journal.ev.push([S.t, 'Beacon activated.']);
  };
  function beaconTick(gm, dt) {
    const S = DC.S; if (!W.mast) return;
    const ms = W.getState(W.mast.y * N + W.mast.x); if (!ms || !ms.active || ms.done) return;
    const mx = W.mast.x * T + 8, my = W.mast.y * T + 8;
    ms.pulse = (ms.pulse || 0) - dt;
    if (ms.pulse <= 0) { ms.pulse = 3; DC.Z.noise(mx, my, 46, 'beacon'); DC.audio.sfx('alarm', mx, my); }
    const prog = (S.t - ms.t0);
    if (prog / 25 > ms.wave) {
      ms.wave++;
      const P = S.player; let n = 0;
      for (let k = 0; k < 30 && n < 5 + Math.floor(ms.wave / 2); k++) {
        const a = rnd() * 6.28, d = 28 + rnd() * 10, x = Math.floor(W.mast.x + Math.cos(a) * d), y = Math.floor(W.mast.y + Math.sin(a) * d);
        if (!W.inb(x, y) || W.blocked(x, y) || W.bl[y * N + x]) continue;
        const z = DC.Z.spawn(x * T + 8, y * T + 8, DC.Z.randType(S.amb < 0.5), { state: 'hear', tx: mx, ty: my, sx: mx, sy: my, st: 40, hearT: 0.5 }); if (z) n++;
      }
      DC.log('Wave ' + ms.wave + ': they are drawn to the signal.', 'bad');
    }
    if (prog >= 180 && !S.heli) {
      S.heli = { t: 0, landed: false, x: mx - 600, y: my - 300 }; DC.log('Rotor sound. The rescue helicopter is coming in!', 'good'); DC.audio.sfx('heli');
    }
    if (S.heli) {
      const h = S.heli, tx = W.pads.x * T + 8, ty = W.pads.y * T + 8;
      if (!h.landed) { h.t += dt; const d = Math.hypot(tx - h.x, ty - h.y); if (d < 3) { h.landed = true; h.x = tx; h.y = ty; DC.log('The helicopter has landed on the pad. Get to it!', 'good'); ms.done = true; } else { const sp = 120; h.x += (tx - h.x) / d * Math.min(d, sp * dt); h.y += (ty - h.y) / d * Math.min(d, sp * dt); } }
      else { DC.Z.noise(tx, ty, 30, 'heli'); }
    }
  }
  Sys.revealMap = function () {
    const S = DC.S;
    for (let y = 50; y < 176; y++) for (let x = 50; x < 176; x++) S.disc[y * N + x] = 1;
    for (const b of W.buildings) { b.disc = true; }
    for (let y = 0; y < N; y++) for (const x of [111, 112, 113]) { S.disc[y * N + x] = 1; S.disc[x * N + y] = 1; }
  };

  // ---------- master update ----------
  Sys.update = function (dt) {
    const S = DC.S, P = S.player;
    const ds = Sys.dayScale();
    S.rt += dt;
    const sm = S.sleeping ? 18 : 1;
    const gm = dt * ds * sm / 1; // game minutes
    const prevDay = Math.floor(S.t / 1440);
    S.t += gm;
    S.dayChanged = Math.floor(S.t / 1440) !== prevDay;
    S.isNight = S.amb < 0.45;
    const prevHr = Math.floor((S.t - gm) / 60);
    if (Math.floor(S.t / 60) !== prevHr) { DC.Life.hourly(); if (S.t / 60 % 24 === 0 || S.dayChanged) DC.log('Day ' + Sys.day() + ' begins.', 'info'); }
    updateWeather(gm, dt);
    Sys.perception();
    survival(gm);
    stressTick(dt);
    services(); events(gm); alarmsTick(dt); beaconTick(gm, dt);
    if (S.sleeping) sleepTick(gm, dt);
    S.slowT = (S.slowT || 0) - dt; if (S.slowT <= 0) { S.slowT = 1; slowTick(); }
    for (const b of W.buildings) if (b.roofA === undefined) b.roofA = 1;
    S.stats.days = Sys.day();
  };
})();

/* Dead County: Last Light - browser-storage save/load (versioned). The world is regenerated from the seed; only changes are stored. */
(function () {
  'use strict';
  const DC = window.DC, W = DC.W, N = W.N, Save = (DC.Save = {});
  const KEY = 'deadcounty.save.v1', SKEY = 'deadcounty.settings.v1';
  // Browser storage with an in-memory fallback (sandboxed iframes or blocked storage still allow save/continue within the session)
  const mem = {};
  const ls = {
    get(k) { try { const v = window['local' + 'Storage'].getItem(k); if (v !== null) return v; } catch (e) {} return k in mem ? mem[k] : null; },
    set(k, v) { try { window['local' + 'Storage'].setItem(k, v); delete mem[k]; return true; } catch (e) { mem[k] = v; return true; } },
    del(k) { delete mem[k]; try { window['local' + 'Storage'].removeItem(k); } catch (e) {} },
  };

  // ----- settings -----
  Save.loadSettings = function () {
    let s = {}; try { s = JSON.parse(ls.get(SKEY) || '{}'); } catch (e) {}
    DC.settings = Object.assign(DC.deepClone(DC.DEFAULT_SETTINGS), s); if (!DC.settings.ctl) DC.settings.ctl = {};
  };
  Save.saveSettings = function () { ls.set(SKEY, JSON.stringify(DC.settings)); };

  // ----- helpers -----
  function packBits(a) { const out = new Uint8Array(Math.ceil(a.length / 8)); for (let i = 0; i < a.length; i++) if (a[i]) out[i >> 3] |= 1 << (i & 7); let s = ''; for (let i = 0; i < out.length; i += 4096) s += String.fromCharCode.apply(null, out.subarray(i, i + 4096)); return btoa(s); }
  function unpackBits(str, n) { const s = atob(str), a = new Uint8Array(n); for (let i = 0; i < n; i++) if (s.charCodeAt(i >> 3) & (1 << (i & 7))) a[i] = 1; return a; }
  function maxUid(o, m) { if (!o) return m; if (Array.isArray(o)) { for (const x of o) m = maxUid(x, m); return m; } if (typeof o === 'object') { if (typeof o.uid === 'number' && o.uid > m) m = o.uid; for (const k in o) if (typeof o[k] === 'object') m = maxUid(o[k], m); } return m; }

  Save.has = () => !!ls.get(KEY);
  Save.info = function () { try { const d = JSON.parse(ls.get(KEY)); return d.name + ', day ' + (Math.floor(d.t / 1440) + 1); } catch (e) { return null; } };
  Save.clear = function () { ls.del(KEY); };

  Save.save = function (quiet) {
    const S = DC.S; if (!S || S.player.dead || !DC.Game.running) return false;
    const P = S.player, Z = DC.Z, d = { v: DC.SAVE_VERSION, name: P.name, seed: S.seed, preset: S.preset, mode: S.mode, set: S.set };
    for (const k of ['t', 'rt', 'flags', 'weather', 'stats', 'journal', 'obj', 'powerAt', 'waterAt', 'nextEvent', 'nextRadio', 'nextWeather', 'radioOn', 'heli', 'beaconUntil', 'won']) d[k] = S[k];
    d.logHist = S.logHist.slice(-30);
    const pc = Object.assign({}, P); delete pc.hand; delete pc.swing; delete pc.inBld; d.handUid = P.hand ? P.hand.uid : null;
    d.player = JSON.parse(JSON.stringify(pc));
    d.diff = Array.from(W.diff.entries());
    d.st = []; for (const [i, s] of W.st) d.st.push([i, s]);
    d.bld = W.buildings.map((b) => [b.disc ? 1 : 0, b.alarm ? 1 : 0, b.powered === false ? 0 : 1, b.alarmOn ? 1 : 0]);
    d.cars = W.cars.map((c) => [c.alarm ? 1 : 0]);
    d.ground = DC.groundPool.filter((g) => g.alive).map((g) => ({ x: g.x, y: g.y, it: g.it, t: g.t }));
    d.bodies = S.bodies.filter((b) => b.alive).map((b) => ({ x: b.x, y: b.y, t: b.t, looted: b.looted, face: b.face, var: b.var, type: b.type }));
    const nodes = Z.nodes();
    d.zombies = []; Z.pool.forEach((z, i) => { if (z.alive) d.zombies.push({ i, x: z.x, y: z.y, type: z.type, hp: z.hp, var: z.var, horde: z.horde, face: z.face, state: z.state === 'idle' ? 'idle' : 'wander' }); });
    d.hordes = Z.hordes.map((h) => ({ id: h.id, x: h.x, y: h.y, node: nodes.indexOf(h.node), to: h.to ? nodes.indexOf(h.to) : -1, wait: h.wait, spd: h.spd, members: h.members.map((m) => Z.pool.indexOf(m)).filter((x) => x >= 0) }));
    d.animals = S.animals; d.npcs = S.npcs.map((n) => { const c = Object.assign({}, n); c.def = n.def.id; c.home = n.home.id; return c; });
    d.disc = packBits(S.disc); d.uid = DC.uid.get();
    d.savedAt = Date.now();
    const json = JSON.stringify(d);
    const ok = ls.set(KEY, json);
    if (!ok) { DC.log('Save failed: storage full or blocked.', 'bad'); return false; }
    return true;
  };

  Save.load = function () {
    let d; try { d = JSON.parse(ls.get(KEY)); } catch (e) { return false; }
    if (!d || d.v !== DC.SAVE_VERSION) return false;
    const Z = DC.Z, I = DC.ITEMS;
    DC.Sys.newGame({ seed: d.seed, preset: d.preset, mode: d.mode, set: d.set, name: d.name, occ: d.player.occ, traits: d.player.traits });
    const S = DC.S;
    W.applyDiff(d.diff);
    for (const [i, s] of d.st) { if (s && s.grid && !s.grid.findSpot) s.grid = DC.Grid.from(s.grid); W.st.set(i, s); }
    d.bld.forEach((a, i) => { const b = W.buildings[i]; if (!b) return; b.disc = !!a[0]; b.alarm = !!a[1]; b.powered = !!a[2]; b.alarmOn = a[3] ? 0 : 0; });
    d.cars.forEach((a, i) => { if (W.cars[i]) { W.cars[i].alarm = !!a[0]; W.cars[i].alarmOn = 0; } });
    for (const k of ['t', 'rt', 'flags', 'weather', 'stats', 'journal', 'obj', 'powerAt', 'waterAt', 'nextEvent', 'nextRadio', 'nextWeather', 'radioOn', 'heli', 'beaconUntil', 'won']) if (d[k] !== undefined) S[k] = d[k];
    S.logHist = d.logHist || []; S.disc = unpackBits(d.disc, N * N);
    // player
    const P = d.player; P.pockets = DC.Grid.from(P.pockets);
    for (const s in P.equip) if (P.equip[s]) DC.reviveItem(P.equip[s]);
    P.hand = null; P.swing = null; P.inBld = null; S.player = P;
    DC.uid.set(Math.max(d.uid || 1, maxUid(d, 0) + 1));
    P.hand = d.handUid ? DC.findUid(d.handUid) || Object.values(P.equip).find((i) => i && i.uid === d.handUid) || null : null;
    if (P.hand && !DC.allItems().includes(P.hand)) P.hand = null;
    // ground and bodies
    DC.groundPool.forEach((g) => (g.alive = false));
    d.ground.forEach((g, k) => { const s = DC.groundPool[k]; if (s) { s.alive = true; s.x = g.x; s.y = g.y; s.it = DC.reviveItem(g.it); s.t = g.t; } });
    S.bodies.forEach((b) => (b.alive = false));
    d.bodies.forEach((b, k) => { if (S.bodies[k]) Object.assign(S.bodies[k], b, { alive: true }); });
    // zombies
    Z.pool.forEach((z) => (z.alive = false)); Z.active = [];
    for (const zs of d.zombies) { const z = Z.spawn(zs.x, zs.y, zs.type, { state: zs.state, horde: zs.horde }); if (!z) continue; z.hp = zs.hp; z.var = zs.var; z.face = zs.face; z.state = zs.state; z.horde = zs.horde; }
    // spawn() takes the first free slot, so rebuild the index mapping through order
    const alive = Z.pool.filter((z) => z.alive), idxMap = new Map(d.zombies.map((zs, k) => [zs.i, alive[k]]));
    const nodes = Z.nodes();
    Z.hordes = d.hordes.map((h) => ({ id: h.id, x: h.x, y: h.y, node: nodes[h.node] || nodes[0], to: h.to >= 0 ? nodes[h.to] : null, wait: h.wait, spd: h.spd, members: h.members.map((m) => idxMap.get(m)).filter(Boolean) }));
    // life
    S.animals = d.animals;
    S.npcs = d.npcs.map((n) => { n.def = DC.NPCS.find((q) => q.id === n.def); n.home = W.buildings[n.home]; return n; }).filter((n) => n.def && n.home);
    S.trail = []; S.noiseLog = []; S.thrown = []; S.clocks = []; S.alarms = []; S.sleeping = null; S.act = null; S.build = null;
    DC.checkRecipes(false); DC.emit('inv');
    return true;
  };
})();

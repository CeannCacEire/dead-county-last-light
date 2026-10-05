/* Dead County: Last Light - grid inventory, items, containers, loot generation. */
(function () {
  'use strict';
  const DC = window.DC, I = DC.ITEMS, W = DC.W;

  // ---------- Grid ----------
  function Grid(w, h) { this.w = w; this.h = h; this.items = []; }
  DC.Grid = Grid;
  const sz = (it) => { const d = I[it.id]; return it.r ? [d.h, d.w] : [d.w, d.h]; };
  Grid.prototype.canPlace = function (it, x, y, ignore) {
    const [w, h] = sz(it);
    if (x < 0 || y < 0 || x + w > this.w || y + h > this.h) return false;
    for (const o of this.items) {
      if (o === it || o === ignore) continue;
      const [ow, oh] = sz(o);
      if (x < o.x + ow && x + w > o.x && y < o.y + oh && y + h > o.y) return false;
    }
    return true;
  };
  Grid.prototype.findSpot = function (it) {
    const d = I[it.id];
    for (const r of d.w === d.h ? [0] : [0, 1]) {
      const save = it.r; it.r = r;
      for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (this.canPlace(it, x, y)) { it.r = save; return { x, y, r }; }
      it.r = save;
    }
    return null;
  };
  Grid.prototype.place = function (it, x, y, r) { if (r !== undefined) it.r = r; it.x = x; it.y = y; if (this.items.indexOf(it) < 0) this.items.push(it); };
  Grid.prototype.remove = function (it) { const k = this.items.indexOf(it); if (k >= 0) this.items.splice(k, 1); };
  Grid.prototype.itemAt = function (x, y) {
    for (const o of this.items) { const [w, h] = sz(o); if (x >= o.x && x < o.x + w && y >= o.y && y < o.y + h) return o; }
    return null;
  };
  Grid.prototype.toJSON = function () { return { w: this.w, h: this.h, items: this.items }; };
  Grid.from = function (j) { const g = new Grid(j.w, j.h); g.items = (j.items || []).map(reviveItem); return g; };
  function reviveItem(j) { if (j.grids) j.grids = j.grids.map(Grid.from); return j; }
  DC.reviveItem = reviveItem;

  // ---------- items ----------
  DC.maxDur = (it) => { const d = I[it.id]; return (d.wp && d.wp.dur) || d.dur || 0; };
  DC.makeItem = function (id, q, rng) {
    const d = I[id]; if (!d) throw new Error('bad item ' + id);
    const it = { uid: DC.uid.next(), id, q: q || 1, x: 0, y: 0, r: 0, age: 0, at: DC.S ? DC.S.t : 0 };
    const md = DC.maxDur(it);
    if (md) it.d = rng ? Math.round(md * (0.5 + rng() * 0.5)) : md;
    if (d.uses) it.u = d.uses;
    if (d.cap) it.grids = d.cap.map((c) => new Grid(c[0], c[1]));
    if (d.sp && rng) it.age = rng() * d.sp * 0.4;
    return it;
  };
  const spoilRate = (it) => (it.fr && DC.S && DC.S.flags.power ? 0.15 : 1);
  DC.itemAge = (it) => it.age + ((DC.S ? DC.S.t : 0) - it.at) / 60 * spoilRate(it);
  DC.settleAge = (it) => { it.age = DC.itemAge(it); it.at = DC.S.t; };
  DC.spoil = function (it) { const d = I[it.id]; if (!d.sp) return 0; return DC.itemAge(it) / d.sp; };
  DC.itemName = function (it) {
    const d = I[it.id]; let n = d.name; const s = DC.spoil(it);
    if (d.sp) n = (s >= 1 ? 'Rotten ' : s >= 0.7 ? 'Stale ' : '') + n;
    return n;
  };
  DC.itemWeight = function (it) {
    const d = I[it.id]; let w = d.wt * it.q;
    if (it.grids) for (const g of it.grids) for (const c of g.items) w += DC.itemWeight(c);
    return w;
  };

  // ---------- player bags ----------
  DC.bags = function () {
    const P = DC.S.player, out = [{ name: 'Pockets', grid: P.pockets, src: null }];
    for (const slot of ['body', 'legs', 'back', 'head', 'feet']) {
      const it = P.equip[slot];
      if (it && it.grids) it.grids.forEach((g, k) => out.push({ name: I[it.id].name + (it.grids.length > 1 ? ' ' + (k + 1) : ''), grid: g, src: it }));
    }
    return out;
  };
  DC.allItems = function () {
    const out = [];
    for (const b of DC.bags()) for (const it of b.grid.items) out.push(it);
    return out;
  };
  DC.findUid = function (uid) { if (!uid) return null; return DC.allItems().find((i) => i.uid === uid) || null; };
  DC.carryWeight = function () {
    const P = DC.S.player; let w = 0;
    for (const it of DC.allItems()) w += DC.itemWeight(it);
    for (const s in P.equip) if (P.equip[s]) w += I[P.equip[s].id].wt * 0.5;
    return w;
  };
  DC.carryCap = function () {
    const P = DC.S.player; let c = 14 + P.skills.fit.lvl * 1.1;
    if (P.traits.includes('strong')) c += 6; if (P.traits.includes('weak')) c -= 4;
    if (P.equip.back) c += I[P.equip.back.id].cb || 0;
    return c;
  };
  DC.countItem = function (id) { let n = 0; for (const it of DC.allItems()) if (it.id === id) n += it.q; return n; };
  DC.hasTool = function (tag) {
    const P = DC.S.player;
    const alts = tag.split('|');
    const ok = (it) => it && I[it.id].tl && alts.some((a) => I[it.id].tl.includes(a)) && (!DC.maxDur(it) || it.d > 0 || I[it.id].tl.indexOf('light') >= 0 && false);
    if (ok(P.hand)) return true;
    return DC.allItems().some(ok);
  };

  // add item to a list of grids (stack merge first). returns leftover qty
  DC.addTo = function (grids, it) {
    const d = I[it.id];
    if (d.stack > 1) {
      for (const g of grids) for (const o of g.items) {
        if (o.id === it.id && o.q < d.stack && o !== it && !o.eq) {
          if (!!it.fr !== !!o.fr) continue;
          const mv = Math.min(d.stack - o.q, it.q); o.q += mv; it.q -= mv; if (it.q <= 0) return 0;
        }
      }
    }
    for (const g of grids) { const sp = g.findSpot(it); if (sp) { g.place(it, sp.x, sp.y, sp.r); return 0; } }
    return it.q;
  };
  DC.giveItem = function (it) { // into the player inventory; true if placed fully
    const left = DC.addTo(DC.bags().map((b) => b.grid), it);
    return left === 0;
  };
  DC.removeItem = function (it, q) {
    q = q || it.q;
    if (q < it.q) { it.q -= q; return; }
    for (const b of DC.bags()) b.grid.remove(it);
    const P = DC.S.player; if (P.hand === it) P.hand = null;
    P.hot = P.hot.map((u) => (u === it.uid ? null : u));
  };
  DC.consume = function (id, q) { // remove q of item id from inventory
    let need = q;
    for (const it of DC.allItems().filter((i) => i.id === id)) {
      if (need <= 0) break;
      const t = Math.min(need, it.q); DC.removeItem(it, t); need -= t;
    }
    return need <= 0;
  };

  // ---------- containers in the world ----------
  function tableFor(ot, b) {
    const O = DC.O, t = b && b.type;
    switch (ot) {
      case O.SHOPSHELF: return 'shop_' + (b && b.kind || 'conv');
      case O.COUNTER: if (t === 'shop' || t === 'gas') return 'shop_' + b.kind; return 'kitchen';
      case O.SHELF: if (t === 'shop' || t === 'gas') return 'shop_' + b.kind; if (t === 'hospital') return 'hospital'; if (t === 'fire') return 'fire'; if (t === 'police') return 'police'; if (t === 'warehouse' || t === 'barn') return 'warehouse'; return 'living';
      case O.CRATE: if (t === 'warehouse') return 'warehouse'; if (t === 'barn') return 'farm'; if (t === 'hospital') return 'hospital'; if (t === 'police') return 'police'; if (t === 'fire') return 'fire'; if (t === 'gas') return 'gas'; if (t === 'shop') return 'shop_' + b.kind; return 'garage';
      case O.LOCKER: if (t === 'police') return 'police'; if (t === 'fire') return 'fire'; return 'locker';
      case O.DESK: if (t === 'police') return 'desk'; return 'desk';
      case O.MEDCAB: if (t === 'hospital') return 'hospital'; return 'bath';
      case O.BARREL: return 'barrel';
      case O.CABINET: return 'cabinet';
      default: return DC.CONTAINER_TABLE[DC.OD[ot].c.t];
    }
  }
  DC.rollLoot = function (table, rng, n, mul) {
    const list = DC.LOOT[table]; const out = [];
    if (!list || !list.length) return out;
    for (let k = 0; k < n; k++) {
      const id = DC.wpick(list.filter((e) => e[1] > 0), rng), d = I[id];
      let q = 1; if (d.stack > 1) q = Math.max(1, Math.round(1 + rng() * Math.min(d.stack - 1, d.stack > 20 ? 14 : 3)));
      out.push(DC.makeItem(id, q, rng));
    }
    return out;
  };
  // returns {grid, name, st, tx, ty} ; creates contents on first access
  DC.getContainer = function (tx, ty) {
    const i = ty * W.N + tx, oi = W.origin(i), ot = W.o[i];
    const od = DC.OD[ot]; if (!od || !od.c) return null;
    let s = W.st.get(oi);
    if (!s) { s = {}; W.st.set(oi, s); }
    if (!s.grid) {
      const b = W.buildings[W.bl[oi] - 1];
      const rng = DC.mulberry(W.seed ^ (oi * 2654435761));
      const g = new Grid(od.c.w, od.c.h);
      const abund = DC.S.set.loot * (1 + DC.S.player.skills.scav.lvl * 0.04);
      if (ot !== DC.O.BSTORE) {
        const forced = W.force.get(oi) || [];
        const table = tableFor(ot, b);
        let n = 0;
        if (rng() < Math.min(0.97, 0.78 * Math.min(1.3, abund + 0.2))) n = 1 + Math.floor(rng() * (ot === DC.O.CAR ? 2 : 3) * Math.min(1.6, abund) + 0.5);
        if (ot === DC.O.SHOPSHELF || ot === DC.O.CRATE) n += rng() < 0.5 * abund ? 1 : 0;
        const items = DC.rollLoot(table, rng, n);
        for (const [id, q] of forced) items.unshift(DC.makeItem(id, q, rng));
        for (const it of items) { if (od.c.fridge) it.fr = true; DC.addTo([g], it); }
      }
      s.grid = g; s.fridge = !!od.c.fridge; s.searched = false;
    }
    if (typeof s.grid.findSpot !== 'function') s.grid = Grid.from(s.grid);
    return { grid: s.grid, st: s, name: od.n, tx, ty, fridge: s.fridge };
  };

  // ---------- ground items (pool) ----------
  DC.groundPool = [];
  for (let k = 0; k < 400; k++) DC.groundPool.push({ alive: false, x: 0, y: 0, it: null, t: 0 });
  DC.dropAt = function (it, x, y) {
    let slot = DC.groundPool.find((g) => !g.alive);
    if (!slot) { slot = DC.groundPool.reduce((a, b) => (a.t < b.t ? a : b)); }
    slot.alive = true; slot.x = x + (Math.random() - 0.5) * 6; slot.y = y + (Math.random() - 0.5) * 6; slot.it = it; slot.t = DC.S.t;
    DC.S.ground = DC.groundPool;
    return slot;
  };
  DC.groundNear = function (x, y, r) { return DC.groundPool.filter((g) => g.alive && Math.hypot(g.x - x, g.y - y) < r); };

  // ---------- equip / use ----------
  DC.equipSlot = function (it) {
    const P = DC.S.player, d = I[it.id];
    if (!d.slot) return false;
    // remove from bag
    for (const b of DC.bags()) b.grid.remove(it);
    const old = P.equip[d.slot];
    P.equip[d.slot] = it;
    if (old) { if (!DC.giveItem(old)) { DC.dropAt(old, P.x, P.y); DC.log('No room: dropped ' + I[old.id].name, 'warn'); } }
    DC.audio && DC.audio.sfx('cloth');
    DC.emit('inv');
    return true;
  };
  DC.unequipSlot = function (slot) {
    const P = DC.S.player, it = P.equip[slot]; if (!it) return;
    P.equip[slot] = null;
    if (!DC.giveItem(it)) { P.equip[slot] = it; DC.log('No room to remove that.', 'warn'); return; }
    DC.emit('inv');
  };
  DC.equipHand = function (it) {
    const P = DC.S.player; P.hand = P.hand === it ? null : it;
    DC.audio && DC.audio.sfx('equip'); DC.emit('inv');
  };
  DC.transfer = function (it, fromGrid, toGrid, toInfo) {
    // move whole stack to another grid; returns bool
    if (fromGrid === toGrid) return false;
    DC.settleAge(it);
    const wasFr = it.fr; it.fr = !!(toInfo && toInfo.fridge);
    fromGrid.remove(it);
    const left = DC.addTo([toGrid], it);
    if (left > 0) { it.fr = wasFr; if (left < it.q) { it.q = left; } const sp = fromGrid.findSpot(it); if (sp) fromGrid.place(it, sp.x, sp.y, sp.r); else fromGrid.items.push(it); return false; }
    DC.audio && DC.audio.sfx('pickup');
    return true;
  };
})();

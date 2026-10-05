/* Dead County: Last Light - inventory, loot, crafting/building, skills, journal and map screens. */
(function () {
  'use strict';
  const DC = window.DC, UI = DC.UI, h = UI.h, I = DC.ITEMS, W = DC.W, T = 16, N = W.N;
  const CAT = { food: 'Food', water: 'Water', med: 'Medicine', tool: 'Tools', weapon: 'Weapons', ammo: 'Ammunition', cloth: 'Clothing', build: 'Building materials', elec: 'Electronics', misc: 'Miscellaneous' };
  const SLOTS = [['head', 'Head'], ['neck', 'Neck'], ['body', 'Body'], ['hands', 'Gloves'], ['legs', 'Legs'], ['feet', 'Feet'], ['back', 'Back'], ['hand', 'Held']];
  const flt = { q: '', cat: '', sort: 'name' };
  const SORTS = [['name', 'Name'], ['cat', 'Category'], ['wt', 'Weight'], ['cond', 'Condition']];
  const match = (it) => (!flt.cat || I[it.id].cat === flt.cat) && (!flt.q || DC.itemName(it).toLowerCase().includes(flt.q));
  const condOf = (it) => { const md = DC.maxDur(it); return md && it.d !== undefined ? it.d / md : 1; };
  function sortGrid(grid) {
    const old = grid.items.map((it) => [it, it.x, it.y, it.r]), items = grid.items.slice();
    const key = { name: (a, b) => DC.itemName(a).localeCompare(DC.itemName(b)), cat: (a, b) => I[a.id].cat.localeCompare(I[b.id].cat) || DC.itemName(a).localeCompare(DC.itemName(b)), wt: (a, b) => I[b.id].wt * b.q - I[a.id].wt * a.q, cond: (a, b) => condOf(a) - condOf(b) }[flt.sort];
    items.sort((a, b) => (I[b.id].w * I[b.id].h) - (I[a.id].w * I[a.id].h) || key(a, b));
    items.sort(key); grid.items.length = 0; let ok = true;
    for (const it of items) { const sp = grid.findSpot(it); if (!sp) { ok = false; break; } grid.place(it, sp.x, sp.y, sp.r); }
    if (!ok) { grid.items.length = 0; old.forEach(([it, x, y, r]) => grid.place(it, x, y, r)); DC.log('Could not rearrange that bag.', 'warn'); }
  }
  let drag = null;
  function splitStack(it, grid) {
    if (!(it.q > 1) || !grid) return false;
    const half = Math.floor(it.q / 2), n = DC.makeItem(it.id, half); n.fr = it.fr; n.age = it.age; n.at = it.at; if (it.d !== undefined) n.d = it.d;
    const sp = grid.findSpot(n); if (!sp) { DC.log('No room to split.', 'warn'); return false; }
    it.q -= half; grid.place(n, sp.x, sp.y, sp.r); DC.audio.sfx('invmove'); DC.gfx.vibrate(18); DC.emit('inv'); return true;
  }
  let sel = null, cmpMode = false, cmp = null;   // sel: {it, grid|null, slot|null}

  function gridOf(it) { for (const b of DC.bags()) if (b.grid.items.includes(it)) return b.grid; return null; }
  function dropToWorld(it) { const P = DC.S.player; DC.Player && 0; DC.dropAt(it, P.x + Math.cos(P.face) * 10, P.y + Math.sin(P.face) * 10); DC.audio.sfx('pickup'); }
  function removeAnywhere(it, loot) {
    const P = DC.S.player;
    for (const b of DC.bags()) b.grid.remove(it); if (loot) loot.grid.remove(it);
    for (const s in P.equip) if (P.equip[s] === it) P.equip[s] = null;
    if (P.hand === it) P.hand = null;
    P.hot = P.hot.map((u) => (u === it.uid ? null : u));
  }
  function moveToPlayer(it, from) { for (const b of DC.bags()) if (DC.transfer(it, from, b.grid, { fridge: false })) return true; return false; }

  function mkGrid(grid, info, cell, loot, e) {
    const g = h('div', { class: 'igrid', style: 'grid-template-columns:repeat(' + grid.w + ',var(--cell));' });
    for (let y = 0; y < grid.h; y++) for (let x = 0; x < grid.w; x++) { const c = h('div', { class: 'c', onclick: () => placeAt(grid, info, x, y, loot, e) }); c._cell = { grid, info, x, y }; g.append(c); }
    for (const it of grid.items) {
      const d = I[it.id], w = it.r ? d.h : d.w, hh = it.r ? d.w : d.h;
      const el = h('div', { class: 'it' + (sel && sel.it === it ? ' sel' : '') + (cmp === it ? ' cmp' : '') + (d.sp && DC.spoil(it) >= 1 ? ' bad' : d.sp && DC.spoil(it) >= 0.7 ? ' old' : ''), style: 'left:' + it.x * cell + 'px;top:' + it.y * cell + 'px;width:' + w * cell + 'px;height:' + hh * cell + 'px', onclick: (ev) => { ev.stopPropagation(); if (el._swallow) { el._swallow = false; return; } pick(it, grid, null, e); } });
      if (!match(it)) el.style.opacity = '0.22';
      // hold to split a stack; mouse users can also drag items to a new cell
      let holdTm = null, sx = 0, sy = 0;
      el.addEventListener('pointerdown', (ev) => {
        sx = ev.clientX; sy = ev.clientY; clearTimeout(holdTm);
        if (it.q > 1) holdTm = setTimeout(() => { if (splitStack(it, grid)) el._swallow = true; }, 520);
        if (ev.pointerType === 'mouse' && ev.button === 0) drag = { it, grid, el, sx, sy, on: false };
      });
      el.addEventListener('pointermove', (ev) => { if (Math.hypot(ev.clientX - sx, ev.clientY - sy) > 10) clearTimeout(holdTm); });
      const cancelHold = () => clearTimeout(holdTm);
      el.addEventListener('pointerup', cancelHold); el.addEventListener('pointercancel', cancelHold); el.addEventListener('pointerleave', cancelHold);
      const ic = UI.icon(it.id); const s = Math.min(w, hh) * cell - 6; ic.style.width = ic.style.height = Math.max(16, Math.min(s, 52)) + 'px'; if (it.r && d.w !== d.h) ic.style.transform = 'rotate(90deg)';
      el.append(ic);
      if (it.q > 1) el.append(h('span', { class: 'q', text: it.q })); else if (d.uses && it.u > 0 && d.uses > 1) el.append(h('span', { class: 'q', text: it.u }));
      if (it.grids) el.append(h('span', { class: 'q', style: 'left:1px;right:auto', text: '[]' }));
      const md = DC.maxDur(it); if (md && it.d !== undefined) { const b = h('div', { class: 'd' }, h('i')); b.firstChild.style.width = Math.max(0, it.d / md * 100) + '%'; b.firstChild.style.background = it.d / md < 0.25 ? '#c8503a' : '#9ccf88'; el.append(b); }
      g.append(el);
    }
    return g;
  }
  function pick(it, grid, slot, e) {
    DC.audio.sfx('click');
    if (cmpMode && sel && sel.it !== it) { cmp = it; cmpMode = false; UI.refresh(e); return; }
    if (sel && sel.it === it) sel = null; else { sel = { it, grid, slot }; cmp = null; }
    UI.refresh(e);
  }
  function placeAt(grid, info, x, y, loot, e) {
    if (!sel) return; const it = sel.it, P = DC.S.player;
    const src = sel.grid;
    if (!grid.canPlace(it, x, y, it)) { if (it.w !== it.h && grid.canPlace(Object.assign({}, it, { r: it.r ? 0 : 1 }), x, y, it)) { it.r = it.r ? 0 : 1; } else { DC.log('Does not fit there.', 'warn'); return; } }
    if (it.grids && it.grids.some((g) => g === grid)) { DC.log('A bag cannot go inside itself.', 'warn'); return; }
    DC.settleAge(it); removeAnywhere(it, loot); P.hot = P.hot; it.fr = !!(info && info.fridge); grid.place(it, x, y, it.r); DC.audio.sfx('pickup');
    sel = { it, grid, slot: null }; DC.emit('inv');
  }

  window.addEventListener('pointermove', (ev) => {
    if (!drag || ev.pointerType !== 'mouse') return;
    if (!drag.on && Math.hypot(ev.clientX - drag.sx, ev.clientY - drag.sy) > 8) { drag.on = true; drag.el.classList.add('drag'); }
  });
  window.addEventListener('pointerup', (ev) => {
    if (!drag) return; const d = drag; drag = null; d.el.classList.remove('drag');
    if (!d.on) return; d.el._swallow = true;
    const t = document.elementFromPoint(ev.clientX, ev.clientY), cell = t && t.closest && (t.closest('.c') || t.closest('.it'));
    const c = cell && (cell._cell || null); const e = UI.stack.find((q) => q.name === 'inv');
    if (c && e) { sel = { it: d.it, grid: d.grid, slot: null }; placeAt(c.grid, c.info, c.x, c.y, e.arg && e.arg.loot, e); }
  });

  // ---------- details ----------
  function statRows(it) {
    const d = I[it.id], r = [];
    if (d.wp) { const w = d.wp; r.push(['Damage', w.dmg[0] + '-' + w.dmg[1]], ['Reach', w.ranged ? w.rng + ' px (ranged)' : w.rng + ' px'], ['Cooldown', w.cd + 's'], ['Stamina', w.st], ['Noise', w.nz]); if (w.dur) r.push(['Durability', Math.max(0, Math.round(it.d || 0)) + '/' + w.dur]); if (w.ammo) r.push(['Ammo', I[w.ammo].name + ' (' + DC.countItem(w.ammo) + ')']); }
    else if (DC.maxDur(it)) r.push(['Condition', Math.round(it.d || 0) + '/' + DC.maxDur(it)]);
    if (d.slot) { r.push(['Warmth', d.warm || 0], ['Protection', Math.round((d.prot || 0) * 100) + '%'], ['Rain', Math.round((d.rain || 0) * 100) + '%']); if (d.cap) r.push(['Storage', d.cap.map((c) => c[0] + 'x' + c[1]).join(' + ')]); if (d.cb) r.push(['Carry bonus', '+' + d.cb + ' kg']); }
    for (const k of ['fd', 'dr', 'med']) if (d[k]) for (const q in d[k]) r.push([({ h: 'Hunger', t: 'Thirst', sick: 'Sickness risk', bleed: 'Stops bleeding', heal: 'Heals', clean: 'Antiseptic', pain: 'Pain relief', stress: 'Calms', fat: 'Energy', inf: 'Infection' })[q] || q, d[k][q]]);
    if (d.sp) r.push(['Freshness', Math.max(0, Math.round((1 - DC.spoil(it)) * 100)) + '%']);
    if (d.uses) r.push(['Uses', it.u + '/' + d.uses]);
    return r;
  }
  function compareTarget(it) {
    const d = I[it.id], P = DC.S.player; if (cmp && cmp !== it) return cmp;
    if (d.slot && P.equip[d.slot] && P.equip[d.slot] !== it) return P.equip[d.slot];
    if (d.wp && P.hand && P.hand !== it && I[P.hand.id].wp) return P.hand;
    return null;
  }
  function detailEl(e, loot) {
    if (!sel) return h('div', { class: 'detail dim', text: 'Tap an item to select it. Tap an empty cell to move it there. Items can be moved between your bags and the nearby container.' });
    const it = sel.it, d = I[it.id], P = DC.S.player, equipped = !!sel.slot;
    const th = UI.icon(it.id); th.style.width = th.style.height = '54px'; th.className = 'th';
    const box = h('div', { class: 'detail' }, th, h('h4', { text: DC.itemName(it) + (it.q > 1 ? ' x' + it.q : '') }), h('div', null, h('span', { class: 'stat', text: CAT[d.cat] }), h('span', { class: 'stat', text: (d.wt * it.q).toFixed(2) + ' kg' }), h('span', { class: 'stat', text: d.w + 'x' + d.h + ' cells' }), condOf(it) < 1 ? h('span', { class: 'stat ' + (condOf(it) < 0.25 ? 'bad' : 'good'), text: Math.round(condOf(it) * 100) + '% condition' }) : null), d.d ? h('p', { text: d.d }) : null, h('div', { style: 'clear:both' }));
    const rows = statRows(it), other = compareTarget(it), orows = other ? statRows(other) : null;
    if (rows.length) box.append(h('div', null, rows.map((r) => { const o = orows && orows.find((q) => q[0] === r[0]); let cls = ''; if (o && typeof r[1] === 'number' && typeof o[1] === 'number') cls = r[1] > o[1] ? 'green' : r[1] < o[1] ? 'red' : ''; else if (o && typeof r[1] === 'string' && typeof o[1] === 'string' && parseFloat(r[1]) !== parseFloat(o[1])) cls = parseFloat(r[1]) > parseFloat(o[1]) ? 'green' : 'red'; return h('div', { class: 'kv' }, h('span', { class: 'dim', text: r[0] }), h('span', null, h('b', { class: cls, text: String(r[1]) }), o ? h('span', { class: 'dim', text: '  vs ' + o[1] }) : null)); })));
    if (other) box.append(h('p', { class: 'blue', text: 'Compared with ' + I[other.id].name + (other === P.hand || Object.values(P.equip).includes(other) ? ' (equipped)' : '') }));
    const acts = h('div', { class: 'row', style: 'margin-top:8px' });
    const A = (label, fn, cls) => acts.append(UI.btn(label, () => { fn(); }, 'sm ' + (cls || '')));
    const useLabel = d.cat === 'food' ? 'Eat' : d.cat === 'water' ? 'Drink' : d.cat === 'med' ? 'Apply' : 'Use';
    if (d.fd || d.dr || d.med || d.cat === 'misc' || d.cat === 'elec' || d.throw || d.tl) A(d.wp || d.tl || d.light || d.throw ? 'Hold / use' : useLabel, () => { DC.useItem(it); if (DC.S.act) UI.close('inv'); else { UI.hotbarRefresh(); UI.refresh(e); } }, 'pri');
    if (d.wp && !d.fd) A(P.hand === it ? 'Put away' : 'Wield', () => { DC.equipHand(it); }, 'pri');
    if (d.slot && !equipped) A('Equip', () => { DC.equipSlot(it); sel = { it, grid: null, slot: d.slot }; }, 'pri');
    if (equipped && sel.slot !== 'hand') A('Unequip', () => { DC.unequipSlot(sel.slot); sel = null; });
    if (sel.slot === 'hand') A('Put away', () => { P.hand = null; P.lightOn = false; sel = null; DC.emit('inv'); });
    if (loot && !equipped) { const inLoot = loot.grid.items.includes(it); A(inLoot ? 'Take' : 'Put in ' + loot.name.toLowerCase(), () => { const ok = inLoot ? moveToPlayer(it, loot.grid) : DC.transfer(it, sel.grid, loot.grid, { fridge: loot.fridge }); if (!ok) DC.log('No room.', 'warn'); else sel = null; DC.emit('inv'); }); }
    if (d.w !== d.h && sel.grid) A('Rotate', () => { const g = sel.grid; it.r = it.r ? 0 : 1; if (!g.canPlace(it, it.x, it.y, it)) { const sp = g.findSpot(it); if (sp) { it.x = sp.x; it.y = sp.y; it.r = sp.r; } else { it.r = it.r ? 0 : 1; DC.log('No room to rotate.', 'warn'); } } DC.emit('inv'); });
    if (it.q > 1 && sel.grid) A('Split (or hold item)', () => { splitStack(it, sel.grid); });
    A(cmpMode ? 'Pick item...' : 'Compare', () => { cmpMode = !cmpMode; UI.refresh(e); });
    A('Drop', () => { removeAnywhere(it, loot); dropToWorld(it); sel = null; DC.emit('inv'); }, 'dng');
    box.append(acts);
    if (!d.stack || true) { const pin = h('div', { class: 'row', style: 'margin-top:6px' }, h('span', { class: 'dim', text: 'Hotbar slot:' })); for (let k = 0; k < 6; k++) pin.append(UI.btn(String(k + 1), () => { P.hot = P.hot.map((u) => (u === it.uid ? null : u)); P.hot[k] = it.uid; UI.hotbarRefresh(); UI.refresh(e); }, 'sm' + (P.hot[k] === it.uid ? ' sel' : ''))); box.append(pin); }
    return box;
  }

  UI.register('inv', {
    pause: 'inv',
    close() { sel = null; cmp = null; cmpMode = false; flt.q = ''; flt.cat = ''; },
    render(e) {
      const P = DC.S.player, loot = e.arg && e.arg.loot;
      if (sel && sel.it && !DC.allItems().includes(sel.it) && !(loot && loot.grid.items.includes(sel.it)) && !Object.values(P.equip).includes(sel.it) && P.hand !== sel.it) sel = null;
      const bags = DC.bags(), wide = window.innerWidth > 720;
      const maxW = Math.max(...bags.map((b) => b.grid.w), loot ? loot.grid.w : 0);
      const avail = Math.min(window.innerWidth, 980) - 44, cell = DC.clamp(Math.floor((wide ? avail / 2 - 14 : avail) / maxW), 26, 44);
      e.el.style.setProperty('--cell', cell + 'px');
      const wt = DC.carryWeight(), cap = DC.carryCap(), pct = Math.min(100, wt / cap * 100);
      const eq = h('div', { class: 'eqrow' }, SLOTS.map(([s, nm]) => {
        const it = s === 'hand' ? P.hand : P.equip[s];
        const el = h('div', { class: 'eq' + (it ? ' has' : '') + (sel && sel.it === it && it ? ' sel' : ''), onclick: () => { if (it) pick(it, gridOf(it), s, e); } });
        if (it) el.append(UI.icon(it.id), h('span', null, h('span', { class: 'slotn', text: nm }), I[it.id].name)); else el.append(h('span', { class: 'slotn', text: nm }));
        return el;
      }));
      const tools = h('div', { class: 'tools' },
        h('input', { type: 'search', placeholder: 'Search items', value: flt.q, oninput: (ev) => { flt.q = ev.target.value.trim().toLowerCase(); clearTimeout(e.ft); e.ft = setTimeout(() => { UI.refresh(e); const i = e.el.querySelector('input[type=search]'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 250); } }),
        UI.bi('sort', 'Sort: ' + SORTS.find((x) => x[0] === flt.sort)[1], () => { const k = SORTS.findIndex((x) => x[0] === flt.sort); flt.sort = SORTS[(k + 1) % SORTS.length][0]; for (const b of DC.bags()) sortGrid(b.grid); if (loot) sortGrid(loot.grid); DC.audio.sfx('invmove'); DC.emit('inv'); }, 'sm'));
      const cats = h('div', { class: 'chips' }, [['', 'All']].concat(Object.entries(CAT)).map(([k, n]) => UI.btn(({ build: 'Materials', misc: 'Misc', ammo: 'Ammo', elec: 'Electronics' })[k] || n, () => { flt.cat = k; UI.refresh(e); }, 'sm' + (flt.cat === k ? ' sel' : ''))));
      const left = h('div', { class: 'invcol' },
        h('div', { class: 'gbox' }, h('h5', null, h('span', { text: 'Equipped' })), eq),
        h('div', { class: 'gbox' }, h('h5', null, h('span', { text: 'Weight' }), h('span', { class: wt > cap ? 'red' : '', text: wt.toFixed(1) + ' / ' + cap.toFixed(1) + ' kg' })), h('div', { class: 'wbar' + (wt > cap ? ' over' : '') }, h('i', { style: 'width:' + pct + '%' + (wt > cap * 0.8 && wt <= cap ? ';background:linear-gradient(180deg,#e8c070,#b88a30)' : '') })), wt > cap ? h('p', { class: 'red', text: 'Overloaded: you move slowly and make more noise.' }) : null),
        bags.map((b) => { const used = b.grid.items.reduce((a, q) => a + I[q.id].w * I[q.id].h, 0), tot = b.grid.w * b.grid.h; return h('div', { class: 'gbox' }, h('h5', null, h('span', { text: b.name }), h('span', { class: used >= tot ? 'full' : '', text: used >= tot ? 'Full' : used + '/' + tot + ' cells' })), mkGrid(b.grid, { fridge: false }, cell, loot, e)); }));
      const nearby = h('div', { class: 'gbox' });
      if (loot) {
        nearby.append(h('h5', null, h('span', { text: loot.name + (loot.fridge ? ' (cold)' : '') }), UI.bi('arrow', 'Take all', () => { for (const it of loot.grid.items.slice()) moveToPlayer(it, loot.grid); DC.emit('inv'); }, 'sm')), mkGrid(loot.grid, { fridge: loot.fridge }, cell, loot, e));
        if (!loot.grid.items.length) nearby.append(h('p', { class: 'dim', text: 'Empty.' }));
      } else nearby.append(h('h5', null, h('span', { text: 'Nearby container' })), h('p', { class: 'dim', text: 'Search a container (hold Act) to see its contents here.' }));
      const ground = DC.groundNear(P.x, P.y, 30);
      const gl = h('div', { class: 'gbox' }, h('h5', null, h('span', { text: 'On the ground (' + ground.length + ')' })));
      ground.slice(0, 8).forEach((g) => gl.append(h('div', { class: 'list' }, h('div', { class: 'li', onclick: () => { if (DC.giveItem(g.it)) { g.alive = false; DC.audio.sfx('pickup'); DC.emit('inv'); } else DC.log('No room.', 'warn'); } }, UI.icon(g.it.id), h('div', { class: 't', text: DC.itemName(g.it) + (g.it.q > 1 ? ' x' + g.it.q : '') }), UI.btn('Pick up', () => {}, 'sm')))));
      const right = h('div', { class: 'invcol' }, nearby, ground.length ? gl : null, detailEl(e, loot));
      const body = UI.scroll(tools, cats, h('div', { class: 'inv' }, loot ? right : left, loot ? left : right));
      e.el.append(UI.panel(loot ? 'Search: ' + loot.name : 'Inventory', body, [UI.bi('hammer', 'Crafting', () => { UI.close('inv'); UI.open('craft'); }, 'sm'), UI.bi('skill', 'Skills', () => { UI.close('inv'); UI.open('skills'); }, 'sm'), UI.bi('back', 'Back', () => UI.close('inv'), 'pri')], 'wide', () => UI.close('inv')));
    },
  });

  // ---------- crafting ----------
  function toolOk(tag) { return DC.hasTool(tag); }
  function stationOk(st) { if (!st) return true; if (st === 'bench') return DC.Sys.nearBench(); if (st === 'heat') return DC.Sys.nearHeat(); return true; }
  function recipeStatus(r) {
    const miss = [];
    for (const [id, q] of r.ing) if (DC.countItem(id) < q) miss.push('Need ' + I[id].name + ' x' + q);
    for (const t of r.tools || []) if (!toolOk(t)) miss.push('Tool: ' + t.split('|').join(' or '));
    if (!stationOk(r.station)) miss.push(r.station === 'bench' ? 'Stand near a workbench' : 'Stand near a lit fire or stove');
    return miss;
  }
  DC.craft = function (r) {
    const S = DC.S, P = S.player, Pl = DC.Player;
    if (recipeStatus(r).length) { DC.log('Cannot craft that right now.', 'warn'); return; }
    const dur = Math.max(1, r.t * Pl.buildMul());
    Pl.startGeneric('Crafting ' + r.n, dur, () => {
      if (recipeStatus(r).length) { DC.log('Crafting failed: missing something.', 'warn'); return; }
      let src = null; if (r.inherit === 'uses') src = DC.allItems().find((i) => i.id === r.ing[0][0]);
      const u = src ? src.u : null;
      for (const [id, q] of r.ing) DC.consume(id, q);
      const it = DC.makeItem(r.out[0], r.out[1]); if (u != null && I[r.out[0]].uses) it.u = u;
      if (!DC.giveItem(it)) { DC.dropAt(it, P.x, P.y); DC.log('No room - dropped the result.', 'warn'); }
      DC.addXP(r.sk || 'craft', 5 + r.t); S.stats.crafted++; if (r.id === 'purify' || r.id === 'boil') { S.stats.purified++; DC.addXP('cook', 2); }
      DC.log('Crafted ' + I[r.out[0]].name + (r.out[1] > 1 ? ' x' + r.out[1] : '') + '.', 'good'); DC.audio.sfx('craft'); DC.emit('inv');
    }, { sfx: 'craft', noise: [4, 1.4] });
  };
  function lockText(r) { const u = r.un; if (u === 'start') return ''; if (u.skill) return 'Needs ' + DC.SKILLS.find((s) => s.id === u.skill).n + ' ' + u.lvl; if (u.book) return 'Find a how-to book or note'; return 'Locked'; }
  let craftSel = null;
  UI.register('craft', {
    pause: 'inv',
    render(e) {
      const a = e.arg || {}; e.tab = e.tab || a.tab || 'craft'; const P = DC.S.player;
      const tabs = h('div', { class: 'tabs' }, [['craft', 'Craft'], ['build', 'Build']].map(([k, n]) => h('div', { class: 'tab' + (e.tab === k ? ' sel' : ''), onclick: () => { e.tab = k; craftSel = null; UI.refresh(e); } }, n)));
      const list = e.tab === 'craft' ? DC.RECIPES : DC.BUILDS;
      const q = (e.cq || '').toLowerCase(), ready = (r) => DC.hasRecipe(r) && (e.tab === 'craft' ? !recipeStatus(r).length : r.mats.every(([id, n]) => DC.countItem(id) >= n));
      const sorted = list.filter((r) => (!q || r.n.toLowerCase().includes(q)) && (!e.onlyReady || ready(r))).sort((x, y) => (ready(y) ? 1 : 0) - (ready(x) ? 1 : 0) || (DC.hasRecipe(y) ? 1 : 0) - (DC.hasRecipe(x) ? 1 : 0));
      const filt = h('div', { class: 'tools' },
        h('input', { type: 'search', placeholder: 'Search recipes', value: e.cq || '', oninput: (ev) => { e.cq = ev.target.value; clearTimeout(e.ft); e.ft = setTimeout(() => { UI.refresh(e); const i = e.el.querySelector('input[type=search]'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 250); } }),
        UI.btn(e.onlyReady ? 'Ready only' : 'All recipes', () => { e.onlyReady = !e.onlyReady; UI.refresh(e); }, 'sm' + (e.onlyReady ? ' sel' : '')));
      const rows = h('div', { class: 'list' });
      if (!sorted.length) rows.append(h('p', { class: 'dim', text: 'No matching recipes.' }));
      for (const r of sorted) {
        const known = DC.hasRecipe(r), need = e.tab === 'craft' ? r.ing : r.mats, miss = known ? (e.tab === 'craft' ? recipeStatus(r) : r.mats.filter(([id, n]) => DC.countItem(id) < n).map(([id]) => 'Need ' + I[id].name)) : [lockText(r)];
        const outId = e.tab === 'craft' ? r.out[0] : (r.id === 'bbed' ? 'sheet' : 'plank');
        const mats = h('div', { class: 'mats' }, known ? need.map(([id, n]) => { const have = DC.countItem(id); return h('span', { class: 'mat ' + (have >= n ? 'have' : 'miss') }, UI.icon(id, 16), have + '/' + n); }) : [h('span', { class: 'mat miss', text: '???' })]);
        rows.append(h('div', { class: 'li recipe' + (craftSel === r.id ? ' sel' : '') + (!known ? ' no' : ''), onclick: () => { DC.audio.sfx('click'); craftSel = r.id; UI.refresh(e); } }, UI.icon(outId), h('div', { class: 't' }, h('span', { text: known ? r.n : '??? ' + r.n }), mats, h('small', { class: miss.length ? (known ? 'red' : 'dim') : 'green', text: miss.length ? miss[0] : 'Ready to make' }))));
      }
      const r = list.find((q) => q.id === craftSel), det = h('div', { class: 'detail' });
      if (!r) det.append(h('span', { class: 'dim', text: 'Select a recipe. Recipes unlock with skill levels and by finding books or notes.' }));
      else {
        const known = DC.hasRecipe(r); det.append(h('h4', { text: r.n }), r.d ? h('p', { text: r.d }) : null);
        const need = (e.tab === 'craft' ? r.ing : r.mats);
        need.forEach(([id, q]) => { const have = DC.countItem(id); det.append(h('div', { class: 'kv' }, h('span', null, I[id].name), h('b', { class: have >= q ? 'green' : 'red', text: have + '/' + q }))); });
        (r.tools || []).forEach((t) => det.append(h('div', { class: 'kv' }, h('span', { text: 'Tool: ' + t.split('|').join(' or ') }), h('b', { class: toolOk(t) ? 'green' : 'red', text: toolOk(t) ? 'ok' : 'missing' }))));
        if (r.station) det.append(h('div', { class: 'kv' }, h('span', { text: r.station === 'bench' ? 'Workbench nearby' : 'Heat source nearby' }), h('b', { class: stationOk(r.station) ? 'green' : 'red', text: stationOk(r.station) ? 'ok' : 'missing' })));
        det.append(h('div', { class: 'kv' }, h('span', { class: 'dim', text: 'Time' }), h('span', { text: (r.t * DC.Player.buildMul()).toFixed(1) + 's' })));
        if (e.tab === 'craft') det.append(h('div', { style: 'margin-top:8px' }, UI.btn(known ? 'Craft' : lockText(r), () => { UI.close('craft'); DC.craft(r); }, 'pri' + (known && !recipeStatus(r).length ? '' : ' off'))));
        else det.append(h('div', { style: 'margin-top:8px' }, UI.btn(known ? 'Place' : lockText(r), () => { UI.close('craft'); DC.Player.enterBuild(r); }, 'pri' + (known ? '' : ' off'))));
        if (e.tab === 'build') det.append(h('p', { class: 'dim', text: 'Place on the grid; aim or tap to move the cursor, then hold Act.' }));
      }
      e.el.append(UI.panel(e.tab === 'craft' ? 'Crafting' : 'Building', h('div', { style: 'display:flex;flex-direction:column;min-height:0;flex:1' }, tabs, filt, UI.scroll(rows, det)), [UI.bi('back', 'Back', () => UI.close('craft'), 'pri')], 'narrow', () => UI.close('craft')));
    },
  });

  // ---------- skills ----------
  UI.register('skills', {
    pause: 'inv',
    render(e) {
      const P = DC.S.player, occ = DC.OCCUPATIONS.find((o) => o.id === P.occ);
      const body = UI.scroll(
        h('div', { class: 'row' }, h('b', { class: 'amber', text: P.name }), h('span', { class: 'dim', text: occ ? occ.n : '' })),
        h('div', null, P.traits.length ? P.traits.map((t) => { const d = DC.TRAITS.find((x) => x.id === t); return h('span', { class: 'chip ' + (d.c > 0 ? 'p' : 'n'), title: d.d, text: d.n }); }) : h('span', { class: 'dim', text: 'No traits' })),
        h('h3', { text: 'Skills (improve by using them)' }),
        DC.SKILLS.map((s) => { const sk = P.skills[s.id], need = DC.xpNeed(sk.lvl); return h('div', null, h('div', { class: 'skill' }, h('span', { class: 'nm', text: s.n }), h('b', { class: 'amber', text: 'Lv ' + sk.lvl }), h('div', { class: 'prog' }, h('i', { style: 'width:' + (sk.lvl >= 10 ? 100 : sk.xp / need * 100) + '%' }))), h('div', { class: 'dim', style: 'font-size:10px;margin:-2px 0 4px 0', text: s.d })); }));
      e.el.append(UI.panel('Character', body, [UI.btn('Done', () => UI.close('skills'), 'pri')], 'narrow', () => UI.close('skills')));
    },
  });

  // ---------- journal ----------
  const jt = { tab: 'obj' };
  UI.register('journal', {
    pause: 'inv',
    render(e) {
      const S = DC.S, P = S.player;
      const tabs = [['obj', 'Objectives'], ['places', 'Places'], ['rec', 'Recipes'], ['notes', 'Notes'], ['ev', 'Events'], ['stats', 'Stats']];
      const tb = h('div', { class: 'tabs' }, tabs.map(([k, n]) => h('div', { class: 'tab' + (jt.tab === k ? ' sel' : ''), onclick: () => { jt.tab = k; UI.refresh(e); } }, n)));
      let c = h('div');
      if (jt.tab === 'obj') {
        const list = DC.Sys.objectiveList(), groups = {}; list.forEach((o) => (groups[o.group] = groups[o.group] || []).push(o));
        c = h('div', null, Object.keys(groups).map((g) => h('div', null, h('h3', { text: g }), groups[g].map((o) => h('div', { class: 'kv', style: 'align-items:flex-start' }, h('span', { class: o.done ? 'green' : '', html: '<i class="chk' + (o.done ? ' on' : '') + '"></i>' + o.text + (o.hint && !o.done ? '<br><span class="dim" style="font-size:10px">' + o.hint + '</span>' : '') }))))));
      } else if (jt.tab === 'places') {
        const px = P.x / T, py = P.y / T, dirs = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'];
        const rowOf = (name, x, y, tag) => { const dx = x - px, dy = y - py, a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)); return h('div', { class: 'kv' }, h('span', null, name, tag ? h('span', { class: 'chip', text: tag }) : null), h('span', { class: 'dim', text: Math.round(Math.hypot(dx, dy)) + 'm ' + dirs[(a + 8) % 8] })); };
        const sf = W.safehouse; const items = [rowOf('Your safehouse', sf.x + sf.w / 2, sf.y + sf.h / 2, 'home')];
        for (const b of W.buildings) if (b.disc && b !== sf && b.type !== 'house') items.push(rowOf(b.name, b.x + b.w / 2, b.y + b.h / 2, b.type));
        const hs = W.buildings.filter((b) => b.disc && b.type === 'house' && b !== sf).length;
        for (const p of W.pois) if (S.disc[p.y * N + p.x] && !W.buildings.some((b) => b.name === p.n)) items.push(rowOf(p.n, p.x, p.y, p.t));
        c = h('div', null, items, hs ? h('p', { class: 'dim', text: 'Houses explored: ' + hs }) : null);
      } else if (jt.tab === 'rec') {
        const known = DC.RECIPES.concat(DC.BUILDS).filter((r) => DC.hasRecipe(r));
        c = h('div', null, known.map((r) => h('div', { class: 'kv', style: 'align-items:flex-start' }, h('span', { text: r.n }), h('span', { class: 'dim', style: 'text-align:right;font-size:10px', text: (r.ing || r.mats).map(([id, q]) => I[id].name + ' x' + q).join(', ') }))));
      } else if (jt.tab === 'notes') {
        const keys = Object.keys(S.journal.notes);
        c = h('div', null, keys.length ? keys.map((k) => h('p', { class: 'dlg', style: 'min-height:0;margin:6px 0', text: DC.LORE[k] })) : h('p', { class: 'dim', text: 'Notes and letters you find appear here.' }), S.npcs.filter((n) => n.hinted).map((n) => h('p', { class: 'dlg', style: 'min-height:0', text: n.def.n + ': ' + n.def.tip })));
      } else if (jt.tab === 'ev') {
        const ev = S.journal.ev.slice().reverse().concat(S.logHist.slice().reverse().map((l) => [l[0], l[1]])).slice(0, 80);
        c = h('div', null, ev.length ? ev.map((x) => h('div', { class: 'kv' }, h('span', { class: 'dim', text: 'D' + (Math.floor(x[0] / 1440) + 1) + ' ' + DC.fmtClock(x[0]) }), h('span', { style: 'text-align:right', text: x[1] }))) : h('p', { class: 'dim', text: 'Nothing yet.' }));
      } else c = UI.statsBody();
      e.el.append(UI.panel('Journal', h('div', { style: 'display:flex;flex-direction:column;min-height:0;flex:1' }, tb, UI.scroll(c)), [UI.btn('Done', () => UI.close('journal'), 'pri')], 'narrow', () => UI.close('journal')));
    },
  });

  // ---------- map ----------
  UI.register('map', {
    pause: 'inv',
    render(e) {
      const cv = DC.render.fullMap(), wrap = h('div', { class: 'mapwrap' });
      const out = document.createElement('canvas'); out.width = cv.width; out.height = cv.height; out.getContext('2d').drawImage(cv, 0, 0); wrap.append(out);
      const body = UI.scroll(wrap, h('div', { class: 'legend' }, h('span', null, h('i', { style: 'background:#fff' }), 'You'), h('span', null, h('i', { style: 'background:#4fd0e0' }), 'Safehouse'), h('span', null, h('i', { style: 'background:#e8c050' }), 'Place'), h('span', null, h('i', { style: 'background:#e0503a' }), 'Threat'), h('span', null, h('i', { style: 'background:#6fb86f' }), 'Survivor')), h('p', { class: 'dim', text: 'Only places you have seen are shown.' }));
      e.el.append(UI.panel('Map', body, [UI.bi('back', 'Back', () => UI.close('map'), 'pri')], 'narrow', () => UI.close('map')));
    },
  });
})();

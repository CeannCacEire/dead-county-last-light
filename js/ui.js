/* Dead County: Last Light - interface: HUD, hotbar, menus, settings, control editor, dialogs. */
(function () {
  'use strict';
  const DC = window.DC, I = DC.ITEMS, T = 16;
  const UI = (DC.UI = { stack: [], reg: {}, sel: {} });
  const $ = (id) => document.getElementById(id);

  // ---------- tiny DOM helper ----------
  function h(tag, props, ...kids) {
    const e = document.createElement(tag);
    if (props) for (const k in props) {
      const v = props[k];
      if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else if (k === 'html') e.innerHTML = v;
      else if (k === 'style') e.style.cssText = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (v !== undefined && v !== null && v !== false) e.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids.flat()) if (c !== null && c !== undefined && c !== false) e.append(c.nodeType ? c : document.createTextNode(c));
    return e;
  }
  UI.h = h;
  UI.ico = (name, size) => { const e = document.createElement('span'); e.className = 'ico'; e.innerHTML = DC.uiIcon(name, size || 18); return e; };
  UI.bi = (icon, label, fn, cls) => h('button', { class: 'b ' + (cls || ''), onclick: (e) => { DC.audio.sfx('click'); fn && fn(e); } }, UI.ico(icon, 18), label ? h('span', { text: label }) : null);
  UI.btn = (label, fn, cls) => h('button', { class: 'b ' + (cls || ''), onclick: (e) => { DC.audio.sfx('click'); DC.gfx && DC.gfx.vibrate(6); fn && fn(e); } }, label);
  UI.toggle = (label, get, set, hint) => {
    const sw = h('div', { class: 'sw' + (get() ? ' on' : '') });
    const row = h('div', { class: 'toggle', onclick: () => { set(!get()); sw.classList.toggle('on', get()); DC.audio.sfx('select'); DC.gfx && DC.gfx.vibrate(6); } }, h('div', null, h('div', { text: label }), hint ? h('div', { class: 'dim', style: 'font-size:10px', text: hint }) : null), sw);
    return row;
  };
  UI.slider = (label, min, max, step, get, set, fmt) => {
    const val = h('span', { class: 'amber', text: (fmt || ((v) => v))(get()) });
    const inp = h('input', { type: 'range', min, max, step, value: get(), oninput: () => { set(+inp.value); val.textContent = (fmt || ((v) => v))(+inp.value); } });
    return h('div', { class: 'col', style: 'padding:4px 0' }, h('div', { class: 'row', style: 'justify-content:space-between' }, h('span', { text: label }), val), inp);
  };
  UI.icon = (id, size) => { const c = document.createElement('canvas'); c.width = c.height = 36; c.getContext('2d').drawImage(DC.iconCanvas(id), 0, 0); if (size) { c.style.width = c.style.height = size + 'px'; } return c; };

  // ---------- screen stack ----------
  UI.register = (name, def) => (UI.reg[name] = def);
  UI.top = () => UI.stack[UI.stack.length - 1] || null;
  UI.isOpen = (name) => UI.stack.some((e) => e.name === name);
  UI.open = function (name, arg) {
    const def = UI.reg[name]; if (!def) return null;
    if (UI.isOpen(name) && !def.multi) { const e = UI.stack.find((q) => q.name === name); e.arg = arg; UI.refresh(e); return e; }
    const el = h('div', { class: 'screen' + (def.solid ? ' solid' : '') + (def.title ? ' title' : '') + (def.passthru ? ' passthru' : '') });
    if (def.passthru) el.style.cssText = 'background:transparent;pointer-events:none';
    const entry = { name, el, def, arg, scroll: [] };
    UI.stack.push(entry); $('screens').appendChild(el);
    // swallow the synthetic click that follows the touch which opened this screen
    if (!def.passthru) { el.classList.add('arming'); setTimeout(() => el.classList.remove('arming'), 380); }
    def.render(entry); DC.hydrateIcons(el); UI.sync(); DC.audio.sfx(def.passthru || def.title ? 'ui' : 'uiopen');
    return entry;
  };
  UI.refresh = function (entry) {
    entry = entry || UI.top(); if (!entry) return;
    entry.scroll = [...entry.el.querySelectorAll('.scroll')].map((s) => s.scrollTop);
    entry.el.innerHTML = ''; entry.def.render(entry);
    [...entry.el.querySelectorAll('.scroll')].forEach((s, i) => { s.scrollTop = entry.scroll[i] || 0; });
  };
  UI.close = function (name) {
    let k = name ? UI.stack.findLastIndex((e) => e.name === name) : UI.stack.length - 1; if (k < 0) return;
    const e = UI.stack.splice(k, 1)[0]; e.el.remove(); e.def.close && e.def.close(e); UI.sync(); DC.audio.sfx('uiclose');
  };
  UI.closeAll = function () { while (UI.stack.length) { const e = UI.stack.pop(); e.el.remove(); e.def.close && e.def.close(e); } UI.sync(); };
  UI.sync = function () {
    const blocking = UI.stack.some((e) => !e.def.passthru);
    DC.Input.blocked = blocking; if (blocking) DC.Input.releaseAll();
  };
  UI.paused = function () {
    for (const e of UI.stack) { if (e.def.pause === true) return true; if (e.def.pause === 'inv' && DC.settings.pauseInv) return true; }
    return false;
  };
  UI.panel = function (title, body, footer, cls, onClose) {
    return h('div', { class: 'panel ' + (cls || '') },
      h('header', null, h('h2', { text: title }), onClose === false ? null : UI.bi('close', 'Close', onClose || (() => UI.close()), 'sm')),
      body, footer ? h('footer', null, footer) : null);
  };
  UI.scroll = (...k) => h('div', { class: 'scroll' }, ...k);

  // ---------- toasts ----------
  DC.on('log', (msg, kind) => {
    const box = $('toasts'); if (!box) return;
    if (kind === 'radio') kind = 'info';
    const d = h('div', { class: kind || 'info', text: msg }); box.appendChild(d);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => d.remove(), 5000);
  });
  DC.on('discover', (b) => { if (b.name && b.type !== 'house') DC.log('Discovered: ' + b.name, 'info'); });

  // ---------- HUD ----------
  const BARS = [['hp', 'Health', '#c4523f', 'heart'], ['food', 'Food', '#d08a3a', 'food'], ['h2o', 'Water', '#4f94c8', 'drop'], ['sta', 'Stamina', '#78a852', 'bolt'], ['rest', 'Energy', '#8a7ab0', 'moon'], ['calm', 'Nerve', '#5fa8a0', 'pulse'], ['temp', 'Body heat', '#d6b448', 'thermo']];
  const barEls = {}; let hudT = 0, hotKey = '', objT = 0, lastObj = '';
  function buildHud() {
    const bars = $('bars'); bars.innerHTML = '';
    for (const [id, nm, col, ic] of BARS) {
      const i = h('i'), s = h('span', { text: '' }), icon = h('span', { class: 'ic', html: DC.uiIcon(ic, 15) });
      const b = h('div', { class: 'bar', title: nm, style: '--c:' + col }, icon, h('div', { class: 'tr' }, i), s); bars.appendChild(b); barEls[id] = { b, i, s, nm };
    }
    const hot = $('c-hot'); hot.innerHTML = '';
    for (let k = 0; k < 6; k++) {
      const s = h('div', { class: 'slot', 'data-i': k }); s.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); if (DC.Input.editing) return; DC.audio.start(); DC.gfx.vibrate(8); DC.emit('hotbar', k); });
      hot.appendChild(s);
    }
    $('minimap').replaceWith(DC.render.minimapCanvas); DC.render.minimapCanvas.id = 'minimap'; DC.render.minimapCanvas.addEventListener('click', () => UI.open('map'));
    $('m-noise').lastChild.innerHTML = DC.uiIcon('noise', 14); $('m-vis').lastChild.innerHTML = DC.uiIcon('eye', 14); $('m-wt').lastChild.innerHTML = DC.uiIcon('weight', 14);
    $('objective').firstChild.innerHTML = DC.uiIcon('target', 14); $('threat').firstChild.innerHTML = DC.uiIcon('skull', 14);
    DC.hydrateIcons(document);
  }
  UI.buildHud = buildHud;
  function setBar(id, v, txt) { const e = barEls[id]; if (!e) return; v = DC.clamp(v, 0, 100); e.i.style.width = v + '%'; e.b.classList.toggle('low', v < 22 && id !== 'temp'); e.s.textContent = txt !== undefined ? txt : Math.round(v); }
  UI.hudUpdate = function (dt) {
    const S = DC.S; if (!S) return; hudT -= dt; const P = S.player;
    // action button and prompt (every frame, cheap)
    const f = S.focus, a = S.act, act = $('c-act'), pr = $('prompt');
    if (S.build) { act.querySelector('b').textContent = 'Build'; act.querySelector('small').textContent = S.build.valid ? 'hold' : S.build.why; act.classList.toggle('dim', !S.build.valid); pr.classList.add('hidden'); }
    else {
      act.classList.toggle('dim', !f);
      const first = f && f.acts[0];
      act.querySelector('b').textContent = first ? first.label.length > 12 ? first.label.slice(0, 11) + '.' : first.label : 'Act';
      act.querySelector('small').textContent = first ? (first.hold ? 'hold' : 'tap') : '';
      if (first && !a) { pr.classList.remove('hidden'); $('prompt-text').textContent = (document.body.classList.contains('notouch') ? '[E] ' : '') + first.label + (f.acts.length > 1 ? (document.body.classList.contains('notouch') ? '  [F] more' : '  (+' + (f.acts.length - 1) + ')') : ''); $('prompt-bar').style.display = 'none'; }
      else if (a) { pr.classList.remove('hidden'); $('prompt-text').textContent = a.label || 'Working'; $('prompt-bar').style.display = 'block'; $('prompt-bar').firstChild.style.width = Math.min(100, (a.breakTile ? (1 - Math.max(0, (S.act.hp || 0) / 100)) * 100 : a.t / Math.max(0.01, a.dur) * 100)) + '%'; }
      else pr.classList.add('hidden');
    }
    act.style.setProperty('--p', a && !a.breakTile ? Math.min(100, a.t / Math.max(0.01, a.dur) * 100) : 0);
    if (hudT > 0) return; hudT = 0.1;
    setBar('hp', P.hp / P.maxhp * 100, Math.round(P.hp)); setBar('food', P.hunger); setBar('h2o', P.thirst); setBar('sta', P.stam / P.maxStam * 100);
    setBar('rest', 100 - P.fatigue); setBar('calm', 100 - P.stress);
    setBar('temp', (P.temp - 33) / 6 * 100, P.temp.toFixed(1));
    barEls.temp.i.style.background = P.temp < 35.5 ? '#4a8ac0' : P.temp > 38 ? '#d0603a' : '#d0b040';
    const chips = [], c = (t, k) => chips.push(h('b', { class: k || '', text: t }));
    if (P.bleed > 0.1) c('Bleeding', 'bad'); if (P.infect > 0) c('Infected', 'bad'); if (P.sick > 0) c('Sick', 'warn'); if (P.sprain > 0) c('Sprain', 'warn');
    if (P.pain > 25) c('Pain', 'warn'); if (P.painkill > 0) c('Numbed', 'good'); if (P.exhausted) c('Winded', 'warn'); if (P.hunger < 25) c('Hungry', 'warn'); if (P.thirst < 25) c('Thirsty', 'warn');
    if (P.fatigue > 75) c('Tired', 'warn'); if (P.stress > 70) c('Panic', 'bad'); if (P.temp < 35.5) c('Cold', 'bad'); else if (P.temp > 38) c('Hot', 'bad'); if (P.wet > 40) c('Wet', 'warn'); if (P.crouch) c('Crouching', 'good');
    const st = $('status'); st.innerHTML = ''; chips.forEach((x) => st.appendChild(x));
    const air = DC.Sys.airTemp ? DC.Sys.airTemp() : 15;
    $('clock').innerHTML = '<b>Day ' + DC.Sys.day() + '  ' + DC.fmtClock(S.t) + '</b>\n' + S.weather.type.charAt(0).toUpperCase() + S.weather.type.slice(1) + '  ' + Math.round(air) + '\u00b0C' + (S.flags.power ? '' : '\n<span class="nope">No power</span>') + (S.flags.water ? '' : '\n<span class="nope">No water</span>');
    $('m-noise').firstChild.style.width = DC.clamp(P.noiseR / 28 * 100, 0, 100) + '%'; $('m-vis').firstChild.style.width = DC.clamp((P.vis || 0) * 100, 0, 100) + '%';
    const wt = DC.carryWeight(), cap = DC.carryCap(); $('m-wt').firstChild.style.width = DC.clamp(wt / cap * 100, 0, 100) + '%'; $('m-wt').classList.toggle('heavy', wt > cap * 0.9);
    const thr = DC.audio.threat, th = $('threat'); if (thr && thr.chasing > 0) { th.classList.remove('hidden', 'near'); $('threat-n').textContent = 'Hunted x' + thr.chasing; } else if (thr && thr.nearest < 14) { th.classList.remove('hidden'); th.classList.add('near'); $('threat-n').textContent = 'Nearby'; } else th.classList.add('hidden');
    objT -= 0.1; if (objT <= 0) { objT = 2; const ob = UI.currentObjective(); const el = $('objective'); if (ob) { el.classList.remove('hidden'); if (ob !== lastObj) { $('obj-text').textContent = ob; if (lastObj) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); DC.audio.sfx('notify'); } lastObj = ob; } } else el.classList.add('hidden'); }
    UI.compassUpdate(P);
    // hotbar
    const key = P.hot.join(',') + '|' + (P.hand ? P.hand.uid : 0) + '|' + DC.allItems().map((i) => i.uid + ':' + i.q + ':' + (i.d | 0)).join(',');
    if (key !== hotKey) { hotKey = key; UI.hotbarRefresh(); }
    const dbg = $('perf'); dbg.classList.toggle('hidden', !DC.settings.overlay); if (DC.settings.overlay) dbg.textContent = DC.render.overlayText() + '\naudio ' + JSON.stringify(DC.audio.status());
    $('c-crc').classList.toggle('on', P.crouch);
    const bb = $('buildbar');
    if (S.build) {
      const d = S.build.def; bb.classList.remove('hidden'); bb.innerHTML = '';
      const mats = d.mats.map(([id, q]) => I[id].name + ' ' + DC.countItem(id) + '/' + q).join(', ');
      bb.append(h('b', { class: 'amber', text: d.n }), h('span', { class: 'dim', text: mats }), h('span', { class: S.build.valid ? 'ok' : 'why', text: S.build.valid ? 'Hold Act to build' : S.build.why }), UI.btn('Cancel', () => DC.Player.exitBuild(), 'sm dng'));
    } else bb.classList.add('hidden');
  };
  // ---------- objective and compass ----------
  UI.currentObjective = function () {
    const S = DC.S; if (!S || !DC.Sys.objectiveList) return '';
    const list = DC.Sys.objectiveList(), main = list.filter((o) => !/^Optional/.test(o.group));
    if (S.mode === 'story') {
      const groups = {}; main.forEach((o) => { (groups[o.group] = groups[o.group] || []).push(o); });
      let best = null, bs = -1; for (const g in groups) { const done = groups[g].filter((o) => o.done).length; if (done > bs && done < groups[g].length) { bs = done; best = groups[g]; } }
      const nx = best && best.find((o) => !o.done); UI.objTarget = nx ? UI.targetFor(nx.id) : null; return nx ? nx.text : '';
    }
    const nx = main.find((o) => !o.done); UI.objTarget = null; return nx ? nx.text : 'Survive as long as you can';
  };
  UI.targetFor = function (id) {
    const W = DC.W;
    if (id === 'b_i' || id === 'b_a') return W.mast ? { x: W.mast.x * T + 8, y: W.mast.y * T + 8 } : null;
    if (id === 'b_e') return W.heli ? { x: W.heli.x * T, y: W.heli.y * T } : { x: 151 * T, y: 133 * T };
    if (id === 'c_e') return { x: 112 * T, y: 6 * T };
    return null;
  };
  let cmpEl = null;
  UI.compassUpdate = function (P) {
    const c = $('compass'); if (!c) return;
    if (!cmpEl) { c.innerHTML = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="none" stroke="#3a4f54" stroke-width="1"/><text x="12" y="8.5" font-size="7" text-anchor="middle" fill="#e0a84a" font-family="sans-serif" font-weight="700">N</text><g id="cmp-need"><path d="M12 11l2.4 6.5L12 16l-2.4 1.5z" fill="#dbe0d6"/></g><circle id="cmp-obj" r="2.2" fill="#e0a84a" cx="12" cy="3" style="display:none"/></svg>'; cmpEl = { need: c.querySelector('#cmp-need'), obj: c.querySelector('#cmp-obj') }; }
    cmpEl.need.setAttribute('transform', 'rotate(' + (P.face * 180 / Math.PI + 90).toFixed(0) + ' 12 12)');
    const t = UI.objTarget; if (t) { const a = Math.atan2(t.y - P.y, t.x - P.x); const r = 9; cmpEl.obj.setAttribute('cx', (12 + Math.cos(a) * r).toFixed(1)); cmpEl.obj.setAttribute('cy', (12 + Math.sin(a) * r).toFixed(1)); cmpEl.obj.style.display = ''; } else cmpEl.obj.style.display = 'none';
  };
  UI.hotbarRefresh = function () {
    const P = DC.S && DC.S.player; if (!P) return; const slots = $('c-hot').children;
    for (let k = 0; k < 6; k++) {
      const s = slots[k]; s.innerHTML = ''; const it = DC.findUid(P.hot[k]);
      s.append(h('span', { class: 'k', text: k + 1 }));
      s.classList.toggle('sel', !!(it && P.hand === it));
      if (it) {
        s.append(UI.icon(it.id)); const d = I[it.id];
        if (it.q > 1) s.append(h('span', { class: 'q', text: it.q }));
        else if (d.uses && it.u > 1) s.append(h('span', { class: 'q', text: it.u }));
        const md = DC.maxDur(it); if (md && it.d !== undefined) { const bar = h('div', { class: 'd' }, h('i')); bar.firstChild.style.width = Math.max(0, it.d / md * 100) + '%'; bar.firstChild.style.background = it.d / md < 0.25 ? '#c8503a' : '#9ccf88'; s.append(bar); }
      }
    }
  };
  DC.on('hotbar', (k) => {
    if (!DC.S || UI.stack.some((e) => !e.def.passthru) || DC.S.player.dead) return;
    const it = DC.findUid(DC.S.player.hot[k]); if (!it) { DC.log('Hotbar slot ' + (k + 1) + ' is empty. Pin items from the inventory.', 'info'); return; }
    DC.useItem(it); UI.hotbarRefresh(); DC.audio.sfx('click');
  });
  DC.on('inv', () => { hotKey = ''; const e = UI.stack.find((q) => q.name === 'inv' || q.name === 'craft'); if (e) UI.refresh(e); });
  DC.on('journal', () => { const e = UI.stack.find((q) => q.name === 'journal'); if (e) UI.refresh(e); });

  // ---------- global key / button routes ----------
  DC.on('ui', (n) => {
    const S = DC.S, inGame = S && UI.game;
    if (n === 'overlay') { DC.settings.overlay = !DC.settings.overlay; DC.Save.saveSettings(); return; }
    if (n === 'escape') {
      const top = UI.top(); if (top && top.def.noEsc) return;
      if (top) { UI.close(); return; }
      if (inGame && S.build) { DC.Player.exitBuild(); return; }
      if (inGame && !S.player.dead) UI.open('pause'); return;
    }
    if (!inGame || S.player.dead) return;
    if (n === 'cancelBuild') { if (S.build) DC.Player.exitBuild(); return; }
    const blocked = UI.stack.some((e) => e.def.noToggle);
    if (blocked) return;
    const tog = (name, arg) => { if (UI.top() && UI.top().name === name) UI.close(name); else if (!UI.top() || !UI.top().def.solid) { UI.closeAll(); if (S.build) DC.Player.exitBuild(); UI.open(name, arg); } };
    if (n === 'inv') tog('inv'); else if (n === 'map') tog('map'); else if (n === 'journal') tog('journal'); else if (n === 'skills') tog('skills'); else if (n === 'craft') tog('craft'); else if (n === 'build') tog('craft', { tab: 'build' }); else if (n === 'pause') tog('pause');
  });
  DC.on('openLoot', (c) => { UI.closeAll(); UI.open('inv', { loot: c }); });
  DC.on('openCraft', (st) => { UI.closeAll(); UI.open('craft', { station: st }); });
  DC.on('actMenu', (f) => { UI.open('actmenu', f); });
  DC.on('talk', (n) => { UI.open('talk', n); });
  DC.on('buildMode', (on) => { if (on) UI.closeAll(); });
  DC.on('death', () => { UI.closeAll(); DC.Save.clear(); setTimeout(() => UI.open('death'), 1400); });
  DC.on('win', () => { UI.closeAll(); DC.Save.clear(); setTimeout(() => UI.open('win'), 1200); });
  DC.on('sleep', (on) => { if (on) UI.open('sleep'); else UI.close('sleep'); });

  // ---------- Main menu ----------
  UI.register('menu', {
    solid: true, title: true, pause: true, noEsc: true, noToggle: true,
    render(e) {
      DC.title.start();
      const has = DC.Save.has(), info = has ? DC.Save.info() : null, S = DC.settings;
      e.el.append(
        h('div', { class: 'corner' }, UI.bi(S.mute ? 'mute' : 'volume', '', () => { S.mute = !S.mute; DC.Save.saveSettings(); DC.audio.apply(); UI.refresh(e); }, 'sm ib ghost')),
        h('div', { class: 'titlebox' },
          h('div', { class: 'logo' }, h('div', { class: 'l1', text: 'DEAD COUNTY' }), h('div', { class: 'l2' }, h('i'), h('span', { text: 'LAST LIGHT' }), h('i'))),
          h('div', { class: 'tmenu' },
            has ? UI.bi('play', 'Continue' + (info ? '  -  ' + info : ''), () => DC.Game.continueGame(), 'pri') : null,
            UI.bi('plus', 'New Survivor', () => UI.open('create'), has ? '' : 'pri'),
            UI.bi('info', 'How to Play', () => UI.open('howto')),
            UI.bi('gear', 'Settings', () => UI.open('settings'))),
          h('div', { class: 'ver', text: 'VERSION 1.0' })));
    },
    close() { DC.title.stop(); },
  });

  // ---------- Character creation ----------
  const cr = { name: 'Alex', occ: 'nurse', traits: [], mode: 'story', preset: 'normal', set: null, seed: '' };
  UI.register('create', {
    pause: true,
    render(e) {
      const spent = cr.traits.reduce((a, id) => a + DC.TRAITS.find((t) => t.id === id).c, 0), left = 3 - spent;
      const P = DC.PRESETS[cr.preset]; if (!cr.set) cr.set = Object.assign({}, P);
      const name = h('input', { type: 'text', maxlength: 18, value: cr.name, oninput: () => (cr.name = name.value) });
      const occ = h('div', { class: 'grid2' }, DC.OCCUPATIONS.map((o) => h('div', { class: 'card' + (cr.occ === o.id ? ' sel' : ''), onclick: () => { cr.occ = o.id; UI.refresh(e); } }, h('h4', { text: o.n }), h('p', { text: o.d }), h('p', { class: 'blue', text: 'Kit: ' + o.kit.map((k) => I[k[0]].name + (k[1] > 1 ? ' x' + k[1] : '')).join(', ') }))));
      const traits = h('div', { class: 'grid2' }, DC.TRAITS.map((t) => {
        const on = cr.traits.includes(t.id), can = on || t.c <= left;
        return h('div', { class: 'card' + (on ? ' sel' : ''), style: can ? '' : 'opacity:.4', onclick: () => { if (on) cr.traits = cr.traits.filter((x) => x !== t.id); else if (can) cr.traits.push(t.id); UI.refresh(e); } }, h('h4', { html: t.n + ' <span class="' + (t.c > 0 ? 'red' : 'green') + '">' + (t.c > 0 ? '-' + t.c : '+' + (-t.c)) + '</span>' }), h('p', { text: t.d }));
      }));
      const modes = [['story', 'Story', 'Escape the county. Three routes: signal beacon, checkpoint keycard, or endure 21 days.'], ['endless', 'Endless Survival', 'No rescue. Survive as many days as you can.'], ['sandbox', 'Sandbox', 'Endless, with your own world settings.']];
      const modeEl = h('div', { class: 'grid2' }, modes.map((m) => h('div', { class: 'card' + (cr.mode === m[0] ? ' sel' : ''), onclick: () => { cr.mode = m[0]; UI.refresh(e); } }, h('h4', { text: m[1] }), h('p', { text: m[2] }))));
      const diff = h('div', { class: 'grid2' }, Object.keys(DC.PRESETS).map((k) => h('div', { class: 'card' + (cr.preset === k ? ' sel' : ''), onclick: () => { cr.preset = k; cr.set = Object.assign({}, DC.PRESETS[k]); UI.refresh(e); } }, h('h4', { text: DC.PRESETS[k].name }), h('p', { text: 'Zombies x' + DC.PRESETS[k].zombies + ', loot x' + DC.PRESETS[k].loot + ', power fails day ' + DC.PRESETS[k].powerDay }))));
      let sb = null;
      if (cr.mode === 'sandbox') {
        const S = cr.set, sl = (l, k, a, b, st, f) => UI.slider(l, a, b, st, () => S[k], (v) => (S[k] = v), f || ((v) => 'x' + v));
        sb = h('div', null, h('h3', { text: 'Sandbox settings' }), sl('Zombie population', 'zombies', 0, 3, 0.1), sl('Loot abundance', 'loot', 0.2, 3, 0.1), sl('Weather severity', 'weather', 0, 2.5, 0.1), sl('Day length (real minutes)', 'dayLen', 6, 60, 1, (v) => v + ' min'), sl('Survival needs rate', 'needs', 0.2, 2.5, 0.1), sl('Power fails on day', 'powerDay', 1, 30, 1, (v) => v), sl('Water fails on day', 'waterDay', 1, 30, 1, (v) => v));
      }
      const body = UI.scroll(
        h('div', { class: 'lbl', text: 'Name' }), name,
        h('h3', { text: 'Background' }), occ,
        h('h3', { html: 'Traits <span class="dim">(' + left + ' points left - weaknesses give points)</span>' }), traits,
        h('h3', { text: 'Mode' }), modeEl,
        h('h3', { text: 'Difficulty' }), diff, sb,
        h('h3', { text: 'World seed (optional)' }), h('input', { type: 'text', placeholder: 'random', value: cr.seed, maxlength: 12, oninput: (ev) => (cr.seed = ev.target.value) }));
      e.el.append(UI.panel('New Survivor', body, [UI.btn('Back', () => UI.close(), ''), UI.btn('Begin', () => {
        const seed = cr.seed ? [...cr.seed].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7) : (Math.random() * 1e9) | 0;
        DC.Game.newGame({ name: cr.name.trim() || 'Survivor', occ: cr.occ, traits: cr.traits.slice(), mode: cr.mode, preset: cr.preset, set: Object.assign({}, cr.set), seed });
      }, 'pri')], 'wide'));
    },
  });

  // ---------- Settings ----------
  let setTab = 'graphics';
  UI.register('settings', {
    pause: true,
    render(e) {
      const s = DC.settings, save = () => { DC.Save.saveSettings(); DC.audio.apply(); }, pct = (v) => Math.round(v * 100) + '%';
      const gfx = () => { save(); DC.gfx.refresh(); };
      const acc = () => { save(); DC.Input.applyAccess(); };
      const opt = (label, cur, list, set) => h('div', { class: 'col' }, h('div', { class: 'lbl', text: label }), h('div', { class: 'seg' }, list.map(([v, t]) => UI.btn(t, () => { set(v); UI.refresh(e); }, 'sm' + (cur === v ? ' sel' : '')))));
      const tabs = [['graphics', 'Graphics', 'sun'], ['audio', 'Audio', 'volume'], ['controls', 'Controls', 'hand'], ['access', 'Accessibility', 'eye'], ['game', 'Game', 'gear']];
      let body;
      if (setTab === 'graphics') {
        body = [
          opt('Quality', s.gfx || 'auto', [['auto', 'Auto'], ['perf', 'Performance'], ['low', 'Low'], ['medium', 'Medium'], ['high', 'High']], (v) => { s.gfx = v; gfx(); }),
          h('p', { class: 'note', text: 'Now: ' + DC.gfx.PRESETS[DC.gfx.level].name + '. Performance mode removes lighting and shadows and keeps the game readable on older phones.' }),
          UI.toggle('Adjust quality automatically', () => s.autoQuality !== false, (v) => { s.autoQuality = v; if (!v) DC.gfx.autoDrop = 0; gfx(); }, 'Lowers detail if the frame rate drops'),
          h('h3', { text: 'Effects' }),
          UI.toggle('Colour grading and vignette', () => s.postfx !== false, (v) => { s.postfx = v; gfx(); }),
          UI.toggle('Film grain', () => s.grain !== false, (v) => { s.grain = v; gfx(); }),
          UI.toggle('Reduced particles', () => !!s.redParticles, (v) => { s.redParticles = v; gfx(); }),
          UI.toggle('Reduced shadows', () => !!s.redShadows, (v) => { s.redShadows = v; gfx(); }),
          UI.toggle('Reduced lighting', () => !!s.redLight, (v) => { s.redLight = v; gfx(); }),
          UI.toggle('Reduced weather effects', () => !!s.redWeather, (v) => { s.redWeather = v; gfx(); }),
          UI.toggle('Reduced camera shake', () => !!s.redShake, (v) => { s.redShake = v; gfx(); }),
          h('h3', { text: 'View' }),
          UI.slider('Base zoom (0 = auto)', 0, 6, 0.5, () => s.zoom, (v) => { s.zoom = v; save(); DC.render.resize(); }, (v) => (v ? 'x' + v : 'auto')),
          UI.toggle('Noise rings', () => s.noiseRing, (v) => { s.noiseRing = v; save(); }),
          UI.toggle('Performance overlay', () => !!s.overlay, (v) => { s.overlay = v; save(); }, 'F3 also toggles'),
        ];
      } else if (setTab === 'audio') {
        body = [
          UI.toggle('Mute all audio', () => s.mute, (v) => { s.mute = v; save(); }, 'The game is fully playable without sound'),
          UI.slider('Master volume', 0, 1, 0.05, () => s.master === undefined ? 1 : s.master, (v) => { s.master = v; save(); }, pct),
          UI.slider('Music', 0, 1, 0.05, () => s.music, (v) => { s.music = v; save(); }, pct),
          UI.slider('Effects', 0, 1, 0.05, () => s.sfx, (v) => { s.sfx = v; save(); }, pct),
          UI.slider('Ambience and weather', 0, 1, 0.05, () => s.amb === undefined ? 0.7 : s.amb, (v) => { s.amb = v; save(); }, pct),
          UI.slider('Interface', 0, 1, 0.05, () => s.uivol === undefined ? 0.6 : s.uivol, (v) => { s.uivol = v; save(); DC.audio.sfx('click'); }, pct),
          UI.toggle('Low-power audio mode', () => !!s.lowPowerAudio, (v) => { s.lowPowerAudio = v; save(); }, 'Fewer simultaneous sounds, no reverb. Applies at next launch.'),
          UI.toggle('Vibration feedback', () => s.haptics !== false, (v) => { s.haptics = v; save(); }, 'Short haptic pulses on touch devices'),
        ];
      } else if (setTab === 'controls') {
        body = [
          UI.toggle('Left-handed layout', () => !!s.leftHand, (v) => { s.leftHand = v; save(); DC.Input.applyLayout(); }, 'Mirrors the sticks and buttons'),
          UI.slider('Button opacity', 0.3, 1, 0.05, () => s.ctlOpacity === undefined ? 0.85 : s.ctlOpacity, (v) => { s.ctlOpacity = v; save(); DC.Input.applyAccess(); }, pct),
          UI.toggle('Button labels', () => s.btnLabels !== false, (v) => { s.btnLabels = v; acc(); }),
          UI.toggle('On-screen controls on desktop', () => s.showTouch, (v) => { s.showTouch = v; save(); DC.Input.applyLayout(); }, 'Touch devices always show them'),
          UI.toggle('Aim assist', () => s.aimAssist, (v) => { s.aimAssist = v; save(); }),
          UI.toggle('Tap once for long actions', () => s.holdToggle, (v) => { s.holdToggle = v; save(); }, 'Instead of holding the Act button'),
          h('h3', { text: 'Buttons' }),
          h('div', { class: 'grid2' }, DC.Input.OPTIONAL.map((id) => UI.toggle(DC.Input.NAMES[id], () => !DC.Input.isHidden(id), (v) => { s.hideBtn = s.hideBtn || {}; s.hideBtn[id] = !v; save(); DC.Input.applyLayout(); }))),
          h('div', { class: 'row', style: 'margin-top:10px' }, UI.bi('hand', 'Move and resize buttons', () => UI.open('ctledit'), 'pri'), UI.btn('Reset layout', () => { DC.Input.resetLayout(); s.hideBtn = {}; s.leftHand = false; save(); DC.Input.applyLayout(); UI.refresh(e); })),
          h('p', { class: 'note', text: 'Pinch with two fingers on the right side, or use the mouse wheel, to zoom.' }),
        ];
      } else if (setTab === 'access') {
        body = [
          UI.toggle('Reduce motion', () => !!s.reduceMotion, (v) => { s.reduceMotion = v; save(); DC.gfx.refresh(); DC.Input.applyAccess(); }, 'Calmer camera, no sway, simpler interface animation'),
          UI.toggle('High-contrast interface', () => !!s.hiContrast, (v) => { s.hiContrast = v; acc(); }),
          UI.toggle('Colour-blind friendly colours', () => !!s.colorBlind, (v) => { s.colorBlind = v; acc(); }, 'Blue and amber palette with shape markers'),
          UI.toggle('Larger text', () => !!s.bigText, (v) => { s.bigText = v; acc(); }),
          UI.toggle('Compact HUD', () => !!s.hudCompact, (v) => { s.hudCompact = v; acc(); }, 'Icons only, no numbers'),
          UI.toggle('Compass', () => s.compass !== false, (v) => { s.compass = v; acc(); }),
          UI.toggle('Gameplay hints', () => s.hints, (v) => { s.hints = v; save(); }, 'Short tips in the message feed'),
          UI.toggle('Combat gore', () => s.gore, (v) => { s.gore = v; save(); }, 'Off removes blood effects'),
        ];
      } else {
        body = [
          UI.toggle('Pause while inventory is open', () => s.pauseInv, (v) => { s.pauseInv = v; save(); }, 'Off = real-time looting (dangerous)'),
          h('h3', { text: 'Save data' }),
          h('p', { class: 'note', text: 'Progress is stored in this browser only. Nothing is sent anywhere.' }),
          UI.btn('Delete saved game', () => UI.open('confirm', { text: 'Delete your saved game? Settings and layout are kept.', ok: () => { DC.Save.clear(); const m = UI.stack.find((q) => q.name === 'menu'); if (m) UI.refresh(m); DC.log('Saved game deleted.', 'info'); } }), 'dng'),
        ];
      }
      const tb = h('div', { class: 'tabs' }, tabs.map(([id, nm, ic]) => h('div', { class: 'tab' + (setTab === id ? ' sel' : ''), onclick: () => { setTab = id; DC.audio.sfx('tab'); UI.refresh(e); } }, UI.ico(ic, 15), nm)));
      e.el.append(h('div', { class: 'panel' }, h('header', null, h('h2', { text: 'Settings' }), UI.bi('close', 'Done', () => UI.close(), 'sm')), tb, UI.scroll(...body)));
    },
  });
  UI.register('confirm', { pause: true, multi: true, render(e) { const a = e.arg; e.el.append(UI.panel('Confirm', h('div', { class: 'menu' }, h('p', { text: a.text }), h('div', { class: 'row' }, UI.btn('Cancel', () => UI.close('confirm')), UI.btn('Yes', () => { UI.close('confirm'); a.ok(); }, 'dng'))), null, 'narrow', false)); } });

  // ---------- Control editor ----------
  let drag = null, edSel = 'act';
  UI.register('ctledit', {
    passthru: true, pause: true, noEsc: false,
    render(e) {
      DC.Input.editing = true; document.body.classList.add('editing'); $('controls').classList.remove('hidden'); $('controls').style.zIndex = 12; if (UI.game) $('hud').classList.remove('hidden');
      const step = (d) => { const l = DC.Input.getLayout(edSel); DC.Input.setLayout(edSel, { cx: l.cx, cy: l.cy, s: l.s + d }); DC.Save.saveSettings(); UI.refresh(e); };
      const l = DC.Input.getLayout(edSel);
      const names = Object.keys(DC.Input.NAMES);
      e.el.append(h('div', { class: 'ctl-edit-hint' },
        h('div', { class: 'col' }, h('b', { class: 'amber', text: 'Customise controls (' + (DC.Input.orient() === 'p' ? 'portrait' : 'landscape') + ')' }), h('span', { class: 'dim', text: 'Drag a control to move it. Tap to select, then resize.' }),
          h('div', { class: 'row', style: 'justify-content:center' }, names.map((n) => UI.btn(DC.Input.NAMES[n], () => { edSel = n; UI.refresh(e); }, 'sm' + (edSel === n ? ' sel' : '')))),
          h('div', { class: 'row', style: 'justify-content:center' }, UI.btn('-', () => step(-0.1), 'sm'), h('span', { text: DC.Input.NAMES[edSel] + ' size x' + l.s.toFixed(1) }), UI.btn('+', () => step(0.1), 'sm'), DC.Input.OPTIONAL.includes(edSel) ? UI.btn(DC.Input.isHidden(edSel) ? 'Show' : 'Hide', () => { DC.settings.hideBtn = DC.settings.hideBtn || {}; DC.settings.hideBtn[edSel] = !DC.Input.isHidden(edSel); DC.Save.saveSettings(); UI.refresh(e); }, 'sm') : null, UI.btn('Reset all', () => { DC.Input.resetLayout(); DC.Save.saveSettings(); UI.refresh(e); }, 'sm dng'), UI.btn('Done', () => UI.close('ctledit'), 'sm pri')))));
      for (const id of names) {
        const el = $('c-' + id); el.classList.toggle('sel-edit', id === edSel); el.style.outlineColor = id === edSel ? '#fff' : '';
        el.onpointerdown = (ev) => { if (!DC.Input.editing) return; ev.preventDefault(); ev.stopPropagation(); el.setPointerCapture(ev.pointerId); drag = { id, el }; if (edSel !== id) { edSel = id; UI.refresh(e); } };
        el.onpointermove = (ev) => { if (!drag || drag.id !== id) return; const L = DC.Input.getLayout(id); DC.Input.setLayout(id, { cx: ev.clientX / window.innerWidth * 100, cy: ev.clientY / window.innerHeight * 100, s: L.s }); };
        el.onpointerup = el.onpointercancel = () => { if (drag) { drag = null; DC.Save.saveSettings(); } };
      }
    },
    close(e) {
      DC.Input.editing = false; document.body.classList.remove('editing'); $('controls').style.zIndex = '';
      for (const id of Object.keys(DC.Input.NAMES)) { const el = $('c-' + id); el.onpointerdown = el.onpointermove = el.onpointerup = el.onpointercancel = null; el.style.outlineColor = ''; }
      if (!UI.game) $('controls').classList.add('hidden'); DC.Save.saveSettings(); DC.Input.applyLayout();
    },
  });

  // ---------- How to play ----------
  UI.register('howto', {
    pause: true,
    render(e) {
      const body = UI.scroll(
        h('h3', { text: 'Touch' }),
        h('p', { html: '<b>Left thumb</b>: drag anywhere on the lower left to move. The stick floats where you touch.' }),
        h('p', { html: '<b>Right thumb</b>: drag to aim, tap to face a point, and pinch with two fingers to zoom. Use <b>Attack</b> to strike.' }),
        h('p', { html: '<b>Act</b> performs the highlighted action; hold it for searching, breaking and looting. <b>Search</b> lists every action nearby. <b>Sprint</b> costs stamina. <b>Crouch</b> is slow and quiet. <b>Pack</b> opens the inventory, and the round buttons open the map, journal, flashlight and quick heal.' }),
        h('p', { text: 'Tap a hotbar slot to use or equip the pinned item. Pin items from the inventory.' }),
        h('h3', { text: 'Keyboard and mouse' }),
        h('p', { html: 'WASD move, Shift sprint, Ctrl or C crouch, E interact (hold), F action list, mouse aims, left click or Space attacks, wheel zooms, Tab inventory, 1-6 hotbar, R craft, B build, L flashlight, H quick heal, M map, J journal, K skills, Esc pause, F3 performance overlay.' }),
        h('h3', { text: 'Survival' }),
        h('p', { text: 'Noise draws the dead. Sprinting, hard ground and combat are loud; crouching on grass or carpet is quiet. They lose interest when they cannot see or hear you. Close doors, board windows, and always keep a way out.' }),
        h('p', { text: 'Eat, drink, rest, treat bleeding with bandages and purify water. Power and water will fail. Build a shelter, then widen your range.' }),
        h('h3', { text: 'Story routes' }),
        h('p', { text: 'A: assemble a signal beacon at the fire station mast and survive until the helicopter arrives. B: find the keycard at the police station and open the northern checkpoint. C: simply endure 21 days.' }));
      e.el.append(UI.panel('How to Play', body, null, 'narrow'));
    },
  });

  // ---------- Pause ----------
  UI.register('pause', {
    pause: true,
    render(e) {
      e.el.append(UI.panel('Paused', h('div', { class: 'menu' },
        UI.bi('play', 'Resume', () => UI.close(), 'pri'),
        h('div', { class: 'grid2' },
          UI.bi('bag', 'Inventory', () => { UI.close(); UI.open('inv'); }), UI.bi('book', 'Journal', () => { UI.close(); UI.open('journal'); }),
          UI.bi('skill', 'Skills', () => { UI.close(); UI.open('skills'); }), UI.bi('map', 'Map', () => { UI.close(); UI.open('map'); })),
        UI.bi('menu', 'Survival statistics', () => UI.open('stats')),
        UI.bi('gear', 'Settings', () => UI.open('settings')),
        UI.bi('save', 'Save game', () => { DC.Save.save(); DC.log('Game saved.', 'good'); UI.close(); }),
        UI.bi('home', 'Save and quit to menu', () => { DC.Save.save(); DC.Game.toMenu(); }, 'dng')), null, 'narrow', false));
    },
  });

  // ---------- Action menu ----------
  UI.register('actmenu', {
    pause: false, multi: false,
    render(e) {
      const f = e.arg; if (!f || !f.acts) { UI.close('actmenu'); return; }
      const list = f.acts.map((a) => h('button', { class: 'b' + (a.disabled ? ' off' : ''), style: 'justify-content:space-between;width:100%', onclick: () => { UI.close('actmenu'); DC.Player.startAct(a, f); } }, h('span', { text: a.label }), h('span', { class: 'dim', style: 'font-size:10px;text-transform:none', text: a.disabled ? a.why || '' : (a.dur ? (a.hold ? 'hold ' : '') + a.dur.toFixed(1) + 's' : '') })));
      e.el.append(UI.panel('Actions', h('div', { class: 'menu' }, list), null, 'narrow'));
    },
  });

  // ---------- NPC dialogue ----------
  UI.register('talk', {
    pause: true,
    render(e) {
      const n = e.arg, d = n.def, P = DC.S.player; e.say = e.say || d.lines[0];
      const say = (t) => { e.say = t; UI.refresh(e); };
      const gifts = DC.allItems().filter((it) => { const x = I[it.id]; return x.fd || x.dr || x.med || x.cat === 'food' || x.cat === 'water' || x.cat === 'medicine'; }).slice(0, 8);
      const body = UI.scroll(
        h('div', { class: 'row' }, h('b', { class: 'amber', text: d.n }), h('span', { class: 'dim', text: d.role })),
        h('div', { class: 'row' }, h('span', { class: 'dim', text: 'Trust' }), h('div', { class: 'prog grow' }, h('i', { style: 'width:' + n.trust + '%' })), h('span', { text: Math.round(n.trust) })),
        h('div', { class: 'dlg', text: '"' + e.say + '"' }),
        h('div', { class: 'col' },
          UI.btn('Talk', () => { n.talks++; n.trust = Math.min(100, n.trust + (n.talks < 6 ? 1.5 : 0.3)); say(d.lines[n.talks % d.lines.length]); }),
          UI.btn('Ask for advice', () => { if (n.trust >= 25) { n.hinted++; say(d.tip); } else say('I do not know you well enough yet.'); }),
          n.trust >= 70 && !n.gift ? UI.btn('Accept their gift', () => { n.gift = true; const it = DC.makeItem(d.gift, 1); if (!DC.giveItem(it)) DC.dropAt(it, P.x, P.y); DC.log(d.n.split(' ')[0] + ' gave you ' + I[d.gift].name + '.', 'good'); DC.emit('inv'); say('Take it. You have earned it.'); }, 'pri') : null,
          h('h3', { text: 'Give something' }),
          gifts.length ? gifts.map((it) => h('div', { class: 'list' }, h('div', { class: 'li', onclick: () => { DC.Life.gift(n, it); DC.audio.sfx('pickup'); say('Thank you. I will not forget it.'); } }, UI.icon(it.id), h('div', { class: 't', text: DC.itemName(it) + (it.q > 1 ? ' x' + it.q : '') })))) : h('p', { class: 'dim', text: 'You have nothing suitable to give.' })));
      e.el.append(UI.panel(d.n, body, [UI.btn('Leave', () => UI.close('talk'), 'pri')], 'narrow', () => UI.close('talk')));
    },
  });

  // ---------- Sleep overlay ----------
  UI.register('sleep', {
    passthru: true, pause: false,
    render(e) {
      e.el.append(h('div', { style: 'position:absolute;left:50%;bottom:22%;transform:translateX(-50%);pointer-events:auto;text-align:center;background:rgba(5,7,7,.85);border:1px solid var(--line);padding:10px 16px' },
        h('div', { class: 'amber', text: 'Sleeping... ' + DC.fmtClock(DC.S.t) }), h('p', { class: 'dim', text: 'Time passes quickly. Loud noises wake you.' }), UI.btn('Wake up', () => DC.Sys.wake('You wake up.'), 'pri')));
      clearTimeout(e.tm); e.tm = setTimeout(() => { if (UI.isOpen('sleep')) UI.refresh(UI.stack.find((q) => q.name === 'sleep')); }, 1000);
    },
    close(e) { clearTimeout(e.tm); },
  });

  // ---------- Death / Win / Stats ----------
  function statsBody() {
    const S = DC.S, st = S.stats, rows = [['Days survived', DC.Sys.day()], ['Time survived', DC.fmtDur(S.t - 450)], ['Zombies put down', st.kills], ['Distance travelled', Math.round(st.dist / T) + ' m'], ['Containers searched', st.searched], ['Items looted', st.looted], ['Things crafted', st.crafted], ['Structures built', st.built], ['Openings barricaded', st.barricades], ['Meals eaten', st.eaten], ['Medicine used', st.medUsed], ['Damage taken', Math.round(st.damage)], ['Alarms set off', st.alarms], ['Water purified', st.purified], ['Times slept', st.sleeps], ['Gifts given', st.gifts]];
    return h('div', { class: 'stat-grid' }, rows.map((r) => h('div', { class: 'kv' }, h('span', { class: 'dim', text: r[0] }), h('b', { text: String(r[1]) }))));
  }
  UI.statsBody = statsBody;
  UI.register('stats', { pause: true, multi: true, render(e) { e.el.append(UI.panel('Survival Statistics', UI.scroll(statsBody()), null, 'narrow', () => UI.close('stats'))); } });
  UI.register('death', {
    solid: true, pause: true, noEsc: true, noToggle: true,
    render(e) {
      const S = DC.S;
      e.el.append(h('div', { class: 'panel narrow' }, h('div', { class: 'endhead' }, h('div', { class: 'bigmsg red', text: 'YOU DIED' }), h('p', { class: 'amber', text: S.dead ? S.dead.cause : 'Unknown causes.' }), h('p', { text: 'Survived ' + DC.fmtDur(S.t - 450) + ' (day ' + DC.Sys.day() + ')' })),
        UI.scroll(statsBody()), h('footer', null, UI.btn('Main menu', () => DC.Game.toMenu()), UI.btn('New survivor', () => { DC.Game.toMenu(); UI.open('create'); }, 'pri'))));
    },
  });
  UI.register('win', {
    solid: true, pause: true, noEsc: true, noToggle: true,
    render(e) {
      const S = DC.S, how = S.won ? S.won.how : '';
      if (!e.vic) { e.vic = true; DC.audio.victory && DC.audio.victory(); }
      const txt = { beacon: 'The rescue helicopter lifts off over Dead County. You made it out.', checkpoint: 'The checkpoint gate grinds open. You walk north and do not look back.', endurance: 'Twenty-one days. The county is quiet, and you are still standing. A convoy arrives at dawn.' }[how] || 'You survived.';
      e.el.append(h('div', { class: 'panel narrow' }, h('div', { class: 'endhead' }, h('div', { class: 'bigmsg green', text: 'SURVIVED' }), h('p', { text: txt }), h('p', { class: 'amber', text: 'Time: ' + DC.fmtDur(S.t - 450) })),
        UI.scroll(statsBody()), h('footer', null, UI.btn('Main menu', () => DC.Game.toMenu()), UI.btn('Keep exploring', () => { UI.close('win'); }, 'pri'))));
    },
  });

  UI.init = function () { buildHud(); };
})();

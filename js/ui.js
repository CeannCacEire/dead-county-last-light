/* Dead County: Last Light - UI core: HUD, hotbar, menus, settings, control editor, dialogs. */
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
  UI.btn = (label, fn, cls) => h('button', { class: 'b ' + (cls || ''), onclick: (e) => { DC.audio.sfx('ui'); fn && fn(e); } }, label);
  UI.toggle = (label, get, set, hint) => {
    const sw = h('div', { class: 'sw' + (get() ? ' on' : '') });
    const row = h('div', { class: 'toggle', onclick: () => { set(!get()); sw.classList.toggle('on', get()); DC.audio.sfx('ui'); } }, h('div', null, h('div', { text: label }), hint ? h('div', { class: 'dim', style: 'font-size:10px', text: hint }) : null), sw);
    return row;
  };
  UI.slider = (label, min, max, step, get, set, fmt) => {
    const val = h('span', { class: 'amber', text: (fmt || ((v) => v))(get()) });
    const inp = h('input', { type: 'range', min, max, step, value: get(), oninput: () => { set(+inp.value); val.textContent = (fmt || ((v) => v))(+inp.value); } });
    return h('div', { class: 'col', style: 'padding:4px 0' }, h('div', { class: 'row', style: 'justify-content:space-between' }, h('span', { text: label }), val), inp);
  };
  UI.icon = (id, size) => { const c = document.createElement('canvas'); c.width = c.height = 16; c.getContext('2d').drawImage(DC.iconCanvas(id), 0, 0); if (size) { c.style.width = c.style.height = size + 'px'; } return c; };

  // ---------- screen stack ----------
  UI.register = (name, def) => (UI.reg[name] = def);
  UI.top = () => UI.stack[UI.stack.length - 1] || null;
  UI.isOpen = (name) => UI.stack.some((e) => e.name === name);
  UI.open = function (name, arg) {
    const def = UI.reg[name]; if (!def) return null;
    if (UI.isOpen(name) && !def.multi) { const e = UI.stack.find((q) => q.name === name); e.arg = arg; UI.refresh(e); return e; }
    const el = h('div', { class: 'screen' + (def.solid ? ' solid' : '') + (def.passthru ? ' passthru' : '') });
    if (def.passthru) el.style.cssText = 'background:transparent;pointer-events:none';
    const entry = { name, el, def, arg, scroll: [] };
    UI.stack.push(entry); $('screens').appendChild(el);
    // swallow the synthetic click that follows the touch which opened this screen
    if (!def.passthru) { el.classList.add('arming'); setTimeout(() => el.classList.remove('arming'), 380); }
    def.render(entry); UI.sync();
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
    const e = UI.stack.splice(k, 1)[0]; e.el.remove(); e.def.close && e.def.close(e); UI.sync();
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
      h('header', null, h('h2', { text: title }), onClose === false ? null : UI.btn('Close', onClose || (() => UI.close()), 'sm')),
      body, footer ? h('footer', null, footer) : null);
  };
  UI.scroll = (...k) => h('div', { class: 'scroll' }, ...k);

  // ---------- toasts ----------
  DC.on('log', (msg, kind) => {
    const box = $('toasts'); if (!box) return;
    if (kind === 'radio') kind = 'info';
    const d = h('div', { class: kind || 'info', text: msg }); box.appendChild(d);
    while (box.children.length > 4) box.firstChild.remove();
    setTimeout(() => d.remove(), 5000);
  });
  DC.on('discover', (b) => { if (b.name && b.type !== 'house') DC.log('Discovered: ' + b.name, 'info'); });

  // ---------- HUD ----------
  const BARS = [['hp', 'HEALTH', '#b5483a'], ['food', 'FOOD', '#c8863a'], ['h2o', 'WATER', '#4a8ac0'], ['sta', 'STAMINA', '#6f9f4e'], ['rest', 'ENERGY', '#8a7ab0'], ['calm', 'NERVE', '#5fa8a0'], ['temp', 'TEMP', '#d0b040']];
  const barEls = {}; let hudT = 0, hotKey = '';
  function buildHud() {
    const bars = $('bars'); bars.innerHTML = '';
    for (const [id, nm, col] of BARS) { const i = h('i'); i.style.background = col; const s = h('span', { text: nm }); const b = h('div', { class: 'bar' }, i, s); bars.appendChild(b); barEls[id] = { b, i, s, nm }; }
    const hot = $('c-hot'); hot.innerHTML = '';
    for (let k = 0; k < 6; k++) {
      const s = h('div', { class: 'slot', 'data-i': k }); s.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); if (DC.Input.editing) return; DC.audio.start(); DC.emit('hotbar', k); });
      hot.appendChild(s);
    }
    $('minimap').replaceWith(DC.render.minimapCanvas); DC.render.minimapCanvas.id = 'minimap'; DC.render.minimapCanvas.addEventListener('click', () => UI.open('map'));
  }
  UI.buildHud = buildHud;
  function setBar(id, v, txt) { const e = barEls[id]; if (!e) return; v = DC.clamp(v, 0, 100); e.i.style.width = v + '%'; e.b.classList.toggle('low', v < 22 && id !== 'temp'); if (txt !== undefined) e.s.textContent = e.nm + ' ' + txt; }
  UI.hudUpdate = function (dt) {
    const S = DC.S; if (!S) return; hudT -= dt; const P = S.player;
    // action button and prompt (every frame, cheap)
    const f = S.focus, a = S.act, act = $('c-act'), pr = $('prompt');
    if (S.build) { act.querySelector('b').textContent = 'BUILD'; act.querySelector('small').textContent = S.build.valid ? 'hold' : S.build.why; act.classList.toggle('dim', !S.build.valid); pr.classList.add('hidden'); }
    else {
      act.classList.toggle('dim', !f);
      const first = f && f.acts[0];
      act.querySelector('b').textContent = first ? first.label.length > 12 ? first.label.slice(0, 11) + '.' : first.label : 'ACT';
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
    if (P.bleed > 0.1) c('BLEEDING', 'bad'); if (P.infect > 0) c('INFECTED', 'bad'); if (P.sick > 0) c('SICK', 'warn'); if (P.sprain > 0) c('SPRAIN', 'warn');
    if (P.pain > 25) c('PAIN', 'warn'); if (P.painkill > 0) c('NUMB', 'good'); if (P.exhausted) c('WINDED', 'warn'); if (P.hunger < 25) c('HUNGRY', 'warn'); if (P.thirst < 25) c('THIRSTY', 'warn');
    if (P.fatigue > 75) c('TIRED', 'warn'); if (P.stress > 70) c('PANIC', 'bad'); if (P.temp < 35.5) c('COLD', 'bad'); else if (P.temp > 38) c('HOT', 'bad'); if (P.wet > 40) c('WET', 'warn'); if (P.crouch) c('CROUCH', 'good');
    const st = $('status'); st.innerHTML = ''; chips.forEach((x) => st.appendChild(x));
    const air = DC.Sys.airTemp ? DC.Sys.airTemp() : 15;
    $('clock').textContent = 'Day ' + DC.Sys.day() + '  ' + DC.fmtClock(S.t) + '\n' + S.weather.type.toUpperCase() + ' ' + Math.round(air) + 'C' + (S.flags.power ? '' : '\nNO POWER') + (S.flags.water ? '' : '\nNO WATER');
    $('m-noise').firstChild.style.width = DC.clamp(P.noiseR / 28 * 100, 0, 100) + '%'; $('m-vis').firstChild.style.width = DC.clamp((P.vis || 0) * 100, 0, 100) + '%';
    // hotbar
    const key = P.hot.join(',') + '|' + (P.hand ? P.hand.uid : 0) + '|' + DC.allItems().map((i) => i.uid + ':' + i.q + ':' + (i.d | 0)).join(',');
    if (key !== hotKey) { hotKey = key; UI.hotbarRefresh(); }
    const dbg = $('debug'); dbg.classList.toggle('hidden', !DC.settings.debug); if (DC.settings.debug) dbg.textContent = DC.render.debugText();
    $('c-crc').classList.toggle('on', P.crouch);
    const bb = $('buildbar');
    if (S.build) {
      const d = S.build.def; bb.classList.remove('hidden'); bb.innerHTML = '';
      const mats = d.mats.map(([id, q]) => I[id].name + ' ' + DC.countItem(id) + '/' + q).join(', ');
      bb.append(h('b', { class: 'amber', text: d.n }), h('span', { class: 'dim', text: mats }), h('span', { class: S.build.valid ? 'ok' : 'why', text: S.build.valid ? 'OK - hold ACT to build' : S.build.why }), UI.btn('Cancel', () => DC.Player.exitBuild(), 'sm dng'));
    } else bb.classList.add('hidden');
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
    if (n === 'debug') { DC.settings.debug = !DC.settings.debug; DC.Save.saveSettings(); return; }
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
    solid: true, pause: true, noEsc: true, noToggle: true,
    render(e) {
      const has = DC.Save.has();
      const info = has ? DC.Save.info() : null;
      e.el.append(h('div', { class: 'panel narrow' },
        h('div', { class: 'title' }, h('h1', { html: 'DEAD COUNTY<small>LAST LIGHT</small>' }), h('div', { class: 'tag', text: 'ORIGINAL AI-GENERATED DEMO' })),
        h('div', { class: 'menu' },
          has ? UI.btn('Continue' + (info ? ' - ' + info : ''), () => DC.Game.continueGame(), 'pri') : null,
          UI.btn('New Survivor', () => UI.open('create'), has ? '' : 'pri'),
          UI.btn('How to Play', () => UI.open('howto')),
          UI.btn('Settings', () => UI.open('settings')),
          h('p', { class: 'dim', style: 'text-align:center;font-size:10px;margin-top:8px', html: 'A top-down survival prototype. All art, sound and code are original and generated procedurally. No Project Zomboid or Minecraft assets are used.' }))));
    },
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
  UI.register('settings', {
    pause: true,
    render(e) {
      const s = DC.settings, save = () => { DC.Save.saveSettings(); DC.audio.apply(); };
      const body = UI.scroll(
        h('h3', { text: 'Audio' }),
        UI.slider('Music', 0, 1, 0.05, () => s.music, (v) => { s.music = v; save(); }, (v) => Math.round(v * 100) + '%'),
        UI.slider('Effects', 0, 1, 0.05, () => s.sfx, (v) => { s.sfx = v; save(); }, (v) => Math.round(v * 100) + '%'),
        UI.toggle('Mute all audio', () => s.mute, (v) => { s.mute = v; save(); }),
        h('h3', { text: 'Gameplay' }),
        UI.toggle('Combat gore', () => s.gore, (v) => { s.gore = v; save(); }, 'Off removes all blood effects'),
        UI.toggle('Pause while inventory is open', () => s.pauseInv, (v) => { s.pauseInv = v; save(); }, 'Off = real-time looting (dangerous)'),
        UI.toggle('Aim assist', () => s.aimAssist, (v) => { s.aimAssist = v; save(); }),
        UI.toggle('Hold-to-toggle actions', () => s.holdToggle, (v) => { s.holdToggle = v; save(); }, 'Tap once to start long actions instead of holding'),
        UI.toggle('Gameplay hints', () => s.hints, (v) => { s.hints = v; save(); }, 'One-time tips in the message log'),
        UI.toggle('Show noise rings', () => s.noiseRing, (v) => { s.noiseRing = v; save(); }),
        UI.toggle('On-screen controls on desktop', () => s.showTouch, (v) => { s.showTouch = v; save(); DC.Input.applyLayout(); }, 'Touch devices always show them'),
        h('h3', { text: 'Display' }),
        UI.slider('Zoom (0 = auto)', 0, 6, 0.5, () => s.zoom, (v) => { s.zoom = v; save(); DC.render.resize(); }, (v) => (v ? 'x' + v : 'auto')),
        UI.toggle('Performance / debug overlay', () => s.debug, (v) => { s.debug = v; save(); }, 'F3 also toggles'),
        h('h3', { text: 'Controls' }),
        h('div', { class: 'row' }, UI.btn('Customise touch controls', () => UI.open('ctledit'), 'pri'), UI.btn('Reset layout', () => { DC.Input.resetLayout(); save(); })),
        h('h3', { text: 'Save data' }),
        h('p', { class: 'dim', text: 'The game saves to this browser only (browser storage). Nothing is sent anywhere.' }),
        UI.btn('Reset save', () => UI.open('confirm', { text: 'Delete your saved game? Settings and layout are kept.', ok: () => { DC.Save.clear(); if (UI.game && UI.isOpen('pause')) {} UI.refresh(UI.stack.find((q) => q.name === 'menu')); DC.log('Save deleted.', 'warn'); } }), 'dng'));
      e.el.append(UI.panel('Settings', body, null, 'narrow'));
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
          h('div', { class: 'row', style: 'justify-content:center' }, UI.btn('-', () => step(-0.1), 'sm'), h('span', { text: DC.Input.NAMES[edSel] + ' size x' + l.s.toFixed(1) }), UI.btn('+', () => step(0.1), 'sm'), UI.btn('Reset all', () => { DC.Input.resetLayout(); DC.Save.saveSettings(); UI.refresh(e); }, 'sm dng'), UI.btn('Done', () => UI.close('ctledit'), 'sm pri')))));
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
      if (!UI.game) $('controls').classList.add('hidden'); DC.Save.saveSettings();
    },
  });

  // ---------- How to play ----------
  UI.register('howto', {
    pause: true,
    render(e) {
      const body = UI.scroll(
        h('h3', { text: 'Touch' }),
        h('p', { html: '<b>Left thumb</b>: drag anywhere on the lower left to move (floating joystick, eight directions).' }),
        h('p', { html: '<b>Right thumb</b>: drag anywhere on the right half to aim. Tap to face a point. Use HIT to attack.' }),
        h('p', { html: '<b>ACT</b> does the highlighted action (hold for searching, breaking and looting). <b>USE</b> opens every available action. <b>RUN</b> sprints (costs stamina). <b>SNK</b> toggles crouch: quiet and slow. <b>BAG</b> opens the inventory.' }),
        h('p', { html: 'Tap a hotbar slot to use or equip the pinned item. Pin items from the inventory.' }),
        h('h3', { text: 'Keyboard and mouse' }),
        h('p', { html: 'WASD move, Shift sprint, Ctrl or C crouch, E interact (hold), F action menu, mouse aims, left click or Space attacks, Tab inventory, 1-6 hotbar, R craft, B build, M map, J journal, K skills, Esc pause, F3 debug.' }),
        h('h3', { text: 'Survival' }),
        h('p', { text: 'Noise draws zombies. Sprinting, hard ground and combat are loud. Crouching on grass or carpet is quiet. Zombies lose interest when they cannot see or hear you. Close doors, board windows, and keep a way out.' }),
        h('p', { text: 'Eat, drink, rest, treat bleeding with bandages, purify water. Power and water will fail. Build a shelter, then expand your range.' }),
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
        UI.btn('Resume', () => UI.close(), 'pri'),
        UI.btn('Inventory', () => { UI.close(); UI.open('inv'); }), UI.btn('Journal', () => { UI.close(); UI.open('journal'); }), UI.btn('Skills', () => { UI.close(); UI.open('skills'); }), UI.btn('Map', () => { UI.close(); UI.open('map'); }),
        UI.btn('Survival statistics', () => UI.open('stats')),
        UI.btn('Settings', () => UI.open('settings')),
        UI.btn('Save game', () => { DC.Save.save(); DC.log('Game saved.', 'good'); UI.close(); }),
        UI.btn('Save and quit to menu', () => { DC.Save.save(); DC.Game.toMenu(); }, 'dng')), null, 'narrow', false));
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
      e.el.append(h('div', { class: 'panel narrow' }, h('div', { class: 'title' }, h('div', { class: 'bigmsg red', text: 'YOU DIED' }), h('p', { class: 'amber', text: S.dead ? S.dead.cause : 'Unknown causes.' }), h('p', { text: 'Survived ' + DC.fmtDur(S.t - 450) + ' (day ' + DC.Sys.day() + ')' })),
        UI.scroll(statsBody()), h('footer', null, UI.btn('Main menu', () => DC.Game.toMenu()), UI.btn('New survivor', () => { DC.Game.toMenu(); UI.open('create'); }, 'pri'))));
    },
  });
  UI.register('win', {
    solid: true, pause: true, noEsc: true, noToggle: true,
    render(e) {
      const S = DC.S, how = S.won ? S.won.how : '';
      const txt = { beacon: 'The rescue helicopter lifts off over Dead County. You made it out.', checkpoint: 'The checkpoint gate grinds open. You walk north and do not look back.', endurance: 'Twenty-one days. The county is quiet, and you are still standing. A convoy arrives at dawn.' }[how] || 'You survived.';
      e.el.append(h('div', { class: 'panel narrow' }, h('div', { class: 'title' }, h('div', { class: 'bigmsg green', text: 'SURVIVED' }), h('p', { text: txt }), h('p', { class: 'amber', text: 'Time: ' + DC.fmtDur(S.t - 450) })),
        UI.scroll(statsBody()), h('footer', null, UI.btn('Main menu', () => DC.Game.toMenu()), UI.btn('Keep exploring', () => { UI.close('win'); }, 'pri'))));
    },
  });

  UI.init = function () { buildHud(); };
})();

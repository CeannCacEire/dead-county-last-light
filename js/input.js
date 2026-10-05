/* Dead County: Last Light - touch, mouse and keyboard input. Floating joystick, drag-to-aim, large buttons, user-customisable layout. */
(function () {
  'use strict';
  const DC = window.DC;
  const inp = (DC.inp = { move: { x: 0, y: 0 }, sprint: false, aim: { active: false, angle: 0, moved: false, tap: null }, attackEdge: false, attackHeld: false, actEdge: false, actHeld: false, menuEdge: false });
  const In = (DC.Input = { blocked: false, editing: false });
  const BASE = { act: 92, atk: 80, int: 68, spr: 68, crc: 68, inv: 62, joy: 120, hot: 0 };
  In.BASE = BASE;
  In.NAMES = { act: 'Action', atk: 'Attack', int: 'Interact menu', spr: 'Sprint', crc: 'Crouch', inv: 'Inventory', joy: 'Joystick', hot: 'Hotbar' };
  const DEF = {
    p: { joy: [21, 80, 1], act: [78, 82, 1.15], atk: [51, 90, 1], spr: [62, 72, 1], crc: [90, 64, 1], int: [90, 48, 1], inv: [10, 50, 1], hot: [43, 60, 1] },
    l: { joy: [14, 72, 1], act: [89, 72, 1.1], atk: [76, 86, 1], spr: [84, 44, 1], crc: [72, 62, 1], int: [93, 44, 1], inv: [7, 46, 1], hot: [50, 91, 1.12] },
  };
  In.orient = function () { return window.innerHeight >= window.innerWidth ? 'p' : 'l'; };
  In.getLayout = function (id, o) {
    o = o || In.orient(); const u = DC.settings.ctl && DC.settings.ctl[o] && DC.settings.ctl[o][id]; const d = DEF[o][id];
    return u ? { cx: u.cx, cy: u.cy, s: u.s } : { cx: d[0], cy: d[1], s: d[2] };
  };
  In.setLayout = function (id, v, o) {
    o = o || In.orient(); const c = DC.settings.ctl; c[o] = c[o] || {}; const min = id === 'hot' ? 0.6 : Math.max(0.6, 56 / BASE[id]);
    c[o][id] = { cx: DC.clamp(v.cx, 4, 96), cy: DC.clamp(v.cy, 4, 96), s: DC.clamp(v.s, min, 1.8) }; In.applyLayout();
  };
  In.resetLayout = function () { DC.settings.ctl = {}; In.applyLayout(); };
  In.applyLayout = function () {
    const o = In.orient();
    const touch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (window.matchMedia && matchMedia('(pointer:coarse)').matches);
    document.body.classList.toggle('notouch', !touch && !DC.settings.showTouch);
    for (const id of Object.keys(BASE)) {
      const el = document.getElementById('c-' + id); if (!el) continue; const l = In.getLayout(id, o);
      el.style.left = l.cx + '%'; el.style.top = l.cy + '%'; el.style.setProperty('--s', l.s);
      if (id !== 'hot' && id !== 'joy') { const px = Math.round(BASE[id] * l.s); el.style.width = el.style.height = px + 'px'; }
    }
    const ghost = document.getElementById('c-joy'); if (ghost && !joy.id) { const l = In.getLayout('joy', o); ghost.style.left = l.cx + '%'; ghost.style.top = l.cy + '%'; }
  };

  const joy = { id: null, ox: 0, oy: 0, r: 52 };
  const aimP = { id: null, sx: 0, sy: 0, t0: 0, moved: false, ang0: 0 };
  let holdT = 0, mouseSeen = false, canvas, game;
  const keys = {};

  function setMove(dx, dy, mag) {
    if (mag < 0.14) { inp.move.x = inp.move.y = 0; return; }
    const a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);   // eight-direction
    const m = Math.min(1, mag);
    inp.move.x = Math.cos(a) * m; inp.move.y = Math.sin(a) * m;
    if (Math.abs(inp.move.x) < 1e-6) inp.move.x = 0; if (Math.abs(inp.move.y) < 1e-6) inp.move.y = 0;
  }
  function joyEl() { return document.getElementById('c-joy'); }
  function showJoy(on, x, y) {
    const el = joyEl(); if (!el) return; el.classList.toggle('active', on);
    if (on) { el.style.left = x + 'px'; el.style.top = y + 'px'; } else In.applyLayout();
  }
  function knob(dx, dy) { const k = document.querySelector('#c-joy .knob'); if (k) k.style.transform = 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px))'; }

  function canvasDown(e) {
    if (In.blocked) return;
    DC.audio.start();
    if (e.pointerType === 'mouse') {
      if (e.button === 0) { inp.attackHeld = true; inp.attackEdge = true; mouseAim(e); }
      return;
    }
    const w = window.innerWidth, h = window.innerHeight;
    canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
    if (e.clientX < w * 0.5 && e.clientY > h * 0.22 && joy.id === null) {
      joy.id = e.pointerId; joy.ox = e.clientX; joy.oy = e.clientY; showJoy(true, joy.ox, joy.oy); knob(0, 0); setMove(0, 0, 0);
    } else if (aimP.id === null) {
      aimP.id = e.pointerId; aimP.sx = e.clientX; aimP.sy = e.clientY; aimP.t0 = performance.now(); aimP.moved = false;
      inp.aim.moved = false;
    }
  }
  function canvasMove(e) {
    if (In.blocked) return;
    if (e.pointerType === 'mouse') { mouseAim(e); return; }
    if (e.pointerId === joy.id) {
      let dx = e.clientX - joy.ox, dy = e.clientY - joy.oy, d = Math.hypot(dx, dy);
      if (d > joy.r * 1.5) { const k = (d - joy.r * 1.5) / d; joy.ox += dx * k; joy.oy += dy * k; showJoy(true, joy.ox, joy.oy); dx = e.clientX - joy.ox; dy = e.clientY - joy.oy; d = Math.hypot(dx, dy); }
      const m = Math.min(d, joy.r); knob(d ? dx / d * m : 0, d ? dy / d * m : 0); setMove(dx, dy, d / joy.r);
    } else if (e.pointerId === aimP.id) {
      const dx = e.clientX - aimP.sx, dy = e.clientY - aimP.sy, d = Math.hypot(dx, dy);
      if (d > 8) { aimP.moved = true; inp.aim.moved = true; inp.aim.active = true; holdT = 0; inp.aim.angle = Math.atan2(dy, dx); }
      // let the reference point follow so direction changes feel responsive
      if (d > 70) { const k = (d - 70) / d; aimP.sx += dx * k; aimP.sy += dy * k; }
    }
  }
  function canvasUp(e) {
    if (e.pointerType === 'mouse') { if (e.button === 0) inp.attackHeld = false; return; }
    if (e.pointerId === joy.id) { joy.id = null; inp.move.x = inp.move.y = 0; showJoy(false); knob(0, 0); }
    if (e.pointerId === aimP.id) {
      const dt = performance.now() - aimP.t0;
      if (!aimP.moved && dt < 280) {
        const wp = DC.render.screenToWorld(e.clientX, e.clientY); inp.aim.tap = { wx: wp.x, wy: wp.y };
        if (DC.S && !DC.S.build) { const P = DC.S.player; inp.aim.angle = Math.atan2(wp.y - P.y, wp.x - P.x); inp.aim.active = true; holdT = 1.0; }
      } else if (aimP.moved) holdT = 0.9;   // keep facing briefly after release
      aimP.id = null; inp.aim.moved = false;
    }
  }
  function mouseAim(e) {
    if (!DC.S || e.pointerType !== 'mouse') return; mouseSeen = true;
    const P = DC.S.player, sp = DC.render.worldToScreen(P.x, P.y);
    inp.aim.angle = Math.atan2(e.clientY - sp.y, e.clientX - sp.x); inp.aim.active = true; holdT = 99; inp.aim.moved = true;
    const wp = DC.render.screenToWorld(e.clientX, e.clientY); In.mouseWorld = wp;
  }

  function bindButton(id, down, up) {
    const el = document.getElementById(id); if (!el) return;
    el.addEventListener('pointerdown', (e) => {
      if (In.editing) return; e.preventDefault(); e.stopPropagation(); DC.audio.start(); el.setPointerCapture && el.setPointerCapture(e.pointerId); el.classList.add('down'); down && down(e);
    });
    const end = (e) => { if (In.editing) return; el.classList.remove('down'); up && up(e); };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  }

  function toggleCrouch() { if (!DC.S || DC.S.player.dead) return; const P = DC.S.player; P.crouch = !P.crouch; document.getElementById('c-crc').classList.toggle('on', P.crouch); DC.audio.sfx('click'); }
  In.toggleCrouch = toggleCrouch;

  In.init = function () {
    canvas = document.getElementById('game'); game = document.getElementById('app');
    canvas.addEventListener('pointerdown', canvasDown); canvas.addEventListener('pointermove', canvasMove);
    canvas.addEventListener('pointerup', canvasUp); canvas.addEventListener('pointercancel', canvasUp);
    window.addEventListener('pointerup', (e) => { if (e.pointerType === 'mouse' && e.button === 0) inp.attackHeld = false; });
    bindButton('c-act', () => { inp.actEdge = true; inp.actHeld = true; }, () => { inp.actHeld = false; });
    bindButton('c-atk', () => { inp.attackEdge = true; inp.attackHeld = true; }, () => { inp.attackHeld = false; });
    bindButton('c-int', () => { inp.menuEdge = true; });
    bindButton('c-spr', () => { inp.sprint = true; }, () => { inp.sprint = false; });
    bindButton('c-crc', () => { toggleCrouch(); });
    bindButton('c-inv', () => { DC.emit('ui', 'inv'); });
    // touch hardening
    const stop = (e) => { if (!e.target.closest || !e.target.closest('.scroll')) e.preventDefault(); };
    document.addEventListener('touchmove', stop, { passive: false });
    document.addEventListener('touchstart', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
    document.addEventListener('gesturestart', (e) => e.preventDefault()); document.addEventListener('gesturechange', (e) => e.preventDefault());
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('selectstart', (e) => { if (!(e.target.closest && e.target.closest('input,textarea'))) e.preventDefault(); });
    document.addEventListener('dragstart', (e) => e.preventDefault());
    let lastTouchEnd = 0; document.addEventListener('touchend', (e) => { const n = Date.now(); if (n - lastTouchEnd < 300) e.preventDefault(); lastTouchEnd = n; }, { passive: false });
    document.addEventListener('wheel', (e) => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
    try { history.pushState({ dc: 1 }, ''); window.addEventListener('popstate', () => { history.pushState({ dc: 1 }, ''); DC.emit('ui', 'pause'); }); } catch (e) {}
    window.addEventListener('beforeunload', (e) => { if (DC.S && !DC.S.dead && !DC.S.won && DC.Save) DC.Save.save(true); });
    window.addEventListener('keydown', keyDown); window.addEventListener('keyup', keyUp);
    window.addEventListener('blur', In.releaseAll);
    window.addEventListener('resize', () => { In.applyLayout(); DC.render.resize(); }); window.addEventListener('orientationchange', () => setTimeout(() => { In.applyLayout(); DC.render.resize(); }, 150));
    In.applyLayout();
  };
  In.releaseAll = function () {
    for (const k in keys) keys[k] = false; inp.move.x = inp.move.y = 0; inp.sprint = false; inp.attackHeld = false; inp.actHeld = false; inp.aim.active = false; holdT = 0;
    joy.id = null; aimP.id = null; showJoy(false);
  };
  function typing(e) { const t = e.target; return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT'); }
  function keyDown(e) {
    if (typing(e)) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (['Tab', 'F3', ' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) || (e.ctrlKey && k !== 'r')) e.preventDefault();
    DC.audio.start();
    if (e.repeat) { return; }
    keys[k] = true;
    if (k === 'Escape') { DC.emit('ui', 'escape'); return; }
    if (k === 'Tab') { DC.emit('ui', 'inv'); return; }
    if (k === 'F3') { DC.emit('ui', 'debug'); return; }
    if (k === 'm') { DC.emit('ui', 'map'); return; } if (k === 'j') { DC.emit('ui', 'journal'); return; } if (k === 'k') { DC.emit('ui', 'skills'); return; }
    if (k === 'r' && !e.ctrlKey) { DC.emit('ui', 'craft'); return; } if (k === 'b') { DC.emit('ui', 'build'); return; } if (k === 'p') { DC.emit('ui', 'pause'); return; }
    if (In.blocked) return;
    if (k >= '1' && k <= '6') { DC.emit('hotbar', +k - 1); return; }
    if (k === 'e') { inp.actEdge = true; inp.actHeld = true; }
    else if (k === 'f') inp.menuEdge = true;
    else if (k === ' ') { inp.attackEdge = true; inp.attackHeld = true; }
    else if (k === 'Control' || k === 'c') toggleCrouch();
    else if (k === 'q') DC.emit('ui', 'cancelBuild');
  }
  function keyUp(e) {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; keys[k] = false;
    if (k === 'e') inp.actHeld = false; if (k === ' ') inp.attackHeld = false;
  }
  In.update = function (dt) {
    // keyboard movement merges when joystick idle
    if (In.blocked) { inp.move.x = inp.move.y = 0; inp.sprint = false; inp.attackHeld = false; inp.actHeld = false; return; }
    if (joy.id === null) {
      let x = (keys.d || keys.ArrowRight ? 1 : 0) - (keys.a || keys.ArrowLeft ? 1 : 0), y = (keys.s || keys.ArrowDown ? 1 : 0) - (keys.w || keys.ArrowUp ? 1 : 0);
      if (x || y) { const m = Math.hypot(x, y); inp.move.x = x / m; inp.move.y = y / m; } else if (!inp.move.x && !inp.move.y) { /* idle */ } else inp.move.x = inp.move.y = 0;
    }
    const shift = keys.Shift; if (shift) inp.sprint = true; else if (!document.getElementById('c-spr').classList.contains('down')) inp.sprint = false;
    if (holdT > 0 && aimP.id === null) { holdT -= dt; if (holdT <= 0) { inp.aim.active = false; inp.aim.moved = false; } }
    document.getElementById('c-spr').classList.toggle('on', inp.sprint);
  };
})();

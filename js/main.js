/* Dead County: Last Light - boot, game loop and game-state transitions. */
(function () {
  'use strict';
  const DC = window.DC, $ = (id) => document.getElementById(id);
  const Game = (DC.Game = { running: false });
  let last = 0, autosave = 0, acc = 0;

  function show(on) { $('hud').classList.toggle('hidden', !on); $('controls').classList.toggle('hidden', !on); }
  function start() {
    Game.running = true; DC.UI.game = true; DC.UI.closeAll(); show(true);
    DC.tiles.chunks.clear(); DC.render.resize(); DC.render.snapCamera();
    DC.S.player.crouch = false; DC.Input.applyLayout(); DC.UI.hotbarRefresh(); DC.audio.start();
    autosave = 30; DC.emit('inv');
    if (DC.S.mode === 'story' && DC.S.t < 460) DC.log('Story: escape the county. Open the Journal (J) for routes.', 'info');
  }
  Game.newGame = function (cfg) { DC.Save.clear(); hintT = 0; DC.Sys.newGame(cfg); start(); DC.Save.save(true); };
  Game.continueGame = function () { if (DC.Save.load()) start(); else { DC.Save.clear(); DC.UI.refresh(DC.UI.top()); } };
  Game.toMenu = function () { Game.running = false; DC.UI.game = false; DC.UI.closeAll(); show(false); DC.Input.releaseAll(); DC.UI.open('menu'); };

  // one-time contextual hints (can be disabled in settings)
  let hintT = 0;
  function hint(key, text) {
    const st = DC.settings; if (!st.hints || st.seen[key]) return false;
    st.seen[key] = 1; DC.log(text, 'info'); DC.Save.saveSettings(); return true;
  }
  function hints(dt) {
    hintT -= dt; if (hintT > 0) return; hintT = 1.5;
    const S = DC.S, P = S.player, desk = document.body.classList.contains('notouch');
    if (S.rt > 4 && hint('move', desk ? 'WASD moves, the mouse aims, E interacts, Tab opens the inventory.' : 'Drag the lower left to move, the right side to aim. Act interacts, Pack opens the inventory.')) return;
    if (S.focus && S.focus.kind === 'tile' && S.focus.acts[0] && /search/.test(S.focus.acts[0].id) && hint('search', 'Hold ' + (desk ? 'E' : 'Act') + ' to search a container. It takes time and makes a little noise.')) return;
    if (P.chased && hint('chase', 'Break line of sight, shut doors behind you and keep moving. Sprinting is loud and tiring.')) return;
    if (P.bleed > 0 && hint('bleed', 'You are bleeding. Open the inventory and apply a bandage.')) return;
    if (DC.Sys.hour() >= 18.5 && hint('dusk', 'Night is falling. Visibility drops and zombies are harder to spot. Barricade windows and hold up.')) return;
    if (P.hunger < 45 && hint('hungry', 'You are getting hungry. Eat from the inventory or the hotbar. Cooked food lasts longer.')) return;
    if (P.thirst < 45 && hint('thirsty', 'You are thirsty. Boil or purify dirty water before drinking.')) return;
    if (S.flags && !S.flags.power && hint('power', 'The power is out. Interiors are dark; carry a light.')) return;
  }
  function step(dt) {
    const S = DC.S, ds = DC.Sys.dayScale(), gdt = dt * ds * 60 * (S.sleeping ? 18 : 1);
    DC.Sys.update(dt);
    if (S.player.dead) { DC.Z.update(dt, gdt); DC.fx.update(dt); return; }
    DC.Player.update(dt);
    DC.Z.update(dt, gdt);
    DC.Life.update(dt);
    DC.Player.updateThrown(dt);
    DC.fx.update(dt);
    hints(dt);
  }
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000; last = now; if (!(dt > 0)) dt = 0.016; dt = Math.min(dt, 0.1);
    DC.Input.update(dt);
    if (!Game.running) { DC.audio.update(dt, true); return; }
    const paused = DC.UI.paused();
    if (!paused) { step(dt); autosave -= dt; if (autosave <= 0) { autosave = 30; DC.Save.save(true); } }
    DC.render.frame(paused ? 0 : dt);
    DC.UI.hudUpdate(dt);
    DC.audio.update(paused ? 0 : dt);
  }
  Game.advance = function (secs) { const n = Math.round(secs / 0.05); for (let k = 0; k < n; k++) step(0.05); };

  function boot() {
    DC.Save.loadSettings(); DC.Input.applyAccess();
    ['pointerdown', 'keydown', 'touchend'].forEach((ev) => document.addEventListener(ev, () => DC.audio.start(), { passive: true }));
    DC.render.init($('game')); DC.Input.init(); DC.UI.init();
    document.addEventListener('visibilitychange', () => { if (document.hidden) { DC.Input.releaseAll(); if (Game.running) DC.Save.save(true); } });
    window.addEventListener('pagehide', () => { if (Game.running) DC.Save.save(true); });
    DC.UI.open('menu');
    requestAnimationFrame((t) => { last = t; frame(t); });
    DC.boot = true;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();

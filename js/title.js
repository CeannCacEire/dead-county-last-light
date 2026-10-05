/* Dead County: Last Light - animated title backdrop: dusk skyline, drifting mist, rain and a failing streetlamp. */
(function () {
  'use strict';
  const DC = window.DC;
  const Ti = (DC.title = { running: false });
  let cv, c, W = 0, H = 0, raf = 0, last = 0, t = 0, sky, layers = [], drops = [], mist = [], flash = 0, nextFlash = 6, lampOn = 1, lampT = 0;
  let seed = 7; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

  function build() {
    const sc = DC.settings && DC.settings.gfx === 'perf' ? 0.4 : 0.55;
    W = Math.max(240, Math.round(window.innerWidth * sc)); H = Math.max(240, Math.round(window.innerHeight * sc));
    cv.width = W; cv.height = H; c = cv.getContext('2d'); seed = 11;
    const hor = H * 0.68;
    // skyline layers: far, mid, near
    layers = [];
    [[0.42, '#1a2a30', 0.35, 0.16], [0.3, '#121d22', 0.55, 0.2], [0.2, '#0b1316', 0.85, 0.26]].forEach(([hh, col, par, wm], li) => {
      const bl = []; let x = -20;
      while (x < W + 60) {
        const w = (14 + rnd() * 34) * (W / 360) * (1 + li * 0.15), bh = H * hh * (0.35 + rnd() * 0.75);
        const wins = []; for (let k = 0; k < w * bh / (li === 2 ? 90 : 160); k++) wins.push([rnd(), rnd(), rnd() < 0.18 + li * 0.04, rnd() * 9]);
        bl.push({ x, w, h: bh, wins, roof: rnd(), ant: rnd() < 0.2 }); x += w + rnd() * 4;
      }
      layers.push({ bl, col, par, base: hor + li * H * 0.015, li });
    });
    drops = []; for (let i = 0; i < Math.round(W * H / 2600); i++) drops.push([rnd() * W, rnd() * H, 0.6 + rnd() * 0.8]);
    mist = []; for (let i = 0; i < 6; i++) mist.push({ x: rnd() * W, y: hor - H * 0.08 + rnd() * H * 0.2, r: W * (0.25 + rnd() * 0.3), s: 4 + rnd() * 8, a: 0.05 + rnd() * 0.06 });
    sky = c.createLinearGradient(0, 0, 0, hor);
    sky.addColorStop(0, '#0a1418'); sky.addColorStop(0.5, '#1d3036'); sky.addColorStop(0.85, '#5c4a3a'); sky.addColorStop(1, '#8a5f3a');
  }

  function frame(now) {
    if (!Ti.running) return; raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now; t += dt;
    const reduce = DC.settings && DC.settings.reduceMotion;
    const hor = H * 0.68;
    c.fillStyle = sky; c.fillRect(0, 0, W, H);
    // stars and moon
    c.fillStyle = 'rgba(220,230,225,.55)'; for (let i = 0; i < 40; i++) { const x = (i * 97.3) % W, y = (i * 53.7) % (hor * 0.55); c.fillRect(x, y, 1, 1); }
    const mg = c.createRadialGradient(W * 0.78, H * 0.16, 2, W * 0.78, H * 0.16, H * 0.14); mg.addColorStop(0, 'rgba(230,225,200,.9)'); mg.addColorStop(0.18, 'rgba(210,215,200,.5)'); mg.addColorStop(1, 'rgba(210,215,200,0)');
    c.fillStyle = mg; c.fillRect(0, 0, W, hor);
    // skyline
    const drift = reduce ? 0 : Math.sin(t * 0.05) * 6;
    for (const L of layers) {
      const ox = drift * L.par;
      for (const b of L.bl) {
        const x = b.x + ox, y = L.base - b.h; c.fillStyle = L.col; c.fillRect(x, y, b.w, b.h + H);
        if (b.roof > 0.7) c.fillRect(x + b.w * 0.2, y - 4, b.w * 0.25, 4); if (b.ant) c.fillRect(x + b.w * 0.5, y - 12, 1, 12);
        if (L.li > 0) for (const w of b.wins) { if (!w[2]) continue; const flick = reduce ? 1 : (Math.sin(t * 2 + w[3]) > -0.97 ? 1 : 0.2); c.fillStyle = 'rgba(' + (L.li === 2 ? '240,190,110' : '200,170,110') + ',' + (0.55 * flick).toFixed(2) + ')'; c.fillRect(x + 2 + w[0] * (b.w - 5), y + 4 + w[1] * (b.h - 8), 2, 2.5); }
      }
    }
    // far fires glow
    const fg = c.createRadialGradient(W * 0.3, hor, 1, W * 0.3, hor, H * 0.18); fg.addColorStop(0, 'rgba(255,140,60,' + (0.32 + Math.sin(t * 7) * 0.04) + ')'); fg.addColorStop(1, 'rgba(255,140,60,0)'); c.fillStyle = fg; c.fillRect(0, hor - H * 0.2, W, H * 0.3);
    // ground and road
    const gg = c.createLinearGradient(0, hor, 0, H); gg.addColorStop(0, '#0d1315'); gg.addColorStop(1, '#050808'); c.fillStyle = gg; c.fillRect(0, hor + H * 0.03, W, H);
    c.fillStyle = 'rgba(70,84,88,.35)'; c.fillRect(0, hor + H * 0.1, W, 1);
    c.fillStyle = '#2b3034'; c.beginPath(); c.moveTo(W * 0.35, hor + H * 0.04); c.lineTo(W * 0.65, hor + H * 0.04); c.lineTo(W * 1.2, H); c.lineTo(-W * 0.2, H); c.fill();
    c.strokeStyle = 'rgba(210,175,90,.5)'; c.lineWidth = 2; c.setLineDash([H * 0.04, H * 0.035]); c.beginPath(); c.moveTo(W * 0.5, hor + H * 0.04); c.lineTo(W * 0.5, H); c.stroke(); c.setLineDash([]);
    // streetlamp with failing light
    lampT -= dt; if (lampT <= 0) { lampOn = reduce ? 1 : (Math.random() < 0.82 ? 1 : 0.15 + Math.random() * 0.5); lampT = lampOn < 1 ? 0.05 + Math.random() * 0.12 : 0.4 + Math.random() * 2.4; }
    const lx = W * 0.2, ly = H * 0.42;
    c.fillStyle = '#0a0f11'; c.fillRect(lx - 1.5, ly, 3, H * 0.6); c.fillRect(lx - 1.5, ly, W * 0.06, 3); c.fillRect(lx + W * 0.055, ly, 5, 5);
    const lcx = lx + W * 0.06, lcy = ly + 5;
    const lg = c.createRadialGradient(lcx, lcy, 2, lcx, lcy + H * 0.2, H * 0.4); lg.addColorStop(0, 'rgba(255,215,140,' + (0.85 * lampOn).toFixed(2) + ')'); lg.addColorStop(0.3, 'rgba(255,200,120,' + (0.2 * lampOn).toFixed(2) + ')'); lg.addColorStop(1, 'rgba(255,200,120,0)');
    c.fillStyle = lg; c.beginPath(); c.moveTo(lcx - 3, lcy); c.lineTo(lcx + 3, lcy); c.lineTo(lcx + H * 0.3, H); c.lineTo(lcx - H * 0.3, H); c.fill();
    c.fillStyle = 'rgba(255,225,160,' + lampOn.toFixed(2) + ')'; c.beginPath(); c.arc(lcx, lcy + 2, 3, 0, 6.3); c.fill();
    // lone silhouette in the light
    const fx = lcx + W * 0.04, fy = H * 0.9; c.fillStyle = '#050708'; c.beginPath(); c.ellipse(fx, fy, W * 0.018, H * 0.012, 0, 0, 6.3); c.fill(); c.fillRect(fx - W * 0.012, fy - H * 0.12, W * 0.024, H * 0.12); c.beginPath(); c.arc(fx, fy - H * 0.135, W * 0.014, 0, 6.3); c.fill();
    // mist
    for (const m of mist) { if (!reduce) { m.x += m.s * dt; if (m.x - m.r > W) m.x = -m.r; } const g = c.createRadialGradient(m.x, m.y, 2, m.x, m.y, m.r); g.addColorStop(0, 'rgba(140,160,160,' + m.a + ')'); g.addColorStop(1, 'rgba(140,160,160,0)'); c.fillStyle = g; c.fillRect(m.x - m.r, m.y - m.r, m.r * 2, m.r * 2); }
    // rain
    if (!reduce) { c.strokeStyle = 'rgba(190,210,215,.28)'; c.lineWidth = 1; c.beginPath(); for (const d of drops) { d[1] += 340 * d[2] * dt; d[0] -= 50 * d[2] * dt; if (d[1] > H) { d[1] = -10; d[0] = Math.random() * (W + 40); } c.moveTo(d[0], d[1]); c.lineTo(d[0] + 2, d[1] + 7 * d[2]); } c.stroke(); }
    // distant lightning
    nextFlash -= dt; if (nextFlash <= 0 && !reduce) { flash = 1; nextFlash = 7 + Math.random() * 12; if (DC.audio && DC.audio.ctx) setTimeout(() => DC.audio.sfx('thunder'), 800 + Math.random() * 1500); }
    if (flash > 0) { c.fillStyle = 'rgba(190,210,230,' + (flash * 0.18).toFixed(3) + ')'; c.fillRect(0, 0, W, H); flash -= dt * 3.5; }
    // vignette
    const vg = c.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.85); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.6)'); c.fillStyle = vg; c.fillRect(0, 0, W, H);
    c.fillStyle = 'rgba(5,8,9,.28)'; c.fillRect(0, 0, W, H);   // darken so the menu reads cleanly
  }
  Ti.start = function () {
    cv = document.getElementById('titlecv'); if (!cv || Ti.running) return;
    cv.classList.remove('hidden'); Ti.running = true; build(); last = performance.now(); raf = requestAnimationFrame(frame);
    window.addEventListener('resize', Ti.resize);
  };
  Ti.resize = function () { if (Ti.running) build(); };
  Ti.stop = function () { Ti.running = false; cancelAnimationFrame(raf); window.removeEventListener('resize', Ti.resize); if (cv) cv.classList.add('hidden'); };
})();

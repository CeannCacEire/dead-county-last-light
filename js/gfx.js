/* Dead County: Last Light - graphics quality profiles and shared drawing helpers. */
(function () {
  'use strict';
  const DC = window.DC;
  const Q = (DC.gfx = { cfg: null, level: 'high' });

  // rs: render resolution multiplier (device pixels per CSS pixel, capped by the device ratio)
  // bake: chunk texture scale   part: particle budget   shadow/light/grade/grain/sway/water: feature tiers
  const PRE = {
    perf:   { name: 'Mobile performance', rs: 1,    bake: 1,   part: 0.4, shadow: 0, light: 0, weather: 0.45, sway: 0, decor: 0.4, grade: 0, grain: 0, fogL: 0, water: 0, view: 0.9 },
    low:    { name: 'Low',                rs: 1,    bake: 1,   part: 0.6, shadow: 1, light: 1, weather: 0.7,  sway: 0, decor: 0.6, grade: 1, grain: 0, fogL: 0, water: 1, view: 1 },
    medium: { name: 'Medium',             rs: 1.35, bake: 1.5, part: 1,   shadow: 1, light: 1, weather: 1,    sway: 1, decor: 1,   grade: 1, grain: 1, fogL: 1, water: 1, view: 1 },
    high:   { name: 'High',               rs: 2,    bake: 2,   part: 1.5, shadow: 2, light: 2, weather: 1,    sway: 1, decor: 1,   grade: 2, grain: 1, fogL: 1, water: 1, view: 1 },
  };
  Q.PRESETS = PRE;
  Q.isMobile = function () {
    try { return !!(window.matchMedia && matchMedia('(pointer:coarse)').matches) || Math.min(screen.width, screen.height) < 520; } catch (e) { return false; }
  };
  Q.resolveLevel = function () {
    const s = DC.settings || {}; let l = s.gfx || 'auto';
    if (l === 'auto') l = Q.isMobile() ? 'medium' : 'high';
    if (Q.autoDrop && Q.autoDrop > 0) { const order = ['high', 'medium', 'low', 'perf']; l = order[Math.min(3, order.indexOf(l) + Q.autoDrop)]; }
    return l;
  };
  Q.refresh = function (force) {
    const s = DC.settings || {}, lvl = Q.resolveLevel(), p = Object.assign({}, PRE[lvl]);
    const dpr = window.devicePixelRatio || 1;
    p.rs = Math.max(1, Math.min(p.rs, dpr));
    if (s.redParticles) p.part *= 0.4;
    if (s.redShadows) p.shadow = 0;
    if (s.redLight) { p.light = 0; p.grade = Math.min(p.grade, 1); }
    if (s.redWeather) p.weather *= 0.4;
    p.shake = s.redShake || s.reduceMotion ? 0 : 1;
    if (s.reduceMotion) { p.sway = 0; p.water = Math.min(p.water, 1); p.lag = 0; } else p.lag = 1;
    p.grain = (s.grain === false || s.postfx === false || s.reduceMotion) ? 0 : p.grain;
    p.post = s.postfx === false ? 0 : 1;
    if (!p.post) { p.grade = 0; p.grain = 0; }
    p.lowPower = !!s.lowPowerAudio;
    const changed = !Q.cfg || Q.cfg.bake !== p.bake || Math.abs(Q.cfg.rs - p.rs) > 0.01 || Q.cfg.shadow !== p.shadow || Q.cfg.decor !== p.decor;
    Q.level = lvl; Q.cfg = p;
    if (changed || force) { if (DC.tiles && DC.tiles.clear) DC.tiles.clear(); if (DC.render && DC.render.resize && DC.render.ready) DC.render.resize(); }
  };

  // ---------- shared helpers ----------
  Q.col = {
    mix(a, b, t) { const pa = parse(a), pb = parse(b); return 'rgb(' + ((pa[0] + (pb[0] - pa[0]) * t) | 0) + ',' + ((pa[1] + (pb[1] - pa[1]) * t) | 0) + ',' + ((pa[2] + (pb[2] - pa[2]) * t) | 0) + ')'; },
    shade(a, f) { const p = parse(a); return 'rgb(' + clamp(p[0] * f) + ',' + clamp(p[1] * f) + ',' + clamp(p[2] * f) + ')'; },
  };
  function clamp(v) { return v < 0 ? 0 : v > 255 ? 255 : v | 0; }
  const pc = {};
  function parse(s) {
    if (pc[s]) return pc[s];
    let r;
    if (s[0] === '#') { const n = parseInt(s.length === 4 ? s.replace(/#(.)(.)(.)/, '#$1$1$2$2$3$3').slice(1) : s.slice(1), 16); r = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
    else { const m = s.match(/[\d.]+/g) || [0, 0, 0]; r = [+m[0], +m[1], +m[2]]; }
    return (pc[s] = r);
  }
  Q.parse = parse;
  Q.rr = function (c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  };
  Q.circle = function (c, x, y, r, fill) { c.fillStyle = fill; c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fill(); };
  Q.soft = function (c, x, y, rx, ry, a) {      // soft contact shadow
    c.save(); c.translate(x, y); c.scale(1, ry / rx);
    const g = c.createRadialGradient(0, 0, 0, 0, 0, rx); g.addColorStop(0, 'rgba(0,0,0,' + a + ')'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, rx, 0, 6.2832); c.fill(); c.restore();
  };
  // pre-rendered soft noise (fog layers, film grain)
  Q.noiseTile = function (size, kind) {
    const cv = document.createElement('canvas'); cv.width = cv.height = size; const c = cv.getContext('2d'), img = c.createImageData(size, size), d = img.data;
    for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
      const o = (j * size + i) * 4;
      if (kind === 'grain') { const v = (Math.random() * 255) | 0; d[o] = d[o + 1] = d[o + 2] = v; d[o + 3] = 255; }
      else {
        // tileable fbm cloud
        const f = (s, sd) => { const sx = i / size * s, sy = j / size * s; const xi = Math.floor(sx), yi = Math.floor(sy), xf = sx - xi, yf = sy - yi; const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); const h = (a, b) => DC.hash(((a % s) + s) % s, ((b % s) + s) % s, sd); return h(xi, yi) * (1 - u) * (1 - v) + h(xi + 1, yi) * u * (1 - v) + h(xi, yi + 1) * (1 - u) * v + h(xi + 1, yi + 1) * u * v; };
        const v = (f(4, 3) * 0.5 + f(8, 5) * 0.3 + f(16, 9) * 0.2);
        const a = Math.max(0, (v - 0.35) * 1.9);
        d[o] = 200; d[o + 1] = 208; d[o + 2] = 214; d[o + 3] = Math.min(255, a * 255);
      }
    }
    c.putImageData(img, 0, 0); return cv;
  };
  Q.vibrate = function (ms) { try { if (DC.settings && DC.settings.haptics !== false && navigator.vibrate) navigator.vibrate(ms); } catch (e) {} };
})();

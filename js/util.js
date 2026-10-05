/* Dead County: Last Light - original AI-generated demo. Utilities. */
(function () {
  'use strict';
  const DC = (window.DC = window.DC || {});
  DC.VERSION = '1.0.0';
  DC.SAVE_VERSION = 1;
  DC.TILE = 16;

  DC.mulberry = function (a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  DC.hash = function (x, y, s) {
    let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul((s | 0) + 7, 1442695041)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  DC.vnoise = function (x, y, s) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = DC.hash(xi, yi, s), b = DC.hash(xi + 1, yi, s), c = DC.hash(xi, yi + 1, s), d = DC.hash(xi + 1, yi + 1, s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  DC.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  DC.lerp = (a, b, t) => a + (b - a) * t;
  DC.dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
  DC.$ = (id) => document.getElementById(id);
  DC.el = function (tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  };
  DC.pick = (arr, r) => arr[Math.floor((r || Math.random)() * arr.length)];
  DC.wpick = function (list, r) { // list of [id, weight]
    let t = 0; for (const e of list) t += e[1];
    let x = (r || Math.random)() * t;
    for (const e of list) { x -= e[1]; if (x <= 0) return e[0]; }
    return list[list.length - 1][0];
  };
  DC.angDiff = function (a, b) {
    let d = a - b;
    if (!isFinite(d)) return 0;
    d = d % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2; else if (d < -Math.PI) d += Math.PI * 2;
    return d;
  };
  DC.uid = (function () { let n = 1; return { next: () => n++, set: (v) => (n = Math.max(n, v)), get: () => n }; })();
  DC.fmtClock = function (min) {
    const h = Math.floor(min / 60) % 24, m = Math.floor(min % 60);
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  };
  DC.fmtDur = function (min) {
    const d = Math.floor(min / 1440), h = Math.floor((min % 1440) / 60), m = Math.floor(min % 60);
    return (d ? d + 'd ' : '') + h + 'h ' + m + 'm';
  };
  DC.deepClone = (o) => JSON.parse(JSON.stringify(o));
  // tiny event bus
  const handlers = {};
  DC.on = (n, f) => ((handlers[n] = handlers[n] || []).push(f));
  DC.emit = (n, a, b) => { (handlers[n] || []).forEach((f) => f(a, b)); };
})();

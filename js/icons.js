/* Dead County: Last Light - procedural 16x16 pixel icons for items. */
(function () {
  'use strict';
  const DC = window.DC, cache = {};
  const S = {
    can(c, a, b) { c.fillStyle = '#c9c9c9'; c.fillRect(4, 3, 8, 1); c.fillStyle = a; c.fillRect(4, 4, 8, 9); c.fillStyle = b; c.fillRect(4, 6, 8, 4); c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(11, 4, 1, 9); },
    bag(c, a, b) { c.fillStyle = a; c.fillRect(4, 2, 8, 12); c.fillStyle = b; c.fillRect(4, 2, 8, 2); c.fillRect(6, 7, 4, 3); c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(11, 3, 1, 11); },
    bar(c, a, b) { c.fillStyle = a; c.fillRect(2, 5, 12, 6); c.fillStyle = b; c.fillRect(2, 7, 12, 2); c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(2, 10, 12, 1); },
    round(c, a, b) { c.fillStyle = a; c.fillRect(5, 3, 6, 10); c.fillRect(3, 5, 10, 6); c.fillRect(4, 4, 8, 8); c.fillStyle = b; c.fillRect(7, 2, 2, 2); c.fillStyle = 'rgba(255,255,255,.3)'; c.fillRect(5, 5, 2, 2); },
    loaf(c, a, b) { c.fillStyle = a; c.fillRect(2, 5, 12, 7); c.fillRect(3, 4, 10, 1); c.fillStyle = b; c.fillRect(4, 6, 1, 3); c.fillRect(7, 6, 1, 3); c.fillRect(10, 6, 1, 3); },
    box(c, a, b) { c.fillStyle = a; c.fillRect(3, 2, 10, 12); c.fillStyle = b; c.fillRect(3, 5, 10, 3); c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(12, 2, 1, 12); },
    bottle(c, a, b) { c.fillStyle = b; c.fillRect(7, 1, 2, 3); c.fillStyle = a; c.fillRect(5, 4, 6, 10); c.fillRect(6, 3, 4, 1); c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(6, 5, 1, 7); },
    wrap(c, a, b) { c.fillStyle = a; c.fillRect(4, 4, 8, 8); c.fillRect(5, 3, 6, 10); c.fillStyle = b; c.fillRect(6, 6, 4, 4); c.fillStyle = a; c.fillRect(7, 7, 2, 2); },
    pill(c, a, b) { c.fillStyle = a; c.fillRect(3, 6, 5, 4); c.fillStyle = b; c.fillRect(8, 6, 5, 4); c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(4, 6, 8, 1); },
    kit(c, a, b) { c.fillStyle = a; c.fillRect(2, 4, 12, 9); c.fillStyle = '#888'; c.fillRect(6, 2, 4, 2); c.fillStyle = b; c.fillRect(7, 6, 2, 5); c.fillRect(5, 8, 6, 1); c.fillRect(5, 7, 6, 3); c.fillStyle = a; c.fillRect(5, 7, 1, 3); c.fillRect(10, 7, 1, 3); },
    plank(c, a, b) { c.fillStyle = a; c.fillRect(1, 5, 14, 6); c.fillStyle = b; c.fillRect(1, 8, 14, 1); c.fillRect(4, 6, 3, 1); c.fillRect(10, 9, 3, 1); },
    hammer(c, a, b) { c.fillStyle = b; c.fillRect(7, 5, 2, 10); c.fillStyle = a; c.fillRect(3, 2, 9, 4); c.fillRect(11, 3, 2, 2); },
    club(c, a, b) { for (let k = 0; k < 11; k++) { c.fillStyle = k > 7 ? b : a; c.fillRect(2 + k, 13 - k, 3, 3); } c.fillStyle = b; c.fillRect(2, 13, 2, 2); },
    blade(c, a, b) { for (let k = 0; k < 9; k++) { c.fillStyle = a; c.fillRect(4 + k, 9 - k, 2, 2); } c.fillStyle = b; c.fillRect(2, 11, 3, 3); c.fillRect(3, 10, 2, 2); },
    axe(c, a, b) { for (let k = 0; k < 11; k++) { c.fillStyle = b; c.fillRect(2 + k, 13 - k, 2, 2); } c.fillStyle = a; c.fillRect(8, 1, 6, 5); c.fillRect(7, 3, 2, 3); },
    flash(c, a, b) { c.fillStyle = a; c.fillRect(6, 4, 4, 10); c.fillStyle = b; c.fillRect(5, 2, 6, 3); c.fillStyle = '#ffe9a8'; c.fillRect(6, 1, 4, 1); },
    lighter(c, a, b) { c.fillStyle = a; c.fillRect(5, 6, 6, 8); c.fillStyle = b; c.fillRect(5, 5, 6, 1); c.fillStyle = '#ffb040'; c.fillRect(7, 2, 2, 3); },
    saw(c, a, b) { c.fillStyle = a; c.fillRect(1, 4, 11, 4); c.fillStyle = 'rgba(0,0,0,.3)'; for (let k = 1; k < 11; k += 2) c.fillRect(k, 8, 1, 1); c.fillStyle = b; c.fillRect(11, 3, 4, 6); },
    pot(c, a, b) { c.fillStyle = a; c.fillRect(2, 5, 12, 8); c.fillStyle = b; c.fillRect(2, 4, 12, 2); c.fillRect(0, 7, 2, 2); c.fillRect(14, 7, 2, 2); },
    coil(c, a, b) { c.fillStyle = a; c.fillRect(3, 4, 10, 8); c.fillStyle = b; c.fillRect(5, 6, 6, 4); c.fillStyle = a; c.fillRect(7, 7, 2, 2); },
    paper(c, a, b) { c.fillStyle = a; c.fillRect(3, 2, 10, 12); c.fillStyle = b; for (let k = 4; k < 12; k += 2) c.fillRect(5, k, 6, 1); },
    radio(c, a, b) { c.fillStyle = a; c.fillRect(4, 3, 8, 11); c.fillStyle = b; c.fillRect(5, 5, 6, 3); c.fillStyle = '#222'; c.fillRect(5, 10, 6, 2); c.fillStyle = '#aaa'; c.fillRect(11, 0, 1, 4); },
    card(c, a, b) { c.fillStyle = a; c.fillRect(2, 4, 12, 8); c.fillStyle = b; c.fillRect(3, 5, 4, 3); c.fillStyle = '#222'; c.fillRect(2, 10, 12, 1); },
    key(c, a, b) { c.fillStyle = a; c.fillRect(3, 3, 5, 5); c.fillStyle = '#000'; c.fillRect(5, 5, 1, 1); c.fillStyle = a; c.fillRect(7, 7, 2, 6); c.fillRect(9, 11, 3, 1); c.fillRect(9, 9, 2, 1); },
    jerry(c, a, b) { c.fillStyle = a; c.fillRect(2, 3, 12, 11); c.fillStyle = b; c.fillRect(2, 8, 12, 1); c.fillRect(10, 1, 3, 2); c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(5, 5, 4, 2); },
    nail(c, a, b) { c.fillStyle = b; c.fillRect(2, 4, 12, 9); c.fillStyle = a; c.fillRect(4, 6, 1, 5); c.fillRect(7, 6, 1, 5); c.fillRect(10, 6, 1, 5); c.fillStyle = '#ddd'; c.fillRect(3, 6, 3, 1); c.fillRect(6, 6, 3, 1); c.fillRect(9, 6, 3, 1); },
    scrap(c, a, b) { c.fillStyle = a; c.fillRect(2, 5, 8, 6); c.fillRect(6, 3, 8, 5); c.fillStyle = b; c.fillRect(4, 9, 6, 3); },
    log(c, a, b) { c.fillStyle = a; c.fillRect(1, 5, 14, 7); c.fillStyle = b; c.fillRect(1, 6, 3, 5); c.fillStyle = a; c.fillRect(2, 7, 1, 3); },
    stick(c, a, b) { for (let k = 0; k < 12; k++) { c.fillStyle = k % 5 ? a : b; c.fillRect(11 - k + 1, 1 + k, 2, 2); } },
    cloth(c, a, b) { c.fillStyle = a; c.fillRect(3, 3, 10, 10); c.fillStyle = b; c.fillRect(3, 11, 10, 2); c.fillRect(12, 3, 1, 10); c.fillRect(5, 6, 6, 1); },
    panel(c, a, b) { c.fillStyle = a; c.fillRect(0, 3, 16, 10); c.fillStyle = b; c.fillRect(0, 6, 16, 1); c.fillRect(0, 9, 16, 1); c.fillStyle = '#ccc'; c.fillRect(2, 4, 1, 1); c.fillRect(13, 4, 1, 1); c.fillRect(2, 11, 1, 1); c.fillRect(13, 11, 1, 1); },
    battery(c, a, b) { c.fillStyle = b; c.fillRect(4, 3, 8, 11); c.fillStyle = a; c.fillRect(4, 6, 8, 4); c.fillStyle = '#ccc'; c.fillRect(6, 1, 4, 2); },
    chip(c, a, b) { c.fillStyle = a; c.fillRect(2, 3, 12, 10); c.fillStyle = b; c.fillRect(5, 5, 6, 6); c.fillRect(1, 5, 1, 1); c.fillRect(1, 9, 1, 1); c.fillRect(14, 5, 1, 1); c.fillRect(14, 9, 1, 1); },
    clock(c, a, b) { c.fillStyle = b; c.fillRect(3, 3, 10, 10); c.fillStyle = a; c.fillRect(4, 4, 8, 8); c.fillStyle = '#222'; c.fillRect(8, 5, 1, 4); c.fillRect(8, 8, 3, 1); c.fillStyle = b; c.fillRect(2, 2, 3, 2); c.fillRect(11, 2, 3, 2); },
    book(c, a, b) { c.fillStyle = a; c.fillRect(3, 2, 10, 12); c.fillStyle = b; c.fillRect(4, 3, 8, 3); c.fillRect(4, 12, 8, 1); c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(3, 2, 2, 12); },
    glove(c, a, b) { c.fillStyle = a; c.fillRect(5, 7, 7, 7); c.fillRect(5, 3, 2, 5); c.fillRect(7, 2, 2, 6); c.fillRect(9, 3, 2, 5); c.fillRect(11, 5, 2, 4); c.fillRect(3, 8, 3, 3); c.fillStyle = b; c.fillRect(5, 12, 7, 2); },
    scarf(c, a, b) { c.fillStyle = a; c.fillRect(3, 4, 10, 4); c.fillRect(9, 8, 3, 6); c.fillStyle = b; c.fillRect(3, 6, 10, 1); c.fillRect(9, 11, 3, 1); c.fillRect(9, 13, 3, 1); },
    hat(c, a, b) { c.fillStyle = a; c.fillRect(3, 5, 10, 6); c.fillStyle = b; c.fillRect(2, 10, 12, 2); c.fillRect(5, 4, 6, 1); },
    shirt(c, a, b) { c.fillStyle = a; c.fillRect(1, 3, 14, 4); c.fillRect(4, 3, 8, 11); c.fillStyle = b; c.fillRect(6, 3, 4, 2); c.fillRect(4, 12, 8, 2); },
    pants(c, a, b) { c.fillStyle = a; c.fillRect(3, 2, 10, 4); c.fillRect(3, 5, 4, 9); c.fillRect(9, 5, 4, 9); c.fillStyle = b; c.fillRect(3, 2, 10, 1); c.fillRect(7, 5, 2, 3); },
    shoe(c, a, b) { c.fillStyle = a; c.fillRect(1, 6, 9, 6); c.fillRect(8, 8, 7, 4); c.fillStyle = b; c.fillRect(1, 11, 14, 2); },
    pack(c, a, b) { c.fillStyle = a; c.fillRect(3, 3, 10, 11); c.fillStyle = b; c.fillRect(4, 8, 8, 5); c.fillRect(5, 2, 6, 2); c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(7, 9, 2, 1); },
    pan(c, a, b) { c.fillStyle = a; c.fillRect(2, 3, 8, 8); c.fillRect(3, 2, 6, 10); c.fillStyle = b; c.fillRect(9, 6, 6, 2); },
    spear(c, a, b) { for (let k = 0; k < 12; k++) { c.fillStyle = a; c.fillRect(2 + k, 13 - k, 2, 2); } c.fillStyle = b; c.fillRect(12, 1, 3, 3); },
    gun(c, a, b) { c.fillStyle = a; c.fillRect(1, 4, 12, 4); c.fillStyle = b; c.fillRect(3, 8, 4, 5); c.fillRect(1, 3, 3, 1); },
    bullet(c, a, b) { c.fillStyle = a; c.fillRect(6, 3, 4, 9); c.fillStyle = b; c.fillRect(7, 1, 2, 3); c.fillRect(5, 11, 6, 2); },
  };
  // 16px art is upscaled, outlined and shaded so every item reads clearly at touch sizes
  const SZ = 36;
  let tmp = null;
  DC.iconCanvas = function (id) {
    if (cache[id]) return cache[id];
    const d = DC.ITEMS[id], cv = document.createElement('canvas'); cv.width = cv.height = SZ;
    if (!tmp) { tmp = document.createElement('canvas'); tmp.width = tmp.height = 16; }
    const tc = tmp.getContext('2d'); tc.clearRect(0, 0, 16, 16); const [shape, a, b] = d.ic;
    (S[shape] || S.box)(tc, a, b);
    const c = cv.getContext('2d'); c.imageSmoothingEnabled = false;
    // soft ground shadow
    c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.ellipse(SZ / 2 + 1, SZ - 5, 12, 3.4, 0, 0, 6.28); c.fill();
    // silhouette outline
    const sil = document.createElement('canvas'); sil.width = sil.height = SZ; const sc = sil.getContext('2d'); sc.imageSmoothingEnabled = false;
    sc.drawImage(tmp, 2, 1, 32, 32); sc.globalCompositeOperation = 'source-in'; sc.fillStyle = '#0b0d0e'; sc.fillRect(0, 0, SZ, SZ);
    for (const [dx, dy] of [[-1.4, 0], [1.4, 0], [0, -1.4], [0, 1.4], [-1, -1], [1, 1], [-1, 1], [1, -1]]) c.drawImage(sil, dx, dy);
    c.drawImage(tmp, 2, 1, 32, 32);
    // light from the upper left, shade lower right (clipped to the item's own pixels)
    c.globalCompositeOperation = 'source-atop';
    const g = c.createLinearGradient(2, 1, SZ - 2, SZ - 2); g.addColorStop(0, 'rgba(255,255,255,.26)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,.3)');
    c.fillStyle = g; c.fillRect(0, 0, SZ, SZ); c.globalCompositeOperation = 'source-over';
    cache[id] = cv; return cv;
  };
  DC.iconURL = function (id) {
    const k = id + ':url'; if (cache[k]) return cache[k];
    cache[k] = DC.iconCanvas(id).toDataURL(); return cache[k];
  };
})();

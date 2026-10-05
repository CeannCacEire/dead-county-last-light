/* Dead County: Last Light - layered character, creature and animal sprites (drawn procedurally, shaded and outlined). */
(function () {
  'use strict';
  const DC = window.DC, Q = DC.gfx, rr = Q.rr, hash = DC.hash;
  const Sp = (DC.sprites = { marks: [] });
  const OUT = '#0d0f10';
  const SKIN = ['#d9b08c', '#c4906a', '#9c6b48', '#e8c4a0', '#7a5238'];
  const HAIR = ['#2a1d14', '#4a3020', '#8a6a3a', '#1a1a1c', '#a8a29a', '#6a2a1c'];
  const strHash = (s) => { let h = 7; for (let i = 0; i < (s || '').length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };

  function ell(c, x, y, rx, ry, fill) { c.fillStyle = fill; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, 6.2832); c.fill(); }
  function shadow(c, x, y, rx, ry) { Q.soft(c, x, y + 3.5, rx, ry, 0.5); }
  function limb(c, x1, y1, x2, y2, w, col, hand) {
    c.lineCap = 'round'; c.strokeStyle = OUT; c.lineWidth = w + 1.1; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
    c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
    if (hand) { c.fillStyle = OUT; c.beginPath(); c.arc(x2, y2, 1.9, 0, 6.2832); c.fill(); c.fillStyle = hand; c.beginPath(); c.arc(x2, y2, 1.3, 0, 6.2832); c.fill(); }
  }
  function torso(c, x, y, w, h, col, hi) {
    c.fillStyle = OUT; rr(c, x - 0.8, y - 0.8, w + 1.6, h + 1.6, 3); c.fill();
    const g = c.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, hi || Q.col.shade(col, 1.25)); g.addColorStop(0.5, col); g.addColorStop(1, Q.col.shade(col, 0.7));
    c.fillStyle = g; rr(c, x, y, w, h, 2.6); c.fill();
  }
  function itemCol(it, d) { return it ? DC.ITEMS[it.id].ic[1] : d; }

  // ---------------- player ----------------
  Sp.player = function (c, P, x, y, t) {
    const crouch = P.crouch, mv = P.moved > 0.2, anim = P.anim || 0, spr = mv && P.sprinting;
    const sk = SKIN[strHash(P.name) % SKIN.length], hr = HAIR[(strHash(P.name) >> 3) % HAIR.length];
    const sc = crouch ? 0.9 : 1, bob = mv ? Math.sin(anim * 3.2) * 0.35 : Math.sin(t * 1.6) * 0.15;
    shadow(c, x, y, 7 * sc, 3.6 * sc);
    c.save(); c.translate(x, y); c.rotate(P.face || 0); c.scale(sc, sc);
    const ph = Math.sin(anim * 1.6), leg = mv ? ph * (spr ? 3.6 : 2.6) : 0;
    const pants = itemCol(P.equip.legs, '#394252'), shirt = itemCol(P.equip.body, '#5d6975'), boots = '#1b1c20';
    // legs + boots
    for (const s of [-1, 1]) {
      const lx = -1 + leg * s;
      c.fillStyle = OUT; rr(c, lx - 3.2, s * 2.1 - 1.9, 6.4, 3.8, 1.6); c.fill();
      c.fillStyle = pants; rr(c, lx - 2.6, s * 2.1 - 1.3, 4, 2.6, 1.2); c.fill();
      c.fillStyle = boots; rr(c, lx + 0.8, s * 2.1 - 1.4, 2.9, 2.8, 1.2); c.fill();
      c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(lx + 1.2, s * 2.1 - 1.1, 1.7, 0.6);
    }
    // backpack
    if (P.equip.back) {
      const bc = itemCol(P.equip.back, '#4a5a3a');
      c.fillStyle = OUT; rr(c, -8.2, -4.2, 5.8, 8.4, 2); c.fill();
      const g = c.createLinearGradient(-8, -4, -3, 4); g.addColorStop(0, Q.col.shade(bc, 1.3)); g.addColorStop(1, Q.col.shade(bc, 0.65)); c.fillStyle = g; rr(c, -7.5, -3.5, 4.4, 7, 1.6); c.fill();
      c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(-7.2, -0.3, 3.8, 0.7); c.fillStyle = Q.col.shade(bc, 1.5); c.fillRect(-6.9, -3.2, 3.2, 0.7);
    }
    // arms
    const swing = P.swing ? (P.swing.t / P.swing.dur - 0.35) * 2.4 : 0;
    const asw = mv ? -ph * (spr ? 2.6 : 1.6) : 0;
    limb(c, 0.5, -4.6, 4.3 + asw * 0.5, -3.6 - (P.hand ? 0 : 0.3), 2.5, shirt, sk);
    limb(c, 0.5, 4.6, 4.8, 3.4 + (P.swing ? swing * 2.4 : 0), 2.5, shirt, sk);
    // torso (over arms roots)
    torso(c, -3.6, -5.6, 7.4, 11.2, shirt);
    c.fillStyle = 'rgba(0,0,0,.2)'; c.fillRect(-0.4, -4.6, 0.7, 9.2);           // zip/seam
    c.fillStyle = 'rgba(255,255,255,.14)'; c.fillRect(-2.6, -5, 4.5, 0.8);
    // held item
    const h = P.hand;
    if (h) {
      const d = DC.ITEMS[h.id]; c.save(); c.translate(5.2, 3.6); c.rotate(P.swing ? swing : 0.12);
      if (d.wp && d.wp.ranged) { c.fillStyle = OUT; rr(c, -1, -1.6, 9.6, 3.4, 1); c.fill(); c.fillStyle = '#4a4f57'; c.fillRect(-0.2, -0.9, 8.6, 1.8); c.fillStyle = '#7a8088'; c.fillRect(0.5, -0.9, 7, 0.5); }
      else if (d.light && !d.light.fire) { c.fillStyle = OUT; rr(c, -1, -1.6, 6.4, 3.2, 1); c.fill(); c.fillStyle = '#3b3f46'; c.fillRect(-0.2, -0.9, 4.6, 1.8); c.fillStyle = '#ffe9a8'; c.fillRect(4.4, -1.1, 1, 2.2); }
      else {
        const len = d.wp ? 6 + (d.wp.rng || 20) * 0.26 : 6.5;
        c.fillStyle = OUT; rr(c, -1.2, -1.9, len + 2, 3.8, 1.4); c.fill();
        c.fillStyle = d.ic[1]; c.fillRect(-0.4, -1, len, 2); c.fillStyle = 'rgba(255,255,255,.28)'; c.fillRect(-0.4, -1, len, 0.6);
        c.fillStyle = d.ic[2]; rr(c, len - 2.4, -1.6, 3, 3.2, 1); c.fill();
      }
      c.restore();
    }
    // head
    const hx = 0.9 + bob;
    c.fillStyle = OUT; c.beginPath(); c.arc(hx, 0, 4.5, 0, 6.2832); c.fill();
    const hg = c.createRadialGradient(hx + 1, -1, 0.5, hx, 0, 4); hg.addColorStop(0, Q.col.shade(sk, 1.15)); hg.addColorStop(1, Q.col.shade(sk, 0.82));
    c.fillStyle = hg; c.beginPath(); c.arc(hx, 0, 3.6, 0, 6.2832); c.fill();
    c.fillStyle = hr; c.beginPath(); c.arc(hx - 0.4, 0, 3.7, 1.35, 4.93); c.fill();                       // hair covers back of head
    c.fillStyle = 'rgba(255,255,255,.18)'; c.beginPath(); c.arc(hx - 0.8, -1.2, 2, 3.6, 4.8); c.stroke && 0; c.fill();
    c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(hx + 2.6, -0.6, 0.9, 1.2);                                 // nose
    if (P.equip.head) {
      const hc = itemCol(P.equip.head, '#6a6a60'); c.fillStyle = OUT; c.beginPath(); c.arc(hx - 0.2, 0, 4.7, 1.2, 5.1); c.fill(); c.fillStyle = hc; c.beginPath(); c.arc(hx - 0.2, 0, 4, 1.3, 4.98); c.fill();
      c.fillStyle = 'rgba(255,255,255,.2)'; c.fillRect(hx - 2.8, -2.8, 2.2, 0.8);
    }
    c.restore();
  };

  // ---------------- zombies ----------------
  const ZSKIN = ['#8a9a7c', '#9aa38a', '#7f8f84', '#a1a088'];
  const ZCLOTH = [['#5a6a7c', '#c9c9c0'], ['#6a3a3a', '#3a2a2a'], ['#5a5a3a', '#8a8a4a'], ['#d0d0c8', '#8a2a2a']];
  Sp.zombie = function (c, z, x, y, t) {
    const sc = z.type === 'brute' ? 1.38 : z.type === 'runner' ? 0.94 : 1, alert = z.state === 'chase' || z.state === 'attack', v = z.var % 4;
    const skin = ZSKIN[v], cl = ZCLOTH[v], anim = z.anim || 0, flash = z.flash > 0, lunge = z.state === 'attack' ? Math.sin(t * 14) * 1.6 : 0;
    shadow(c, x, y, 7 * sc, 3.6 * sc);
    c.save(); c.translate(x, y); c.rotate((z.face || 0) + Math.sin(anim * 0.8) * (z.type === 'runner' ? 0.05 : 0.11)); c.scale(sc, sc);
    if (z.type === 'runner') c.translate(1, 0);
    const ph = Math.sin(anim * (z.type === 'runner' ? 2.2 : 1.2)), leg = ph * 2.8;
    const body = flash ? '#f0f0e8' : cl[0], sk = flash ? '#ffffff' : skin;
    for (const s of [-1, 1]) {
      const lx = -1 + leg * s;
      c.fillStyle = OUT; rr(c, lx - 3.2, s * 2.1 - 1.9, 6.4, 3.8, 1.6); c.fill();
      c.fillStyle = flash ? '#ddd' : '#3c3a36'; rr(c, lx - 2.6, s * 2.1 - 1.3, 4.2, 2.6, 1.2); c.fill();
      c.fillStyle = '#17171a'; rr(c, lx + 0.8, s * 2.1 - 1.4, 2.8, 2.8, 1.2); c.fill();
    }
    const reach = alert ? 8.4 + lunge : 5.8;
    limb(c, 0.5, -4.8, reach, -3.4 + Math.sin(t * 2 + z.var) * 0.4, 2.6, body, sk);
    limb(c, 0.5, 4.8, reach - 0.6, 3.4 - Math.sin(t * 2.3 + z.var) * 0.4, 2.6, body, sk);
    torso(c, -3.6, -5.6, 7.4, 11.2, body);
    if (z.type === 'brute') { c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(-3.4, -5.4, 7, 2); }
    c.fillStyle = 'rgba(0,0,0,.28)'; c.fillRect(-2.4, -2.2, 3.2, 1.1); c.fillRect(0, 2, 2.4, 1.1);             // tears / grime
    c.fillStyle = cl[1]; if (v === 0) { c.fillRect(1.2, -0.6, 1.2, 4.2); }                                  // tie / collar accent
    else if (v === 1) { c.beginPath(); c.arc(-2.2, 0, 3.3, 1.5, 4.8); c.fill(); }                           // hood
    else if (v === 2) { c.fillRect(-3.4, -1, 7, 0.9); }
    else { c.fillStyle = 'rgba(150,30,30,.7)'; c.beginPath(); c.arc(1, 2.4, 1.7, 0, 6.28); c.fill(); }         // stain
    const hx = 0.7 + Math.sin(t * 1.4 + z.var) * 0.25;
    c.fillStyle = OUT; c.beginPath(); c.arc(hx, 0, 4.5, 0, 6.2832); c.fill();
    const hg = c.createRadialGradient(hx + 1, -1, 0.4, hx, 0, 4); hg.addColorStop(0, Q.col.shade(sk, 1.15)); hg.addColorStop(1, Q.col.shade(sk, 0.78));
    c.fillStyle = hg; c.beginPath(); c.arc(hx, 0, 3.6, 0, 6.2832); c.fill();
    c.fillStyle = '#2a2824'; c.beginPath(); c.arc(hx - 0.5, 0, 3.7, 1.7, 4.6); c.fill();                    // matted hair
    c.fillStyle = alert ? '#e8d050' : '#c8c8a8'; c.fillRect(hx + 1.7, -1.9, 1, 1); c.fillRect(hx + 1.7, 0.9, 1, 1);
    c.fillStyle = 'rgba(20,0,0,.7)'; c.fillRect(hx + 2.7, -0.7, 0.8, 1.4);
    c.restore();
    if (z.state === 'hear' || z.state === 'search') Sp.marks.push([x, y - 13 * sc, '?', '#e8d050']);
    else if (alert) Sp.marks.push([x, y - 13 * sc, '!', '#e0503a']);
  };

  // ---------------- friendly survivors ----------------
  Sp.npc = function (c, n, x, y, t) {
    const seed = strHash(n.id), sk = SKIN[seed % SKIN.length], hr = HAIR[(seed >> 2) % HAIR.length];
    const cols = { marta: '#a86a3a', dale: '#4a6a8a', jun: '#7a4a7a' }, bc = cols[n.id] || '#6a6a3a';
    shadow(c, x, y, 7, 3.4);
    c.save(); c.translate(x, y); c.rotate(n.face || 0); if (n.sleeping) c.rotate(1.57);
    for (const s of [-1, 1]) { c.fillStyle = OUT; rr(c, -4.2, s * 2.1 - 1.9, 6.4, 3.8, 1.6); c.fill(); c.fillStyle = '#3a4048'; rr(c, -3.6, s * 2.1 - 1.3, 5.2, 2.6, 1.2); c.fill(); }
    limb(c, 0.5, -4.6, 3.4, -3.4, 2.5, bc, sk); limb(c, 0.5, 4.6, 3.4, 3.4, 2.5, bc, sk);
    torso(c, -3.6, -5.6, 7.4, 11.2, bc);
    c.fillStyle = OUT; c.beginPath(); c.arc(0.9, 0, 4.5, 0, 6.28); c.fill();
    c.fillStyle = sk; c.beginPath(); c.arc(0.9, 0, 3.6, 0, 6.28); c.fill();
    c.fillStyle = hr; c.beginPath(); c.arc(0.4, 0, 3.7, 1.3, 4.98); c.fill();
    if (n.id === 'dale') { c.fillStyle = '#2a3a4a'; c.beginPath(); c.arc(0.4, 0, 4.1, 1.3, 4.98); c.fill(); c.fillRect(-1.5, -4.5, 5.5, 1.2); }
    c.restore();
    const bob = Math.sin(t * 3 + seed) * 0.6;
    c.fillStyle = OUT; rr(c, x - 3, y - 15 + bob, 6, 6, 3); c.fill(); c.fillStyle = '#6fd07a'; c.beginPath(); c.arc(x, y - 12 + bob, 1.8, 0, 6.28); c.fill();
  };

  // ---------------- animals ----------------
  Sp.animal = function (c, a, x, y, t) {
    const w = Math.sin((a.anim || 0) * 6) * (a.moving ? 1 : 0.4), seed = strHash(a.id || a.kind || '') + (a.x | 0);
    shadow(c, x, y, 5.6, 2.8);
    c.save(); c.translate(x, y); c.rotate(a.face || 0);
    if (a.kind === 'dog') {
      const coats = [['#9a7248', '#6a4e30'], ['#caa66a', '#9a7a44'], ['#4a4036', '#2a241e'], ['#d8d2c4', '#a89c88']], co = coats[seed % coats.length];
      c.fillStyle = co[1]; c.lineCap = 'round'; c.strokeStyle = co[1]; c.lineWidth = 1.8; c.beginPath(); c.moveTo(-5, 0); c.quadraticCurveTo(-8, -2 + w * 2, -9, -4 + w * 2.5); c.stroke();    // tail
      for (const s of [-1, 1]) { c.fillStyle = OUT; rr(c, -4 + w * s, s * 2.5 - 1.2, 3.2, 2.4, 1); c.fill(); c.fillStyle = co[1]; rr(c, -3.8 + w * s, s * 2.5 - 0.9, 2.6, 1.8, 0.8); c.fill(); rr(c, 2.2 - w * s, s * 2.5 - 0.9, 2.6, 1.8, 0.8); c.fill(); }
      c.fillStyle = OUT; rr(c, -6, -3.8, 11.8, 7.6, 3.4); c.fill();
      const g = c.createLinearGradient(0, -3, 0, 3); g.addColorStop(0, co[0]); g.addColorStop(1, co[1]); c.fillStyle = g; rr(c, -5.4, -3.2, 10.6, 6.4, 3); c.fill();
      c.fillStyle = 'rgba(0,0,0,.2)'; c.fillRect(-1.5, -3, 1.2, 6);
      c.fillStyle = OUT; c.beginPath(); c.arc(5.4, 0, 3.4, 0, 6.28); c.fill(); c.fillStyle = co[0]; c.beginPath(); c.arc(5.4, 0, 2.7, 0, 6.28); c.fill();
      c.fillStyle = co[1]; rr(c, 4, -3.8, 2.4, 1.8, 0.8); c.fill(); rr(c, 4, 2, 2.4, 1.8, 0.8); c.fill();                  // floppy ears
      c.fillStyle = '#d8c8a8'; rr(c, 6.4, -1.2, 2.4, 2.4, 1); c.fill(); c.fillStyle = '#17120e'; c.fillRect(8.2, -0.6, 1, 1.2);
      if (a.follow) { c.fillStyle = '#b83a32'; c.fillRect(2.6, -2.6, 1, 5.2); }
    } else if (a.kind === 'cat') {
      const co = ['#6a6a72', '#c8a070', '#2a2a2e', '#d8d4cc'][seed % 4];
      c.strokeStyle = co; c.lineWidth = 1.6; c.lineCap = 'round'; c.beginPath(); c.moveTo(-4, 0); c.bezierCurveTo(-7, 2 + w * 2, -9, -2, -8, -5 + w * 2); c.stroke();
      c.fillStyle = OUT; rr(c, -5, -3.2, 9, 6.4, 3); c.fill(); c.fillStyle = co; rr(c, -4.4, -2.6, 7.8, 5.2, 2.6); c.fill();
      c.fillStyle = 'rgba(0,0,0,.22)'; c.fillRect(-2.5, -2.4, 0.9, 4.8); c.fillRect(0, -2.4, 0.9, 4.8);
      c.fillStyle = OUT; c.beginPath(); c.arc(4.4, 0, 3, 0, 6.28); c.fill(); c.fillStyle = co; c.beginPath(); c.arc(4.4, 0, 2.3, 0, 6.28); c.fill();
      c.fillStyle = OUT; c.beginPath(); c.moveTo(3.2, -3.8); c.lineTo(4.8, -2.4); c.lineTo(3, -1.8); c.fill(); c.beginPath(); c.moveTo(3.2, 3.8); c.lineTo(4.8, 2.4); c.lineTo(3, 1.8); c.fill();
      c.fillStyle = '#c8e070'; c.fillRect(5.4, -1.4, 0.8, 0.8); c.fillRect(5.4, 0.7, 0.8, 0.8);
    } else {
      c.fillStyle = OUT; c.beginPath(); c.ellipse(-0.5, 0, 4.6, 4, 0, 0, 6.28); c.fill();
      const g = c.createRadialGradient(-1, -1, 0.5, 0, 0, 4.4); g.addColorStop(0, '#fffcf2'); g.addColorStop(1, '#cfc7b4'); c.fillStyle = g; c.beginPath(); c.ellipse(-0.5, 0, 4, 3.4, 0, 0, 6.28); c.fill();
      c.fillStyle = '#b8ae98'; c.beginPath(); c.ellipse(-1.5, 2, 2.4, 1.2, 0.2, 0, 6.28); c.fill(); c.beginPath(); c.ellipse(-1.5, -2, 2.4, 1.2, -0.2, 0, 6.28); c.fill();
      c.fillStyle = OUT; c.beginPath(); c.arc(3.8, 0, 2.4, 0, 6.28); c.fill(); c.fillStyle = '#f4efe2'; c.beginPath(); c.arc(3.8, 0, 1.8, 0, 6.28); c.fill();
      c.fillStyle = '#c8402a'; c.fillRect(3.2, -0.6, 1.8, 1.2); c.fillStyle = '#e0a830'; c.beginPath(); c.moveTo(5.4, -0.8); c.lineTo(7.2, 0); c.lineTo(5.4, 0.8); c.fill();
    }
    c.restore();
    if (a.alert > 0) Sp.marks.push([x, y - 10, '!', '#e0503a']);
  };

  // ---------------- fallen figure ----------------
  Sp.body = function (c, b, x, y, t) {
    Q.soft(c, x, y + 1, 9, 4.6, 0.45);
    c.save(); c.translate(x, y); c.rotate(b.face || 0);
    const v = (b.var || 0) % 4, cl = ZCLOTH[v];
    c.fillStyle = OUT; rr(c, -8.4, -3.6, 13, 7.2, 2.6); c.fill();
    c.fillStyle = cl[0]; rr(c, -7.6, -2.8, 11.4, 5.6, 2.2); c.fill(); c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(-3, -2.8, 0.8, 5.6);
    c.fillStyle = '#3c3a36'; rr(c, -11.5, -2.4, 4.6, 4.8, 1.6); c.fill();
    c.fillStyle = OUT; c.beginPath(); c.arc(6.4, 0, 3.8, 0, 6.28); c.fill(); c.fillStyle = ZSKIN[v]; c.beginPath(); c.arc(6.4, 0, 3, 0, 6.28); c.fill();
    c.fillStyle = '#2a2824'; c.beginPath(); c.arc(5.9, 0, 3.1, 1.7, 4.6); c.fill();
    c.restore();
    if (!b.looted) { const a = 0.5 + 0.4 * Math.sin(t * 4); c.fillStyle = 'rgba(255,226,140,' + a + ')'; c.beginPath(); c.arc(x, y - 7, 1.5, 0, 6.28); c.fill(); c.strokeStyle = 'rgba(255,226,140,' + a * 0.5 + ')'; c.lineWidth = 0.6; c.beginPath(); c.arc(x, y - 7, 3 + Math.sin(t * 4), 0, 6.28); c.stroke(); }
  };
  Sp.corpsePlayer = function (c, x, y) {
    Q.soft(c, x, y + 1, 9, 4.6, 0.5); c.fillStyle = OUT; rr(c, x - 7, y - 3.4, 14, 7, 2.4); c.fill(); c.fillStyle = '#58626e'; rr(c, x - 6.2, y - 2.6, 12.4, 5.2, 2); c.fill();
    c.fillStyle = '#c9a283'; c.beginPath(); c.arc(x + 7, y, 2.8, 0, 6.28); c.fill();
  };
})();

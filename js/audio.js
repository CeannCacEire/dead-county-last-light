/* Dead County: Last Light - layered audio engine.
   Every sound is synthesised at runtime with the Web Audio API (no sample files, no third-party audio).
   The context is only created after the first player gesture. */
(function () {
  'use strict';
  const DC = window.DC, T = 16;
  const A = (DC.audio = { ctx: null, started: false, paused: false, threat: { chasing: 0, near: 0, nearest: 99 }, stats: { voices: 0, dropped: 0 } });
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rnd = Math.random;
  let ctx, master, comp, buses = {}, nW, nP, nB, D = null, cur = { pri: 1 }, active = 0, MAXV = 30, low = false;
  let revIn, revIndoorG, revOutG, outLP, echoIn, tickT = 0, scanT = 0, musicMode = 'game', victoryT = 0, hasPan = false;
  const lastT = Object.create(null), foot = { n: 0, last: 0 };

  // ---------- buffers ----------
  function mkNoise(type, secs) {
    const len = Math.floor(ctx.sampleRate * (secs || 2)), b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
    let l = 0, b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (type === 'white') d[i] = w;
      else if (type === 'brown') { l = (l + 0.02 * w) / 1.02; d[i] = l * 3.5; }
      else { b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2; }
    }
    return b;
  }
  function mkIR(secs, damp) {
    const sr = ctx.sampleRate, len = Math.floor(sr * secs), b = ctx.createBuffer(2, len, sr);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c); let lp = 0;
      for (let i = 0; i < len; i++) { const t = i / len; const w = Math.random() * 2 - 1; lp += (w - lp) * (1 - damp * t); d[i] = lp * Math.pow(1 - t, 2.6); }
    }
    return b;
  }

  // ---------- synthesis helpers (write into the current route D) ----------
  function N(o) {
    if (!ctx || !D) return; if (active >= MAXV && cur.pri < 2) { A.stats.dropped++; return; }
    const t = ctx.currentTime + (o.when || 0), dur = o.dur;
    const s = ctx.createBufferSource(); s.buffer = o.buf || nW; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = o.ft || 'bandpass'; f.frequency.setValueAtTime(o.f0 || 1000, t); if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, t + dur); f.Q.value = o.q || 1;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.g || 0.2), t + (o.att || 0.005)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(o.dest || D); s.start(t, rnd() * 1.5); s.stop(t + dur + 0.05);
    active++; s.onended = () => { active--; };
  }
  function Tn(o) {
    if (!ctx || !D) return; if (active >= MAXV && cur.pri < 2) { A.stats.dropped++; return; }
    const t = ctx.currentTime + (o.when || 0), dur = o.dur;
    const os = ctx.createOscillator(); os.type = o.type || 'sine'; os.frequency.setValueAtTime(o.f0, t); if (o.f1) os.frequency.exponentialRampToValueAtTime(o.f1, t + dur);
    if (o.det) os.detune.value = o.det;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.g || 0.15), t + (o.att || 0.01)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let n = os; if (o.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; os.connect(f); n = f; }
    n.connect(g); g.connect(o.dest || D); os.start(t); os.stop(t + dur + 0.05); active++; os.onended = () => { active--; };
  }
  // vocal formant source for creatures and voices
  function Voc(o) {
    if (!ctx || !D) return; if (active >= MAXV - 2 && cur.pri < 3) { A.stats.dropped++; return; }
    const t = ctx.currentTime + (o.when || 0), dur = o.dur;
    const os = ctx.createOscillator(); os.type = 'sawtooth'; os.frequency.setValueAtTime(o.f0, t); os.frequency.linearRampToValueAtTime(o.f1 || o.f0, t + dur);
    const vib = ctx.createOscillator(); vib.frequency.value = o.vr || 5; const vg = ctx.createGain(); vg.gain.value = o.vd || 6; vib.connect(vg); vg.connect(os.frequency);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.g), t + (o.att || 0.12)); g.gain.setValueAtTime(Math.max(0.0002, o.g), t + dur * 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const out = ctx.createGain(); out.gain.value = 1; g.connect(out);
    (o.fm || [[500, 4], [1100, 6]]).forEach(([fr, q]) => { const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = fr; f.Q.value = q; os.connect(f); f.connect(g); });
    if (o.breath) { const s = ctx.createBufferSource(); s.buffer = nP; s.loop = true; const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = o.breath; f.Q.value = 0.8; const bg = ctx.createGain(); bg.gain.value = o.g * 0.7; s.connect(f); f.connect(bg); bg.connect(g); s.start(t, rnd()); s.stop(t + dur + 0.05); }
    out.connect(o.dest || D); os.start(t); vib.start(t); os.stop(t + dur + 0.05); vib.stop(t + dur + 0.05); active += 2; os.onended = () => { active -= 2; };
  }

  // ---------- routing: distance, panning, occlusion, reverb ----------
  function listener() { const P = DC.S && DC.S.player; return P || { x: 0, y: 0, indoors: false }; }
  function route(busName, x, y, range, wet) {
    const P = listener();
    let vol = 1, lpf = 20000, pan = 0;
    if (x !== undefined && DC.S) {
      const d = Math.hypot(x - P.x, y - P.y) / T; range = range || 38;
      if (d >= range) return null;
      vol = Math.pow(1 - d / range, 1.5);
      const walls = DC.W && DC.W.wallsBetween ? DC.W.wallsBetween(Math.floor(P.x / T), Math.floor(P.y / T), Math.floor(x / T), Math.floor(y / T)) : 0;
      if (walls) { vol *= Math.pow(0.62, Math.min(walls, 4)); lpf = Math.max(380, 16000 * Math.pow(0.32, Math.min(walls, 4))); }
      if (P.indoors && d > 6) { lpf = Math.min(lpf, 1800); vol *= 0.85; }
      pan = clamp((x - P.x) / (range * T * 0.35), -0.92, 0.92);
      lpf = Math.min(lpf, 20000 - d * 380);
      if (vol < 0.015) return null;
    }
    const inN = ctx.createBiquadFilter(); inN.type = 'lowpass'; inN.frequency.value = Math.max(300, lpf); inN.Q.value = 0.4;
    const gn = ctx.createGain(); gn.gain.value = vol; inN.connect(gn);
    let last = gn;
    if (hasPan && pan) { const pn = ctx.createStereoPanner(); pn.pan.value = pan; gn.connect(pn); last = pn; }
    last.connect(buses[busName] || buses.sfx);
    if (revIn && wet > 0 && !low) { const sg = ctx.createGain(); sg.gain.value = wet * (0.4 + 0.6 * Math.min(1, vol + 0.2)); last.connect(sg); sg.connect(revIn); }
    inN._vol = vol; return inN;
  }

  // ---------- footsteps by surface ----------
  const SURF = ['grass', 'dirt', 'pavement', 'pavement', 'wood', 'tile', 'concrete', 'water', 'water', 'gravel', 'leaves', 'dirt', 'carpet', 'wood', 'metal', 'mud'];
  const SND2SURF = { soft: 'grass', hard: 'concrete', wood: 'wood', gravel: 'gravel', leaves: 'leaves', water: 'water' };
  function stepOne(surf, v, r, ft, stance) {
    const sn = stance === 'sneak' ? 0.7 : stance === 'crouch' ? 0.85 : 1;
    switch (surf) {
      case 'grass': N({ buf: nB, ft: 'lowpass', f0: 900 * r * sn, dur: 0.09, g: 0.2 * v, att: 0.01 }); N({ buf: nP, ft: 'bandpass', f0: 3600 * r, q: 0.9, dur: 0.06, g: 0.05 * v }); break;
      case 'dirt': N({ buf: nB, ft: 'lowpass', f0: 650 * r * sn, dur: 0.08, g: 0.24 * v, att: 0.008 }); N({ ft: 'bandpass', f0: 1800 * r, q: 1, dur: 0.04, g: 0.06 * v }); break;
      case 'mud': N({ buf: nB, ft: 'lowpass', f0: 420 * r, dur: 0.17, g: 0.3 * v, att: 0.025 }); Tn({ f0: 190 * r, f1: 80, dur: 0.12, g: 0.05 * v }); N({ ft: 'bandpass', f0: 700, q: 4, f1: 300, dur: 0.12, g: 0.06 * v, when: 0.04 }); break;
      case 'concrete': N({ ft: 'bandpass', f0: 1900 * r * sn, q: 2, dur: 0.05, g: 0.15 * v }); Tn({ f0: 140 * r, f1: 70, dur: 0.07, g: 0.1 * v }); break;
      case 'pavement': N({ ft: 'bandpass', f0: 2500 * r * sn, q: 1.4, dur: 0.055, g: 0.16 * v }); N({ ft: 'highpass', f0: 5200, dur: 0.02, g: 0.04 * v, when: 0.01 }); Tn({ f0: 120 * r, f1: 60, dur: 0.07, g: 0.1 * v }); break;
      case 'tile': N({ ft: 'bandpass', f0: 2200 * r, q: 2.5, dur: 0.05, g: 0.15 * v }); Tn({ f0: 1250 * r, dur: 0.06, g: 0.018 * v }); Tn({ f0: 130, f1: 70, dur: 0.06, g: 0.08 * v }); break;
      case 'gravel': for (let k = 0; k < 4; k++) N({ ft: 'bandpass', f0: (2600 + rnd() * 1800) * r, q: 1.4, dur: 0.04, g: 0.09 * v, when: k * 0.022 + rnd() * 0.01 }); N({ buf: nB, ft: 'lowpass', f0: 500, dur: 0.07, g: 0.1 * v }); break;
      case 'wood': N({ ft: 'bandpass', f0: 420 * r * sn, q: 3, dur: 0.09, g: 0.2 * v }); Tn({ f0: 170 * r, f1: 115, dur: 0.1, type: 'triangle', g: 0.08 * v }); if (rnd() < 0.09 * v) Tn({ f0: 170, f1: 260, dur: 0.26, type: 'sawtooth', g: 0.025, lp: 520 }); break;
      case 'carpet': N({ buf: nB, ft: 'lowpass', f0: 380, dur: 0.08, g: 0.1 * v, att: 0.012 }); break;
      case 'metal': Tn({ f0: 780 * r, f1: 520, dur: 0.09, type: 'triangle', g: 0.07 * v }); N({ ft: 'bandpass', f0: 3100, q: 6, dur: 0.12, g: 0.09 * v }); Tn({ f0: 1850 * r, dur: 0.16, g: 0.02 * v }); break;
      case 'leaves': N({ ft: 'bandpass', f0: 2300 * r, q: 0.8, dur: 0.14, g: 0.12 * v, att: 0.03 }); for (let k = 0; k < 2; k++) N({ ft: 'highpass', f0: 5200, dur: 0.02, g: 0.04 * v, when: 0.03 + k * 0.04 + rnd() * 0.02 }); break;
      case 'water': N({ buf: nP, ft: 'lowpass', f0: 950, dur: 0.24, g: 0.2 * v, att: 0.03 }); Tn({ f0: 300 * r, f1: 720, dur: 0.1, g: 0.05 * v }); N({ ft: 'highpass', f0: 4200, dur: 0.1, g: 0.03 * v, when: 0.05 }); break;
    }
    // (ft kept for alternating foot pitch only)
  }
  A.step = function (snd, stance, win, ex) {
    if (!ctx || A.paused) return;
    ex = ex || {};
    const surf = ex.g !== undefined && SURF[ex.g] ? SURF[ex.g] : SND2SURF[snd] || 'concrete';
    const v = { sprint: 1, walk: 0.55, crouch: 0.28, sneak: 0.12 }[stance] || 0.5;
    const P = listener(); D = route('sfx', undefined, undefined, 0, 0.18); if (!D) return; cur = { pri: 1 };
    foot.n++; const ft = foot.n & 1, r = (0.88 + rnd() * 0.24) * (ft ? 1.04 : 0.97) * (ex.inj ? 0.9 : 1);
    stepOne(surf, v, r, ft, stance);
    if (stance === 'sprint') { Tn({ f0: 90, f1: 50, dur: 0.09, g: 0.07 }); if (foot.n % 3 === 0) N({ buf: nP, ft: 'bandpass', f0: 1500, q: 0.6, dur: 0.12, g: 0.035, att: 0.03 }); }
    if (ex.inj) N({ buf: nP, ft: 'bandpass', f0: 800, q: 1, dur: 0.1, g: 0.09 * v, when: 0.1 + rnd() * 0.04, att: 0.03 });
    if (ex.enc) { Tn({ f0: 75, f1: 42, dur: 0.12, g: 0.11 * Math.max(v, 0.3) }); if (foot.n % 2 === 0) { N({ ft: 'bandpass', f0: 3400, q: 3, dur: 0.05, g: 0.05 * v }); Tn({ f0: 2100, dur: 0.03, type: 'square', g: 0.012, lp: 3000, when: 0.03 }); } }
    if (win) A.sfx('windowclimb');
  };

  // ---------- creatures & animals ----------
  A.groan = function (x, y, v) {
    if (!ctx || A.paused) return; v = v || 1;
    const tg = ctx.currentTime; if (tg - (lastT.groan || 0) < 0.12) return; lastT.groan = tg;
    D = route('creature', x, y, 36, 0.35); if (!D) return; cur = { pri: v > 0.7 ? 2 : 1 };
    const kind = rnd(), f = 78 + rnd() * 55, d = 0.8 + rnd() * 0.9;
    if (v >= 0.9 && kind < 0.35) { // alerted rasp
      Voc({ f0: f * 2.1, f1: f * 1.6, dur: 0.7 + rnd() * 0.4, g: 0.16, att: 0.05, vr: 9, vd: 14, fm: [[650, 5], [1250, 7], [2400, 5]], breath: 2400 });
    } else if (kind < 0.55) { // low moan
      Voc({ f0: f * 1.25, f1: f * 0.8, dur: d, g: 0.13 * Math.min(1, v + 0.2), att: 0.2, vr: 4.5, vd: 5, fm: [[420, 5], [850, 6]], breath: 700 });
    } else if (kind < 0.8) { // drawn-out groan
      Voc({ f0: f, f1: f * 1.3, dur: d * 1.2, g: 0.12, att: 0.3, vr: 3.2, vd: 7, fm: [[360, 6], [980, 6]], breath: 500 });
      N({ buf: nB, ft: 'bandpass', f0: 300, q: 4, dur: d * 0.8, g: 0.12, att: 0.2 });
    } else { // wet gurgle
      Voc({ f0: f * 0.9, f1: f * 0.7, dur: d * 0.7, g: 0.12, att: 0.1, vr: 12, vd: 18, fm: [[300, 7], [700, 8]], breath: 900 });
    }
  };
  const ANIMAL = {
    bark(x, y) { Voc({ f0: 480, f1: 300, dur: 0.14, g: 0.2, att: 0.01, vr: 0, vd: 0, fm: [[700, 5], [1500, 5]], breath: 1800 }); Voc({ f0: 500, f1: 320, dur: 0.13, g: 0.17, att: 0.01, when: 0.2, fm: [[720, 5], [1550, 5]], vd: 0 }); },
    whine() { Voc({ f0: 620, f1: 900, dur: 0.5, g: 0.1, att: 0.1, vr: 6, vd: 20, fm: [[900, 8], [1800, 6]] }); },
    meow() { Voc({ f0: 520, f1: 800, dur: 0.38, g: 0.11, att: 0.06, vr: 5, vd: 12, fm: [[900, 8], [2200, 8]] }); Voc({ f0: 800, f1: 520, dur: 0.3, g: 0.08, att: 0.02, when: 0.34, fm: [[900, 8], [2200, 8]] }); },
    purr() { N({ buf: nB, ft: 'lowpass', f0: 150, dur: 1.4, g: 0.18, att: 0.3 }); },
    cluck() { for (let k = 0; k < 3; k++) Voc({ f0: 650 + rnd() * 160, f1: 450, dur: 0.07, g: 0.11, att: 0.01, when: k * 0.11, fm: [[1200, 6], [2600, 5]] }); },
    caw() { Voc({ f0: 760, f1: 520, dur: 0.28, g: 0.11, att: 0.02, vr: 22, vd: 30, fm: [[1000, 5], [2000, 5]], breath: 2500 }); },
    chirp() { const b = 2600 + rnd() * 1800; for (let k = 0; k < 2 + Math.floor(rnd() * 3); k++) Tn({ f0: b * (1 + rnd() * 0.2), f1: b * (1.2 + rnd() * 0.3), dur: 0.07, g: 0.025, when: k * 0.1 }); },
    owl() { Tn({ f0: 340, f1: 300, dur: 0.4, g: 0.06, att: 0.08, lp: 700 }); Tn({ f0: 300, f1: 280, dur: 0.7, g: 0.055, att: 0.1, lp: 700, when: 0.55 }); },
  };
  A.animal = function (kind, x, y) { const f = ANIMAL[kind]; if (!f || !ctx || A.paused) return; D = route('creature', x, y, 24, 0.3); if (!D) return; cur = { pri: 1 }; f(x, y); };

  // ---------- one-shot effect library ----------
  // each entry: [bus, priority, min gap (s), reverb send, range (tiles), function(v)]
  const S = {};
  const def = (name, bus, pri, gap, wet, range, fn) => { S[name] = { bus, pri, gap, wet, range, fn }; };
  // UI
  def('click', 'ui', 1, 0.03, 0, 0, () => { Tn({ f0: 1200, f1: 800, dur: 0.04, g: 0.08, type: 'square', lp: 2500 }); });
  def('ui', 'ui', 1, 0.03, 0, 0, () => { Tn({ f0: 900, dur: 0.03, type: 'square', g: 0.04, lp: 2000 }); });
  def('uiopen', 'ui', 1, 0.08, 0, 0, () => { Tn({ f0: 420, f1: 640, dur: 0.1, type: 'triangle', g: 0.07 }); N({ ft: 'highpass', f0: 3000, dur: 0.1, g: 0.03, att: 0.04 }); });
  def('uiclose', 'ui', 1, 0.08, 0, 0, () => { Tn({ f0: 620, f1: 380, dur: 0.1, type: 'triangle', g: 0.06 }); });
  def('uierror', 'ui', 1, 0.15, 0, 0, () => { Tn({ f0: 220, f1: 180, dur: 0.14, type: 'square', g: 0.05, lp: 900 }); });
  def('page', 'ui', 1, 0.06, 0.05, 0, () => { N({ ft: 'highpass', f0: 3000, dur: 0.15, g: 0.1, att: 0.05 }); });
  def('tab', 'ui', 1, 0.05, 0, 0, () => { Tn({ f0: 700, f1: 760, dur: 0.05, type: 'triangle', g: 0.06 }); });
  def('select', 'ui', 1, 0.03, 0, 0, () => { Tn({ f0: 1000, dur: 0.035, type: 'triangle', g: 0.05 }); });
  def('notify', 'ui', 1, 0.2, 0.1, 0, () => { Tn({ f0: 880, dur: 0.12, type: 'triangle', g: 0.06 }); Tn({ f0: 1175, dur: 0.18, type: 'triangle', g: 0.05, when: 0.08 }); });
  def('objective', 'ui', 2, 0.4, 0.2, 0, () => { [0, 4, 7].forEach((s, k) => Tn({ f0: 440 * Math.pow(2, s / 12), dur: 0.4, type: 'sine', g: 0.07, when: k * 0.09 })); });
  def('levelup', 'ui', 2, 0.3, 0.2, 0, () => { [0, 4, 7, 12].forEach((s, k) => Tn({ f0: 330 * Math.pow(2, s / 12), dur: 0.35, type: 'triangle', g: 0.09, when: k * 0.1 })); });
  def('win', 'ui', 3, 1, 0.4, 0, () => { [0, 4, 7, 12, 16, 19].forEach((s, k) => Tn({ f0: 262 * Math.pow(2, s / 12), dur: 1.2, type: 'triangle', g: 0.12, when: k * 0.2 })); });
  // inventory and items
  def('pickup', 'sfx', 1, 0.05, 0.1, 0, () => { Tn({ f0: 660, dur: 0.07, g: 0.1, type: 'triangle' }); Tn({ f0: 990, dur: 0.09, g: 0.08, type: 'triangle', when: 0.06 }); N({ buf: nP, ft: 'bandpass', f0: 1800, q: 0.7, dur: 0.1, g: 0.05, att: 0.03 }); });
  def('drop', 'sfx', 1, 0.06, 0.15, 0, () => { N({ buf: nB, ft: 'lowpass', f0: 380, dur: 0.1, g: 0.2 }); Tn({ f0: 150, f1: 80, dur: 0.08, g: 0.1 }); });
  def('invmove', 'ui', 1, 0.04, 0, 0, () => { N({ buf: nP, ft: 'bandpass', f0: 1700 + rnd() * 400, q: 0.8, dur: 0.07, g: 0.07, att: 0.02 }); });
  def('backpack', 'sfx', 1, 0.12, 0.1, 0, () => { N({ buf: nP, ft: 'bandpass', f0: 1100, q: 0.6, dur: 0.22, g: 0.12, att: 0.05 }); Tn({ f0: 2000, dur: 0.03, type: 'square', g: 0.015, lp: 3000, when: 0.1 }); });
  def('cloth', 'sfx', 1, 0.1, 0.05, 0, () => { N({ buf: nP, ft: 'bandpass', f0: 1500, q: 0.7, dur: 0.18, g: 0.12, att: 0.04 }); });
  def('equip', 'sfx', 1, 0.08, 0.1, 0, () => { Tn({ f0: 300, f1: 450, dur: 0.06, type: 'square', g: 0.05, lp: 1500 }); N({ ft: 'bandpass', f0: 2000, q: 3, dur: 0.04, g: 0.08 }); N({ buf: nP, ft: 'bandpass', f0: 1200, q: 0.7, dur: 0.12, g: 0.06, when: 0.04, att: 0.03 }); });
  def('weaponhandle', 'sfx', 1, 0.1, 0.1, 0, () => { N({ ft: 'bandpass', f0: 2600, q: 4, dur: 0.04, g: 0.1 }); Tn({ f0: 180, f1: 120, dur: 0.08, g: 0.1, type: 'triangle' }); });
  def('eat', 'sfx', 1, 0.2, 0.05, 0, () => { for (let k = 0; k < 3; k++) N({ buf: nB, ft: 'lowpass', f0: 900, dur: 0.07, g: 0.25, when: k * 0.16 }); N({ ft: 'bandpass', f0: 3200, q: 2, dur: 0.03, g: 0.06 }); });
  def('drink', 'sfx', 1, 0.2, 0.05, 0, () => { for (let k = 0; k < 3; k++) Tn({ f0: 250 + k * 40, f1: 400, dur: 0.12, g: 0.1, when: k * 0.16 }); N({ buf: nP, ft: 'lowpass', f0: 1200, dur: 0.5, g: 0.06, att: 0.1 }); });
  def('bandage', 'sfx', 1, 0.2, 0.05, 0, () => { N({ buf: nP, ft: 'bandpass', f0: 2500, q: 0.8, dur: 0.35, g: 0.15, att: 0.1 }); N({ ft: 'highpass', f0: 4500, dur: 0.12, g: 0.05, when: 0.15 }); });
  def('heal', 'sfx', 1, 0.3, 0.2, 0, () => { Tn({ f0: 520, f1: 700, dur: 0.4, type: 'sine', g: 0.05, att: 0.1 }); N({ buf: nP, ft: 'bandpass', f0: 2200, q: 0.8, dur: 0.3, g: 0.08, att: 0.1 }); });
  def('can', 'sfx', 1, 0.1, 0.2, 14, () => { for (let k = 0; k < 5; k++) Tn({ f0: 1800 + rnd() * 1400, dur: 0.07, type: 'square', g: 0.07, lp: 4500, when: k * 0.06 + rnd() * 0.04 }); });
  def('tape', 'sfx', 1, 0.2, 0.05, 0, () => { N({ ft: 'bandpass', f0: 3500, q: 2, dur: 0.5, g: 0.08, att: 0.05 }); });
  def('rustle', 'sfx', 1, 0.2, 0.05, 0, () => { N({ buf: nP, ft: 'bandpass', f0: 2000, q: 0.5, dur: 0.25, g: 0.1, att: 0.08 }); });
  def('search', 'sfx', 1, 0.2, 0.1, 0, () => { N({ buf: nP, ft: 'bandpass', f0: 1400, q: 0.6, dur: 0.3, g: 0.1, att: 0.08 }); Tn({ f0: 260, f1: 200, dur: 0.1, g: 0.05, when: 0.18 }); });
  def('containeropen', 'sfx', 1, 0.15, 0.2, 12, () => { Tn({ f0: 110, f1: 260, dur: 0.35, type: 'sawtooth', g: 0.035, lp: 700, att: 0.08 }); N({ ft: 'bandpass', f0: 900, q: 2, dur: 0.18, g: 0.08 }); N({ ft: 'highpass', f0: 4000, dur: 0.03, g: 0.05, when: 0.25 }); });
  def('containerclose', 'sfx', 1, 0.15, 0.2, 12, () => { N({ buf: nB, ft: 'lowpass', f0: 420, dur: 0.14, g: 0.3 }); Tn({ f0: 120, f1: 60, dur: 0.12, g: 0.12 }); N({ ft: 'bandpass', f0: 2800, q: 5, dur: 0.03, g: 0.07, when: 0.1 }); });
  def('lootfound', 'ui', 1, 0.3, 0.1, 0, () => { Tn({ f0: 1320, dur: 0.1, type: 'sine', g: 0.05 }); Tn({ f0: 1760, dur: 0.16, type: 'sine', g: 0.04, when: 0.07 }); });
  def('open', 'sfx', 1, 0.15, 0.15, 12, () => { N({ ft: 'bandpass', f0: 500, f1: 900, q: 2, dur: 0.22, g: 0.14 }); Tn({ f0: 180, f1: 220, dur: 0.2, type: 'sawtooth', g: 0.03, lp: 500 }); });
  // crafting and building
  def('craft', 'sfx', 1, 0.2, 0.1, 0, () => { for (let k = 0; k < 3; k++) { Tn({ f0: 500, f1: 300, dur: 0.06, type: 'triangle', g: 0.14, when: k * 0.12 }); N({ ft: 'bandpass', f0: 1500, q: 4, dur: 0.04, g: 0.2, when: k * 0.12 }); } });
  def('hammer', 'sfx', 1, 0.12, 0.25, 22, () => { Tn({ f0: 900, f1: 500, dur: 0.07, type: 'square', g: 0.07, lp: 2500 }); N({ buf: nB, ft: 'lowpass', f0: 600, dur: 0.1, g: 0.35 }); N({ ft: 'bandpass', f0: 3200, q: 8, dur: 0.12, g: 0.04 }); });
  def('saw', 'sfx', 1, 0.2, 0.15, 20, () => { N({ ft: 'bandpass', f0: 1800, f1: 1300, q: 2, dur: 0.3, g: 0.1, att: 0.05 }); });
  def('build', 'sfx', 1, 0.3, 0.2, 0, () => { Tn({ f0: 330, dur: 0.1, type: 'triangle', g: 0.1 }); Tn({ f0: 495, dur: 0.14, type: 'triangle', g: 0.1, when: 0.09 }); Tn({ f0: 660, dur: 0.2, type: 'triangle', g: 0.1, when: 0.2 }); N({ buf: nB, ft: 'lowpass', f0: 500, dur: 0.12, g: 0.25 }); });
  def('barricade', 'sfx', 2, 0.2, 0.3, 24, () => { N({ buf: nB, ft: 'lowpass', f0: 450, dur: 0.12, g: 0.5 }); Tn({ f0: 190, f1: 110, dur: 0.1, type: 'triangle', g: 0.2 }); N({ ft: 'bandpass', f0: 900, q: 4, dur: 0.1, g: 0.3, when: 0.13 }); });
  def('plank', 'sfx', 1, 0.1, 0.25, 24, () => { N({ ft: 'bandpass', f0: 800, q: 4, dur: 0.1, g: 0.4 }); Tn({ f0: 220, f1: 140, dur: 0.1, type: 'triangle', g: 0.2 }); });
  def('chop', 'sfx', 1, 0.2, 0.3, 28, () => { N({ buf: nB, ft: 'lowpass', f0: 700, dur: 0.14, g: 0.55 }); Tn({ f0: 300, f1: 120, dur: 0.1, type: 'triangle', g: 0.2 }); N({ ft: 'bandpass', f0: 1400, q: 3, dur: 0.05, g: 0.1 }); });
  def('pick', 'sfx', 1, 0.15, 0.1, 10, () => { for (let k = 0; k < 2; k++) Tn({ f0: 2400 + k * 300, dur: 0.02, type: 'square', g: 0.05, lp: 4000, when: k * 0.15 }); });
  def('repair', 'sfx', 1, 0.2, 0.15, 14, () => { Tn({ f0: 1600, f1: 1200, dur: 0.05, type: 'square', g: 0.03, lp: 3000 }); N({ ft: 'bandpass', f0: 2600, q: 5, dur: 0.06, g: 0.08, when: 0.1 }); });
  def('break', 'sfx', 2, 0.15, 0.3, 28, () => { N({ ft: 'bandpass', f0: 1200, q: 1, dur: 0.2, g: 0.5 }); Tn({ f0: 200, f1: 70, dur: 0.2, type: 'sawtooth', g: 0.15, lp: 500 }); });
  def('gate', 'sfx', 2, 0.5, 0.35, 0, () => { N({ buf: nB, ft: 'lowpass', f0: 250, dur: 1.5, g: 0.5 }); Tn({ f0: 80, f1: 60, dur: 1.5, type: 'sawtooth', g: 0.05, lp: 220 }); });
  def('water', 'sfx', 1, 0.2, 0.1, 0, () => { N({ buf: nP, ft: 'bandpass', f0: 1800, f1: 900, q: 0.6, dur: 0.5, g: 0.1, att: 0.1 }); });
  def('fire', 'sfx', 1, 0.2, 0.1, 18, () => { N({ ft: 'bandpass', f0: 900, q: 1, dur: 0.5, g: 0.1, att: 0.15 }); for (let k = 0; k < 3; k++) N({ ft: 'highpass', f0: 4500, dur: 0.02, g: 0.06, when: rnd() * 0.5 }); });
  def('ignite', 'sfx', 1, 0.3, 0.1, 18, () => { N({ ft: 'highpass', f0: 2500, dur: 0.12, g: 0.15 }); N({ buf: nB, ft: 'lowpass', f0: 500, dur: 0.4, g: 0.2, att: 0.1 }); });
  def('lock', 'sfx', 1, 0.15, 0.2, 18, () => { Tn({ f0: 1800, dur: 0.03, type: 'square', g: 0.07, lp: 3000 }); Tn({ f0: 1200, dur: 0.05, type: 'square', g: 0.07, lp: 3000, when: 0.08 }); });
  def('unlock', 'sfx', 1, 0.15, 0.2, 18, () => { Tn({ f0: 1200, dur: 0.03, type: 'square', g: 0.07, lp: 3000 }); Tn({ f0: 1900, dur: 0.05, type: 'square', g: 0.07, lp: 3000, when: 0.1 }); N({ ft: 'bandpass', f0: 3000, q: 6, dur: 0.03, g: 0.05, when: 0.18 }); });
  def('climb', 'sfx', 1, 0.2, 0.05, 0, () => { N({ buf: nP, ft: 'bandpass', f0: 1000, q: 1, dur: 0.3, g: 0.12, att: 0.1 }); Tn({ f0: 150, f1: 90, dur: 0.1, g: 0.08, when: 0.2 }); });
  def('windowclimb', 'sfx', 1, 0.3, 0.1, 0, () => { N({ buf: nP, ft: 'bandpass', f0: 1000, q: 1, dur: 0.3, g: 0.12, att: 0.1 }); N({ ft: 'highpass', f0: 3800, dur: 0.05, g: 0.03, when: 0.12 }); });
  // doors and windows
  def('dooropen', 'sfx', 1, 0.15, 0.3, 30, () => { Tn({ f0: 90, f1: 210, dur: 0.45, type: 'sawtooth', g: 0.05, lp: 600, att: 0.08 }); N({ buf: nP, ft: 'bandpass', f0: 600, q: 2, dur: 0.3, g: 0.07 }); N({ ft: 'bandpass', f0: 2800, q: 6, dur: 0.02, g: 0.06 }); });
  def('doorclose', 'sfx', 1, 0.15, 0.4, 32, () => { N({ buf: nB, ft: 'lowpass', f0: 300, dur: 0.18, g: 0.5 }); Tn({ f0: 100, f1: 50, dur: 0.15, g: 0.3 }); N({ ft: 'bandpass', f0: 2500, q: 5, dur: 0.03, g: 0.1, when: 0.12 }); });
  def('doorlocked', 'sfx', 1, 0.3, 0.3, 24, () => { N({ ft: 'bandpass', f0: 1600, q: 5, dur: 0.04, g: 0.2 }); N({ ft: 'bandpass', f0: 1900, q: 5, dur: 0.04, g: 0.17, when: 0.07 }); Tn({ f0: 120, f1: 80, dur: 0.1, g: 0.1 }); });
  def('doorbang', 'sfx', 2, 0.12, 0.4, 36, () => { N({ buf: nB, ft: 'lowpass', f0: 280, dur: 0.22, g: 0.7 }); Tn({ f0: 95, f1: 40, dur: 0.22, g: 0.4 }); N({ ft: 'bandpass', f0: 700, q: 2, dur: 0.1, g: 0.2, when: 0.03 }); });
  def('doorbreak', 'sfx', 3, 0.3, 0.5, 40, () => { N({ buf: nB, ft: 'lowpass', f0: 500, dur: 0.5, g: 0.8 }); N({ ft: 'bandpass', f0: 900, q: 1, dur: 0.35, g: 0.4 }); for (let k = 0; k < 4; k++) N({ ft: 'bandpass', f0: 1500 + rnd() * 1200, q: 4, dur: 0.05, g: 0.15, when: 0.1 + k * 0.07 }); });
  def('windowopen', 'sfx', 1, 0.15, 0.2, 18, () => { N({ ft: 'bandpass', f0: 1100, f1: 1700, q: 3, dur: 0.25, g: 0.09 }); Tn({ f0: 320, f1: 380, dur: 0.2, type: 'sawtooth', g: 0.02, lp: 700 }); });
  def('windowclose', 'sfx', 1, 0.15, 0.2, 18, () => { N({ ft: 'bandpass', f0: 1700, f1: 1100, q: 3, dur: 0.2, g: 0.09 }); N({ ft: 'bandpass', f0: 3000, q: 6, dur: 0.03, g: 0.08, when: 0.18 }); });
  def('glass', 'sfx', 3, 0.15, 0.5, 42, () => { N({ ft: 'highpass', f0: 3500, dur: 0.5, g: 0.5 }); for (let k = 0; k < 6; k++) Tn({ f0: 2500 + rnd() * 3000, dur: 0.12, g: 0.06, when: rnd() * 0.3 }); });
  def('glassdebris', 'sfx', 1, 0.2, 0.2, 20, () => { for (let k = 0; k < 4; k++) Tn({ f0: 3000 + rnd() * 3000, dur: 0.05, g: 0.04, when: k * 0.05 + rnd() * 0.05 }); });
  // combat
  def('swing', 'sfx', 1, 0.08, 0.1, 20, () => { N({ buf: nP, ft: 'bandpass', f0: 800, f1: 2000, q: 1, dur: 0.14, g: 0.12, att: 0.06 }); });
  def('whiff', 'sfx', 1, 0.08, 0.05, 20, () => { N({ buf: nP, ft: 'bandpass', f0: 1200, f1: 700, q: 1, dur: 0.12, g: 0.06, att: 0.05 }); });
  def('hit', 'sfx', 2, 0.07, 0.25, 30, () => { N({ buf: nB, ft: 'lowpass', f0: 450, dur: 0.12, g: 0.6 }); Tn({ f0: 160, f1: 60, dur: 0.1, g: 0.3 }); N({ ft: 'bandpass', f0: 1400, q: 2, dur: 0.05, g: 0.12 }); });
  def('thud', 'sfx', 1, 0.06, 0.3, 30, () => { N({ buf: nB, ft: 'lowpass', f0: 350, dur: 0.16, g: 0.55 }); Tn({ f0: 110, f1: 45, dur: 0.15, g: 0.3 }); });
  def('hurt', 'voice', 3, 0.15, 0.2, 0, () => { Voc({ f0: 230, f1: 150, dur: 0.28, g: 0.14, att: 0.02, vr: 6, vd: 8, fm: [[600, 5], [1200, 6]], breath: 1500 }); N({ buf: nB, ft: 'lowpass', f0: 400, dur: 0.2, g: 0.35 }); });
  def('death', 'voice', 3, 1, 0.5, 0, () => { Tn({ f0: 140, f1: 35, dur: 2.5, type: 'sawtooth', g: 0.3, lp: 400 }); N({ buf: nB, ft: 'lowpass', f0: 300, dur: 2, g: 0.5 }); });
  def('zdie', 'creature', 2, 0.1, 0.3, 34, () => { Voc({ f0: 120, f1: 55, dur: 0.7, g: 0.13, att: 0.04, vr: 6, vd: 10, fm: [[380, 6], [850, 6]], breath: 800 }); N({ buf: nB, ft: 'lowpass', f0: 300, dur: 0.2, g: 0.3, when: 0.3 }); });
  def('zhit', 'creature', 1, 0.1, 0.2, 28, () => { Voc({ f0: 160, f1: 110, dur: 0.18, g: 0.11, att: 0.01, fm: [[500, 5], [1000, 6]], breath: 1200 }); });
  def('zsnarl', 'creature', 2, 0.3, 0.3, 30, () => { Voc({ f0: 105, f1: 80, dur: 0.55, g: 0.14, att: 0.1, vr: 22, vd: 20, fm: [[320, 7], [900, 7], [1900, 5]], breath: 1800 }); });
  def('shot', 'sfx', 3, 0.08, 0.7, 70, () => { N({ ft: 'lowpass', f0: 4000, f1: 300, dur: 0.35, g: 0.9, att: 0.002 }); Tn({ f0: 160, f1: 40, dur: 0.25, g: 0.5 }); N({ buf: nB, ft: 'lowpass', f0: 600, dur: 0.9, g: 0.25, when: 0.05, att: 0.1 }); });
  def('distantshot', 'sfx', 1, 0.5, 0.8, 0, () => { for (let k = 0; k < 3; k++) N({ ft: 'lowpass', f0: 600, f1: 150, dur: 0.6, g: 0.18, when: k * 0.4 + rnd() * 0.2 }); });
  def('empty', 'sfx', 1, 0.2, 0.05, 0, () => { Tn({ f0: 700, f1: 400, dur: 0.04, type: 'square', g: 0.1, lp: 1500 }); });
  def('reload', 'sfx', 1, 0.3, 0.2, 0, () => { N({ ft: 'bandpass', f0: 2400, q: 6, dur: 0.04, g: 0.15 }); N({ ft: 'bandpass', f0: 1800, q: 6, dur: 0.05, g: 0.15, when: 0.25 }); });
  def('wake', 'ui', 1, 0.5, 0.1, 0, () => { Tn({ f0: 400, f1: 600, dur: 0.3, type: 'triangle', g: 0.1 }); });
  // devices, power, vehicles, broadcasts
  def('flashlight', 'sfx', 1, 0.1, 0.05, 0, () => { N({ ft: 'bandpass', f0: 3000, q: 6, dur: 0.02, g: 0.12 }); Tn({ f0: 1500, dur: 0.02, type: 'square', g: 0.03, lp: 3000 }); });
  def('generator', 'sfx', 2, 0.5, 0.3, 30, () => { Tn({ f0: 60, f1: 120, dur: 0.8, type: 'sawtooth', g: 0.08, lp: 300, att: 0.4 }); N({ buf: nB, ft: 'lowpass', f0: 300, dur: 0.8, g: 0.3, att: 0.3 }); });
  def('powerdown', 'sfx', 2, 1, 0.5, 0, () => { Tn({ f0: 120, f1: 30, dur: 1.4, type: 'sawtooth', g: 0.15, lp: 300 }); N({ ft: 'bandpass', f0: 4000, q: 2, dur: 0.3, g: 0.12 }); });
  def('powerup', 'sfx', 2, 1, 0.3, 0, () => { Tn({ f0: 40, f1: 120, dur: 0.8, type: 'sawtooth', g: 0.08, lp: 300, att: 0.3 }); N({ ft: 'bandpass', f0: 3500, q: 3, dur: 0.15, g: 0.08, when: 0.3 }); });
  def('cardoor', 'sfx', 1, 0.2, 0.3, 28, () => { N({ buf: nB, ft: 'lowpass', f0: 350, dur: 0.14, g: 0.4 }); N({ ft: 'bandpass', f0: 2200, q: 4, dur: 0.04, g: 0.15, when: 0.05 }); });
  def('alarm', 'sfx', 3, 0.4, 0.6, 60, () => { for (let k = 0; k < 4; k++) Tn({ f0: k % 2 ? 1250 : 900, dur: 0.22, type: 'square', g: 0.14, lp: 3000, when: k * 0.22 }); });
  def('alarmstart', 'sfx', 3, 0.4, 0.6, 60, () => { for (let k = 0; k < 6; k++) Tn({ f0: k % 2 ? 1250 : 900, dur: 0.22, type: 'square', g: 0.14, lp: 3000, when: k * 0.22 }); });
  def('siren', 'sfx', 1, 2, 0.8, 0, () => { Tn({ f0: 500, f1: 900, dur: 2, type: 'sawtooth', g: 0.05, lp: 1500, att: 0.5 }); Tn({ f0: 900, f1: 500, dur: 2, type: 'sawtooth', g: 0.05, lp: 1500, att: 0.5, when: 2 }); });
  def('radio', 'sfx', 1, 0.5, 0.1, 0, () => { N({ ft: 'bandpass', f0: 1800, q: 2, dur: 0.8, g: 0.12 }); Tn({ f0: 800, dur: 0.1, g: 0.06, type: 'square', lp: 1500, when: 0.6 }); });
  def('broadcast', 'sfx', 2, 3, 0.2, 0, () => { // emergency alert tone and static speech
    Tn({ f0: 853, dur: 1, type: 'sine', g: 0.07 }); Tn({ f0: 960, dur: 1, type: 'sine', g: 0.07 });
    for (let k = 0; k < 9; k++) Voc({ f0: 140 + rnd() * 40, f1: 130 + rnd() * 40, dur: 0.22, g: 0.08, att: 0.03, when: 1.2 + k * 0.3, vr: 0, vd: 0, fm: [[500 + rnd() * 300, 5], [1500, 5]] });
    N({ ft: 'bandpass', f0: 2200, q: 1.5, dur: 4, g: 0.05, att: 0.2 });
  });
  def('heli', 'sfx', 2, 1, 0.5, 0, () => { N({ buf: nB, ft: 'lowpass', f0: 250, dur: 4, g: 0.35, att: 1.5 }); for (let k = 0; k < 12; k++) Tn({ f0: 70, f1: 50, dur: 0.18, g: 0.08, when: 0.3 + k * 0.3 }); });
  def('beacon', 'sfx', 2, 1, 0.3, 0, () => { Tn({ f0: 220, f1: 880, dur: 1.5, type: 'sawtooth', g: 0.12, lp: 1200 }); });
  def('thunder', 'weather', 3, 2, 0.9, 0, () => { N({ buf: nB, ft: 'lowpass', f0: 400, f1: 80, dur: 3.5, g: 0.9, att: 0.15 }); N({ buf: nB, ft: 'lowpass', f0: 250, f1: 60, dur: 2.5, g: 0.5, att: 0.3, when: 0.6 }); N({ ft: 'bandpass', f0: 900, f1: 300, q: 0.6, dur: 0.5, g: 0.2, att: 0.01 }); });
  def('clock', 'sfx', 1, 0.5, 0.1, 0, () => { for (let k = 0; k < 6; k++) Tn({ f0: 2200, dur: 0.05, type: 'square', g: 0.08, lp: 3500, when: k * 0.1 }); });
  def('purr', 'creature', 1, 1, 0.1, 0, () => ANIMAL.purr());
  def('pet', 'creature', 1, 0.3, 0.1, 0, () => { Tn({ f0: 500, f1: 600, dur: 0.12, type: 'triangle', g: 0.06 }); });
  def('bark', 'creature', 1, 0.5, 0.4, 30, () => ANIMAL.bark());
  def('meow', 'creature', 1, 0.5, 0.2, 20, () => ANIMAL.meow());
  def('cluck', 'creature', 1, 0.5, 0.2, 18, () => ANIMAL.cluck());
  def('talk', 'voice', 1, 0.2, 0.2, 18, () => { const b = 150 + rnd() * 50; for (let k = 0; k < 4 + Math.floor(rnd() * 3); k++) Voc({ f0: b + rnd() * 30, f1: b + rnd() * 30, dur: 0.1, g: 0.06, att: 0.02, when: k * 0.13, vr: 0, vd: 0, fm: [[450 + rnd() * 400, 6], [1400 + rnd() * 500, 6]] }); });
  def('rain_drip', 'weather', 1, 0.05, 0.3, 12, () => { Tn({ f0: 1400 + rnd() * 900, f1: 900, dur: 0.05, g: 0.03 }); });

  A.sfx = function (n, x, y) {
    if (!ctx) return;
    const d = S[n]; if (!d) return;
    if (A.paused && (d.bus === 'creature' || d.bus === 'weather') && n !== 'thunder') return;
    const now = ctx.currentTime; if (now - (lastT[n] || 0) < d.gap) return; lastT[n] = now;
    const dest = route(d.bus, x, y, d.range || 38, d.wet);
    if (!dest) return;
    const wet = d.wet; D = dest; cur = { pri: d.pri };
    // small random pitch is applied through detune-like variation in the helper parameters
    d.fn(dest._vol);
    D = null;
  };
  A.has = (n) => !!S[n];

  // ---------- ambience layers ----------
  const L = {}; // looping layers
  function loopSrc(buf, dest, filt) {
    const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; let n = s; const out = [];
    if (filt) { const f = ctx.createBiquadFilter(); f.type = filt.t; f.frequency.value = filt.f; f.Q.value = filt.q || 0.7; s.connect(f); n = f; out.push(f); }
    const g = ctx.createGain(); g.gain.value = 0; n.connect(g); g.connect(dest); s.start(0, rnd() * 1.5);
    return { s, f: out[0], g };
  }
  function buildAmbience() {
    outLP = ctx.createBiquadFilter(); outLP.type = 'lowpass'; outLP.frequency.value = 18000; outLP.connect(buses.amb);
    const wBus = ctx.createBiquadFilter(); wBus.type = 'lowpass'; wBus.frequency.value = 18000; wBus.connect(buses.weather); L.wxLP = wBus;
    L.wind = loopSrc(nP, outLP, { t: 'bandpass', f: 500, q: 0.6 });
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.13; const lg = ctx.createGain(); lg.gain.value = 250; lfo.connect(lg); lg.connect(L.wind.f.frequency); lfo.start();
    L.gust = loopSrc(nP, outLP, { t: 'bandpass', f: 1500, q: 0.9 });
    L.rainHi = loopSrc(nW, wBus, { t: 'highpass', f: 1200, q: 0.5 });
    L.rainLo = loopSrc(nP, wBus, { t: 'bandpass', f: 700, q: 0.5 });
    L.roof = loopSrc(nW, buses.weather, { t: 'bandpass', f: 1500, q: 0.6 }); const rl = ctx.createBiquadFilter(); rl.type = 'lowpass'; rl.frequency.value = 2400;
    L.leaves = loopSrc(nP, outLP, { t: 'bandpass', f: 3200, q: 0.8 });
    L.urban = loopSrc(nB, outLP, { t: 'lowpass', f: 160, q: 0.5 });
    L.night = loopSrc(nB, outLP, { t: 'lowpass', f: 120 });
    L.room = loopSrc(nB, buses.amb, { t: 'lowpass', f: 220 });
    L.safe = loopSrc(nB, buses.amb, { t: 'lowpass', f: 320 });
    L.crowd = loopSrc(nB, buses.creature, { t: 'bandpass', f: 220, q: 2.5 });
    // electrical hum (mains + harmonics) and cooler
    L.hum = ctx.createOscillator(); L.hum.type = 'sawtooth'; L.hum.frequency.value = 50; const hf = ctx.createBiquadFilter(); hf.type = 'lowpass'; hf.frequency.value = 180; L.humG = ctx.createGain(); L.humG.gain.value = 0; L.hum.connect(hf); hf.connect(L.humG); L.humG.connect(buses.amb); L.hum.start();
    L.fridge = ctx.createOscillator(); L.fridge.type = 'triangle'; L.fridge.frequency.value = 58; L.fridgeG = ctx.createGain(); L.fridgeG.gain.value = 0; L.fridge.connect(L.fridgeG); L.fridgeG.connect(buses.amb); L.fridge.start();
    L.gen = ctx.createOscillator(); L.gen.type = 'sawtooth'; L.gen.frequency.value = 46; const gf = ctx.createBiquadFilter(); gf.type = 'lowpass'; gf.frequency.value = 260; L.genG = ctx.createGain(); L.genG.gain.value = 0; L.gen.connect(gf); gf.connect(L.genG); L.genG.connect(buses.amb); L.gen.start();
    const gl = ctx.createOscillator(); gl.frequency.value = 9; const glg = ctx.createGain(); glg.gain.value = 3; gl.connect(glg); glg.connect(L.gen.frequency); gl.start();
    // crickets
    L.cric = ctx.createOscillator(); L.cric.type = 'sine'; L.cric.frequency.value = 4300; L.cricG = ctx.createGain(); L.cricG.gain.value = 0; const cm = ctx.createGain(); cm.gain.value = 0; const cl = ctx.createOscillator(); cl.type = 'square'; cl.frequency.value = 13; const cls = ctx.createGain(); cls.gain.value = 0.5; cl.connect(cls); cls.connect(cm.gain); L.cric.connect(cm); cm.connect(L.cricG); L.cricG.connect(outLP); L.cric.start(); cl.start();
  }
  const setG = (g, v, tau) => g.gain.setTargetAtTime(v, ctx.currentTime, tau || 0.6);

  // ---------- music ----------
  const M = { roots: [55, 49, 41.2, 46.2, 51.9, 43.65], ri: 0, rootF: 55, nextBeat: 0, beat: 0, nextHeart: 0, nextPluck: 2, g: {}, osc: [], pads: {}, vic: 0 };
  function mkPad(name, ratios, type, lp, gain, det) {
    const out = ctx.createGain(); out.gain.value = 0; const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; f.Q.value = 0.4; f.connect(out); out.connect(buses.music);
    const oscs = [];
    ratios.forEach((r) => { [-1, 1].forEach((sgn) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = M.rootF * r; o.detune.value = sgn * (det || 5); const g = ctx.createGain(); g.gain.value = gain / ratios.length; o.connect(g); g.connect(f); o.start(); oscs.push({ o, r }); }); });
    const lf = ctx.createOscillator(); lf.frequency.value = 0.07 + rnd() * 0.08; const lg = ctx.createGain(); lg.gain.value = lp * 0.25; lf.connect(lg); lg.connect(f.frequency); lf.start();
    M.pads[name] = { out, oscs }; return out;
  }
  function buildMusic() {
    M.g.calm = mkPad('calm', [1, 1.5, 2, 3], 'triangle', 520, 0.7);
    M.g.tension = mkPad('tension', [1, 1.0595, 1.4142, 2.0], 'sawtooth', 380, 0.34, 9);
    M.g.danger = mkPad('danger', [0.5, 1, 1.5], 'sawtooth', 700, 0.4, 12);
    if (!low) {
      M.g.horde = mkPad('horde', [0.5, 1, 1.5, 2.02], 'sawtooth', 950, 0.46, 15);
      M.g.night = mkPad('night', [0.5, 1, 2.0], 'sine', 420, 0.8);
      M.g.safe = mkPad('safe', [1, 1.25, 1.5, 2, 2.5], 'triangle', 900, 0.62, 4);
      M.g.menu = mkPad('menu', [1, 1.2, 1.5, 2.4], 'triangle', 700, 0.7, 6);
      M.g.victory = mkPad('victory', [1, 1.25, 1.5, 2, 3], 'triangle', 1500, 0.7, 5);
    }
    // plucked-note bus with echo
    echoIn = ctx.createGain(); const dl = ctx.createDelay(1.5); dl.delayTime.value = 0.42; const fb = ctx.createGain(); fb.gain.value = 0.38; const df = ctx.createBiquadFilter(); df.type = 'lowpass'; df.frequency.value = 1800;
    echoIn.connect(dl); dl.connect(df); df.connect(fb); fb.connect(dl); df.connect(buses.music); echoIn.connect(buses.music);
  }
  function pluck(f, g, dur, type, when) {
    if (!ctx || low && type === 'triangle' && rnd() < 0.3) return;
    const t = ctx.currentTime + (when || 0), o = ctx.createOscillator(); o.type = type || 'sine'; o.frequency.value = f; const gn = ctx.createGain(); gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(g, t + 0.015); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(gn); gn.connect(echoIn); o.start(t); o.stop(t + dur + 0.05);
  }
  function kick(t, g, f) { const o = ctx.createOscillator(); o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(34, t + 0.16); const gn = ctx.createGain(); gn.gain.setValueAtTime(g, t); gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.22); o.connect(gn); gn.connect(buses.music); o.start(t); o.stop(t + 0.25); }
  function tick(t, g, f) { const s = ctx.createBufferSource(); s.buffer = nW; const fl = ctx.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = f; fl.Q.value = 4; const gn = ctx.createGain(); gn.gain.setValueAtTime(g, t); gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.07); s.connect(fl); fl.connect(gn); gn.connect(buses.music); s.start(t, rnd()); s.stop(t + 0.1); }
  const MIN = [0, 3, 5, 7, 10, 12, 15], MAJ = [0, 2, 4, 7, 9, 12, 14];
  function musicUpdate(dt, tg) {
    const now = ctx.currentTime;
    // glide roots slowly
    if (now > M.nextRoot) { M.ri = (M.ri + 1 + Math.floor(rnd() * 2)) % M.roots.length; M.rootF = M.roots[M.ri]; M.nextRoot = now + 14 + rnd() * 8; for (const k in M.pads) M.pads[k].oscs.forEach((q) => q.o.frequency.setTargetAtTime(M.rootF * q.r * (k === 'menu' ? 1.5 : k === 'safe' || k === 'victory' ? 1.25 : 1), now, 3)); }
    if (M.nextRoot === undefined) M.nextRoot = now + 6;
    const mv = DC.settings.mute ? 0 : DC.settings.music;
    for (const k in M.g) setG(M.g[k], (mv > 0.002 ? (tg[k] || 0) : 0) * (k === 'calm' ? 0.9 : 0.8), 1.8);
    if (mv <= 0.002 || A.paused && !tg.menu) return;
    const R = M.rootF;
    // sparse melodic notes
    if (now > M.nextPluck) {
      const calmish = tg.calm + tg.safe + tg.menu + tg.night + (tg.victory || 0);
      if (calmish > 0.2) {
        const sc = tg.safe > 0.4 || tg.victory > 0.4 ? MAJ : MIN, oct = tg.night > 0.4 ? 2 : tg.menu > 0.4 ? 4 : 4;
        pluck(R * oct * Math.pow(2, sc[Math.floor(rnd() * sc.length)] / 12), 0.04 * Math.min(1, calmish), tg.night > 0.4 ? 4 : 2.6, tg.safe > 0.4 ? 'triangle' : 'sine');
        if (tg.menu > 0.4 && rnd() < 0.6) pluck(R * 2 * Math.pow(2, sc[Math.floor(rnd() * 4)] / 12), 0.035, 3, 'sine', 0.5);
      }
      M.nextPluck = now + (tg.menu > 0.4 ? 1.8 : 3.5) + rnd() * 5;
      if (tg.tension > 0.35 && rnd() < 0.5) pluck(R * 8 * (rnd() < 0.5 ? 1.0595 : 1.4142), 0.018 * tg.tension, 3.4, 'sine', 0.3);
    }
    // heartbeat pulse for danger
    if (tg.danger > 0.25 && now > M.nextHeart) { const iv = 1.0 - 0.45 * tg.danger; kick(now + 0.02, 0.22 * tg.danger, 80); kick(now + 0.02 + iv * 0.22, 0.15 * tg.danger, 70); M.nextHeart = now + iv; }
    // horde percussion (lookahead scheduling)
    if (!low && tg.horde > 0.25) {
      const sp = 0.27 - 0.05 * tg.horde; if (M.nextBeat < now) M.nextBeat = now + 0.05;
      while (M.nextBeat < now + 0.25) { const b = M.beat++ % 8; if (b === 0 || b === 3 || b === 6) kick(M.nextBeat, 0.2 * tg.horde, 70); if (b % 2 === 1) tick(M.nextBeat, 0.05 * tg.horde, 5200); if (b === 4) tick(M.nextBeat, 0.07 * tg.horde, 2400); M.nextBeat += sp; }
    }
    // victory arpeggio
    if (tg.victory > 0.3 && now > (M.nextVic || 0)) { const k = M.vic++ % 6; pluck(R * 4 * Math.pow(2, MAJ[[0, 2, 3, 4, 5, 3][k]] / 12), 0.05, 2.5, 'triangle'); M.nextVic = now + 0.32; }
  }
  A.music = function (mode) { musicMode = mode || 'game'; };
  A.victory = function () { victoryT = 25; };

  // ---------- master / settings ----------
  function build() {
    master = ctx.createGain(); master.gain.value = 0.9;
    comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 6; comp.attack.value = 0.004; comp.release.value = 0.2;
    master.connect(comp); comp.connect(ctx.destination);
    ['music', 'amb', 'weather', 'sfx', 'ui', 'voice', 'creature'].forEach((n) => { const g = ctx.createGain(); g.gain.value = 0; g.connect(master); buses[n] = g; });
    nW = mkNoise('white'); nP = mkNoise('pink'); nB = mkNoise('brown');
    if (!low) {
      revIn = ctx.createGain(); revIn.gain.value = 1;
      const cI = ctx.createConvolver(); cI.buffer = mkIR(0.5, 0.55); const cO = ctx.createConvolver(); cO.buffer = mkIR(1.7, 0.85);
      revIndoorG = ctx.createGain(); revOutG = ctx.createGain(); revIndoorG.gain.value = 0; revOutG.gain.value = 0.25;
      revIn.connect(cI); revIn.connect(cO); cI.connect(revIndoorG); cO.connect(revOutG); revIndoorG.connect(master); revOutG.connect(master);
    }
    hasPan = !!ctx.createStereoPanner;
    buildAmbience(); buildMusic();
  }
  A.start = function () {
    if (A.started) { if (ctx && ctx.state === 'suspended' && !document.hidden) ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    try { ctx = A.ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { try { ctx = A.ctx = new AC(); } catch (e2) { return; } }
    A.started = true; low = !!DC.settings.lowPowerAudio || (DC.gfx && DC.gfx.level === 'perf'); MAXV = low ? 14 : 30;
    try { build(); } catch (err) { A.ctx = null; ctx = null; A.started = false; return; }
    // unlock on iOS with a silent buffer
    try { const b = ctx.createBuffer(1, 1, 22050), s = ctx.createBufferSource(); s.buffer = b; s.connect(ctx.destination); s.start(0); } catch (e) { /* ignore */ }
    if (ctx.state === 'suspended') ctx.resume();
    A.apply();
  };
  A.apply = function () {
    if (!ctx) return; const s = DC.settings, now = ctx.currentTime, m = s.mute ? 0 : 1;
    const wasLow = low; low = !!s.lowPowerAudio; MAXV = low ? 14 : 30;
    const mst = (s.master === undefined ? 1 : s.master) * m, amb = (s.amb === undefined ? 0.7 : s.amb), pa = A.paused ? 0.3 : 1;
    master.gain.setTargetAtTime(0.9 * mst, now, 0.05);
    buses.sfx.gain.setTargetAtTime(s.sfx, now, 0.05); buses.voice.gain.setTargetAtTime(s.sfx, now, 0.05);
    buses.creature.gain.setTargetAtTime(s.sfx * 0.9 * pa, now, 0.05);
    buses.music.gain.setTargetAtTime(s.music * 0.7, now, 0.05);
    buses.amb.gain.setTargetAtTime(amb * pa, now, 0.05); buses.weather.gain.setTargetAtTime(amb * 0.9 * pa, now, 0.05);
    buses.ui.gain.setTargetAtTime(s.uivol === undefined ? 0.6 : s.uivol, now, 0.05);
  };
  A.setPaused = function (p) { if (A.paused === p) return; A.paused = p; A.apply(); };
  A.silence = function () { if (!ctx) return; const now = ctx.currentTime; for (const k in buses) buses[k].gain.cancelScheduledValues(now); };
  function onVis() { if (!ctx) return; if (document.hidden) { try { ctx.suspend(); } catch (e) { /* ignore */ } } else if (A.started) { try { ctx.resume(); } catch (e) { /* ignore */ } } }
  document.addEventListener('visibilitychange', onVis);
  window.addEventListener('pagehide', () => { if (ctx) try { ctx.suspend(); } catch (e) { /* ignore */ } });
  window.addEventListener('pageshow', () => { if (ctx && !document.hidden) try { ctx.resume(); } catch (e) { /* ignore */ } });

  // ---------- per-frame update ----------
  const scan = { surf: 'grass', biome: 0, nearGen: 0, nearHum: 0, safe: false };
  function scanWorld() {
    const S = DC.S, P = S.player, W = DC.W, N0 = W.N, tx = Math.floor(P.x / T), ty = Math.floor(P.y / T);
    const g = W.g[ty * N0 + tx]; scan.g = g; scan.surf = SURF[g] || 'grass'; scan.biome = DC.art ? DC.art.biome(tx, ty) : 0;
    const sf = W.safehouse; scan.safe = !!(sf && P.indoors && tx >= sf.x && tx < sf.x + sf.w && ty >= sf.y && ty < sf.y + sf.h);
    // power units beside emergency buildings
    let gd = 99; for (const b of W.buildings) { if (b.type === 'fire' || b.type === 'police' || b.type === 'hospital') { const d = Math.hypot(b.x + b.w / 2 - tx, b.y + b.h / 2 - ty); if (d < gd) gd = d; } } scan.nearGen = gd;
    // creature census
    let chasing = 0, near = 0, nearest = 99, nz = null;
    for (const z of DC.Z.active) { if (!z.alive) continue; const d = Math.hypot(z.x - P.x, z.y - P.y) / T; if (d < 26) near++; if (d < nearest) { nearest = d; nz = z; } if (d < 22 && (z.state === 'chase' || z.state === 'attack')) chasing++; }
    A.threat.chasing = chasing; A.threat.near = near; A.threat.nearest = nearest; scan.nz = nz;
    // wildlife timers
    scan.animals = S.animals ? S.animals.filter((a) => Math.hypot(a.x - P.x, a.y - P.y) / T < 20) : [];
  }
  let birdT = 4, owlT = 12, dripT = 3, nzT = 6, anT = 3, creakT = 15, ctickT = 8, windHowlT = 20;
  A.update = function (dt, menu) {
    if (!ctx || ctx.state === 'closed') return;
    tickT -= dt || 0.016; if (tickT > 0) return; tickT = low ? 0.25 : 0.1;
    const now = ctx.currentTime, s = DC.settings;
    if (menu || !DC.S) { // title screen: music only
      A.setPaused(false);
      const tg = { menu: 1, calm: 0, tension: 0, danger: 0, horde: 0, night: 0, safe: 0, victory: 0 };
      for (const k in L) if (L[k] && L[k].g) setG(L[k].g, 0, 0.5);
      if (L.humG) { setG(L.humG, 0, 0.5); setG(L.fridgeG, 0, 0.5); setG(L.genG, 0, 0.5); setG(L.cricG, 0, 0.5); }
      musicUpdate(0.1, tg); return;
    }
    const S = DC.S, P = S.player, w = S.weather, indoor = !!P.indoors, power = S.flags.power;
    if (!dt) { A.setPaused(true); } else A.setPaused(false);
    scanT -= 0.1; if (scanT <= 0) { scanT = 0.4; scanWorld(); }
    const night = clamp((0.45 - S.amb) / 0.35, 0, 1), surf = scan.surf, biome = scan.biome;
    const forest = biome === 2 && !indoor ? 1 : 0, urban = !indoor && (surf === 'pavement' || surf === 'concrete' || surf === 'tile') ? 1 : 0;
    // indoor / outdoor filtering and reverb balance
    outLP.frequency.setTargetAtTime(indoor ? 420 : 18000, now, 0.25); L.wxLP.frequency.setTargetAtTime(indoor ? 700 : 18000, now, 0.25);
    if (revIndoorG) { revIndoorG.gain.setTargetAtTime(indoor ? 0.5 : 0, now, 0.3); revOutG.gain.setTargetAtTime(indoor ? 0.04 : 0.22, now, 0.3); }
    // wind and rain by surface
    setG(L.wind.g, 0.02 + w.wind * 0.22); setG(L.gust.g, w.wind > 0.5 ? (w.wind - 0.5) * 0.12 : 0);
    const rain = w.rain || 0, bright = { pavement: 1800, concrete: 1800, tile: 1800, grass: 900, leaves: 700, dirt: 800, mud: 600, wood: 1300, metal: 2500, water: 1000, gravel: 1500, carpet: 900 }[surf] || 1200;
    L.rainHi.f.frequency.setTargetAtTime(bright, now, 0.5); setG(L.rainHi.g, indoor ? 0 : rain * (surf === 'grass' || surf === 'leaves' ? 0.09 : 0.14));
    setG(L.rainLo.g, indoor ? 0 : rain * 0.11); setG(L.roof.g, indoor ? rain * 0.14 : 0);
    // places
    setG(L.leaves.g, forest ? 0.015 + w.wind * 0.09 : 0, 1);
    setG(L.urban.g, urban && !night ? 0.06 : urban ? 0.045 : 0, 1.5);
    setG(L.night.g, !indoor && night > 0.3 ? 0.07 * night : 0, 2);
    setG(L.room.g, indoor ? 0.05 : 0, 0.5); setG(L.safe.g, scan.safe ? 0.05 : 0, 1);
    setG(L.humG, indoor && power ? 0.01 : 0, 0.4); setG(L.fridgeG, indoor && power && scan.safe ? 0.01 : 0, 0.5);
    setG(L.genG, power && scan.nearGen < 20 ? 0.03 * Math.pow(1 - scan.nearGen / 20, 1.5) * (indoor ? 0.4 : 1) : 0, 0.5);
    setG(L.cricG, !indoor && night > 0.35 && rain < 0.1 && w.type !== 'storm' ? 0.0045 : 0, 1);
    const crowd = clamp(A.threat.near / 14, 0, 1); setG(L.crowd.g, crowd * 0.14 * (A.threat.nearest < 18 ? 1 : 0.4), 1.2);
    L.crowd.f.frequency.setTargetAtTime(160 + crowd * 120, now, 1);
    if (!dt) { musicUpdate(0.1, musicTargets(S, P, night)); return; }
    // discrete ambient events
    if ((birdT -= dt) <= 0) { birdT = 3 + rnd() * 6; if (forest && !night && rain < 0.3 && !low) { const a = rnd() * 6.28, d = 8 + rnd() * 18; D = route('amb', P.x + Math.cos(a) * d * T, P.y + Math.sin(a) * d * T, 30, 0.2); if (D) { cur = { pri: 0 }; ANIMAL.chirp(); } D = null; } }
    if ((owlT -= dt) <= 0) { owlT = 14 + rnd() * 16; if (forest && night > 0.5 && !low) { const a = rnd() * 6.28; D = route('amb', P.x + Math.cos(a) * 18 * T, P.y + Math.sin(a) * 18 * T, 30, 0.5); if (D) { cur = { pri: 0 }; ANIMAL.owl(); } D = null; } }
    if ((dripT -= dt) <= 0) { dripT = 0.25 + rnd() * 0.5; if (rain > 0.3 && indoor && !low) { D = route('weather', undefined, undefined, 0, 0.5); if (D) { cur = { pri: 0 }; Tn({ f0: 1300 + rnd() * 800, f1: 800, dur: 0.05, g: 0.022 * rain }); } D = null; } }
    if ((nzT -= dt) <= 0) { nzT = 7 + rnd() * 12; if (DC.Z.counts.alive > 0 && !indoor && rnd() < 0.8) { const a = rnd() * 6.28, d = 24 + rnd() * 16; A.groan(P.x + Math.cos(a) * d * T, P.y + Math.sin(a) * d * T, 0.4); } }
    // creatures react to player noise
    if ((ctickT -= dt) <= 0) { ctickT = 2.5 + rnd() * 3; const z = scan.nz; if (z && (P.noiseR || 0) > 7 && A.threat.nearest < 24 && (z.state === 'chase' || z.state === 'investigate' || z.state === 'alert')) { A.groan(z.x, z.y, 0.9); } }
    if ((anT -= dt) <= 0) { anT = 2 + rnd() * 3; const an = scan.animals && scan.animals.length ? scan.animals[Math.floor(rnd() * scan.animals.length)] : null; if (an && rnd() < 0.5) { const near = Math.hypot(an.x - P.x, an.y - P.y) / T; if (an.kind === 'dog') A.animal(rnd() < (an.follow ? 0.3 : 0.7) ? 'bark' : 'whine', an.x, an.y); else if (an.kind === 'cat') A.animal('meow', an.x, an.y); else if (an.kind === 'chicken') A.animal('cluck', an.x, an.y); } }
    if ((creakT -= dt) <= 0) { creakT = 14 + rnd() * 20; if (scan.safe && !low) { D = route('amb', undefined, undefined, 0, 0.5); if (D) { cur = { pri: 0 }; Tn({ f0: 160, f1: 230, dur: 0.5, type: 'sawtooth', g: 0.015, lp: 400, att: 0.1 }); } D = null; } }
    if ((windHowlT -= dt) <= 0) { windHowlT = 20 + rnd() * 20; if (w.wind > 0.6 && !low) { D = route('weather', undefined, undefined, 0, 0.4); if (D) { cur = { pri: 0 }; Tn({ f0: 300, f1: 440, dur: 2.2, g: 0.012, att: 0.8, lp: 800 }); } D = null; } }
    if (victoryT > 0) victoryT -= dt;
    musicUpdate(0.1, musicTargets(S, P, night));
  };
  function musicTargets(S, P, night) {
    const T0 = A.threat, ten = clamp(P.stress / 100 * 1.2 + (T0.nearest < 20 ? 0.25 : 0), 0, 1);
    const danger = clamp((P.chased ? 0.7 : 0) + (T0.chasing > 0 ? 0.4 : 0) + (P.hp < 30 ? 0.25 : 0), 0, 1), horde = clamp((T0.chasing - 3) / 5, 0, 1);
    const safe = scan.safe && danger < 0.2 ? 1 : 0, vic = victoryT > 0 || S.won ? 1 : 0;
    const high = Math.max(danger, horde);
    return {
      menu: 0, victory: vic, horde, danger: danger * (1 - vic), tension: clamp(ten - high * 0.4, 0, 1) * (1 - vic) * (1 - safe * 0.7),
      night: night * 0.8 * (1 - high) * (1 - safe) * (1 - vic), safe: safe * (1 - vic),
      calm: clamp(1 - ten * 0.7 - high - night * 0.4, 0, 1) * (1 - vic) * (1 - safe * 0.6),
    };
  }
  A.status = () => ({ voices: active, dropped: A.stats.dropped, ctx: ctx && ctx.state, low });
})();

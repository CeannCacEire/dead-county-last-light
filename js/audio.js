/* Dead County: Last Light - procedural WebAudio (no sample files). Starts only after user gesture. */
(function () {
  'use strict';
  const DC = window.DC, T = 16;
  const A = (DC.audio = { ctx: null, started: false });
  let master, sfxG, musG, ambG, nWhite, nPink, nBrown, wind, rain, hum, crick, active = 0;
  let musT = 3, grT = 6, lastStep = 0, windF, rainF, humG, cricG, lowpassAmb;

  function mkNoise(type) {
    const ctx = A.ctx, len = ctx.sampleRate * 2, b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
    let l = 0, b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (type === 'white') d[i] = w;
      else if (type === 'brown') { l = (l + 0.02 * w) / 1.02; d[i] = l * 3.5; }
      else { b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2; }
    }
    return b;
  }
  A.start = function () {
    if (A.started) { if (A.ctx && A.ctx.state === 'suspended') A.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    try { A.ctx = new AC(); } catch (e) { return; }
    const ctx = A.ctx; A.started = true;
    master = ctx.createGain(); master.connect(ctx.destination);
    const comp = ctx.createDynamicsCompressor(); comp.connect(master);
    sfxG = ctx.createGain(); musG = ctx.createGain(); ambG = ctx.createGain();
    sfxG.connect(comp); musG.connect(comp); ambG.connect(comp);
    nWhite = mkNoise('white'); nPink = mkNoise('pink'); nBrown = mkNoise('brown');
    // ambient loops
    const loop = (buf) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.start(); return s; };
    lowpassAmb = ctx.createBiquadFilter(); lowpassAmb.type = 'lowpass'; lowpassAmb.frequency.value = 18000; lowpassAmb.connect(ambG);
    wind = loop(nPink); windF = ctx.createBiquadFilter(); windF.type = 'bandpass'; windF.frequency.value = 500; windF.Q.value = 0.6; const wg = ctx.createGain(); wg.gain.value = 0; A.windG = wg; wind.connect(windF); windF.connect(wg); wg.connect(lowpassAmb);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.13; const lg = ctx.createGain(); lg.gain.value = 250; lfo.connect(lg); lg.connect(windF.frequency); lfo.start();
    rain = loop(nWhite); rainF = ctx.createBiquadFilter(); rainF.type = 'highpass'; rainF.frequency.value = 1200; const rg = ctx.createGain(); rg.gain.value = 0; A.rainG = rg; rain.connect(rainF); rainF.connect(rg); rg.connect(lowpassAmb);
    hum = ctx.createOscillator(); hum.type = 'sawtooth'; hum.frequency.value = 50; const hf = ctx.createBiquadFilter(); hf.type = 'lowpass'; hf.frequency.value = 160; humG = ctx.createGain(); humG.gain.value = 0; hum.connect(hf); hf.connect(humG); humG.connect(ambG); hum.start();
    crick = ctx.createOscillator(); crick.type = 'sine'; crick.frequency.value = 4300; cricG = ctx.createGain(); cricG.gain.value = 0; const cm = ctx.createGain(); cm.gain.value = 0; const cl = ctx.createOscillator(); cl.type = 'square'; cl.frequency.value = 11; const clg = ctx.createGain(); clg.gain.value = 0.5; cl.connect(clg); clg.connect(cm.gain); crick.connect(cm); cm.connect(cricG); cricG.connect(ambG); crick.start(); cl.start();
    A.apply();
  };
  A.apply = function () {
    if (!A.ctx) return; const s = DC.settings, now = A.ctx.currentTime;
    master.gain.setTargetAtTime(s.mute ? 0 : 0.9, now, 0.05); sfxG.gain.setTargetAtTime(s.sfx, now, 0.05); musG.gain.setTargetAtTime(s.music * 0.7, now, 0.05); ambG.gain.setTargetAtTime(Math.min(1, s.sfx * 0.9), now, 0.05);
  };
  function vol(x, y, maxT) {
    if (x === undefined || !DC.S) return 1;
    const P = DC.S.player, d = Math.hypot(x - P.x, y - P.y) / T; maxT = maxT || 40;
    return d >= maxT ? 0 : Math.pow(1 - d / maxT, 1.6) * (P.indoors ? 0.7 : 1);
  }
  function noiseBurst(o) {
    const ctx = A.ctx; if (!ctx || active > 36) return; const t = ctx.currentTime + (o.when || 0);
    const s = ctx.createBufferSource(); s.buffer = o.buf || nWhite; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = o.ft || 'bandpass'; f.frequency.setValueAtTime(o.f0 || 1000, t); if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, t + o.dur); f.Q.value = o.q || 1;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.g || 0.2), t + (o.att || 0.005)); g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    s.connect(f); f.connect(g); g.connect(o.dest || sfxG); s.start(t, Math.random()); s.stop(t + o.dur + 0.05);
    active++; s.onended = () => active--;
  }
  function tone(o) {
    const ctx = A.ctx; if (!ctx || active > 36) return; const t = ctx.currentTime + (o.when || 0);
    const os = ctx.createOscillator(); os.type = o.type || 'sine'; os.frequency.setValueAtTime(o.f0, t); if (o.f1) os.frequency.exponentialRampToValueAtTime(o.f1, t + o.dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.g || 0.15), t + (o.att || 0.01)); g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    let n = os; if (o.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; os.connect(f); n = f; }
    n.connect(g); g.connect(o.dest || sfxG); os.start(t); os.stop(t + o.dur + 0.05); active++; os.onended = () => active--;
  }
  A.step = function (snd, stance, win) {
    if (!A.ctx) return; const v = { sprint: 1, walk: 0.55, crouch: 0.28, sneak: 0.12 }[stance] || 0.5;
    const r = 0.85 + Math.random() * 0.3;
    switch (snd) {
      case 'soft': noiseBurst({ buf: nBrown, ft: 'lowpass', f0: 700 * r, dur: 0.1, g: 0.22 * v, att: 0.01 }); break;
      case 'hard': noiseBurst({ ft: 'bandpass', f0: 1900 * r, q: 2, dur: 0.06, g: 0.16 * v }); tone({ f0: 140 * r, f1: 70, dur: 0.07, g: 0.1 * v }); break;
      case 'wood': noiseBurst({ ft: 'bandpass', f0: 420 * r, q: 3, dur: 0.09, g: 0.2 * v }); if (Math.random() < 0.08 * v) tone({ f0: 180, f1: 260, dur: 0.25, type: 'sawtooth', g: 0.03, lp: 500 }); break;
      case 'gravel': for (let k = 0; k < 3; k++) noiseBurst({ ft: 'bandpass', f0: 3000 * r, q: 1.5, dur: 0.05, g: 0.1 * v, when: k * 0.025 }); break;
      case 'leaves': noiseBurst({ ft: 'bandpass', f0: 2300 * r, q: 0.8, dur: 0.14, g: 0.12 * v, att: 0.03 }); break;
      case 'water': noiseBurst({ buf: nPink, ft: 'lowpass', f0: 900, dur: 0.22, g: 0.2 * v, att: 0.03 }); tone({ f0: 300, f1: 700, dur: 0.1, g: 0.05 * v }); break;
    }
    if (win) A.sfx('climb');
  };
  A.groan = function (x, y, v) {
    if (!A.ctx) return; const vv = vol(x, y, 34) * (v || 1) * 0.5; if (vv < 0.01) return;
    const f = 80 + Math.random() * 50, d = 0.9 + Math.random() * 0.7;
    tone({ f0: f * 1.3, f1: f * 0.7, dur: d, type: 'sawtooth', g: 0.12 * vv, lp: 420, att: 0.15 });
    noiseBurst({ buf: nBrown, ft: 'bandpass', f0: 300, q: 4, dur: d * 0.8, g: 0.2 * vv, att: 0.2 });
  };
  A.sfx = function (n, x, y) {
    if (!A.ctx) return; const v = vol(x, y, 38); if (v < 0.02) return;
    switch (n) {
      case 'dooropen': tone({ f0: 90, f1: 210, dur: 0.45, type: 'sawtooth', g: 0.05 * v, lp: 600, att: 0.08 }); noiseBurst({ buf: nPink, ft: 'bandpass', f0: 600, q: 2, dur: 0.3, g: 0.07 * v }); break;
      case 'doorclose': noiseBurst({ buf: nBrown, ft: 'lowpass', f0: 300, dur: 0.18, g: 0.5 * v }); tone({ f0: 100, f1: 50, dur: 0.15, g: 0.3 * v }); noiseBurst({ ft: 'bandpass', f0: 2500, q: 5, dur: 0.03, g: 0.1 * v, when: 0.12 }); break;
      case 'doorbreak': noiseBurst({ buf: nBrown, ft: 'lowpass', f0: 500, dur: 0.5, g: 0.8 * v }); noiseBurst({ ft: 'bandpass', f0: 900, q: 1, dur: 0.35, g: 0.4 * v }); break;
      case 'glass': noiseBurst({ ft: 'highpass', f0: 3500, dur: 0.5, g: 0.5 * v }); for (let k = 0; k < 6; k++) tone({ f0: 2500 + Math.random() * 3000, dur: 0.12, g: 0.06 * v, when: Math.random() * 0.3 }); break;
      case 'thud': noiseBurst({ buf: nBrown, ft: 'lowpass', f0: 350, dur: 0.16, g: 0.55 * v }); tone({ f0: 110, f1: 45, dur: 0.15, g: 0.3 * v }); break;
      case 'plank': noiseBurst({ ft: 'bandpass', f0: 800, q: 4, dur: 0.1, g: 0.4 * v }); tone({ f0: 220, f1: 140, dur: 0.1, type: 'triangle', g: 0.2 * v }); break;
      case 'hit': noiseBurst({ buf: nBrown, ft: 'lowpass', f0: 450, dur: 0.12, g: 0.6 * v }); tone({ f0: 160, f1: 60, dur: 0.1, g: 0.3 * v }); break;
      case 'swing': noiseBurst({ buf: nPink, ft: 'bandpass', f0: 800, f1: 2000, q: 1, dur: 0.14, g: 0.12 * v, att: 0.06 }); break;
      case 'whiff': break;
      case 'hurt': tone({ f0: 220, f1: 110, dur: 0.25, type: 'triangle', g: 0.25 }); noiseBurst({ buf: nBrown, ft: 'lowpass', f0: 400, dur: 0.2, g: 0.4 }); break;
      case 'zdie': tone({ f0: 130, f1: 40, dur: 0.6, type: 'sawtooth', g: 0.12 * v, lp: 300 }); break;
      case 'pickup': tone({ f0: 660, dur: 0.07, g: 0.1, type: 'triangle' }); tone({ f0: 990, dur: 0.09, g: 0.08, type: 'triangle', when: 0.06 }); break;
      case 'click': tone({ f0: 1200, f1: 800, dur: 0.04, g: 0.08, type: 'square', lp: 2500 }); break;
      case 'open': noiseBurst({ ft: 'bandpass', f0: 500, f1: 900, q: 2, dur: 0.22, g: 0.14 }); tone({ f0: 180, f1: 220, dur: 0.2, type: 'sawtooth', g: 0.03, lp: 500 }); break;
      case 'cloth': noiseBurst({ buf: nPink, ft: 'bandpass', f0: 1500, q: 0.7, dur: 0.18, g: 0.12, att: 0.04 }); break;
      case 'equip': tone({ f0: 300, f1: 450, dur: 0.06, type: 'square', g: 0.05, lp: 1500 }); noiseBurst({ ft: 'bandpass', f0: 2000, q: 3, dur: 0.04, g: 0.08 }); break;
      case 'eat': for (let k = 0; k < 3; k++) noiseBurst({ buf: nBrown, ft: 'lowpass', f0: 900, dur: 0.07, g: 0.25, when: k * 0.16 }); break;
      case 'drink': for (let k = 0; k < 3; k++) tone({ f0: 250 + k * 40, f1: 400, dur: 0.12, g: 0.1, when: k * 0.16 }); break;
      case 'bandage': noiseBurst({ buf: nPink, ft: 'bandpass', f0: 2500, q: 0.8, dur: 0.35, g: 0.15, att: 0.1 }); break;
      case 'page': noiseBurst({ ft: 'highpass', f0: 3000, dur: 0.15, g: 0.1, att: 0.05 }); break;
      case 'craft': for (let k = 0; k < 3; k++) { tone({ f0: 500, f1: 300, dur: 0.06, type: 'triangle', g: 0.14, when: k * 0.12 }); noiseBurst({ ft: 'bandpass', f0: 1500, q: 4, dur: 0.04, g: 0.2, when: k * 0.12 }); } break;
      case 'hammer': tone({ f0: 900, f1: 500, dur: 0.07, type: 'square', g: 0.07, lp: 2500 }); noiseBurst({ buf: nBrown, ft: 'lowpass', f0: 600, dur: 0.1, g: 0.35 }); break;
      case 'build': tone({ f0: 330, dur: 0.1, type: 'triangle', g: 0.1 }); tone({ f0: 495, dur: 0.14, type: 'triangle', g: 0.1, when: 0.09 }); tone({ f0: 660, dur: 0.2, type: 'triangle', g: 0.1, when: 0.2 }); break;
      case 'chop': noiseBurst({ buf: nBrown, ft: 'lowpass', f0: 700, dur: 0.14, g: 0.55 }); tone({ f0: 300, f1: 120, dur: 0.1, type: 'triangle', g: 0.2 }); break;
      case 'rustle': noiseBurst({ buf: nPink, ft: 'bandpass', f0: 2000, q: 0.5, dur: 0.25, g: 0.1, att: 0.08 }); break;
      case 'lock': tone({ f0: 1800, dur: 0.03, type: 'square', g: 0.07, lp: 3000 }); tone({ f0: 1200, dur: 0.05, type: 'square', g: 0.07, lp: 3000, when: 0.08 }); break;
      case 'pick': for (let k = 0; k < 2; k++) tone({ f0: 2400 + k * 300, dur: 0.02, type: 'square', g: 0.05, lp: 4000, when: k * 0.15 }); break;
      case 'climb': noiseBurst({ buf: nPink, ft: 'bandpass', f0: 1000, q: 1, dur: 0.3, g: 0.12 * v, att: 0.1 }); break;
      case 'water': noiseBurst({ buf: nPink, ft: 'bandpass', f0: 1800, f1: 900, q: 0.6, dur: 0.5, g: 0.1, att: 0.1 }); break;
      case 'fire': noiseBurst({ ft: 'bandpass', f0: 900, q: 1, dur: 0.5, g: 0.1, att: 0.15 }); break;
      case 'tape': noiseBurst({ ft: 'bandpass', f0: 3500, q: 2, dur: 0.5, g: 0.08, att: 0.05 }); break;
      case 'break': noiseBurst({ ft: 'bandpass', f0: 1200, q: 1, dur: 0.2, g: 0.5 }); tone({ f0: 200, f1: 70, dur: 0.2, type: 'sawtooth', g: 0.15, lp: 500 }); break;
      case 'empty': tone({ f0: 700, f1: 400, dur: 0.04, type: 'square', g: 0.1, lp: 1500 }); break;
      case 'shot': noiseBurst({ ft: 'lowpass', f0: 4000, f1: 300, dur: 0.35, g: 0.9, att: 0.002 }); tone({ f0: 160, f1: 40, dur: 0.25, g: 0.5 }); break;
      case 'levelup': [0, 4, 7, 12].forEach((s, k) => tone({ f0: 330 * Math.pow(2, s / 12), dur: 0.35, type: 'triangle', g: 0.09, when: k * 0.1 })); break;
      case 'win': [0, 4, 7, 12, 16, 19].forEach((s, k) => tone({ f0: 262 * Math.pow(2, s / 12), dur: 1.2, type: 'triangle', g: 0.12, when: k * 0.2 })); break;
      case 'death': tone({ f0: 140, f1: 35, dur: 2.5, type: 'sawtooth', g: 0.3, lp: 400 }); noiseBurst({ buf: nBrown, ft: 'lowpass', f0: 300, dur: 2, g: 0.5 }); break;
      case 'wake': tone({ f0: 400, f1: 600, dur: 0.3, type: 'triangle', g: 0.1 }); break;
      case 'alarmstart': A.sfx('alarm', x, y); break;
      case 'alarm': for (let k = 0; k < 4; k++) tone({ f0: k % 2 ? 1250 : 900, dur: 0.22, type: 'square', g: 0.14 * v, lp: 3000, when: k * 0.22 }); break;
      case 'siren': tone({ f0: 500, f1: 900, dur: 2, type: 'sawtooth', g: 0.05, lp: 1500, att: 0.5 }); tone({ f0: 900, f1: 500, dur: 2, type: 'sawtooth', g: 0.05, lp: 1500, att: 0.5, when: 2 }); break;
      case 'distantshot': for (let k = 0; k < 3; k++) noiseBurst({ ft: 'lowpass', f0: 600, f1: 150, dur: 0.6, g: 0.18, when: k * 0.4 + Math.random() * 0.2 }); break;
      case 'heli': noiseBurst({ buf: nBrown, ft: 'lowpass', f0: 250, dur: 4, g: 0.35, att: 1.5 }); break;
      case 'thunder': noiseBurst({ buf: nBrown, ft: 'lowpass', f0: 400, f1: 80, dur: 3.5, g: 0.9, att: 0.15 }); noiseBurst({ buf: nBrown, ft: 'lowpass', f0: 250, f1: 60, dur: 2.5, g: 0.5, att: 0.3, when: 0.6 }); break;
      case 'powerdown': tone({ f0: 120, f1: 30, dur: 1.4, type: 'sawtooth', g: 0.15, lp: 300 }); noiseBurst({ ft: 'bandpass', f0: 4000, q: 2, dur: 0.3, g: 0.12 }); break;
      case 'clock': for (let k = 0; k < 6; k++) tone({ f0: 2200, dur: 0.05, type: 'square', g: 0.08 * v, lp: 3500, when: k * 0.1 }); break;
      case 'radio': noiseBurst({ ft: 'bandpass', f0: 1800, q: 2, dur: 0.8, g: 0.12 }); tone({ f0: 800, dur: 0.1, g: 0.06, type: 'square', lp: 1500, when: 0.6 }); break;
      case 'can': for (let k = 0; k < 5; k++) tone({ f0: 1800 + Math.random() * 1400, dur: 0.07, type: 'square', g: 0.07 * v, lp: 4500, when: k * 0.06 + Math.random() * 0.04 }); break;
      case 'beacon': tone({ f0: 220, f1: 880, dur: 1.5, type: 'sawtooth', g: 0.12, lp: 1200 }); break;
      case 'gate': noiseBurst({ buf: nBrown, ft: 'lowpass', f0: 250, dur: 1.5, g: 0.5 }); break;
      case 'purr': noiseBurst({ buf: nBrown, ft: 'lowpass', f0: 140, dur: 1.2, g: 0.2, att: 0.3 }); break;
      case 'pet': tone({ f0: 500, f1: 600, dur: 0.12, type: 'triangle', g: 0.06 }); break;
      case 'ui': tone({ f0: 900, dur: 0.03, type: 'square', g: 0.04, lp: 2000 }); break;
    }
  };
  A.update = function (dt) {
    if (!A.ctx || !DC.S) return;
    const S = DC.S, P = S.player, w = S.weather, now = A.ctx.currentTime;
    const indoor = P.indoors;
    lowpassAmb.frequency.setTargetAtTime(indoor ? 450 : 18000, now, 0.25);
    A.windG.gain.setTargetAtTime(0.02 + w.wind * 0.22, now, 0.5);
    A.rainG.gain.setTargetAtTime(w.rain * 0.16, now, 0.5);
    humG.gain.setTargetAtTime(indoor && S.flags.power ? 0.012 : 0, now, 0.3);
    cricG.gain.setTargetAtTime(!indoor && S.amb < 0.35 && w.rain < 0.1 ? 0.0045 : 0, now, 1);
    grT -= dt;
    if (grT <= 0) { grT = 7 + Math.random() * 12; if (DC.Z.counts.alive > 0) { const a = Math.random() * 6.28, d = 22 + Math.random() * 20; A.groan(P.x + Math.cos(a) * d * T, P.y + Math.sin(a) * d * T, 0.5); } }
    // music
    musT -= dt;
    if (musT <= 0) {
      const tense = Math.min(1, P.stress / 100 + (P.chased ? 0.5 : 0));
      musT = 9 - tense * 4 + Math.random() * 4;
      const root = [55, 49, 41.2, 46.2][(Math.floor(S.t / 120)) % 4];
      const pad = (f, g) => tone({ f0: f, dur: 9, type: 'triangle', g, att: 3, lp: 500, dest: musG });
      pad(root, 0.12); pad(root * 1.5, 0.06); if (tense > 0.3) pad(root * 1.5874, 0.05);
      const sc = [0, 3, 5, 7, 10, 12, 15];
      if (Math.random() < 0.6) tone({ f0: root * 4 * Math.pow(2, sc[Math.floor(Math.random() * sc.length)] / 12), dur: 3, type: 'sine', g: 0.05, att: 0.02, dest: musG, when: 1 + Math.random() * 3 });
      if (tense > 0.5) for (let k = 0; k < 4; k++) tone({ f0: root, f1: root * 0.9, dur: 0.4, type: 'sine', g: 0.14, dest: musG, when: k * 0.5 });
    }
  };
})();

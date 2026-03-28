// ==============================================
// js/sounds.js – Sound Engine (Web Audio API)
// ==============================================

export const Sounds = {
  ctx: null,
  init() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
  },
  play(type) {
    if (!this.ctx) this.init();
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.connect(ctx.destination);

    const playTone = (freq, dur, start = 0, gainVal = 0.3) => {
      const o = ctx.createOscillator();
      o.connect(g);
      o.frequency.value = freq;
      g.gain.setValueAtTime(gainVal, ctx.currentTime + start);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
      o.start(ctx.currentTime + start);
      o.stop(ctx.currentTime + start + dur);
    };

    switch (type) {
      case 'start':
        playTone(440, 0.15, 0);
        playTone(660, 0.15, 0.18);
        playTone(880, 0.25, 0.36);
        break;
      case 'tick':
        playTone(800, 0.05, 0, 0.1);
        break;
      case 'warning':
        playTone(600, 0.1, 0);
        playTone(600, 0.1, 0.2);
        break;
      case 'end':
        playTone(880, 0.1, 0);
        playTone(660, 0.1, 0.12);
        playTone(440, 0.1, 0.24);
        playTone(330, 0.4, 0.36);
        break;
      case 'correct':
        playTone(523, 0.12, 0);
        playTone(659, 0.12, 0.14);
        playTone(784, 0.3, 0.28);
        break;
      case 'wrong':
        playTone(220, 0.4, 0, 0.2);
        break;
      case 'winner':
        [0,0.15,0.3,0.45,0.6].forEach((t,i) => {
          playTone([523,659,784,1047,1319][i], 0.3, t, 0.3);
        });
        break;
    }
  }
};

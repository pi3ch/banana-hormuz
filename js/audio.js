/* ===== Banana Hormuz — tiny WebAudio blips (no asset files) ===== */
(function () {
  const G = window.GAME;
  let ctx = null;
  function ac() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) ctx = new AC();
    }
    if (ctx && ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function tone(freq, dur, type, gain, slideTo) {
    const c = ac();
    if (!c) return;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type || "square";
    o.frequency.setValueAtTime(freq, c.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + dur);
    g.gain.setValueAtTime(gain || 0.08, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    o.connect(g); g.connect(c.destination);
    o.start(); o.stop(c.currentTime + dur);
  }

  function noise(dur, gain) {
    const c = ac();
    if (!c) return;
    const n = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, n, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = c.createBufferSource();
    const g = c.createGain();
    g.gain.value = gain || 0.18;
    src.buffer = buf; src.connect(g); g.connect(c.destination);
    src.start();
  }

  G.Audio = {
    fire() { tone(520, 0.18, "square", 0.07, 180); },
    explode() { noise(0.4, 0.22); tone(90, 0.35, "sawtooth", 0.12, 40); },
    splash() { noise(0.25, 0.1); tone(300, 0.2, "sine", 0.05, 120); },
    win() { tone(523, 0.12, "square", 0.08); setTimeout(() => tone(659, 0.12, "square", 0.08), 110); setTimeout(() => tone(784, 0.2, "square", 0.08), 220); },
    click() { tone(660, 0.05, "square", 0.05); },
    // Cheerful victory fanfare.
    winSong() {
      const seq = [
        [523, 0.13], [659, 0.13], [784, 0.13], [1047, 0.22],
        [880, 0.13], [1047, 0.13], [1318, 0.34], [1047, 0.13], [1318, 0.4],
      ];
      let t = 0;
      for (const [f, d] of seq) {
        const at = t;
        setTimeout(() => { tone(f, d * 1.1, "square", 0.09); tone(f / 2, d, "triangle", 0.04); }, at * 1000);
        t += d;
      }
      // little percussive claps under the melody
      [0, 0.26, 0.52, 0.9, 1.3].forEach((d) => setTimeout(() => noise(0.05, 0.08), d * 1000));
    },
    laugh() { // quick "ha" blip used during the jump celebration
      tone(330, 0.06, "square", 0.06, 420);
    },
  };
})();

/* ===== Banana Hormuz — AI opponent ===== */
/* Plays the right cliff. Each turn it searches angle/power space by simulating the
   shot under the current wind (so it adapts to terrain + wind), then applies a
   difficulty-scaled error. It homes in over successive misses within a round. */
(function () {
  const G = window.GAME;

  // Simulate a candidate shot; return the closest approach distance to the target.
  function closestApproach(footX, footY, angle, power, facing, wind, tx, ty) {
    const p = G.Physics.launch(footX, footY, angle, power, facing);
    let best = Infinity;
    const W = G.CFG.W, H = G.CFG.H;
    for (let i = 0; i < 600; i++) {
      G.Physics.step(p, wind);
      const dx = p.x - tx, dy = p.y - ty;
      const d = dx * dx + dy * dy;
      if (d < best) best = d;
      if (p.x < -60 || p.x > W + 60 || p.y > H + 60) break;
    }
    return Math.sqrt(best);
  }

  G.AI = {
    state: { misses: 0 },

    resetRound() { this.state.misses = 0; },

    // Returns { angle, power } for the AI's shot.
    plan(footX, footY, facing, wind, target) {
      const tx = target.x + target.w / 2;
      const ty = target.y + target.h / 2;

      let best = { angle: 50, power: 55, d: Infinity };
      const consider = (angle, power) => {
        const d = closestApproach(footX, footY, angle, power, facing, wind, tx, ty);
        if (d < best.d) best = { angle, power, d };
      };

      // coarse sweep
      for (let a = 30; a <= 78; a += 4) {
        for (let p = 20; p <= 100; p += 5) consider(a, p);
      }
      // refine around the best candidate
      const ca = best.angle, cp = best.power;
      for (let a = ca - 4; a <= ca + 4; a += 1) {
        for (let p = cp - 6; p <= cp + 6; p += 1) {
          consider(Math.max(5, Math.min(85, a)), Math.max(8, Math.min(100, p)));
        }
      }

      // Difficulty-scaled error, shrinking as the AI misses more this round.
      const diff = G.CFG.DIFFICULTY[this.state.level] || G.CFG.DIFFICULTY.normal;
      const homing = Math.pow(1 - diff.learn, this.state.misses); // 1, then smaller
      const errMag = diff.error * homing;
      const jit = (Math.random() * 2 - 1) * diff.jitter * 30 * homing;

      const angle = Math.max(8, Math.min(85, best.angle + jit * 0.4));
      const power = Math.max(10, Math.min(100, best.power + (Math.random() * 2 - 1) * errMag));
      return { angle: Math.round(angle), power: Math.round(power) };
    },

    noteMiss() { this.state.misses += 1; },
  };
})();

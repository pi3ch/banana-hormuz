/* ===== Banana Hormuz — projectile physics ===== */
(function () {
  const G = window.GAME;

  G.Physics = {
    // Build a projectile launched from a character.
    // angleDeg 0..90 from horizontal; power 0..100; facing +1 right / -1 left.
    launch(footX, footY, angleDeg, power, facing) {
      const C = G.CFG;
      const a = (angleDeg * Math.PI) / 180;
      const speed = power * C.POWER_SCALE;
      const dir = facing < 0 ? -1 : 1;
      // start near the character's upper body / throwing hand
      const startX = footX + dir * (G.CHAR_W * 0.45 * C.PIXEL);
      const startY = footY - G.CHAR_H * C.PIXEL * 0.78;
      return {
        x: startX,
        y: startY,
        vx: dir * speed * Math.cos(a),
        vy: -speed * Math.sin(a),
        t: 0,
        alive: true,
      };
    },

    // Advance one frame under gravity + wind (wind = horizontal accel).
    step(p, wind) {
      p.vy += G.CFG.GRAVITY;
      p.vx += wind;
      p.x += p.vx;
      p.y += p.vy;
      p.t += 1;
    },

    // Circle-vs-rect overlap test (projectile radius vs character box).
    hitsBox(p, box, r) {
      const cx = Math.max(box.x, Math.min(p.x, box.x + box.w));
      const cy = Math.max(box.y, Math.min(p.y, box.y + box.h));
      const dx = p.x - cx, dy = p.y - cy;
      return dx * dx + dy * dy <= r * r;
    },
  };
})();

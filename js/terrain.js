/* ===== Banana Hormuz — terrain (Strait of Hormuz cliffs) ===== */
/* Gorillas' building skyline, re-skinned: a jagged row of cliff plateaus on two
   shores with the strait's water channel down the middle. The per-column surface
   array doubles as the collision heightmap. */
(function () {
  const G = window.GAME;

  function randRange(a, b) { return a + Math.random() * (b - a); }
  function randInt(a, b) { return Math.floor(randRange(a, b + 1)); }

  G.Terrain = {
    surfaceY: null,   // surfaceY[x] = top of land at column x
    isWater: null,    // isWater[x] = true if column x is open water
    craters: [],      // [{x,y,r}] charred holes blasted into the terrain
    waterY: 0,
    left: null,       // { centerX, topY } player-1 platform
    right: null,      // { centerX, topY } player-2 platform

    generate() {
      const W = G.CFG.W, H = G.CFG.H;
      const waterY = Math.round(H * 0.74);
      this.waterY = waterY;
      const surfaceY = new Float32Array(W);
      const isWater = new Uint8Array(W);
      // default everything to water, then stamp land blocks on top
      for (let x = 0; x < W; x++) { surfaceY[x] = waterY; isWater[x] = 1; }

      const blocks = [];
      const stamp = (x0, x1, topY) => {
        x0 = Math.max(0, Math.round(x0));
        x1 = Math.min(W, Math.round(x1));
        for (let x = x0; x < x1; x++) {
          if (topY < surfaceY[x]) surfaceY[x] = topY; // taller wins
          isWater[x] = 0;
        }
        blocks.push({ x0, x1, topY });
      };

      const minTop = H * 0.26, maxTop = H * 0.60;

      // --- Left shore: outer platform + stepping cliffs down toward the channel ---
      const lPlatW = randInt(78, 104);
      const lPlatTop = randRange(minTop, maxTop);
      stamp(0, lPlatW, lPlatTop);
      this.left = { centerX: lPlatW / 2, topY: lPlatTop };

      let lx = lPlatW;
      const leftShoreEnd = W * randRange(0.36, 0.42);
      while (lx < leftShoreEnd - 30) {
        const bw = randInt(40, 80);
        const top = randRange(minTop, waterY - 24);
        stamp(lx, lx + bw, top);
        lx += bw;
      }

      // --- Right shore mirror: stepping cliffs + outer platform ---
      const rPlatW = randInt(78, 104);
      const rPlatTop = randRange(minTop, maxTop);
      stamp(W - rPlatW, W, rPlatTop);
      this.right = { centerX: W - rPlatW / 2, topY: rPlatTop };

      let rx = W - rPlatW;
      const rightShoreStart = W * randRange(0.58, 0.64);
      while (rx > rightShoreStart + 30) {
        const bw = randInt(40, 80);
        const top = randRange(minTop, waterY - 24);
        stamp(rx - bw, rx, top);
        rx -= bw;
      }
      // the gap between leftShoreEnd and rightShoreStart stays open water (the strait)

      this.surfaceY = surfaceY;
      this.isWater = isWater;
      this.blocks = blocks;
      this.craters = [];
    },

    surfaceAt(x) {
      x = Math.max(0, Math.min(G.CFG.W - 1, x | 0));
      return this.surfaceY[x];
    },
    isWaterAt(x) {
      if (x < 0 || x >= G.CFG.W) return false;
      return this.isWater[x | 0] === 1;
    },

    // Blast a charred hole into the terrain at the impact point. The center is
    // sunk slightly into the rock so it reads as a round black hole, not a bowl.
    damage(cx, cy, radius) {
      this.craters.push({ x: Math.round(cx), y: Math.round(cy + radius * 0.45), r: radius });
    },

    // Draw the charred holes on top of the cliffs (masked to land only).
    drawCraters(ctx) {
      const W = G.CFG.W;
      for (const cr of this.craters) {
        const r = cr.r;
        for (let x = Math.max(0, cr.x - r) | 0; x <= Math.min(W - 1, cr.x + r); x++) {
          if (this.isWater[x]) continue;
          const dx = x - cr.x;
          const half = Math.sqrt(r * r - dx * dx);
          if (!(half >= 0)) continue;
          const top = Math.max(cr.y - half, this.surfaceY[x]);
          const bottom = cr.y + half;
          if (bottom <= top) continue;
          ctx.fillStyle = "#130d0a";                 // charred near-black hole
          ctx.fillRect(x, top, 1, bottom - top);
          ctx.fillStyle = "rgba(58,32,18,0.9)";      // burnt rim at the edges
          ctx.fillRect(x, top, 1, 2);
          ctx.fillRect(x, bottom - 2, 1, 2);
        }
      }
    },

    draw(ctx, t) {
      const C = G.CFG, W = C.W, H = C.H;

      // --- Sky (desert sunset gradient) ---
      const sky = ctx.createLinearGradient(0, 0, 0, this.waterY);
      sky.addColorStop(0, C.SKY_TOP);
      sky.addColorStop(0.55, C.SKY_MID);
      sky.addColorStop(1, C.SKY_LOW);
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, this.waterY);

      // --- Sun behind the ridgeline ---
      ctx.fillStyle = C.SUN;
      const sx = W * 0.5, sy = H * 0.30, sr = 38;
      ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(255,240,192,0.18)";
      ctx.beginPath(); ctx.arc(sx, sy, sr + 12, 0, Math.PI * 2); ctx.fill();

      // --- Water (gulf) ---
      const water = ctx.createLinearGradient(0, this.waterY, 0, H);
      water.addColorStop(0, C.WATER_TOP);
      water.addColorStop(1, C.WATER_LOW);
      ctx.fillStyle = water;
      ctx.fillRect(0, this.waterY, W, H - this.waterY);
      // shimmer lines
      ctx.fillStyle = C.WATER_SHIMMER;
      ctx.globalAlpha = 0.25;
      for (let i = 0; i < 7; i++) {
        const yy = this.waterY + 8 + i * 14;
        const off = Math.sin(t * 0.04 + i) * 18;
        ctx.fillRect(((i * 90 + off) % W + W) % W, yy, 26, 2);
        ctx.fillRect(((i * 90 + 200 + off) % W + W) % W, yy, 18, 2);
      }
      ctx.globalAlpha = 1;

      // --- Cliffs (column-by-column from the heightmap) ---
      const mid = W / 2;
      for (let x = 0; x < W; x++) {
        if (this.isWater[x]) continue;
        const top = this.surfaceY[x];
        const pal = x < mid ? C.CLIFF_L : C.CLIFF_R;
        // banded rock body
        ctx.fillStyle = pal[0];
        ctx.fillRect(x, top, 1, H - top);
        // subtle vertical banding for texture
        const band = Math.floor((x / 9)) % 2;
        if (band) { ctx.fillStyle = pal[2]; ctx.fillRect(x, top + 6, 1, H - top); }
        // lit rim along the top edge (sandy)
        ctx.fillStyle = pal[1];
        ctx.fillRect(x, top, 1, 3);
      }
      // waterline shading where land meets the strait
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.fillRect(0, this.waterY, W, 2);

      // charred destruction holes on top of the cliffs
      this.drawCraters(ctx);
    },
  };
})();

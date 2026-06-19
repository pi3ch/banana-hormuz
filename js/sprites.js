/* ===== Banana Hormuz — procedural pixel-art sprites ===== */
/* Characters are built from grid-rect specs (no image assets). Each character is
   drawn in a 14x20 grid; one grid cell = `unit` screen pixels. */
(function () {
  const G = window.GAME;

  G.CHAR_W = 14;
  G.CHAR_H = 20;

  // px(): fill one axis-aligned block of pixels.
  G.px = function (ctx, x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x | 0, y | 0, Math.ceil(w), Math.ceil(h));
  };

  // ---- Character definitions: palette + list of [gx, gy, gw, gh, paletteKey] ----
  const DEFS = {
    donald: {
      pal: { hair: "#e6b34d", skin: "#f1c9a1", suit: "#1b2433", shirt: "#eef0f4",
             tie: "#cc2b2b", eye: "#222", mouth: "#9a5a4a" },
      rects: [
        // hair (orange comb-over with a forward swoosh)
        [3,0,9,1,"hair"],[2,1,11,2,"hair"],[9,0,4,2,"hair"],[2,3,2,2,"hair"],[10,3,2,2,"hair"],
        // face
        [4,3,7,5,"skin"],
        [5,5,1,1,"eye"],[8,5,1,1,"eye"],
        [6,7,3,1,"mouth"],
        // neck
        [6,8,3,1,"skin"],
        // suit
        [1,9,12,2,"suit"],[2,11,11,9,"suit"],
        // white shirt + red tie
        [6,9,3,7,"shirt"],
        [7,9,1,1,"tie"],[6,10,3,1,"tie"],[7,11,2,5,"tie"],[6,15,4,2,"tie"],
        // hands
        [1,16,2,2,"skin"],[12,16,2,2,"skin"],
      ],
    },
    bibi: {
      pal: { hair: "#d6d6d6", skin: "#e8b894", suit: "#23252e", shirt: "#eef0f4",
             tie: "#2a5db0", eye: "#222", brow: "#bdbdbd", mouth: "#9a5a4a" },
      rects: [
        // balding: hair on the sides + a thin top line, big forehead
        [2,1,11,1,"hair"],[2,2,3,3,"hair"],[9,2,3,3,"hair"],
        // face
        [4,2,7,6,"skin"],
        [5,3,2,1,"brow"],[7,3,2,1,"brow"],
        [5,4,1,1,"eye"],[8,4,1,1,"eye"],
        [6,6,3,1,"mouth"],
        // neck
        [6,8,3,1,"skin"],
        // suit
        [1,9,12,2,"suit"],[2,11,11,9,"suit"],
        // shirt + blue tie
        [6,9,3,7,"shirt"],
        [7,9,1,1,"tie"],[6,10,3,1,"tie"],[7,11,2,5,"tie"],[6,15,4,2,"tie"],
        [1,16,2,2,"skin"],[12,16,2,2,"skin"],
      ],
    },
    mojtaba: {
      pal: { turban: "#1b1b1b", turbanHi: "#343434", skin: "#e0b088", beard: "#cfcfcf",
             robe: "#5b4632", robeHi: "#7a5f42", glass: "#111", collar: "#e8e8e8" },
      rects: [
        // black turban
        [3,0,8,1,"turbanHi"],[2,1,10,2,"turban"],[2,3,10,1,"turbanHi"],
        // forehead / eyes strip
        [4,4,7,2,"skin"],
        // glasses
        [4,4,3,1,"glass"],[7,4,3,1,"glass"],
        // grey beard covering lower face
        [3,6,9,3,"beard"],[4,9,7,1,"beard"],
        // clerical robe
        [1,9,12,2,"robe"],[2,11,11,9,"robe"],
        [6,10,3,9,"robeHi"],   // inner garment stripe
        [6,9,3,1,"collar"],
        [1,16,2,2,"skin"],[12,16,2,2,"skin"],
      ],
    },
  };

  // Draw a standing character. footX = horizontal center, footY = ground line.
  // facing: +1 faces right, -1 faces left (mirrored).
  G.drawCharacter = function (ctx, charId, footX, footY, unit, facing, opts) {
    const def = DEFS[charId];
    if (!def) return;
    opts = opts || {};
    const skip = opts.skip; // array of palette keys to omit (e.g. ["turban"])
    facing = facing < 0 ? -1 : 1;
    const ox = Math.round(footX - (G.CHAR_W * unit) / 2);
    const oy = Math.round(footY - G.CHAR_H * unit);
    for (const [gx, gy, gw, gh, key] of def.rects) {
      if (skip && skip.indexOf(key) !== -1) continue;
      const fx = facing < 0 ? G.CHAR_W - gx - gw : gx;
      G.px(ctx, ox + fx * unit, oy + gy * unit, gw * unit, gh * unit, def.pal[key]);
    }
    // when the turban is skipped, cap the bare head with a skin dome
    if (skip && skip.indexOf("turban") !== -1) {
      G.px(ctx, ox + 4 * unit, oy + 2 * unit, 6 * unit, 2 * unit, "#e0b088");
      G.px(ctx, ox + 5 * unit, oy + 1 * unit, 4 * unit, 1 * unit, "#e0b088");
    }
  };

  // Bounding box used for hit-tests & placement.
  G.charBox = function (footX, footY, unit) {
    return {
      x: footX - (G.CHAR_W * unit) / 2,
      y: footY - G.CHAR_H * unit,
      w: G.CHAR_W * unit,
      h: G.CHAR_H * unit,
    };
  };

  // ---------- Projectiles ----------
  // Each is centered on (x,y). Rotating ones face their velocity vector.
  G.PROJECTILE_R = 9; // collision radius (screen px) used by physics

  function drawTweet(ctx, x, y, u, t) {
    // White speech bubble that bobs; blue header + grey text lines.
    const bob = Math.sin(t * 0.3) * u;
    const bx = Math.round(x - 5 * u), by = Math.round(y - 4 * u + bob);
    G.px(ctx, bx, by, 10 * u, 7 * u, "#f6f8fb");           // body
    G.px(ctx, bx, by, 10 * u, 2 * u, "#1d9bf0");           // blue header bar
    G.px(ctx, bx + u, by - u, 2 * u, u, "#f6f8fb");        // little top nub
    G.px(ctx, bx + 2 * u, by + 3 * u, 6 * u, u, "#b8c2cc");// text line
    G.px(ctx, bx + 2 * u, by + 5 * u, 4 * u, u, "#b8c2cc");// text line
    G.px(ctx, bx + u, by + 7 * u, 2 * u, 2 * u, "#f6f8fb");// speech tail
  }

  function drawMissile(ctx, x, y, ang, u) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    // local +x = forward (nose). Body centered on origin.
    G.px(ctx, -5 * u, -1.5 * u, 7 * u, 3 * u, "#cfd3d8");   // body
    G.px(ctx, 2 * u, -1.5 * u, 3 * u, 3 * u, "#cc2b2b");    // red nose
    G.px(ctx, -5 * u, -3 * u, 2 * u, 1.5 * u, "#9aa0a6");   // top fin
    G.px(ctx, -5 * u, 1.5 * u, 2 * u, 1.5 * u, "#9aa0a6");  // bottom fin
    G.px(ctx, -8 * u, -1 * u, 3 * u, 2 * u, "#ffcf4d");     // flame
    G.px(ctx, -9.5 * u, -0.5 * u, 1.5 * u, u, "#ff6b4d");   // flame tip
    ctx.restore();
  }

  function drawDrone(ctx, x, y, ang, u, t) {
    // Shahed-style: small fuselage + delta wing + rear pusher prop. +x = nose.
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    G.px(ctx, -4 * u, -1 * u, 9 * u, 2 * u, "#d8dadd");     // fuselage
    G.px(ctx, 4 * u, -0.5 * u, 2 * u, u, "#8a8d92");        // nose
    // delta wings (triangle swept back from mid-body)
    ctx.fillStyle = "#c2c5c9";
    ctx.beginPath();
    ctx.moveTo(2 * u, 0); ctx.lineTo(-4 * u, -5 * u); ctx.lineTo(-4 * u, 0); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(2 * u, 0); ctx.lineTo(-4 * u, 5 * u); ctx.lineTo(-4 * u, 0); ctx.closePath(); ctx.fill();
    // tail prop (blurred by time)
    const p = (t % 2 < 1) ? 3 * u : 1 * u;
    G.px(ctx, -5.5 * u, -p / 2, u, p, "#444");
    ctx.restore();
  }

  G.drawProjectile = function (ctx, charId, x, y, vx, vy, t) {
    const u = Math.max(2, (G.CFG.PIXEL || 4) - 1);
    const proj = (G.CHARACTERS[charId] || {}).projectile;
    const ang = Math.atan2(vy, vx);
    if (proj === "missile") drawMissile(ctx, x, y, ang, u);
    else if (proj === "drone") drawDrone(ctx, x, y, ang, u, t);
    else drawTweet(ctx, x, y, u, t);
  };

  // ---- Victory props ----
  // Black turban tumbling through the air (Khamenei's victory toss).
  G.drawFlyingTurban = function (ctx, x, y, ang, u) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    G.px(ctx, -6 * u, -1.5 * u, 12 * u, 3 * u, "#1b1b1b");  // main band
    G.px(ctx, -5 * u, -3 * u, 10 * u, 1.5 * u, "#1b1b1b");  // dome
    G.px(ctx, -2 * u, -4 * u, 4 * u, 1.5 * u, "#343434");   // top knot
    ctx.restore();
  };

  // Render a projectile into a small standalone canvas (for select cards).
  G.makeProjectileThumb = function (charId, w, h) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(1.5, 1.5);
    // draw moving rightward so missile/drone point sideways
    G.drawProjectile(ctx, charId, 0, 0, 4, 0, 6);
    ctx.restore();
    return c;
  };

  // Render a character into a small standalone canvas (for select cards).
  G.makeCharThumb = function (charId, w, h) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    const unit = Math.floor(h / (G.CHAR_H + 2));
    G.drawCharacter(ctx, charId, w / 2, h - unit, unit, 1);
    return c;
  };
})();

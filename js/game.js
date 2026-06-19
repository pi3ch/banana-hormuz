/* ===== Banana Hormuz — main game (state machine, loop, wiring) ===== */
(function () {
  const G = window.GAME;
  const C = G.CFG;

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  // ---- DOM refs ----
  const el = (id) => document.getElementById(id);
  const overlays = {
    menu: el("menu"), difficulty: el("difficulty"), select: el("select"),
    banner: el("banner"), scores: el("scores"), help: el("help"),
  };
  const hud = el("hud");
  const angleInput = el("angle"), powerInput = el("power");
  const angleOut = el("angle-out"), powerOut = el("power-out");
  const fireBtn = el("fire");
  const turnLabel = el("turn-label"), windArrow = el("wind-arrow"), windVal = el("wind-val");
  const scoreLine = el("score-line");

  // ---- Game state ----
  const S = {
    screen: "menu",
    mode: "two",            // 'one' | 'two'
    difficulty: "normal",
    chars: [null, null],    // [leftPlayer, rightPlayer]
    names: ["Player 1", "Player 2"],
    selectFor: 0,           // which player is choosing
    players: [],            // [{footX,footY,facing}]
    wins: [0, 0],
    shots: [0, 0],
    current: 0,
    wind: 0,
    phase: "idle",          // 'aim' | 'flying' | 'resolving' | 'idle'
    proj: null,
    trail: [],
    explosions: [],
    particles: [],          // debris / confetti bits
    celebrate: null,        // { winner, frames, total } during the win dance
    message: null,          // { text, frames }
    resolveFrames: 0,
    afterResolve: null,
    aiTimer: null,
    t: 0,
    cheat: false,           // aim-assist dots, unlocked via the Konami code
    konami: [],             // recent-keys buffer for cheat detection
  };

  // ↑ ↑ ↓ ↓ ← → ← → B A
  const KONAMI = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown",
                  "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];

  // ---- Screen management ----
  function showScreen(name) {
    S.screen = name;
    for (const k in overlays) overlays[k].classList.toggle("hidden", k !== name);
    const playing = name === "play";
    hud.classList.toggle("hidden", !playing);
  }

  // ---- Character select cards ----
  function buildSelect() {
    const grid = el("char-grid");
    grid.innerHTML = "";
    el("select-title").textContent =
      S.mode === "two"
        ? `PLAYER ${S.selectFor + 1} — CHOOSE YOUR FIGHTER`
        : "CHOOSE YOUR FIGHTER";
    for (const id of G.CHAR_ORDER) {
      const ch = G.CHARACTERS[id];
      const card = document.createElement("div");
      card.className = "char-card";
      const thumb = G.makeCharThumb(id, 96, 120);
      card.appendChild(thumb);
      const nm = document.createElement("div");
      nm.className = "cname"; nm.textContent = ch.name;
      const wp = G.makeProjectileThumb(id, 70, 34);
      wp.className = "cweapon-icon";
      wp.title = ch.weapon;
      card.appendChild(nm); card.appendChild(wp);
      card.addEventListener("click", () => { G.Audio.click(); pickCharacter(id); });
      grid.appendChild(card);
    }
  }

  function pickCharacter(id) {
    S.chars[S.selectFor] = id;
    if (S.mode === "two") {
      if (S.selectFor === 0) {
        S.selectFor = 1;
        buildSelect();
        return;
      }
      S.names = [G.CHARACTERS[S.chars[0]].name, G.CHARACTERS[S.chars[1]].name];
      startMatch();
    } else {
      // 1P: human is left; AI gets a random different fighter.
      const others = G.CHAR_ORDER.filter((c) => c !== id);
      S.chars[1] = others[Math.floor(Math.random() * others.length)];
      S.names = [G.CHARACTERS[id].name, "AI " + G.CHARACTERS[S.chars[1]].name];
      G.AI.state.level = S.difficulty;
      startMatch();
    }
  }

  function isAI(idx) { return S.mode === "one" && idx === 1; }

  // ---- Match / round lifecycle ----
  function startMatch() {
    S.wins = [0, 0];
    S.shots = [0, 0];
    startRound(0);
  }

  function placePlayers() {
    const T = G.Terrain;
    S.players = [
      { footX: T.left.centerX, footY: T.left.topY, facing: 1 },
      { footX: T.right.centerX, footY: T.right.topY, facing: -1 },
    ];
  }

  function startRound(starter) {
    G.Terrain.generate();
    placePlayers();
    S.current = starter;
    S.proj = null;
    S.trail = [];
    S.explosions = [];
    S.particles = [];
    S.celebrate = null;
    S.message = null;
    G.AI.resetRound();
    showScreen("play");
    beginTurn();
  }

  function beginTurn() {
    S.phase = "aim";
    // wind changes every turn
    S.wind = (Math.random() * 2 - 1) * C.WIND_MAX;
    updateHud();
    fireBtn.disabled = false;
    if (isAI(S.current)) {
      fireBtn.disabled = true;
      scheduleAI();
    }
  }

  function scheduleAI() {
    clearTimeout(S.aiTimer);
    S.message = { text: "AI is aiming…", frames: 9999 };
    S.aiTimer = setTimeout(() => {
      const me = S.players[S.current];
      const target = G.charBox(
        S.players[1 - S.current].footX,
        S.players[1 - S.current].footY,
        C.PIXEL
      );
      const plan = G.AI.plan(me.footX, me.footY, me.facing, S.wind, target);
      angleInput.value = plan.angle; powerInput.value = plan.power;
      syncInputs();
      S.message = null;
      fire(S.current, plan.angle, plan.power);
    }, 750);
  }

  function fire(idx, angle, power) {
    if (S.phase !== "aim") return;
    const p = S.players[idx];
    S.shots[idx] += 1;
    S.proj = G.Physics.launch(p.footX, p.footY, angle, power, p.facing);
    S.proj.charId = S.chars[idx];
    S.proj.shooter = idx;
    S.proj.armed = false; // becomes true once it clears the thrower (enables self-hits)
    S.trail = [];
    S.phase = "flying";
    fireBtn.disabled = true;
    G.Audio.fire();
  }

  function spawnExplosion(x, y, big) {
    S.explosions.push({ x, y, r: 2, max: big ? 54 : 22, age: 0 });
  }

  function spawnParticles(x, y, n, colors, speed, gravity, up) {
    for (let i = 0; i < n; i++) {
      const a = up ? -Math.PI / 2 + (Math.random() - 0.5) * Math.PI
                   : Math.random() * Math.PI * 2;
      const sp = speed * (0.4 + Math.random() * 0.8);
      S.particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - (up ? Math.random() * 2 : 0),
        life: 30 + Math.random() * 30,
        max: 60,
        g: gravity,
        color: colors[(Math.random() * colors.length) | 0],
        size: 2 + (Math.random() * 2 | 0),
      });
    }
  }

  function resolveMiss(reason) {
    const p = S.proj;
    if (reason === "water") {
      G.Audio.splash();
      spawnExplosion(p.x, G.Terrain.waterY, false);
      spawnParticles(p.x, G.Terrain.waterY, 14, ["#5aa0d0", "#9ad0f0", "#cde6ff"], 4.2, 0.18, true);
    } else if (reason === "land") {
      // destructible terrain: punch a persistent charred hole into the cliff top
      G.Audio.explode();
      const surf = G.Terrain.surfaceAt(p.x);  // anchor at the surface, not the overshot y
      G.Terrain.damage(p.x, surf, 20);
      spawnExplosion(p.x, surf, true);
      const dirt = (p.x < C.W / 2) ? ["#7a5a3a", "#8a6a44", "#5e4630"] : ["#6a5240", "#7d6149", "#54402f"];
      spawnParticles(p.x, surf, 22, dirt, 5, 0.22, true);
    } else { // off-screen
      G.Audio.explode();
      spawnExplosion(p.x, p.y, false);
    }
    if (isAI(p.shooter)) G.AI.noteMiss();
    S.proj = null;
    S.phase = "resolving";
    S.resolveFrames = 34;
    S.afterResolve = () => beginTurn(); // turn already switched below
    S.current = 1 - S.current;          // hand over to opponent
  }

  function resolveHit(shooter) {
    const victim = 1 - shooter;
    const vb = G.charBox(S.players[victim].footX, S.players[victim].footY, C.PIXEL);
    const cx = vb.x + vb.w / 2, cy = vb.y + vb.h / 2;
    G.Audio.explode();
    spawnExplosion(cx, cy, true);
    // big debris burst from the blasted fighter
    spawnParticles(cx, cy, 30, ["#ffcf4d", "#ff6b4d", "#ffffff", "#d8d8d8"], 6, 0.18, false);
    S.wins[shooter] += 1;
    S.proj = null;
    startCelebration(shooter, victim, S.wins[shooter] >= C.WIN_ROUNDS);
  }

  // Self-destruction: the shooter's own projectile lands on them → opponent wins.
  function resolveSelfHit(shooter) {
    const opp = 1 - shooter;
    const sb = G.charBox(S.players[shooter].footX, S.players[shooter].footY, C.PIXEL);
    const cx = sb.x + sb.w / 2, cy = sb.y + sb.h / 2;
    G.Audio.explode();
    spawnExplosion(cx, cy, true);
    spawnParticles(cx, cy, 30, ["#ffcf4d", "#ff6b4d", "#ffffff", "#d8d8d8"], 6, 0.18, false);
    S.wins[opp] += 1;
    S.proj = null;
    startCelebration(opp, shooter, S.wins[opp] >= C.WIN_ROUNDS,
      `💥 ${S.names[shooter]} SELF-DESTRUCTS! ${S.names[opp]} wins!`);
  }

  // Winner performs a character-specific victory animation (every round win).
  // The match-winning celebration is longer + confetti + fanfare, then the banner.
  function startCelebration(winner, loser, isMatch, headline) {
    const ch = G.CHARACTERS[S.chars[winner]];
    S.phase = "celebrate";
    S.celebrate = {
      winner, loser, isMatch,
      frames: 0,
      total: isMatch ? 185 : 105,
      lastLaugh: -99,
      taunts: ch.taunts || ["HA HA!"],
    };
    S.message = {
      text: headline || (isMatch ? `${S.names[winner]} WINS THE MATCH!` : `ROUND TO ${S.names[winner]}!`),
      frames: 9999,
    };
    if (isMatch) G.Audio.winSong(); else G.Audio.win();
  }

  // ---- Collision + integration while flying ----
  function stepFlying() {
    const SUB = 2; // substeps for smoother collision
    for (let s = 0; s < SUB; s++) {
      const p = S.proj;
      if (!p) return;
      G.Physics.step(p, S.wind);
      S.trail.push({ x: p.x, y: p.y });
      if (S.trail.length > 90) S.trail.shift();

      // opponent hit?
      const opp = 1 - p.shooter;
      const ob = G.charBox(S.players[opp].footX, S.players[opp].footY, C.PIXEL);
      if (G.Physics.hitsBox(p, ob, G.PROJECTILE_R)) { resolveHit(p.shooter); return; }

      // self hit (only after the shot has cleared the thrower's own body)
      const sb = G.charBox(S.players[p.shooter].footX, S.players[p.shooter].footY, C.PIXEL);
      if (!p.armed) {
        if (!G.Physics.hitsBox(p, sb, G.PROJECTILE_R)) p.armed = true;
      } else if (G.Physics.hitsBox(p, sb, G.PROJECTILE_R)) {
        resolveSelfHit(p.shooter); return;
      }

      // off-screen sides / bottom
      if (p.x < -40 || p.x > C.W + 40 || p.y > C.H + 40) { resolveMiss("off"); return; }

      // water splash
      if (p.y >= G.Terrain.waterY && G.Terrain.isWaterAt(p.x)) { resolveMiss("water"); return; }

      // land / cliff hit
      if (p.y >= G.Terrain.surfaceAt(p.x) && !G.Terrain.isWaterAt(p.x)) {
        resolveMiss("land"); return;
      }
    }
  }

  // ---- Match over + high score entry ----
  function matchOver(winner) {
    showScreen("banner");
    el("banner-title").textContent = `${S.names[winner]} WINS!`;
    el("banner-sub").textContent = `Match ${S.wins[0]} – ${S.wins[1]}`;
    const box = el("banner-buttons");
    box.innerHTML = "";

    const score = G.HighScore.computeScore(S.wins[winner], S.shots[winner]);
    const charName = G.CHARACTERS[S.chars[winner]].name;

    if (isAI(winner)) {
      // AI win: no prompt — auto-generate a tagged name and store immediately.
      const aiName = ("AI-" + charName).slice(0, 12).toUpperCase();
      G.HighScore.add({
        name: aiName, score, character: charName,
        mode: "1P", date: new Date().toISOString().slice(0, 10),
      });
      const info = document.createElement("div");
      info.style.cssText = "color:#c8b48a;font-size:0.9rem;margin-bottom:0.4rem;";
      info.textContent = `🤖 AI scored ${score} — saved as ${aiName}`;
      box.appendChild(info);
      renderScores();
    } else {
      // human win: prompt for a name
      const row = document.createElement("div");
      row.style.cssText = "display:flex;gap:0.5rem;align-items:center;justify-content:center;flex-wrap:wrap;margin-bottom:0.4rem;";
      const label = document.createElement("span");
      label.textContent = `SCORE ${score} · NAME:`;
      label.style.cssText = "color:#c8b48a;font-size:0.85rem;";
      const input = document.createElement("input");
      input.type = "text"; input.maxLength = 12;
      input.value = S.names[winner];
      input.style.cssText = "font-family:inherit;font-size:1rem;padding:0.4em;width:140px;background:#0a0712;color:#f4e4c1;border:2px solid #4a3b6b;text-transform:uppercase;";
      const saveBtn = document.createElement("button");
      saveBtn.className = "btn"; saveBtn.textContent = "SAVE SCORE";
      let saved = false;
      saveBtn.addEventListener("click", () => {
        if (saved) return;
        saved = true;
        G.Audio.click();
        G.HighScore.add({
          name: (input.value || "ANON").slice(0, 12).toUpperCase(),
          score, character: charName,
          mode: S.mode === "one" ? "1P" : "2P",
          date: new Date().toISOString().slice(0, 10),
        });
        saveBtn.textContent = "SAVED ✓";
        saveBtn.disabled = true;
        input.disabled = true;
        renderScores();
      });
      row.appendChild(label); row.appendChild(input); row.appendChild(saveBtn);
      box.appendChild(row);
    }

    const again = mkBtn("PLAY AGAIN", () => {
      S.selectFor = 0; S.chars = [null, null];
      if (S.mode === "one") { showScreen("difficulty"); }
      else { buildSelect(); showScreen("select"); }
    });
    const scores = mkBtn("HIGH SCORES", () => { renderScores(); showScreen("scores"); }, true);
    const menu = mkBtn("MAIN MENU", toMenu, true);
    box.appendChild(again); box.appendChild(scores); box.appendChild(menu);
  }

  function mkBtn(text, fn, ghost) {
    const b = document.createElement("button");
    b.className = "btn" + (ghost ? " ghost" : "");
    b.textContent = text;
    b.addEventListener("click", () => { G.Audio.click(); fn(); });
    return b;
  }

  // ---- High score table ----
  function renderScores() {
    const body = el("score-body");
    body.innerHTML = "";
    const list = G.HighScore.load();
    if (!list.length) {
      const tr = document.createElement("tr");
      tr.className = "empty";
      tr.innerHTML = `<td colspan="5">No scores yet — go win a match!</td>`;
      body.appendChild(tr);
      return;
    }
    list.forEach((e, i) => {
      const tr = document.createElement("tr");
      tr.innerHTML =
        `<td>${i + 1}</td><td>${esc(e.name)}</td><td>${esc(e.character || "")}</td>` +
        `<td>${esc(e.mode || "")}</td><td>${e.score}</td>`;
      body.appendChild(tr);
    });
  }
  function esc(s) { return String(s).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c])); }

  // ---- HUD ----
  function updateHud() {
    const cur = S.current;
    turnLabel.textContent = S.names[cur];
    turnLabel.style.color = cur === 0 ? "#ffcf4d" : "#7ddc6b";
    const strength = Math.round((Math.abs(S.wind) / C.WIND_MAX) * 10);
    windArrow.textContent = strength === 0 ? "·" : (S.wind > 0 ? "→" : "←");
    windVal.textContent = strength;
    scoreLine.textContent = `${S.wins[0]} — ${S.wins[1]}`;
  }

  function syncInputs() {
    angleOut.textContent = angleInput.value;
    powerOut.textContent = powerInput.value;
  }

  let toastEl = null, toastTimer = null;
  function showToast(text) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "toast";
      document.getElementById("stage").appendChild(toastEl);
    }
    toastEl.textContent = text;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2200);
  }

  // ---- Rendering ----
  function drawTrajectoryPreview() {
    if (S.phase !== "aim" || isAI(S.current)) return;
    const p = S.players[S.current];

    // Predicted-arc dots are an aim-assist cheat — only shown once unlocked.
    if (S.cheat) {
      const ghost = G.Physics.launch(p.footX, p.footY, +angleInput.value, +powerInput.value, p.facing);
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      for (let i = 0; i < 60; i++) {
        G.Physics.step(ghost, S.wind);
        if (ghost.x < 0 || ghost.x > C.W || ghost.y > C.H) break;
        if (i % 3 === 0) ctx.fillRect(ghost.x - 1, ghost.y - 1, 2, 2);
      }
    }

    // aim barrel line (just shows the current angle, always visible)
    const a = (+angleInput.value * Math.PI) / 180;
    const len = 22;
    const sx = p.footX, sy = p.footY - G.CHAR_H * C.PIXEL * 0.78;
    ctx.strokeStyle = "rgba(255,207,77,0.9)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + p.facing * Math.cos(a) * len, sy - Math.sin(a) * len);
    ctx.stroke();
  }

  function drawSmoke(x, y, t) {
    for (let i = 0; i < 4; i++) {
      const yy = y - i * 10 - (t * 0.4 % 10);
      ctx.fillStyle = `rgba(90,90,90,${0.35 - i * 0.07})`;
      ctx.beginPath(); ctx.arc(x + Math.sin(t * 0.05 + i) * 5, yy, 8 - i, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawSpeechBubble(x, y, text) {
    ctx.font = "bold 14px 'Courier New', monospace";
    ctx.textAlign = "center";
    const w = ctx.measureText(text).width + 14;
    const half = w / 2;
    const cx = Math.max(half + 2, Math.min(C.W - half - 2, x)); // keep on-screen
    ctx.fillStyle = "#f6f8fb";
    ctx.fillRect(cx - half, y - 22, w, 20);
    ctx.fillRect(cx - 4, y - 4, 8, 6); // tail
    ctx.fillStyle = "#1a1226";
    ctx.fillText(text, cx, y - 8);
    ctx.textAlign = "left";
  }

  // Character-specific victory animation while celebrating a win.
  function drawVictory(charId, footX, footY, facing, cel) {
    const f = cel.frames, u = C.PIXEL;
    const ch = G.CHARACTERS[charId];
    let fy = footY;

    if (ch.victory === "dance") {
      // Trump shimmy: sway side to side, hop, flip facing with the beat
      const sway = Math.sin(f * 0.30) * 12;
      fy = footY - Math.abs(Math.sin(f * 0.30)) * 10;
      const face = Math.sin(f * 0.30) >= 0 ? 1 : -1;
      G.drawCharacter(ctx, charId, footX + sway, fy, u, face);
      footX += sway;
    } else if (ch.victory === "turban") {
      // Khamenei tosses his turban up and it tumbles back down
      fy = footY - Math.abs(Math.sin(f * 0.22)) * 8;
      G.drawCharacter(ctx, charId, footX, fy, u, facing, { skip: ["turban", "turbanHi"] });
      const cyc = (f % 80) / 80;
      const up = Math.sin(cyc * Math.PI) * 80;
      G.drawFlyingTurban(ctx, footX, fy - G.CHAR_H * u - 8 - up, f * 0.18, Math.max(2, u - 1));
    } else if (ch.victory === "handsup") {
      // Bibi waves both hands up and down
      fy = footY - Math.abs(Math.sin(f * 0.24)) * 6;
      G.drawCharacter(ctx, charId, footX, fy, u, facing);
      const wave = Math.sin(f * 0.4) * 7 * u;            // hands rise and fall
      const shoulderY = fy - G.CHAR_H * u * 0.55;
      const skin = "#e8b894", suit = "#23252e";
      [-1, 1].forEach((side) => {
        const hx = footX + side * 6 * u;
        const hy = shoulderY - 4 * u + wave;
        G.px(ctx, hx, hy + 4 * u, 2 * u, 4 * u, suit);    // forearm
        G.px(ctx, hx - 0.5 * u, hy + 2 * u, 3 * u, 2 * u, skin); // hand
      });
    } else {
      fy = footY - Math.abs(Math.sin(f * 0.16)) * 22;
      G.drawCharacter(ctx, charId, footX, fy, u, facing);
    }

    // taunt bubble cycling through the character's lines
    const txt = cel.taunts[Math.floor(f / 30) % cel.taunts.length];
    drawSpeechBubble(footX, fy - G.CHAR_H * u - 6, txt);
  }

  function drawScene() {
    G.Terrain.draw(ctx, S.t);

    // characters
    const cel = S.celebrate;
    for (let i = 0; i < 2; i++) {
      if (!S.players[i] || !S.chars[i]) continue;
      const pl = S.players[i];
      if (cel && i === cel.loser) { drawSmoke(pl.footX, pl.footY - 12, S.t); continue; }
      if (cel && i === cel.winner) { drawVictory(S.chars[i], pl.footX, pl.footY, pl.facing, cel); continue; }
      G.drawCharacter(ctx, S.chars[i], pl.footX, pl.footY, C.PIXEL, pl.facing);
    }

    drawTrajectoryPreview();

    // trail
    for (let i = 0; i < S.trail.length; i++) {
      const tp = S.trail[i];
      ctx.fillStyle = `rgba(255,235,180,${(i / S.trail.length) * 0.6})`;
      ctx.fillRect(tp.x - 1, tp.y - 1, 2, 2);
    }

    // projectile
    if (S.proj) G.drawProjectile(ctx, S.proj.charId, S.proj.x, S.proj.y, S.proj.vx, S.proj.vy, S.t);

    // explosions
    for (const ex of S.explosions) {
      const a = 1 - ex.age / 18;
      ctx.fillStyle = `rgba(255,180,60,${Math.max(0, a)})`;
      ctx.beginPath(); ctx.arc(ex.x, ex.y, ex.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(255,90,50,${Math.max(0, a * 0.7)})`;
      ctx.beginPath(); ctx.arc(ex.x, ex.y, ex.r * 0.6, 0, Math.PI * 2); ctx.fill();
    }

    // particles (debris / confetti)
    for (const pt of S.particles) {
      ctx.globalAlpha = Math.max(0, Math.min(1, pt.life / 30));
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x | 0, pt.y | 0, pt.size, pt.size);
    }
    ctx.globalAlpha = 1;

    // center message
    if (S.message) {
      ctx.fillStyle = "rgba(10,7,18,0.6)";
      ctx.fillRect(0, C.H * 0.36, C.W, 46);
      ctx.fillStyle = "#ffcf4d";
      ctx.font = "bold 26px 'Courier New', monospace";
      ctx.textAlign = "center";
      ctx.fillText(S.message.text, C.W / 2, C.H * 0.36 + 32);
      ctx.textAlign = "left";
    }
  }

  function update() {
    S.t += 1;
    if (S.phase === "flying") stepFlying();

    // advance explosions
    for (const ex of S.explosions) { ex.age += 1; ex.r = Math.min(ex.max, ex.r + 3); }
    S.explosions = S.explosions.filter((e) => e.age < 20);

    // advance particles
    for (const pt of S.particles) {
      pt.vy += pt.g; pt.x += pt.vx; pt.y += pt.vy; pt.life -= 1;
    }
    S.particles = S.particles.filter((p) => p.life > 0 && p.y < C.H + 20);

    // winner celebration (jump + laugh + confetti)
    if (S.phase === "celebrate" && S.celebrate) {
      const cel = S.celebrate;
      cel.frames += 1;
      // laugh blip at the top of each hop
      if (cel.frames - cel.lastLaugh > 26) { cel.lastLaugh = cel.frames; G.Audio.laugh(); }
      // rain confetti (heavier for the match win)
      const rate = cel.isMatch ? 4 : 9;
      if (cel.frames % rate === 0) {
        const x = Math.random() * C.W;
        S.particles.push({
          x, y: -6, vx: (Math.random() - 0.5) * 1.2, vy: 1 + Math.random() * 1.5,
          life: 140, max: 140, g: 0.02,
          color: ["#ffcf4d", "#ff6b4d", "#7ddc6b", "#5aa0d0", "#ffffff"][(Math.random() * 5) | 0],
          size: 2 + (Math.random() * 2 | 0),
        });
      }
      if (cel.frames >= cel.total) {
        const c = cel; S.celebrate = null; S.phase = "idle"; S.message = null;
        if (c.isMatch) matchOver(c.winner);
        else startRound(c.loser); // loser of the round shoots first next round
      }
    }

    if (S.phase === "resolving") {
      S.resolveFrames -= 1;
      if (S.resolveFrames <= 0) {
        const fn = S.afterResolve;
        S.afterResolve = null;
        S.phase = "idle";
        S.message = null;
        if (fn) fn();
      }
    }
  }

  function loop() {
    if (S.screen === "play") {
      update();
      drawScene();
    }
    requestAnimationFrame(loop);
  }

  // ---- Menu navigation ----
  function toMenu() {
    clearTimeout(S.aiTimer);
    S.phase = "idle";
    showScreen("menu");
  }

  // ---- Event wiring ----
  function wire() {
    document.querySelectorAll("[data-action]").forEach((b) => {
      b.addEventListener("click", () => {
        G.Audio.click();
        const a = b.getAttribute("data-action");
        if (a === "one-player") { S.mode = "one"; showScreen("difficulty"); }
        else if (a === "two-player") { S.mode = "two"; S.selectFor = 0; S.chars = [null, null]; buildSelect(); showScreen("select"); }
        else if (a === "show-scores") { renderScores(); showScreen("scores"); }
        else if (a === "show-help") { showScreen("help"); }
        else if (a === "to-menu") { toMenu(); }
        else if (a === "clear-scores") { G.HighScore.clear(); renderScores(); }
      });
    });

    document.querySelectorAll("[data-diff]").forEach((b) => {
      b.addEventListener("click", () => {
        G.Audio.click();
        S.difficulty = b.getAttribute("data-diff");
        G.AI.state.level = S.difficulty;
        S.selectFor = 0; S.chars = [null, null];
        buildSelect();
        showScreen("select");
      });
    });

    angleInput.addEventListener("input", syncInputs);
    powerInput.addEventListener("input", syncInputs);

    fireBtn.addEventListener("click", () => {
      if (S.phase === "aim" && !isAI(S.current)) fire(S.current, +angleInput.value, +powerInput.value);
    });

    // Konami code (works on any screen): toggles the aim-assist cheat.
    document.addEventListener("keydown", (e) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      S.konami.push(k);
      if (S.konami.length > KONAMI.length) S.konami.shift();
      if (S.konami.length === KONAMI.length && KONAMI.every((v, i) => v === S.konami[i])) {
        S.konami = [];
        S.cheat = !S.cheat;
        G.Audio.win();
        showToast(S.cheat ? "🎯 AIM ASSIST UNLOCKED" : "AIM ASSIST OFF");
      }
    });

    document.addEventListener("keydown", (e) => {
      if (S.screen !== "play" || S.phase !== "aim" || isAI(S.current)) return;
      if (e.key === "ArrowLeft") { angleInput.value = Math.max(0, +angleInput.value - 1); syncInputs(); e.preventDefault(); }
      else if (e.key === "ArrowRight") { angleInput.value = Math.min(90, +angleInput.value + 1); syncInputs(); e.preventDefault(); }
      else if (e.key === "ArrowUp") { powerInput.value = Math.min(100, +powerInput.value + 1); syncInputs(); e.preventDefault(); }
      else if (e.key === "ArrowDown") { powerInput.value = Math.max(0, +powerInput.value - 1); syncInputs(); e.preventDefault(); }
      else if (e.key === " " || e.key === "Enter") { fire(S.current, +angleInput.value, +powerInput.value); e.preventDefault(); }
    });
  }

  // ---- Boot ----
  wire();
  syncInputs();
  showScreen("menu");
  requestAnimationFrame(loop);
})();

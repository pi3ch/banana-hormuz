/* ===== Banana Hormuz — high scores (localStorage) ===== */
(function () {
  const G = window.GAME;

  G.HighScore = {
    load() {
      try {
        const raw = localStorage.getItem(G.CFG.STORE_KEY);
        const arr = raw ? JSON.parse(raw) : [];
        return Array.isArray(arr) ? arr : [];
      } catch (e) {
        return [];
      }
    },

    save(list) {
      try {
        localStorage.setItem(G.CFG.STORE_KEY, JSON.stringify(list));
      } catch (e) { /* storage may be blocked on file:// in some browsers */ }
    },

    // Insert an entry, keep top 10 by score. Returns the new sorted list.
    add(entry) {
      const list = this.load();
      list.push(entry);
      list.sort((a, b) => b.score - a.score);
      const top = list.slice(0, 10);
      this.save(top);
      return top;
    },

    clear() { this.save([]); },

    // Score formula: round wins are the bulk; fewer total shots = bonus.
    computeScore(roundsWon, totalShots) {
      const base = roundsWon * 100;
      const efficiency = Math.max(0, 60 - totalShots * 3); // reward sharp shooting
      return base + efficiency;
    },
  };
})();

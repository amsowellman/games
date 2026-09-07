// SaveSystem - localStorage persistence for progress, settings, badges.
// Also owns the shared game constants and difficulty modifier table.

export const GAME_W = 1280;
export const GAME_H = 720;

export const DIFFICULTIES = {
  easy:   { label: 'Easy',   launchMod: 2,  cooldownMult: 0.6, resilience: 2.0, debrisHpMult: 0.7,  starMult: 0.8,  previewDots: 26 },
  medium: { label: 'Medium', launchMod: 0,  cooldownMult: 1.0, resilience: 1.0, debrisHpMult: 1.0,  starMult: 1.0,  previewDots: 14 },
  hard:   { label: 'Hard',   launchMod: -1, cooldownMult: 1.3, resilience: 0.6, debrisHpMult: 1.35, starMult: 1.15, previewDots: 5 }
};

const SAVE_KEY = 'phr_save_v1';
const DIFF_KEYS = ['easy', 'medium', 'hard'];

function defaultProgress() {
  const p = {};
  for (const d of DIFF_KEYS) p[d] = { unlocked: 1, stars: Array(10).fill(0), scores: Array(10).fill(0) };
  return p;
}

function defaultSave() {
  return {
    settings: { platform: null, difficulty: 'medium', music: 0.6, sfx: 0.8 },
    progress: defaultProgress(),
    badges: []
  };
}

export default class SaveSystem {
  static load() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return defaultSave();
      const data = JSON.parse(raw);
      const base = defaultSave();
      return {
        settings: Object.assign(base.settings, data.settings || {}),
        progress: Object.assign(base.progress, data.progress || {}),
        badges: Array.isArray(data.badges) ? data.badges : []
      };
    } catch (e) {
      return defaultSave();
    }
  }

  static store(data) {
    try { window.localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) { /* storage unavailable */ }
  }

  static getSettings() { return SaveSystem.load().settings; }

  static setSetting(key, value) {
    const data = SaveSystem.load();
    data.settings[key] = value;
    SaveSystem.store(data);
  }

  static getProgress(difficulty) {
    const data = SaveSystem.load();
    return data.progress[difficulty] || data.progress.medium;
  }

  /** Record a level result. Returns true if the star rating improved. */
  static recordResult(difficulty, levelIndex, stars, score) {
    const data = SaveSystem.load();
    const prog = data.progress[difficulty];
    if (!prog) return false;
    const i = levelIndex - 1;
    const improved = stars > (prog.stars[i] || 0);
    prog.stars[i] = Math.max(prog.stars[i] || 0, stars);
    prog.scores[i] = Math.max(prog.scores[i] || 0, score);
    if (stars > 0 && levelIndex < 10) prog.unlocked = Math.max(prog.unlocked, levelIndex + 1);
    if (stars > 0 && levelIndex === 10 && !data.badges.includes('perfect_rescuer')) {
      data.badges.push('perfect_rescuer');
    }
    SaveSystem.store(data);
    return improved;
  }

  static hasBadge(badge) { return SaveSystem.load().badges.includes(badge); }

  static reset() {
    try { window.localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
  }
}

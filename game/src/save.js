// Save and load through localStorage: cash, mission progress, the player's
// position, health, collected coins and lifetime stats. Saving never throws:
// a browser with storage off simply keeps the run in memory.

import { SAVE_KEY } from './config.js';

export function createSave() {
  function read() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (typeof data !== 'object' || data === null) return null;
      return data;
    } catch {
      return null;
    }
  }

  return {
    /** The stored save, or null when there is none or it is unreadable. */
    load() {
      return read();
    },
    hasSave() {
      return read() !== null;
    },
    /** Persist the given snapshot; returns false when storage refused it. */
    save(snapshot) {
      try {
        window.localStorage.setItem(SAVE_KEY, JSON.stringify(snapshot));
        return true;
      } catch {
        return false;
      }
    },
    clear() {
      try {
        window.localStorage.removeItem(SAVE_KEY);
      } catch {
        // Nothing stored, nothing to clear.
      }
    },
  };
}

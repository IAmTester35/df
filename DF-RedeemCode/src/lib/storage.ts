/**
 * Storage Keys Migration Logic
 * Handles moving data from legacy versioned keys (v1-v6) to stable keys.
 */

const LEGACY_KEYS = {
  masterUrl: ['df_master_url_v6', 'df_master_url_v1-5'], // You can add more old keys here
  history: ['df_history_v5', 'df_history_v4', 'df_history_v3'],
  lastSync: ['df_last_sync_v5', 'df_last_sync_v4']
};

export const STABLE_KEYS = {
  MASTER_URL: 'df_master_url',
  HISTORY: 'df_history',
  LAST_SYNC: 'df_last_sync'
};

export const migrateStorage = () => {
  // 1. Migrate Master URL
  if (!localStorage.getItem(STABLE_KEYS.MASTER_URL)) {
    for (const oldKey of LEGACY_KEYS.masterUrl) {
      const data = localStorage.getItem(oldKey);
      if (data) {
        localStorage.setItem(STABLE_KEYS.MASTER_URL, data);
        // After migrating, we could remove oldKey, but keeping for safety for 1-2 versions
        // localStorage.removeItem(oldKey);
        break;
      }
    }
  }

  // 2. Migrate History
  if (!localStorage.getItem(STABLE_KEYS.HISTORY)) {
    for (const oldKey of LEGACY_KEYS.history) {
      const data = localStorage.getItem(oldKey);
      if (data) {
        localStorage.setItem(STABLE_KEYS.HISTORY, data);
        break;
      }
    }
  }

  // 3. Migrate Sync Time
  if (!localStorage.getItem(STABLE_KEYS.LAST_SYNC)) {
    for (const oldKey of LEGACY_KEYS.lastSync) {
      const data = localStorage.getItem(oldKey);
      if (data) {
        localStorage.setItem(STABLE_KEYS.LAST_SYNC, data);
        break;
      }
    }
  }
};

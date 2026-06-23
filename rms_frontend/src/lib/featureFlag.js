import { settingsAPI } from './api';

const CACHE_PREFIX = 'rms_featureFlag_';

// Fetches any boolean flag with offline resilience, given a custom fetcher.
//
// On success: caches the resolved boolean to localStorage and returns it.
// On failure (network blip, offline): falls back to the last known good cached value
// instead of blindly defaulting to "enabled" — a feature an admin disabled must not get
// exposed just because the network hiccuped. Only when there has never been a successful
// fetch (no cache at all — e.g. a brand new device) does it fall back to `fallbackDefault`.
export async function loadCachedFlag(cacheKey, fetcher, fallbackDefault = true) {
  const key = CACHE_PREFIX + cacheKey;
  try {
    const value = await fetcher();
    try { localStorage.setItem(key, String(value)); } catch {}
    return value;
  } catch {}
  try {
    const cached = localStorage.getItem(key);
    if (cached !== null) return cached === 'true';
  } catch {}
  return fallbackDefault;
}

// Convenience wrapper for the common case: a single system-settings key whose stored
// string value determines enabled/disabled.
export async function loadFeatureFlag(key, { fallbackDefault = true, isEnabled = (v) => v !== 'false' } = {}) {
  return loadCachedFlag(key, async () => {
    const res = await settingsAPI.get(key);
    if (res?.value === undefined) throw new Error('no value');
    return isEnabled(res.value);
  }, fallbackDefault);
}

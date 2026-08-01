import { Capacitor } from '@capacitor/core';

let _Bio = null;

async function getBio() {
  if (!Capacitor.isNativePlatform()) return null;
  if (!_Bio) {
    try {
      const mod = await import('capacitor-native-biometric');
      _Bio = mod.NativeBiometric;
    } catch {
      return null;
    }
  }
  return _Bio;
}

const SERVER = 'com.cssgroup.rms';
const DEPTS_KEY = 'rms_bio_depts';

function serverKey(dept) {
  return `${SERVER}.${dept.toLowerCase().replace(/\s+/g, '_')}`;
}

export function isNative() {
  return Capacitor.isNativePlatform();
}

export async function bioAvailable() {
  const bio = await getBio();
  if (!bio) return false;
  try {
    const r = await bio.isAvailable();
    return r.isAvailable;
  } catch {
    return false;
  }
}

export function getSavedBioDepts() {
  try {
    return JSON.parse(localStorage.getItem(DEPTS_KEY) || '[]');
  } catch {
    return [];
  }
}

export function hasBioDept(dept) {
  return getSavedBioDepts().includes(dept);
}

function setBioDept(dept, on) {
  const list = getSavedBioDepts();
  if (on && !list.includes(dept)) list.push(dept);
  if (!on) {
    const i = list.indexOf(dept);
    if (i > -1) list.splice(i, 1);
  }
  localStorage.setItem(DEPTS_KEY, JSON.stringify(list));
}

export async function enrollBiometric(dept, password) {
  const bio = await getBio();
  if (!bio) throw new Error('Biometric not supported on this device');
  await bio.setCredentials({
    username: dept,
    password,
    server: serverKey(dept),
  });
  setBioDept(dept, true);
}

export async function loginWithBiometric(dept) {
  const bio = await getBio();
  if (!bio) throw new Error('Biometric not supported');
  await bio.verifyIdentity({
    reason: `Log in to CSS RMS as ${dept}`,
    title: 'Biometric Login',
    subtitle: `${dept} — CSS RMS Portal`,
    description: 'Use your fingerprint or face to sign in',
    negativeButtonText: 'Use Password',
  });
  const creds = await bio.getCredentials({ server: serverKey(dept) });
  return creds.password; // returns the stored access code
}

export async function removeBiometric(dept) {
  const bio = await getBio();
  if (bio) {
    try { await bio.deleteCredentials({ server: serverKey(dept) }); } catch {}
  }
  setBioDept(dept, false);
}

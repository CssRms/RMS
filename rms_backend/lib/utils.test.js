import { describe, it, expect } from 'vitest';
import { normalizeRole, toIntOrNull, getNumericUserId } from './utils.js';

describe('normalizeRole', () => {
  // This is the exact gate behind every `role === 'global_admin'` access check in
  // serve.js — a regression here is a security bug, not just a display bug.
  it('lowercases the role for case-insensitive comparison', () => {
    expect(normalizeRole('GLOBAL_ADMIN')).toBe('global_admin');
    expect(normalizeRole('Department')).toBe('department');
  });

  it('a missing/null role normalizes to an empty string, not null or undefined', () => {
    expect(normalizeRole(null)).toBe('');
    expect(normalizeRole(undefined)).toBe('');
  });
});

describe('toIntOrNull', () => {
  it('parses valid numeric strings and numbers', () => {
    expect(toIntOrNull('42')).toBe(42);
    expect(toIntOrNull(42)).toBe(42);
  });

  it('returns null for empty/missing values instead of NaN', () => {
    expect(toIntOrNull('')).toBeNull();
    expect(toIntOrNull(null)).toBeNull();
    expect(toIntOrNull(undefined)).toBeNull();
  });

  it('returns null for non-numeric garbage instead of NaN', () => {
    expect(toIntOrNull('not-a-number')).toBeNull();
  });
});

describe('getNumericUserId', () => {
  it("returns the user's numeric id", () => {
    expect(getNumericUserId({ id: 7 })).toBe(7);
  });

  it('returns null for a missing user or a non-numeric id (e.g. a JWT-decoded string id)', () => {
    expect(getNumericUserId(null)).toBeNull();
    expect(getNumericUserId({ id: '7' })).toBeNull();
    expect(getNumericUserId({})).toBeNull();
  });
});

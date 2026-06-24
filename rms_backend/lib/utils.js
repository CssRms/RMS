// Small, generic pure helpers extracted out of serve.js for the same reason as
// businessRules.js: testable in isolation, without starting the server. normalizeRole
// in particular gates admin access throughout the app (every `role === 'global_admin'`
// check goes through it first) — a regression here is a security-relevant bug, not just
// a display bug, so it's worth a direct test even though the logic itself is trivial.

const normalizeRole = (role) => (role || '').toLowerCase();

const toIntOrNull = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number.parseInt(String(value), 10);
  return Number.isNaN(n) ? null : n;
};

const getNumericUserId = (user) => {
  if (!user) return null;
  if (typeof user.id === 'number') return user.id;
  return null;
};

module.exports = { normalizeRole, toIntOrNull, getNumericUserId };

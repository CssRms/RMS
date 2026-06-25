// Pure business-rule functions extracted out of serve.js so they're unit-testable in
// isolation, without starting the Express server or touching a database. These are the
// exact rules behind the re-approval escalation feature, which needed four separate
// rounds of bugfixes during development — this module (and its test file) exists so the
// next change to these rules gets caught by a test instead of by the next user report.

// Does this department's authority band cover this amount? Returns the matching tier
// name ('chairman' | 'gm' | 'hr') if so, otherwise null (amount exceeds their authority).
function checkFinalApproveAuthority(deptName, amount, isMaterial = false) {
  const n = (deptName || '').toLowerCase();
  const amt = parseFloat(amount) || 0;
  const isChairman = /ceo|chairman/i.test(n);
  const isGM = /general\s*manager|\bgm\b/i.test(n);
  const isHR = /\bhr\b|human\s*resource/i.test(n);

  // Material requests have no cash threshold — any authority tier can approve
  if (isMaterial) {
    if (isChairman) return 'chairman';
    if (isGM)       return 'gm';
    if (isHR)       return 'hr';
    return null;
  }

  // Chairman: full authority over all amount levels
  if (isChairman) return 'chairman';
  // GM band: 50,001 – 100,000
  if (isGM && amt > 50000 && amt <= 100000) return 'gm';
  // HR band: ≤ 50,000
  if (isHR && amt <= 50000) return 'hr';
  return null; // Amount outside this department's authorised band
}

// Lowest authority tier whose band actually covers this amount — used to tell the
// requester which department needs to re-approve after a price revision.
function requiredAuthorityTier(amount, isMaterial = false) {
  if (isMaterial) return 'hr'; // material has no cash threshold — any tier already covers it
  const amt = parseFloat(amount) || 0;
  if (amt <= 50000) return 'hr';
  if (amt <= 100000) return 'gm';
  return 'chairman';
}

// Priority: ICC's post-approval override (reviewed last, closest to payment) beats
// Audit's pre-approval override, which beats the creator's original estimate. This is
// the backend mirror of getEffectiveAmount in rms_frontend/src/lib/requisitionDisplay.js —
// the two can't literally share a JS module across runtimes, but the rule must stay in
// sync between them if it's ever revised.
function getEffectiveReqAmount(req) {
  if (req?.hasIccOverride && req?.iccOverrideAmount != null) return parseFloat(req.iccOverrideAmount);
  if (req?.hasAuditOverride && req?.auditAmount != null) return parseFloat(req.auditAmount);
  return parseFloat(req?.amount || 0);
}

const isIccDept = (name) => /\bicc\b|internal.*control|control.*compliance/i.test(name || '');

// Four departments (GM, CEO/Chairman, ICC, Audit) have a fixed, env-configurable
// access code instead of a randomly generated one. Security Reset restores this
// fixed code for them; every other department gets a freshly generated random one.
// `env` is injected (rather than read from process.env internally) so this stays a
// pure, easily-testable function.
function getFixedDefaultAccessCode(deptName, env = {}) {
  const n = deptName || '';
  if (/general\s*manager|\bgm\b/i.test(n)) return env.GM_ACCESS_CODE || 'GM-2026';
  if (/ceo|chairman/i.test(n)) return env.CEO_ACCESS_CODE || 'CEO-2026';
  if (isIccDept(n)) return env.ICC_ACCESS_CODE || 'ICC-2026';
  if (/\baudit\b/i.test(n)) return env.AUDIT_ACCESS_CODE || 'AUDIT-2026';
  return null;
}

// True if the sub-account's JWT-carried privilege limit covers the effective amount.
function subPrivilegeCoversCash(user, effectiveAmount) {
  if (!user?.isSubAccount) return false;
  const limit = parseFloat(user.privilegeAmount);
  return !isNaN(limit) && effectiveAmount <= limit;
}

module.exports = {
  checkFinalApproveAuthority,
  requiredAuthorityTier,
  getEffectiveReqAmount,
  isIccDept,
  subPrivilegeCoversCash,
  getFixedDefaultAccessCode,
};

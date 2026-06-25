import { describe, it, expect } from 'vitest';
import {
  checkFinalApproveAuthority,
  requiredAuthorityTier,
  getEffectiveReqAmount,
  isIccDept,
  subPrivilegeCoversCash,
  getFixedDefaultAccessCode,
} from './businessRules.js';

describe('checkFinalApproveAuthority', () => {
  it('HR covers amounts at and below 50,000', () => {
    expect(checkFinalApproveAuthority('HR', 50000)).toBe('hr');
    expect(checkFinalApproveAuthority('HR', 1)).toBe('hr');
  });

  it('HR does NOT cover amounts above 50,000', () => {
    expect(checkFinalApproveAuthority('HR', 50001)).toBeNull();
  });

  it('GM covers the 50,001–100,000 band only', () => {
    expect(checkFinalApproveAuthority('General Manager', 50001)).toBe('gm');
    expect(checkFinalApproveAuthority('General Manager', 100000)).toBe('gm');
    expect(checkFinalApproveAuthority('General Manager', 50000)).toBeNull(); // below band — HR's, not GM's
    expect(checkFinalApproveAuthority('General Manager', 100001)).toBeNull(); // above band — Chairman's
  });

  it('Chairman/CEO has full authority at any amount', () => {
    expect(checkFinalApproveAuthority('Chairman', 1)).toBe('chairman');
    expect(checkFinalApproveAuthority('Chairman', 100000000)).toBe('chairman');
  });

  it('material requests ignore the cash threshold entirely — any recognized tier covers any amount', () => {
    expect(checkFinalApproveAuthority('HR', 999999999, true)).toBe('hr');
    expect(checkFinalApproveAuthority('General Manager', 1, true)).toBe('gm');
  });

  it('an unrecognized department name has no authority', () => {
    expect(checkFinalApproveAuthority('Marketing', 1000)).toBeNull();
    expect(checkFinalApproveAuthority('', 1000)).toBeNull();
    expect(checkFinalApproveAuthority(undefined, 1000)).toBeNull();
  });

  it('is case-insensitive on department name', () => {
    expect(checkFinalApproveAuthority('chairman', 1)).toBe('chairman');
    expect(checkFinalApproveAuthority('hr department', 100)).toBe('hr');
  });
});

describe('requiredAuthorityTier', () => {
  it('matches the same band boundaries as checkFinalApproveAuthority', () => {
    expect(requiredAuthorityTier(50000)).toBe('hr');
    expect(requiredAuthorityTier(50001)).toBe('gm');
    expect(requiredAuthorityTier(100000)).toBe('gm');
    expect(requiredAuthorityTier(100001)).toBe('chairman');
  });

  it('material requests always resolve to hr, regardless of amount', () => {
    expect(requiredAuthorityTier(999999999, true)).toBe('hr');
  });
});

describe('getEffectiveReqAmount', () => {
  it('prefers ICC override over Audit override and the original amount', () => {
    const req = { amount: 100, hasAuditOverride: true, auditAmount: 200, hasIccOverride: true, iccOverrideAmount: 300 };
    expect(getEffectiveReqAmount(req)).toBe(300);
  });

  it('falls back to Audit override when no ICC override exists', () => {
    const req = { amount: 100, hasAuditOverride: true, auditAmount: 200 };
    expect(getEffectiveReqAmount(req)).toBe(200);
  });

  it('falls back to the original amount when neither override exists', () => {
    expect(getEffectiveReqAmount({ amount: 100 })).toBe(100);
  });

  it('an override flag without its amount field does not get used', () => {
    // This exact gap (flag true, amount field null/undefined) is the kind of half-applied
    // state that caused real bugs this project's history — must not silently return NaN/null.
    expect(getEffectiveReqAmount({ amount: 100, hasIccOverride: true, iccOverrideAmount: null })).toBe(100);
    expect(getEffectiveReqAmount({ amount: 100, hasAuditOverride: true, auditAmount: undefined })).toBe(100);
  });

  it('a missing/null requisition resolves to 0, not NaN', () => {
    expect(getEffectiveReqAmount(null)).toBe(0);
    expect(getEffectiveReqAmount({})).toBe(0);
  });
});

describe('isIccDept', () => {
  it('matches common ICC department name variants', () => {
    expect(isIccDept('ICC')).toBe(true);
    expect(isIccDept('Internal Control and Compliance')).toBe(true);
    expect(isIccDept('internal control & compliance')).toBe(true);
  });

  it('does not match unrelated department names', () => {
    expect(isIccDept('HR')).toBe(false);
    expect(isIccDept('Marketing')).toBe(false);
    expect(isIccDept('')).toBe(false);
    expect(isIccDept(undefined)).toBe(false);
  });
});

describe('subPrivilegeCoversCash', () => {
  it('covers the amount when within the sub-account privilege limit', () => {
    expect(subPrivilegeCoversCash({ isSubAccount: true, privilegeAmount: '50000' }, 40000)).toBe(true);
    expect(subPrivilegeCoversCash({ isSubAccount: true, privilegeAmount: '50000' }, 50000)).toBe(true);
  });

  it('does not cover amounts over the limit', () => {
    expect(subPrivilegeCoversCash({ isSubAccount: true, privilegeAmount: '50000' }, 50001)).toBe(false);
  });

  it('never covers anything for a non-sub-account user, regardless of privilegeAmount', () => {
    expect(subPrivilegeCoversCash({ isSubAccount: false, privilegeAmount: '999999' }, 1)).toBe(false);
  });

  it('an invalid/missing privilegeAmount never covers anything', () => {
    expect(subPrivilegeCoversCash({ isSubAccount: true, privilegeAmount: null }, 1)).toBe(false);
    expect(subPrivilegeCoversCash({ isSubAccount: true }, 1)).toBe(false);
  });
});

describe('getFixedDefaultAccessCode', () => {
  it('falls back to the hardcoded default when the env var is unset', () => {
    expect(getFixedDefaultAccessCode('General Manager (GM)', {})).toBe('GM-2026');
    expect(getFixedDefaultAccessCode('CEO (Chairman)', {})).toBe('CEO-2026');
    expect(getFixedDefaultAccessCode('Internal consult and control (ICC)', {})).toBe('ICC-2026');
    expect(getFixedDefaultAccessCode('Audit', {})).toBe('AUDIT-2026');
  });

  it('prefers the env var over the hardcoded default when set', () => {
    expect(getFixedDefaultAccessCode('Audit', { AUDIT_ACCESS_CODE: 'CUSTOM-1' })).toBe('CUSTOM-1');
    expect(getFixedDefaultAccessCode('General Manager (GM)', { GM_ACCESS_CODE: 'CUSTOM-2' })).toBe('CUSTOM-2');
  });

  it('returns null for departments with no fixed default, so they get a random code instead', () => {
    expect(getFixedDefaultAccessCode('Hydroponics', {})).toBeNull();
    expect(getFixedDefaultAccessCode('ICT', {})).toBeNull();
    expect(getFixedDefaultAccessCode('', {})).toBeNull();
  });
});

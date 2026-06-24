import { describe, it, expect } from 'vitest';
import { normalizeReq, getEffectiveAmount, getLiveTrailDepartment } from './requisitionDisplay';

describe('normalizeReq', () => {
  it('flattens a department object to its name', () => {
    expect(normalizeReq({ department: { name: 'ICT' } }).department).toBe('ICT');
  });

  it('passes through an already-flattened department string unchanged', () => {
    expect(normalizeReq({ department: 'ICT' }).department).toBe('ICT');
  });

  it('falls back to departmentName when department is missing entirely', () => {
    expect(normalizeReq({ departmentName: 'ICT' }).department).toBe('ICT');
  });

  it('derives finalState from finalApprovalStatus, defaulting to none', () => {
    expect(normalizeReq({ finalApprovalStatus: 'vetting' }).finalState).toBe('vetting');
    expect(normalizeReq({}).finalState).toBe('none');
  });

  it('carries the sub-account fields the Dashboard copy used to be missing', () => {
    const out = normalizeReq({ department: { name: 'Sub Unit', isSubAccount: true, headName: 'Jane', parent: { name: 'ICT' } } });
    expect(out.isFromSubAccount).toBe(true);
    expect(out.deptHeadName).toBe('Jane');
    expect(out.parentDeptName).toBe('ICT');
  });
});

describe('getEffectiveAmount', () => {
  it('prefers ICC override over Audit override and the original amount', () => {
    const eff = getEffectiveAmount({ amount: 100, hasAuditOverride: true, auditAmount: 200, hasIccOverride: true, iccOverrideAmount: 300 });
    expect(eff.amount).toBe(300);
    expect(eff.source).toBe('icc');
  });

  it("when ICC overrides on top of an existing Audit override, supersededAmount is Audit's figure, not the true original", () => {
    const eff = getEffectiveAmount({ amount: 100, hasAuditOverride: true, auditAmount: 200, hasIccOverride: true, iccOverrideAmount: 300 });
    expect(eff.supersededAmount).toBe(200);
    expect(eff.originalAmount).toBe(100); // but originalAmount always stays the true original
  });

  it('falls back to Audit override when no ICC override exists', () => {
    const eff = getEffectiveAmount({ amount: 100, hasAuditOverride: true, auditAmount: 200 });
    expect(eff.amount).toBe(200);
    expect(eff.source).toBe('audit');
    expect(eff.supersededAmount).toBe(100);
  });

  it('falls back to the raw amount when neither override exists', () => {
    const eff = getEffectiveAmount({ amount: 100 });
    expect(eff.amount).toBe(100);
    expect(eff.source).toBeNull();
    expect(eff.label).toBe('Total Amount');
  });

  it('an override flag without its amount field does not get used', () => {
    const eff = getEffectiveAmount({ amount: 100, hasIccOverride: true, iccOverrideAmount: null });
    expect(eff.amount).toBe(100);
    expect(eff.source).toBeNull();
  });

  it('a missing/undefined requisition resolves to 0, not NaN', () => {
    expect(getEffectiveAmount(undefined).amount).toBe(0);
    expect(getEffectiveAmount({}).amount).toBe(0);
  });
});

describe('getLiveTrailDepartment', () => {
  const departments = [
    { id: 1, name: 'ICT' },
    { id: 2, name: 'Account' },
    { id: 3, name: 'ICC' },
  ];

  it('prefers the live vetting department over the frozen forwarding target while a detour is active', () => {
    const req = { currentVettingDeptId: 3, targetDepartment: { name: 'Account' }, finalApprovalStatus: 'vetting' };
    expect(getLiveTrailDepartment(req, departments).name).toBe('ICC');
  });

  it('falls back to targetDepartment once there is no active vetting detour', () => {
    const req = { currentVettingDeptId: null, targetDepartment: { name: 'Account' }, finalApprovalStatus: 'pending' };
    expect(getLiveTrailDepartment(req, departments).name).toBe('Account');
  });

  it('falls back to targetDepartment once the record is settled (treated/published), even if a stale currentVettingDeptId lingers', () => {
    const req = { currentVettingDeptId: 3, targetDepartment: { name: 'Account' }, finalApprovalStatus: 'treated' };
    expect(getLiveTrailDepartment(req, departments).name).toBe('Account');
  });

  it('returns null when there is no trail department to show at all', () => {
    expect(getLiveTrailDepartment({}, departments)).toBeNull();
  });
});

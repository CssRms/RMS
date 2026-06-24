// Shared display logic for requisitions — the amount and "where is it right now" rules
// here were previously copy-pasted independently into the Requisitions list table, the
// Requisitions detail modal, and two separate spots in the Dashboard. Each copy needed
// its own bugfix for what was conceptually the same bug. Import from here instead of
// re-deriving these values inline — if the business rule ever changes, it changes once.

// Flattens a few API-shape fields (department/creator objects → display strings) and
// derives finalState. This used to be defined separately in RequisitionsPage.jsx and
// Dashboard.jsx — the two copies had already drifted (RequisitionsPage's had four extra
// fields Dashboard's lacked). Unified here; the extra fields are harmless additions for
// any caller that doesn't use them.
export function normalizeReq(r) {
  return {
    ...r,
    department:           r.department?.name ?? r.department ?? r.departmentName ?? '',
    isFromSubAccount:     r.isFromSubAccount ?? (r.department?.isSubAccount === true),
    deptHeadName:         r.deptHeadName ?? r.department?.headName ?? '',
    parentDeptName:       r.parentDeptName ?? r.department?.parent?.name ?? '',
    visibleToSubAccounts: r.visibleToSubAccounts ?? false,
    creator:              r.creator?.name ?? r.creator ?? r.creatorName ?? '',
    currentStageName:     r.currentStage?.name ?? '',
    finalState:           r.finalApprovalStatus ?? 'none',
  };
}

// ICC's post-approval price verification takes priority over Audit's earlier pre-approval
// override (ICC acts later in the real-world process), matching the precedence used in
// the PDF generator (serve.js) and everywhere else this is computed.
export function getEffectiveAmount(req) {
  const hasIcc = !!req?.hasIccOverride && req?.iccOverrideAmount != null;
  const hasAudit = !!req?.hasAuditOverride && req?.auditAmount != null;
  const originalAmount = Number(req?.amount || 0);

  if (hasIcc) {
    return {
      amount: Number(req.iccOverrideAmount),
      // supersededAmount: the immediately-prior figure (Audit's, if Audit also overrode it
      // before ICC did, else the true original) — what the list table's strikethrough shows.
      supersededAmount: hasAudit ? Number(req.auditAmount) : originalAmount,
      // originalAmount: the true creator-entered amount, regardless of how many override
      // hops happened since — what the detail modal's "Originally:" line shows.
      originalAmount,
      source: 'icc',
      label: 'ICC Verified Amount',
    };
  }
  if (hasAudit) {
    return {
      amount: Number(req.auditAmount),
      supersededAmount: originalAmount,
      originalAmount,
      source: 'audit',
      label: 'Audit Verified Amount',
    };
  }
  return { amount: originalAmount, supersededAmount: null, originalAmount: null, source: null, label: 'Total Amount' };
}

// During an ICC/Audit vetting detour, currentVettingDeptId tracks the requisition's real
// live location. targetDepartmentId freezes at whatever it was forwarded to *before* the
// detour started, so it goes stale the moment a detour begins — only fall back to it once
// there's no active detour, or once the record has been treated/published (settled).
export function getLiveTrailDepartment(req, departments) {
  const cvId = req?.currentVettingDeptId ? parseInt(req.currentVettingDeptId, 10) : null;
  const isSettled = req?.finalApprovalStatus === 'treated' || req?.finalApprovalStatus === 'published';
  if (cvId && !isSettled) {
    const liveDept = (departments || []).find(d => d.id === cvId);
    if (liveDept) return liveDept;
  }
  return req?.targetDepartment || null;
}

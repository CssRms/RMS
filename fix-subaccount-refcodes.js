/**
 * One-time migration: fix reference codes for requisitions created by sub-accounts.
 *
 * Old format:  CSSG/D/FR/14062026/01       (used sub-account's own code)
 * New format:  CSSG/ICT[DAV]/FR/14062026/01 (parent code + sub-account code in brackets)
 *
 * Run with:  node fix-subaccount-refcodes.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const deriveCode = (name) => {
  const words = (name || '').trim().split(/[\s&\/,\-]+/).filter(w => w.length > 1);
  if (!words.length) return (name || 'UNK').slice(0, 4).toUpperCase();
  return words.map(w => w[0]).join('').toUpperCase().slice(0, 6);
};

async function main() {
  // Fetch all non-draft requisitions created by a Sub-Account department
  const reqs = await prisma.requisition.findMany({
    where: {
      refCode: { not: null },
      department: { type: 'Sub-Account' },
    },
    select: {
      id: true,
      refCode: true,
      department: {
        select: {
          id: true,
          name: true,
          code: true,
          parentId: true,
        },
      },
    },
  });

  console.log(`Found ${reqs.length} sub-account requisition(s) to check.\n`);

  // Cache parent dept lookups so we don't hit the DB repeatedly
  const parentCache = {};

  let updated = 0;
  let skipped = 0;

  for (const req of reqs) {
    const dept = req.department;
    if (!dept?.parentId) { skipped++; continue; }

    // Fetch parent dept (cached)
    if (!parentCache[dept.parentId]) {
      parentCache[dept.parentId] = await prisma.department.findUnique({
        where: { id: dept.parentId },
        select: { name: true, code: true },
      });
    }
    const parent = parentCache[dept.parentId];
    if (!parent) { skipped++; continue; }

    const parentCode = parent.code || deriveCode(parent.name);
    const subCode    = dept.code   || deriveCode(dept.name);
    const correctDeptSegment = `${parentCode}[${subCode}]`;

    // Parse existing refCode: ORGPREFIX/DEPTCODE/TYPECODE/DATE/SEQ
    const parts = (req.refCode || '').split('/');
    if (parts.length < 5) { skipped++; continue; }

    // If it already has the bracket format, skip
    if (parts[1].includes('[')) {
      console.log(`  #${req.id} already correct: ${req.refCode}`);
      skipped++;
      continue;
    }

    // Rebuild: replace only the dept-code segment (index 1)
    parts[1] = correctDeptSegment;
    const newRefCode = parts.join('/');

    await prisma.requisition.update({
      where: { id: req.id },
      data: { refCode: newRefCode },
    });

    console.log(`  #${req.id}  ${req.refCode}  →  ${newRefCode}`);
    updated++;
  }

  console.log(`\nDone. Updated: ${updated}  |  Skipped: ${skipped}`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

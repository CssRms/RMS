-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "public"."ActivityLog" (
    "id" SERIAL NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "userId" INTEGER,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Approval" (
    "id" SERIAL NOT NULL,
    "requisitionId" INTEGER NOT NULL,
    "stageId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "remarks" TEXT,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Approval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Attachment" (
    "id" SERIAL NOT NULL,
    "filename" TEXT NOT NULL,
    "path" TEXT,
    "fileType" TEXT,
    "requisitionId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mimeType" TEXT,
    "size" INTEGER,
    "storageKey" TEXT,
    "uploadedById" INTEGER,
    "stageName" TEXT,
    "stageKey" TEXT,
    "uploaderDept" TEXT,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ChatMessage" (
    "id" SERIAL NOT NULL,
    "fromDeptId" INTEGER NOT NULL,
    "toDeptId" INTEGER,
    "body" TEXT NOT NULL DEFAULT '',
    "readBy" INTEGER[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mediaKey" TEXT,
    "mediaMime" TEXT,
    "mediaName" TEXT,
    "mediaType" TEXT,
    "editedAt" TIMESTAMP(3),
    "replyToId" INTEGER,
    "reqRef" TEXT,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DeletedRecord" (
    "id" SERIAL NOT NULL,
    "originalId" INTEGER NOT NULL,
    "recordType" TEXT NOT NULL,
    "title" TEXT,
    "departmentId" INTEGER,
    "departmentName" TEXT,
    "deletedByName" TEXT,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "snapshot" JSONB NOT NULL,

    CONSTRAINT "DeletedRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Department" (
    "id" SERIAL NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'Operational',
    "accessCode" TEXT,
    "parentId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "accessCodeHash" TEXT,
    "accessCodeLabel" TEXT,
    "headEmail" TEXT,
    "headName" TEXT,
    "headTitle" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "codeChangedByDept" BOOLEAN NOT NULL DEFAULT false,
    "canPrint" BOOLEAN NOT NULL DEFAULT true,
    "createdByDeptId" INTEGER,
    "isDisabled" BOOLEAN NOT NULL DEFAULT false,
    "isSubAccount" BOOLEAN NOT NULL DEFAULT false,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "privilegeAmount" DOUBLE PRECISION,
    "memoPrivilege" BOOLEAN NOT NULL DEFAULT false,
    "materialPrivilege" BOOLEAN NOT NULL DEFAULT false,
    "cashPrivilege" BOOLEAN NOT NULL DEFAULT false,
    "subAccountAutoRoute" BOOLEAN NOT NULL DEFAULT true,
    "allowedRouteDeptIds" TEXT,
    "directRoute" BOOLEAN NOT NULL DEFAULT false,
    "approvalLimit" DOUBLE PRECISION,
    "staffId" TEXT,
    "isActingHeadCandidate" BOOLEAN NOT NULL DEFAULT false,
    "preElevationPrivileges" TEXT,
    "seniorityRank" INTEGER,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DepartmentKey" (
    "id" SERIAL NOT NULL,
    "departmentId" INTEGER NOT NULL,
    "publicKeyId" INTEGER NOT NULL,
    "privateKeyEnc" TEXT NOT NULL,
    "algorithm" TEXT NOT NULL DEFAULT 'Ed25519',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DepartmentKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DepartmentStamp" (
    "id" SERIAL NOT NULL,
    "departmentId" INTEGER NOT NULL,
    "imageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DepartmentStamp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FileAccessLog" (
    "id" SERIAL NOT NULL,
    "attachmentId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "action" TEXT NOT NULL DEFAULT 'VIEW',

    CONSTRAINT "FileAccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ForwardEvent" (
    "id" SERIAL NOT NULL,
    "requisitionId" INTEGER NOT NULL,
    "fromDeptId" INTEGER NOT NULL,
    "toDeptId" INTEGER,
    "action" TEXT NOT NULL,
    "note" TEXT,
    "actorName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ForwardEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Memo" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "creatorId" INTEGER NOT NULL,
    "departmentId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Memo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Notification" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "content" TEXT NOT NULL,
    "link" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "departmentId" INTEGER,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PublicKey" (
    "id" SERIAL NOT NULL,
    "kid" TEXT NOT NULL,
    "algorithm" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublicKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PushSubscription" (
    "id" SERIAL NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "deptId" INTEGER,
    "userId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Requisition" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DOUBLE PRECISION,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "creatorId" INTEGER NOT NULL,
    "departmentId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "content" TEXT,
    "approvedAt" TIMESTAMP(3),
    "clientId" TEXT,
    "currentStageId" INTEGER,
    "lastActionAt" TIMESTAMP(3),
    "lastActionById" INTEGER,
    "rejectedAt" TIMESTAMP(3),
    "signedPdfHash" TEXT,
    "signedPdfKey" TEXT,
    "urgency" TEXT NOT NULL DEFAULT 'normal',
    "forwardNote" TEXT,
    "targetDepartmentId" INTEGER,
    "currentVettingDeptId" INTEGER,
    "finalApprovalStatus" TEXT DEFAULT 'none',
    "finalApprovedAt" TIMESTAMP(3),
    "finalApprovedByDeptId" INTEGER,
    "finalApprovedNote" TEXT,
    "treatedAt" TIMESTAMP(3),
    "treatedByDeptId" INTEGER,
    "publishEndAt" TIMESTAMP(3),
    "publishStartAt" TIMESTAMP(3),
    "amountDisbursed" DOUBLE PRECISION,
    "treatmentReason" TEXT,
    "treatmentType" TEXT,
    "isKIV" BOOLEAN NOT NULL DEFAULT false,
    "kivAt" TIMESTAMP(3),
    "kivByName" TEXT,
    "kivNote" TEXT,
    "visibleToSubAccounts" BOOLEAN NOT NULL DEFAULT false,
    "auditAmount" DOUBLE PRECISION,
    "auditContent" TEXT,
    "auditDeptId" INTEGER,
    "auditDeptName" TEXT,
    "hasAuditOverride" BOOLEAN NOT NULL DEFAULT false,
    "iccFreezeAt" TIMESTAMP(3),
    "iccFreezeBy" TEXT,
    "iccFreezeNote" TEXT,
    "iccFrozen" BOOLEAN NOT NULL DEFAULT false,
    "privilegeAmount" DOUBLE PRECISION,
    "materialPrivilege" BOOLEAN NOT NULL DEFAULT false,
    "memoPrivilege" BOOLEAN NOT NULL DEFAULT false,
    "refCode" TEXT,
    "hasIccOverride" BOOLEAN NOT NULL DEFAULT false,
    "iccOverrideAmount" DOUBLE PRECISION,
    "iccOverrideContent" TEXT,
    "iccOverrideDeptName" TEXT,
    "iccVettingAt" TIMESTAMP(3),
    "iccVettingByDeptId" INTEGER,
    "iccVettingCleared" BOOLEAN NOT NULL DEFAULT false,
    "iccVettingNote" TEXT,
    "iccForwardedFromDeptId" INTEGER,
    "needsReapproval" BOOLEAN NOT NULL DEFAULT false,
    "reapprovalAuthority" TEXT,
    "reapprovalReason" TEXT,
    "reapprovedAt" TIMESTAMP(3),
    "reapprovedByDeptId" INTEGER,
    "reapprovalForwardedFromDeptId" INTEGER,
    "reapprovedAmount" DOUBLE PRECISION,

    CONSTRAINT "Requisition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RequisitionSubVisibility" (
    "requisitionId" INTEGER NOT NULL,
    "subAccountId" INTEGER NOT NULL,

    CONSTRAINT "RequisitionSubVisibility_pkey" PRIMARY KEY ("requisitionId","subAccountId")
);

-- CreateTable
CREATE TABLE "public"."RequisitionTag" (
    "id" SERIAL NOT NULL,
    "requisitionId" INTEGER NOT NULL,
    "deptId" INTEGER NOT NULL,
    "taggedByDeptId" INTEGER,
    "taggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequisitionTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RequisitionType" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequisitionType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SignatureRecord" (
    "id" SERIAL NOT NULL,
    "approvalId" INTEGER NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "verificationCode" TEXT NOT NULL,
    "publicKeyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignatureRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StoreRecord" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "location" TEXT,
    "carriedForward" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "departmentId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StoreRecordEntry" (
    "id" SERIAL NOT NULL,
    "storeRecordId" INTEGER NOT NULL,
    "sequence" INTEGER NOT NULL,
    "date" TEXT,
    "openingBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "qtyReceived" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "quantityIssued" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "requisitionSlipNo" TEXT,
    "stockBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "materialsTaken" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreRecordEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SystemSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "public"."User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'staff',
    "departmentId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mfaSecret" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserSignature" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "imageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSignature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."VettingEvent" (
    "id" SERIAL NOT NULL,
    "requisitionId" INTEGER NOT NULL,
    "deptId" INTEGER NOT NULL,
    "deptName" TEXT,
    "action" TEXT NOT NULL,
    "comment" TEXT,
    "attachmentKey" TEXT,
    "attachmentName" TEXT,
    "actorName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vetted" BOOLEAN NOT NULL DEFAULT false,
    "amountDisbursed" DOUBLE PRECISION,
    "treatmentReason" TEXT,
    "treatmentType" TEXT,

    CONSTRAINT "VettingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WorkflowStage" (
    "id" SERIAL NOT NULL,
    "sequence" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowStage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Department_code_key" ON "public"."Department"("code" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Department_name_key" ON "public"."Department"("name" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Department_staffId_key" ON "public"."Department"("staffId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "DepartmentKey_departmentId_key" ON "public"."DepartmentKey"("departmentId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "DepartmentStamp_departmentId_key" ON "public"."DepartmentStamp"("departmentId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "PublicKey_kid_key" ON "public"."PublicKey"("kid" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "public"."PushSubscription"("endpoint" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Requisition_clientId_key" ON "public"."Requisition"("clientId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "RequisitionTag_requisitionId_deptId_key" ON "public"."RequisitionTag"("requisitionId" ASC, "deptId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "RequisitionType_name_key" ON "public"."RequisitionType"("name" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "SignatureRecord_approvalId_key" ON "public"."SignatureRecord"("approvalId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "SignatureRecord_verificationCode_key" ON "public"."SignatureRecord"("verificationCode" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "UserSignature_userId_key" ON "public"."UserSignature"("userId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowStage_sequence_key" ON "public"."WorkflowStage"("sequence" ASC);

-- AddForeignKey
ALTER TABLE "public"."ActivityLog" ADD CONSTRAINT "ActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Approval" ADD CONSTRAINT "Approval_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "public"."Requisition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Approval" ADD CONSTRAINT "Approval_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "public"."WorkflowStage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Approval" ADD CONSTRAINT "Approval_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Attachment" ADD CONSTRAINT "Attachment_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "public"."Requisition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Attachment" ADD CONSTRAINT "Attachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ChatMessage" ADD CONSTRAINT "ChatMessage_fromDeptId_fkey" FOREIGN KEY ("fromDeptId") REFERENCES "public"."Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ChatMessage" ADD CONSTRAINT "ChatMessage_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "public"."ChatMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ChatMessage" ADD CONSTRAINT "ChatMessage_toDeptId_fkey" FOREIGN KEY ("toDeptId") REFERENCES "public"."Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Department" ADD CONSTRAINT "Department_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "public"."Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DepartmentKey" ADD CONSTRAINT "DepartmentKey_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "public"."Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DepartmentKey" ADD CONSTRAINT "DepartmentKey_publicKeyId_fkey" FOREIGN KEY ("publicKeyId") REFERENCES "public"."PublicKey"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DepartmentStamp" ADD CONSTRAINT "DepartmentStamp_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "public"."Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FileAccessLog" ADD CONSTRAINT "FileAccessLog_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES "public"."Attachment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FileAccessLog" ADD CONSTRAINT "FileAccessLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ForwardEvent" ADD CONSTRAINT "ForwardEvent_fromDeptId_fkey" FOREIGN KEY ("fromDeptId") REFERENCES "public"."Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ForwardEvent" ADD CONSTRAINT "ForwardEvent_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "public"."Requisition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ForwardEvent" ADD CONSTRAINT "ForwardEvent_toDeptId_fkey" FOREIGN KEY ("toDeptId") REFERENCES "public"."Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Memo" ADD CONSTRAINT "Memo_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Memo" ADD CONSTRAINT "Memo_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "public"."Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Notification" ADD CONSTRAINT "Notification_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "public"."Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Requisition" ADD CONSTRAINT "Requisition_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Requisition" ADD CONSTRAINT "Requisition_currentStageId_fkey" FOREIGN KEY ("currentStageId") REFERENCES "public"."WorkflowStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Requisition" ADD CONSTRAINT "Requisition_currentVettingDeptId_fkey" FOREIGN KEY ("currentVettingDeptId") REFERENCES "public"."Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Requisition" ADD CONSTRAINT "Requisition_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "public"."Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Requisition" ADD CONSTRAINT "Requisition_finalApprovedByDeptId_fkey" FOREIGN KEY ("finalApprovedByDeptId") REFERENCES "public"."Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Requisition" ADD CONSTRAINT "Requisition_lastActionById_fkey" FOREIGN KEY ("lastActionById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Requisition" ADD CONSTRAINT "Requisition_reapprovedByDeptId_fkey" FOREIGN KEY ("reapprovedByDeptId") REFERENCES "public"."Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Requisition" ADD CONSTRAINT "Requisition_targetDepartmentId_fkey" FOREIGN KEY ("targetDepartmentId") REFERENCES "public"."Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Requisition" ADD CONSTRAINT "Requisition_treatedByDeptId_fkey" FOREIGN KEY ("treatedByDeptId") REFERENCES "public"."Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RequisitionSubVisibility" ADD CONSTRAINT "RequisitionSubVisibility_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "public"."Requisition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RequisitionSubVisibility" ADD CONSTRAINT "RequisitionSubVisibility_subAccountId_fkey" FOREIGN KEY ("subAccountId") REFERENCES "public"."Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RequisitionTag" ADD CONSTRAINT "RequisitionTag_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "public"."Requisition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SignatureRecord" ADD CONSTRAINT "SignatureRecord_approvalId_fkey" FOREIGN KEY ("approvalId") REFERENCES "public"."Approval"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SignatureRecord" ADD CONSTRAINT "SignatureRecord_publicKeyId_fkey" FOREIGN KEY ("publicKeyId") REFERENCES "public"."PublicKey"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StoreRecord" ADD CONSTRAINT "StoreRecord_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "public"."Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StoreRecordEntry" ADD CONSTRAINT "StoreRecordEntry_storeRecordId_fkey" FOREIGN KEY ("storeRecordId") REFERENCES "public"."StoreRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "public"."Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserSignature" ADD CONSTRAINT "UserSignature_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."VettingEvent" ADD CONSTRAINT "VettingEvent_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "public"."Requisition"("id") ON DELETE CASCADE ON UPDATE CASCADE;


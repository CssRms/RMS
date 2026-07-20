-- CreateTable
CREATE TABLE "HREmployee" (
    "id" SERIAL NOT NULL,
    "staffId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "otherName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "department" TEXT,
    "position" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "photoKey" TEXT,
    "joinDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HREmployee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZKAttendancePunch" (
    "id" SERIAL NOT NULL,
    "staffId" TEXT NOT NULL,
    "punchTime" TIMESTAMP(3) NOT NULL,
    "punchType" INTEGER NOT NULL DEFAULT 0,
    "verifyType" INTEGER NOT NULL DEFAULT 1,
    "deviceSerial" TEXT,
    "source" TEXT NOT NULL DEFAULT 'adms',
    "isDuplicate" BOOLEAN NOT NULL DEFAULT false,
    "isFlagged" BOOLEAN NOT NULL DEFAULT false,
    "flagReason" TEXT,

    CONSTRAINT "ZKAttendancePunch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HRAttendanceRecord" (
    "id" SERIAL NOT NULL,
    "staffId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "firstPunch" TIMESTAMP(3),
    "lastPunch" TIMESTAMP(3),
    "punchCount" INTEGER NOT NULL DEFAULT 0,
    "isPresent" BOOLEAN NOT NULL DEFAULT false,
    "hoursWorked" DOUBLE PRECISION,
    "isFlagged" BOOLEAN NOT NULL DEFAULT false,
    "flagReason" TEXT,
    "manualStatus" TEXT,
    "manualNote" TEXT,
    "manualBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HRAttendanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HREmployee_staffId_key" ON "HREmployee"("staffId");

-- CreateIndex
CREATE UNIQUE INDEX "ZKAttendancePunch_staffId_punchTime_key" ON "ZKAttendancePunch"("staffId", "punchTime");

-- CreateIndex
CREATE INDEX "ZKAttendancePunch_staffId_punchTime_idx" ON "ZKAttendancePunch"("staffId", "punchTime");

-- CreateIndex
CREATE INDEX "ZKAttendancePunch_punchTime_idx" ON "ZKAttendancePunch"("punchTime");

-- CreateIndex
CREATE UNIQUE INDEX "HRAttendanceRecord_staffId_date_key" ON "HRAttendanceRecord"("staffId", "date");

-- CreateIndex
CREATE INDEX "HRAttendanceRecord_date_idx" ON "HRAttendanceRecord"("date");

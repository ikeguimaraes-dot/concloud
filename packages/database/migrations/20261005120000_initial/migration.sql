-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "concloud";

-- CreateEnum
CREATE TYPE "concloud"."Role" AS ENUM ('SUPER_ADMIN', 'ORG_ADMIN', 'ACCOUNTANT', 'ASSISTANT', 'CLIENT_OWNER', 'CLIENT_MEMBER');

-- CreateEnum
CREATE TYPE "concloud"."ClosingState" AS ENUM ('AWAITING_INFORMATION', 'UNDER_REVIEW', 'READY_FOR_PROCESSING', 'PROCESSING_EXTERNALLY', 'QUALITY_REVIEW', 'DELIVERED', 'CLOSED');

-- CreateTable
CREATE TABLE "concloud"."Profile" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concloud"."Organization" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "retentionDays" INTEGER NOT NULL DEFAULT 1825,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concloud"."OrganizationMembership" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "concloud"."Role" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "OrganizationMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concloud"."Company" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "accountingSystemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concloud"."CompanyMembership" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "concloud"."Role" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "CompanyMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concloud"."Invitation" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "role" "concloud"."Role" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdBy" UUID NOT NULL,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concloud"."CompanyPartner" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "document" TEXT NOT NULL,
    "share" DECIMAL(7,4) NOT NULL,

    CONSTRAINT "CompanyPartner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concloud"."CompanyTaxProfileHistory" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "regime" TEXT NOT NULL,
    "validFrom" DATE NOT NULL,
    "validTo" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "CompanyTaxProfileHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concloud"."OnboardingItem" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "completedBy" UUID,

    CONSTRAINT "OnboardingItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concloud"."Contact" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "document" TEXT,
    "kind" TEXT NOT NULL,
    "email" TEXT,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concloud"."BankAccount" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "openingBalance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "BankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concloud"."FinancialCategory" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,

    CONSTRAINT "FinancialCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concloud"."CostCenter" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "CostCenter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concloud"."FinancialTitle" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "contactId" UUID,
    "categoryId" UUID,
    "costCenterId" UUID,
    "issueDate" DATE NOT NULL,
    "competence" DATE NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "recurrenceKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialTitle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concloud"."Installment" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "titleId" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "dueDate" DATE NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "Installment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concloud"."Settlement" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "installmentId" UUID NOT NULL,
    "bankAccountId" UUID NOT NULL,
    "principal" DECIMAL(18,2) NOT NULL,
    "interest" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "fine" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "paidAt" DATE NOT NULL,
    "reversedAt" TIMESTAMP(3),
    "reversalReason" TEXT,
    "idempotencyKey" TEXT NOT NULL,

    CONSTRAINT "Settlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concloud"."Transfer" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "sourceId" UUID NOT NULL,
    "targetId" UUID NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "date" DATE NOT NULL,
    "idempotencyKey" TEXT NOT NULL,

    CONSTRAINT "Transfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concloud"."RecurrenceRule" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "startMonth" TEXT NOT NULL,
    "endMonth" TEXT,
    "day" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "RecurrenceRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concloud"."BankImport" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "bankAccountId" UUID NOT NULL,
    "filename" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concloud"."BankTransaction" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "importId" UUID NOT NULL,
    "bankAccountId" UUID NOT NULL,
    "externalId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "BankTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concloud"."Reconciliation" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "transactionId" UUID NOT NULL,
    "settlementId" UUID NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reversedAt" TIMESTAMP(3),
    "reversalReason" TEXT,

    CONSTRAINT "Reconciliation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concloud"."Document" (
    "uploadedBy" UUID NOT NULL,
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "competence" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'INTERNAL',
    "classification" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concloud"."DocumentVersion" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "bucket" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concloud"."DocumentRequest" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "competence" TEXT NOT NULL,
    "dueDate" DATE NOT NULL,
    "fulfilledByDocumentId" UUID,

    CONSTRAINT "DocumentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concloud"."AccountingPeriod" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "competence" TEXT NOT NULL,
    "state" "concloud"."ClosingState" NOT NULL DEFAULT 'AWAITING_INFORMATION',
    "responsibleId" UUID NOT NULL,
    "reviewerId" UUID NOT NULL,
    "dueDate" DATE NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "exportedRevision" INTEGER,

    CONSTRAINT "AccountingPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concloud"."ClosingTask" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "periodId" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "completedAt" TIMESTAMP(3),
    "comment" TEXT,

    CONSTRAINT "ClosingTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concloud"."ClosingTransition" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "periodId" UUID NOT NULL,
    "fromState" "concloud"."ClosingState" NOT NULL,
    "toState" "concloud"."ClosingState" NOT NULL,
    "reason" TEXT NOT NULL,
    "actorId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClosingTransition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concloud"."ExportBatch" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "periodId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "revision" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "manifest" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "objectKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concloud"."ProcessingBatch" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "exportBatchId" UUID NOT NULL,
    "operatorId" UUID NOT NULL,
    "protocol" TEXT NOT NULL,
    "resultDocumentId" UUID NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessingBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concloud"."Review" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "periodId" UUID NOT NULL,
    "exportBatchId" UUID NOT NULL,
    "reviewerId" UUID NOT NULL,
    "approved" BOOLEAN NOT NULL,
    "notes" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concloud"."TaxObligation" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "competence" TEXT NOT NULL,
    "dueDate" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "TaxObligation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concloud"."TaxGuide" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "obligationId" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "dueDate" DATE NOT NULL,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "TaxGuide_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concloud"."TaxPayment" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "guideId" UUID NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "paidAt" DATE NOT NULL,
    "proofDocumentId" UUID,
    "status" TEXT NOT NULL DEFAULT 'REPORTED',
    "verifiedBy" UUID,
    "verifiedAt" TIMESTAMP(3),

    CONSTRAINT "TaxPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concloud"."FilingReceipt" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "obligationId" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "protocol" TEXT NOT NULL,

    CONSTRAINT "FilingReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concloud"."Ticket" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "subject" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concloud"."TicketMessage" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "ticketId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concloud"."AuditEvent" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concloud"."IntegrationConnection" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DISABLED',
    "externalId" TEXT,

    CONSTRAINT "IntegrationConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concloud"."ExternalReference" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,

    CONSTRAINT "ExternalReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concloud"."OutboxEvent" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enqueuedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concloud"."WebhookEvent" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concloud"."SyncRun" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "error" TEXT,

    CONSTRAINT "SyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concloud"."AiInsight" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "sources" JSONB NOT NULL,
    "model" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "approvedBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiInsight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concloud"."ServicePlan" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "features" JSONB NOT NULL,
    "monthlyFee" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "ServicePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concloud"."CompanyServiceAgreement" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "validFrom" DATE NOT NULL,
    "validTo" TIMESTAMP(3),

    CONSTRAINT "CompanyServiceAgreement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Profile_email_key" ON "concloud"."Profile"("email");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMembership_organizationId_userId_key" ON "concloud"."OrganizationMembership"("organizationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Company_organizationId_id_key" ON "concloud"."Company"("organizationId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Company_organizationId_cnpj_key" ON "concloud"."Company"("organizationId", "cnpj");

-- CreateIndex
CREATE INDEX "CompanyMembership_companyId_idx" ON "concloud"."CompanyMembership"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyMembership_companyId_userId_key" ON "concloud"."CompanyMembership"("companyId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyMembership_organizationId_companyId_id_key" ON "concloud"."CompanyMembership"("organizationId", "companyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_tokenHash_key" ON "concloud"."Invitation"("tokenHash");

-- CreateIndex
CREATE INDEX "Invitation_companyId_idx" ON "concloud"."Invitation"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_organizationId_companyId_id_key" ON "concloud"."Invitation"("organizationId", "companyId", "id");

-- CreateIndex
CREATE INDEX "CompanyPartner_companyId_idx" ON "concloud"."CompanyPartner"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyPartner_organizationId_companyId_id_key" ON "concloud"."CompanyPartner"("organizationId", "companyId", "id");

-- CreateIndex
CREATE INDEX "CompanyTaxProfileHistory_companyId_idx" ON "concloud"."CompanyTaxProfileHistory"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyTaxProfileHistory_companyId_validFrom_key" ON "concloud"."CompanyTaxProfileHistory"("companyId", "validFrom");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyTaxProfileHistory_organizationId_companyId_id_key" ON "concloud"."CompanyTaxProfileHistory"("organizationId", "companyId", "id");

-- CreateIndex
CREATE INDEX "OnboardingItem_companyId_idx" ON "concloud"."OnboardingItem"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingItem_companyId_label_key" ON "concloud"."OnboardingItem"("companyId", "label");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingItem_organizationId_companyId_id_key" ON "concloud"."OnboardingItem"("organizationId", "companyId", "id");

-- CreateIndex
CREATE INDEX "Contact_companyId_idx" ON "concloud"."Contact"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_organizationId_companyId_id_key" ON "concloud"."Contact"("organizationId", "companyId", "id");

-- CreateIndex
CREATE INDEX "BankAccount_companyId_idx" ON "concloud"."BankAccount"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "BankAccount_organizationId_companyId_id_key" ON "concloud"."BankAccount"("organizationId", "companyId", "id");

-- CreateIndex
CREATE INDEX "FinancialCategory_companyId_idx" ON "concloud"."FinancialCategory"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialCategory_companyId_name_key" ON "concloud"."FinancialCategory"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialCategory_organizationId_companyId_id_key" ON "concloud"."FinancialCategory"("organizationId", "companyId", "id");

-- CreateIndex
CREATE INDEX "CostCenter_companyId_idx" ON "concloud"."CostCenter"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "CostCenter_companyId_name_key" ON "concloud"."CostCenter"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "CostCenter_organizationId_companyId_id_key" ON "concloud"."CostCenter"("organizationId", "companyId", "id");

-- CreateIndex
CREATE INDEX "FinancialTitle_companyId_idx" ON "concloud"."FinancialTitle"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialTitle_companyId_recurrenceKey_key" ON "concloud"."FinancialTitle"("companyId", "recurrenceKey");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialTitle_organizationId_companyId_id_key" ON "concloud"."FinancialTitle"("organizationId", "companyId", "id");

-- CreateIndex
CREATE INDEX "Installment_companyId_idx" ON "concloud"."Installment"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Installment_companyId_titleId_number_key" ON "concloud"."Installment"("companyId", "titleId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Installment_organizationId_companyId_id_key" ON "concloud"."Installment"("organizationId", "companyId", "id");

-- CreateIndex
CREATE INDEX "Settlement_companyId_idx" ON "concloud"."Settlement"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Settlement_companyId_idempotencyKey_key" ON "concloud"."Settlement"("companyId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Settlement_organizationId_companyId_id_key" ON "concloud"."Settlement"("organizationId", "companyId", "id");

-- CreateIndex
CREATE INDEX "Transfer_companyId_idx" ON "concloud"."Transfer"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Transfer_companyId_idempotencyKey_key" ON "concloud"."Transfer"("companyId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Transfer_organizationId_companyId_id_key" ON "concloud"."Transfer"("organizationId", "companyId", "id");

-- CreateIndex
CREATE INDEX "RecurrenceRule_companyId_idx" ON "concloud"."RecurrenceRule"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "RecurrenceRule_organizationId_companyId_id_key" ON "concloud"."RecurrenceRule"("organizationId", "companyId", "id");

-- CreateIndex
CREATE INDEX "BankImport_companyId_idx" ON "concloud"."BankImport"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "BankImport_companyId_bankAccountId_checksum_key" ON "concloud"."BankImport"("companyId", "bankAccountId", "checksum");

-- CreateIndex
CREATE UNIQUE INDEX "BankImport_organizationId_companyId_id_key" ON "concloud"."BankImport"("organizationId", "companyId", "id");

-- CreateIndex
CREATE INDEX "BankTransaction_companyId_idx" ON "concloud"."BankTransaction"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "BankTransaction_companyId_bankAccountId_externalId_key" ON "concloud"."BankTransaction"("companyId", "bankAccountId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "BankTransaction_organizationId_companyId_id_key" ON "concloud"."BankTransaction"("organizationId", "companyId", "id");

-- CreateIndex
CREATE INDEX "Reconciliation_companyId_idx" ON "concloud"."Reconciliation"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Reconciliation_organizationId_companyId_id_key" ON "concloud"."Reconciliation"("organizationId", "companyId", "id");

-- CreateIndex
CREATE INDEX "Document_companyId_idx" ON "concloud"."Document"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Document_organizationId_companyId_id_key" ON "concloud"."Document"("organizationId", "companyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentVersion_objectKey_key" ON "concloud"."DocumentVersion"("objectKey");

-- CreateIndex
CREATE INDEX "DocumentVersion_companyId_idx" ON "concloud"."DocumentVersion"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentVersion_companyId_documentId_version_key" ON "concloud"."DocumentVersion"("companyId", "documentId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentVersion_organizationId_companyId_id_key" ON "concloud"."DocumentVersion"("organizationId", "companyId", "id");

-- CreateIndex
CREATE INDEX "DocumentRequest_companyId_idx" ON "concloud"."DocumentRequest"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentRequest_organizationId_companyId_id_key" ON "concloud"."DocumentRequest"("organizationId", "companyId", "id");

-- CreateIndex
CREATE INDEX "AccountingPeriod_companyId_idx" ON "concloud"."AccountingPeriod"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "AccountingPeriod_companyId_competence_key" ON "concloud"."AccountingPeriod"("companyId", "competence");

-- CreateIndex
CREATE UNIQUE INDEX "AccountingPeriod_organizationId_companyId_id_key" ON "concloud"."AccountingPeriod"("organizationId", "companyId", "id");

-- CreateIndex
CREATE INDEX "ClosingTask_companyId_idx" ON "concloud"."ClosingTask"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "ClosingTask_organizationId_companyId_id_key" ON "concloud"."ClosingTask"("organizationId", "companyId", "id");

-- CreateIndex
CREATE INDEX "ClosingTransition_companyId_idx" ON "concloud"."ClosingTransition"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "ClosingTransition_organizationId_companyId_id_key" ON "concloud"."ClosingTransition"("organizationId", "companyId", "id");

-- CreateIndex
CREATE INDEX "ExportBatch_companyId_idx" ON "concloud"."ExportBatch"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "ExportBatch_companyId_periodId_version_key" ON "concloud"."ExportBatch"("companyId", "periodId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "ExportBatch_organizationId_companyId_id_key" ON "concloud"."ExportBatch"("organizationId", "companyId", "id");

-- CreateIndex
CREATE INDEX "ProcessingBatch_companyId_idx" ON "concloud"."ProcessingBatch"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessingBatch_companyId_exportBatchId_key" ON "concloud"."ProcessingBatch"("companyId", "exportBatchId");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessingBatch_organizationId_companyId_id_key" ON "concloud"."ProcessingBatch"("organizationId", "companyId", "id");

-- CreateIndex
CREATE INDEX "Review_companyId_idx" ON "concloud"."Review"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Review_companyId_exportBatchId_key" ON "concloud"."Review"("companyId", "exportBatchId");

-- CreateIndex
CREATE UNIQUE INDEX "Review_organizationId_companyId_id_key" ON "concloud"."Review"("organizationId", "companyId", "id");

-- CreateIndex
CREATE INDEX "TaxObligation_companyId_idx" ON "concloud"."TaxObligation"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "TaxObligation_organizationId_companyId_id_key" ON "concloud"."TaxObligation"("organizationId", "companyId", "id");

-- CreateIndex
CREATE INDEX "TaxGuide_companyId_idx" ON "concloud"."TaxGuide"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "TaxGuide_organizationId_companyId_id_key" ON "concloud"."TaxGuide"("organizationId", "companyId", "id");

-- CreateIndex
CREATE INDEX "TaxPayment_companyId_idx" ON "concloud"."TaxPayment"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "TaxPayment_organizationId_companyId_id_key" ON "concloud"."TaxPayment"("organizationId", "companyId", "id");

-- CreateIndex
CREATE INDEX "FilingReceipt_companyId_idx" ON "concloud"."FilingReceipt"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "FilingReceipt_organizationId_companyId_id_key" ON "concloud"."FilingReceipt"("organizationId", "companyId", "id");

-- CreateIndex
CREATE INDEX "Ticket_companyId_idx" ON "concloud"."Ticket"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_organizationId_companyId_id_key" ON "concloud"."Ticket"("organizationId", "companyId", "id");

-- CreateIndex
CREATE INDEX "TicketMessage_companyId_idx" ON "concloud"."TicketMessage"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "TicketMessage_organizationId_companyId_id_key" ON "concloud"."TicketMessage"("organizationId", "companyId", "id");

-- CreateIndex
CREATE INDEX "AuditEvent_companyId_idx" ON "concloud"."AuditEvent"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "AuditEvent_organizationId_companyId_id_key" ON "concloud"."AuditEvent"("organizationId", "companyId", "id");

-- CreateIndex
CREATE INDEX "IntegrationConnection_companyId_idx" ON "concloud"."IntegrationConnection"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationConnection_companyId_provider_key" ON "concloud"."IntegrationConnection"("companyId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationConnection_organizationId_companyId_id_key" ON "concloud"."IntegrationConnection"("organizationId", "companyId", "id");

-- CreateIndex
CREATE INDEX "ExternalReference_companyId_idx" ON "concloud"."ExternalReference"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalReference_companyId_provider_resourceType_externalI_key" ON "concloud"."ExternalReference"("companyId", "provider", "resourceType", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalReference_organizationId_companyId_id_key" ON "concloud"."ExternalReference"("organizationId", "companyId", "id");

-- CreateIndex
CREATE INDEX "OutboxEvent_companyId_idx" ON "concloud"."OutboxEvent"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "OutboxEvent_organizationId_companyId_id_key" ON "concloud"."OutboxEvent"("organizationId", "companyId", "id");

-- CreateIndex
CREATE INDEX "WebhookEvent_companyId_idx" ON "concloud"."WebhookEvent"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_companyId_provider_externalId_key" ON "concloud"."WebhookEvent"("companyId", "provider", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_organizationId_companyId_id_key" ON "concloud"."WebhookEvent"("organizationId", "companyId", "id");

-- CreateIndex
CREATE INDEX "SyncRun_companyId_idx" ON "concloud"."SyncRun"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "SyncRun_organizationId_companyId_id_key" ON "concloud"."SyncRun"("organizationId", "companyId", "id");

-- CreateIndex
CREATE INDEX "AiInsight_companyId_idx" ON "concloud"."AiInsight"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "AiInsight_organizationId_companyId_id_key" ON "concloud"."AiInsight"("organizationId", "companyId", "id");

-- CreateIndex
CREATE INDEX "ServicePlan_companyId_idx" ON "concloud"."ServicePlan"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "ServicePlan_organizationId_companyId_id_key" ON "concloud"."ServicePlan"("organizationId", "companyId", "id");

-- CreateIndex
CREATE INDEX "CompanyServiceAgreement_companyId_idx" ON "concloud"."CompanyServiceAgreement"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyServiceAgreement_organizationId_companyId_id_key" ON "concloud"."CompanyServiceAgreement"("organizationId", "companyId", "id");

-- AddForeignKey
ALTER TABLE "concloud"."OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "concloud"."Organization"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "concloud"."OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "concloud"."Profile"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "concloud"."Company" ADD CONSTRAINT "Company_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "concloud"."Organization"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "concloud"."CompanyMembership" ADD CONSTRAINT "CompanyMembership_organizationId_companyId_fkey" FOREIGN KEY ("organizationId", "companyId") REFERENCES "concloud"."Company"("organizationId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "concloud"."CompanyMembership" ADD CONSTRAINT "CompanyMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "concloud"."Profile"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "concloud"."Invitation" ADD CONSTRAINT "Invitation_organizationId_companyId_fkey" FOREIGN KEY ("organizationId", "companyId") REFERENCES "concloud"."Company"("organizationId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "concloud"."CompanyPartner" ADD CONSTRAINT "CompanyPartner_organizationId_companyId_fkey" FOREIGN KEY ("organizationId", "companyId") REFERENCES "concloud"."Company"("organizationId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "concloud"."CompanyTaxProfileHistory" ADD CONSTRAINT "CompanyTaxProfileHistory_organizationId_companyId_fkey" FOREIGN KEY ("organizationId", "companyId") REFERENCES "concloud"."Company"("organizationId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "concloud"."OnboardingItem" ADD CONSTRAINT "OnboardingItem_organizationId_companyId_fkey" FOREIGN KEY ("organizationId", "companyId") REFERENCES "concloud"."Company"("organizationId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "concloud"."Contact" ADD CONSTRAINT "Contact_organizationId_companyId_fkey" FOREIGN KEY ("organizationId", "companyId") REFERENCES "concloud"."Company"("organizationId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "concloud"."BankAccount" ADD CONSTRAINT "BankAccount_organizationId_companyId_fkey" FOREIGN KEY ("organizationId", "companyId") REFERENCES "concloud"."Company"("organizationId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "concloud"."FinancialCategory" ADD CONSTRAINT "FinancialCategory_organizationId_companyId_fkey" FOREIGN KEY ("organizationId", "companyId") REFERENCES "concloud"."Company"("organizationId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "concloud"."CostCenter" ADD CONSTRAINT "CostCenter_organizationId_companyId_fkey" FOREIGN KEY ("organizationId", "companyId") REFERENCES "concloud"."Company"("organizationId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "concloud"."FinancialTitle" ADD CONSTRAINT "FinancialTitle_organizationId_companyId_fkey" FOREIGN KEY ("organizationId", "companyId") REFERENCES "concloud"."Company"("organizationId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "concloud"."FinancialTitle" ADD CONSTRAINT "FinancialTitle_organizationId_companyId_contactId_fkey" FOREIGN KEY ("organizationId", "companyId", "contactId") REFERENCES "concloud"."Contact"("organizationId", "companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "concloud"."FinancialTitle" ADD CONSTRAINT "FinancialTitle_organizationId_companyId_categoryId_fkey" FOREIGN KEY ("organizationId", "companyId", "categoryId") REFERENCES "concloud"."FinancialCategory"("organizationId", "companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "concloud"."FinancialTitle" ADD CONSTRAINT "FinancialTitle_organizationId_companyId_costCenterId_fkey" FOREIGN KEY ("organizationId", "companyId", "costCenterId") REFERENCES "concloud"."CostCenter"("organizationId", "companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "concloud"."Installment" ADD CONSTRAINT "Installment_organizationId_companyId_fkey" FOREIGN KEY ("organizationId", "companyId") REFERENCES "concloud"."Company"("organizationId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "concloud"."Installment" ADD CONSTRAINT "Installment_organizationId_companyId_titleId_fkey" FOREIGN KEY ("organizationId", "companyId", "titleId") REFERENCES "concloud"."FinancialTitle"("organizationId", "companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "concloud"."Settlement" ADD CONSTRAINT "Settlement_organizationId_companyId_fkey" FOREIGN KEY ("organizationId", "companyId") REFERENCES "concloud"."Company"("organizationId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "concloud"."Settlement" ADD CONSTRAINT "Settlement_organizationId_companyId_installmentId_fkey" FOREIGN KEY ("organizationId", "companyId", "installmentId") REFERENCES "concloud"."Installment"("organizationId", "companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "concloud"."Settlement" ADD CONSTRAINT "Settlement_organizationId_companyId_bankAccountId_fkey" FOREIGN KEY ("organizationId", "companyId", "bankAccountId") REFERENCES "concloud"."BankAccount"("organizationId", "companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "concloud"."Transfer" ADD CONSTRAINT "Transfer_organizationId_companyId_fkey" FOREIGN KEY ("organizationId", "companyId") REFERENCES "concloud"."Company"("organizationId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "concloud"."Transfer" ADD CONSTRAINT "Transfer_organizationId_companyId_sourceId_fkey" FOREIGN KEY ("organizationId", "companyId", "sourceId") REFERENCES "concloud"."BankAccount"("organizationId", "companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "concloud"."Transfer" ADD CONSTRAINT "Transfer_organizationId_companyId_targetId_fkey" FOREIGN KEY ("organizationId", "companyId", "targetId") REFERENCES "concloud"."BankAccount"("organizationId", "companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "concloud"."RecurrenceRule" ADD CONSTRAINT "RecurrenceRule_organizationId_companyId_fkey" FOREIGN KEY ("organizationId", "companyId") REFERENCES "concloud"."Company"("organizationId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "concloud"."BankImport" ADD CONSTRAINT "BankImport_organizationId_companyId_fkey" FOREIGN KEY ("organizationId", "companyId") REFERENCES "concloud"."Company"("organizationId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "concloud"."BankImport" ADD CONSTRAINT "BankImport_organizationId_companyId_bankAccountId_fkey" FOREIGN KEY ("organizationId", "companyId", "bankAccountId") REFERENCES "concloud"."BankAccount"("organizationId", "companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "concloud"."BankTransaction" ADD CONSTRAINT "BankTransaction_organizationId_companyId_fkey" FOREIGN KEY ("organizationId", "companyId") REFERENCES "concloud"."Company"("organizationId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "concloud"."BankTransaction" ADD CONSTRAINT "BankTransaction_organizationId_companyId_importId_fkey" FOREIGN KEY ("organizationId", "companyId", "importId") REFERENCES "concloud"."BankImport"("organizationId", "companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "concloud"."BankTransaction" ADD CONSTRAINT "BankTransaction_organizationId_companyId_bankAccountId_fkey" FOREIGN KEY ("organizationId", "companyId", "bankAccountId") REFERENCES "concloud"."BankAccount"("organizationId", "companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "concloud"."Reconciliation" ADD CONSTRAINT "Reconciliation_organizationId_companyId_fkey" FOREIGN KEY ("organizationId", "companyId") REFERENCES "concloud"."Company"("organizationId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "concloud"."Reconciliation" ADD CONSTRAINT "Reconciliation_organizationId_companyId_transactionId_fkey" FOREIGN KEY ("organizationId", "companyId", "transactionId") REFERENCES "concloud"."BankTransaction"("organizationId", "companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "concloud"."Reconciliation" ADD CONSTRAINT "Reconciliation_organizationId_companyId_settlementId_fkey" FOREIGN KEY ("organizationId", "companyId", "settlementId") REFERENCES "concloud"."Settlement"("organizationId", "companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "concloud"."Document" ADD CONSTRAINT "Document_organizationId_companyId_fkey" FOREIGN KEY ("organizationId", "companyId") REFERENCES "concloud"."Company"("organizationId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "concloud"."DocumentVersion" ADD CONSTRAINT "DocumentVersion_organizationId_companyId_fkey" FOREIGN KEY ("organizationId", "companyId") REFERENCES "concloud"."Company"("organizationId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "concloud"."DocumentVersion" ADD CONSTRAINT "DocumentVersion_organizationId_companyId_documentId_fkey" FOREIGN KEY ("organizationId", "companyId", "documentId") REFERENCES "concloud"."Document"("organizationId", "companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "concloud"."DocumentRequest" ADD CONSTRAINT "DocumentRequest_organizationId_companyId_fkey" FOREIGN KEY ("organizationId", "companyId") REFERENCES "concloud"."Company"("organizationId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "concloud"."DocumentRequest" ADD CONSTRAINT "DocumentRequest_organizationId_companyId_fulfilledByDocume_fkey" FOREIGN KEY ("organizationId", "companyId", "fulfilledByDocumentId") REFERENCES "concloud"."Document"("organizationId", "companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "concloud"."AccountingPeriod" ADD CONSTRAINT "AccountingPeriod_organizationId_companyId_fkey" FOREIGN KEY ("organizationId", "companyId") REFERENCES "concloud"."Company"("organizationId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "concloud"."ClosingTask" ADD CONSTRAINT "ClosingTask_organizationId_companyId_fkey" FOREIGN KEY ("organizationId", "companyId") REFERENCES "concloud"."Company"("organizationId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "concloud"."ClosingTask" ADD CONSTRAINT "ClosingTask_organizationId_companyId_periodId_fkey" FOREIGN KEY ("organizationId", "companyId", "periodId") REFERENCES "concloud"."AccountingPeriod"("organizationId", "companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "concloud"."ClosingTransition" ADD CONSTRAINT "ClosingTransition_organizationId_companyId_fkey" FOREIGN KEY ("organizationId", "companyId") REFERENCES "concloud"."Company"("organizationId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "concloud"."ClosingTransition" ADD CONSTRAINT "ClosingTransition_organizationId_companyId_periodId_fkey" FOREIGN KEY ("organizationId", "companyId", "periodId") REFERENCES "concloud"."AccountingPeriod"("organizationId", "companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "concloud"."ExportBatch" ADD CONSTRAINT "ExportBatch_organizationId_companyId_fkey" FOREIGN KEY ("organizationId", "companyId") REFERENCES "concloud"."Company"("organizationId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "concloud"."ExportBatch" ADD CONSTRAINT "ExportBatch_organizationId_companyId_periodId_fkey" FOREIGN KEY ("organizationId", "companyId", "periodId") REFERENCES "concloud"."AccountingPeriod"("organizationId", "companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "concloud"."ProcessingBatch" ADD CONSTRAINT "ProcessingBatch_organizationId_companyId_fkey" FOREIGN KEY ("organizationId", "companyId") REFERENCES "concloud"."Company"("organizationId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "concloud"."ProcessingBatch" ADD CONSTRAINT "ProcessingBatch_organizationId_companyId_exportBatchId_fkey" FOREIGN KEY ("organizationId", "companyId", "exportBatchId") REFERENCES "concloud"."ExportBatch"("organizationId", "companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "concloud"."ProcessingBatch" ADD CONSTRAINT "ProcessingBatch_organizationId_companyId_resultDocumentId_fkey" FOREIGN KEY ("organizationId", "companyId", "resultDocumentId") REFERENCES "concloud"."Document"("organizationId", "companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "concloud"."Review" ADD CONSTRAINT "Review_organizationId_companyId_fkey" FOREIGN KEY ("organizationId", "companyId") REFERENCES "concloud"."Company"("organizationId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "concloud"."Review" ADD CONSTRAINT "Review_organizationId_companyId_periodId_fkey" FOREIGN KEY ("organizationId", "companyId", "periodId") REFERENCES "concloud"."AccountingPeriod"("organizationId", "companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "concloud"."Review" ADD CONSTRAINT "Review_organizationId_companyId_exportBatchId_fkey" FOREIGN KEY ("organizationId", "companyId", "exportBatchId") REFERENCES "concloud"."ExportBatch"("organizationId", "companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "concloud"."TaxObligation" ADD CONSTRAINT "TaxObligation_organizationId_companyId_fkey" FOREIGN KEY ("organizationId", "companyId") REFERENCES "concloud"."Company"("organizationId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "concloud"."TaxGuide" ADD CONSTRAINT "TaxGuide_organizationId_companyId_fkey" FOREIGN KEY ("organizationId", "companyId") REFERENCES "concloud"."Company"("organizationId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "concloud"."TaxGuide" ADD CONSTRAINT "TaxGuide_organizationId_companyId_obligationId_fkey" FOREIGN KEY ("organizationId", "companyId", "obligationId") REFERENCES "concloud"."TaxObligation"("organizationId", "companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "concloud"."TaxGuide" ADD CONSTRAINT "TaxGuide_organizationId_companyId_documentId_fkey" FOREIGN KEY ("organizationId", "companyId", "documentId") REFERENCES "concloud"."Document"("organizationId", "companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "concloud"."TaxPayment" ADD CONSTRAINT "TaxPayment_organizationId_companyId_fkey" FOREIGN KEY ("organizationId", "companyId") REFERENCES "concloud"."Company"("organizationId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "concloud"."TaxPayment" ADD CONSTRAINT "TaxPayment_organizationId_companyId_guideId_fkey" FOREIGN KEY ("organizationId", "companyId", "guideId") REFERENCES "concloud"."TaxGuide"("organizationId", "companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "concloud"."TaxPayment" ADD CONSTRAINT "TaxPayment_organizationId_companyId_proofDocumentId_fkey" FOREIGN KEY ("organizationId", "companyId", "proofDocumentId") REFERENCES "concloud"."Document"("organizationId", "companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "concloud"."FilingReceipt" ADD CONSTRAINT "FilingReceipt_organizationId_companyId_fkey" FOREIGN KEY ("organizationId", "companyId") REFERENCES "concloud"."Company"("organizationId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "concloud"."FilingReceipt" ADD CONSTRAINT "FilingReceipt_organizationId_companyId_obligationId_fkey" FOREIGN KEY ("organizationId", "companyId", "obligationId") REFERENCES "concloud"."TaxObligation"("organizationId", "companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "concloud"."FilingReceipt" ADD CONSTRAINT "FilingReceipt_organizationId_companyId_documentId_fkey" FOREIGN KEY ("organizationId", "companyId", "documentId") REFERENCES "concloud"."Document"("organizationId", "companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "concloud"."Ticket" ADD CONSTRAINT "Ticket_organizationId_companyId_fkey" FOREIGN KEY ("organizationId", "companyId") REFERENCES "concloud"."Company"("organizationId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "concloud"."TicketMessage" ADD CONSTRAINT "TicketMessage_organizationId_companyId_fkey" FOREIGN KEY ("organizationId", "companyId") REFERENCES "concloud"."Company"("organizationId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "concloud"."TicketMessage" ADD CONSTRAINT "TicketMessage_organizationId_companyId_ticketId_fkey" FOREIGN KEY ("organizationId", "companyId", "ticketId") REFERENCES "concloud"."Ticket"("organizationId", "companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "concloud"."AuditEvent" ADD CONSTRAINT "AuditEvent_organizationId_companyId_fkey" FOREIGN KEY ("organizationId", "companyId") REFERENCES "concloud"."Company"("organizationId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "concloud"."IntegrationConnection" ADD CONSTRAINT "IntegrationConnection_organizationId_companyId_fkey" FOREIGN KEY ("organizationId", "companyId") REFERENCES "concloud"."Company"("organizationId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "concloud"."ExternalReference" ADD CONSTRAINT "ExternalReference_organizationId_companyId_fkey" FOREIGN KEY ("organizationId", "companyId") REFERENCES "concloud"."Company"("organizationId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "concloud"."OutboxEvent" ADD CONSTRAINT "OutboxEvent_organizationId_companyId_fkey" FOREIGN KEY ("organizationId", "companyId") REFERENCES "concloud"."Company"("organizationId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "concloud"."WebhookEvent" ADD CONSTRAINT "WebhookEvent_organizationId_companyId_fkey" FOREIGN KEY ("organizationId", "companyId") REFERENCES "concloud"."Company"("organizationId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "concloud"."SyncRun" ADD CONSTRAINT "SyncRun_organizationId_companyId_fkey" FOREIGN KEY ("organizationId", "companyId") REFERENCES "concloud"."Company"("organizationId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "concloud"."AiInsight" ADD CONSTRAINT "AiInsight_organizationId_companyId_fkey" FOREIGN KEY ("organizationId", "companyId") REFERENCES "concloud"."Company"("organizationId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "concloud"."ServicePlan" ADD CONSTRAINT "ServicePlan_organizationId_companyId_fkey" FOREIGN KEY ("organizationId", "companyId") REFERENCES "concloud"."Company"("organizationId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "concloud"."CompanyServiceAgreement" ADD CONSTRAINT "CompanyServiceAgreement_organizationId_companyId_fkey" FOREIGN KEY ("organizationId", "companyId") REFERENCES "concloud"."Company"("organizationId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "concloud"."CompanyServiceAgreement" ADD CONSTRAINT "CompanyServiceAgreement_organizationId_companyId_planId_fkey" FOREIGN KEY ("organizationId", "companyId", "planId") REFERENCES "concloud"."ServicePlan"("organizationId", "companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;


-- Runtime roles are provisioned separately with passwords supplied out of band.
DO $$ BEGIN IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='concloud_runtime') THEN CREATE ROLE concloud_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS; END IF; END $$;
REVOKE ALL ON SCHEMA concloud FROM PUBLIC;
GRANT USAGE ON SCHEMA concloud TO concloud_runtime;
CREATE FUNCTION concloud.actor() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.user_id',true),'')::uuid $$;
CREATE FUNCTION concloud.invite_hash() RETURNS text LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.invite_hash',true),'') $$;
CREATE FUNCTION concloud.actor_email() RETURNS text LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.email',true),'') $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA concloud FROM PUBLIC;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA concloud TO concloud_runtime;
GRANT SELECT,INSERT,UPDATE ON ALL TABLES IN SCHEMA concloud TO concloud_runtime;
ALTER TABLE concloud."Profile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE concloud."Profile" FORCE ROW LEVEL SECURITY;
CREATE POLICY own_profile ON concloud."Profile" FOR ALL TO concloud_runtime USING (id=concloud.actor()) WITH CHECK(id=concloud.actor());
ALTER TABLE concloud."OrganizationMembership" ENABLE ROW LEVEL SECURITY;
ALTER TABLE concloud."OrganizationMembership" FORCE ROW LEVEL SECURITY;
CREATE POLICY own_membership ON concloud."OrganizationMembership" FOR SELECT TO concloud_runtime USING ("userId"=concloud.actor() AND active);
ALTER TABLE concloud."Organization" ENABLE ROW LEVEL SECURITY;
ALTER TABLE concloud."Organization" FORCE ROW LEVEL SECURITY;
CREATE POLICY visible_org ON concloud."Organization" FOR SELECT TO concloud_runtime USING (id IN (SELECT "organizationId" FROM concloud."OrganizationMembership") OR id IN (SELECT "organizationId" FROM concloud."CompanyMembership"));
ALTER TABLE concloud."Company" ENABLE ROW LEVEL SECURITY;
ALTER TABLE concloud."Company" FORCE ROW LEVEL SECURITY;
CREATE FUNCTION concloud.org_admin(org uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER AS $$ SELECT EXISTS(SELECT 1 FROM concloud."OrganizationMembership" WHERE "organizationId"=org AND "userId"=concloud.actor() AND active AND role IN ('ORG_ADMIN','SUPER_ADMIN')) $$;
CREATE POLICY company_read ON concloud."Company" FOR SELECT TO concloud_runtime USING (concloud.org_admin("organizationId") OR id IN (SELECT "companyId" FROM concloud."CompanyMembership" WHERE "userId"=concloud.actor() AND active));
CREATE POLICY company_create ON concloud."Company" FOR INSERT TO concloud_runtime WITH CHECK(concloud.org_admin("organizationId"));
CREATE POLICY company_update ON concloud."Company" FOR UPDATE TO concloud_runtime USING(concloud.org_admin("organizationId")) WITH CHECK(concloud.org_admin("organizationId"));
ALTER TABLE concloud."CompanyMembership" ENABLE ROW LEVEL SECURITY;
ALTER TABLE concloud."CompanyMembership" FORCE ROW LEVEL SECURITY;
ALTER TABLE concloud."Invitation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE concloud."Invitation" FORCE ROW LEVEL SECURITY;
ALTER TABLE concloud."CompanyPartner" ENABLE ROW LEVEL SECURITY;
ALTER TABLE concloud."CompanyPartner" FORCE ROW LEVEL SECURITY;
ALTER TABLE concloud."CompanyTaxProfileHistory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE concloud."CompanyTaxProfileHistory" FORCE ROW LEVEL SECURITY;
ALTER TABLE concloud."OnboardingItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE concloud."OnboardingItem" FORCE ROW LEVEL SECURITY;
ALTER TABLE concloud."Contact" ENABLE ROW LEVEL SECURITY;
ALTER TABLE concloud."Contact" FORCE ROW LEVEL SECURITY;
ALTER TABLE concloud."BankAccount" ENABLE ROW LEVEL SECURITY;
ALTER TABLE concloud."BankAccount" FORCE ROW LEVEL SECURITY;
ALTER TABLE concloud."FinancialCategory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE concloud."FinancialCategory" FORCE ROW LEVEL SECURITY;
ALTER TABLE concloud."CostCenter" ENABLE ROW LEVEL SECURITY;
ALTER TABLE concloud."CostCenter" FORCE ROW LEVEL SECURITY;
ALTER TABLE concloud."FinancialTitle" ENABLE ROW LEVEL SECURITY;
ALTER TABLE concloud."FinancialTitle" FORCE ROW LEVEL SECURITY;
ALTER TABLE concloud."Installment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE concloud."Installment" FORCE ROW LEVEL SECURITY;
ALTER TABLE concloud."Settlement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE concloud."Settlement" FORCE ROW LEVEL SECURITY;
ALTER TABLE concloud."Transfer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE concloud."Transfer" FORCE ROW LEVEL SECURITY;
ALTER TABLE concloud."RecurrenceRule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE concloud."RecurrenceRule" FORCE ROW LEVEL SECURITY;
ALTER TABLE concloud."BankImport" ENABLE ROW LEVEL SECURITY;
ALTER TABLE concloud."BankImport" FORCE ROW LEVEL SECURITY;
ALTER TABLE concloud."BankTransaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE concloud."BankTransaction" FORCE ROW LEVEL SECURITY;
ALTER TABLE concloud."Reconciliation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE concloud."Reconciliation" FORCE ROW LEVEL SECURITY;
ALTER TABLE concloud."Document" ENABLE ROW LEVEL SECURITY;
ALTER TABLE concloud."Document" FORCE ROW LEVEL SECURITY;
ALTER TABLE concloud."DocumentVersion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE concloud."DocumentVersion" FORCE ROW LEVEL SECURITY;
ALTER TABLE concloud."DocumentRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE concloud."DocumentRequest" FORCE ROW LEVEL SECURITY;
ALTER TABLE concloud."AccountingPeriod" ENABLE ROW LEVEL SECURITY;
ALTER TABLE concloud."AccountingPeriod" FORCE ROW LEVEL SECURITY;
ALTER TABLE concloud."ClosingTask" ENABLE ROW LEVEL SECURITY;
ALTER TABLE concloud."ClosingTask" FORCE ROW LEVEL SECURITY;
ALTER TABLE concloud."ClosingTransition" ENABLE ROW LEVEL SECURITY;
ALTER TABLE concloud."ClosingTransition" FORCE ROW LEVEL SECURITY;
ALTER TABLE concloud."ExportBatch" ENABLE ROW LEVEL SECURITY;
ALTER TABLE concloud."ExportBatch" FORCE ROW LEVEL SECURITY;
ALTER TABLE concloud."ProcessingBatch" ENABLE ROW LEVEL SECURITY;
ALTER TABLE concloud."ProcessingBatch" FORCE ROW LEVEL SECURITY;
ALTER TABLE concloud."Review" ENABLE ROW LEVEL SECURITY;
ALTER TABLE concloud."Review" FORCE ROW LEVEL SECURITY;
ALTER TABLE concloud."TaxObligation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE concloud."TaxObligation" FORCE ROW LEVEL SECURITY;
ALTER TABLE concloud."TaxGuide" ENABLE ROW LEVEL SECURITY;
ALTER TABLE concloud."TaxGuide" FORCE ROW LEVEL SECURITY;
ALTER TABLE concloud."TaxPayment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE concloud."TaxPayment" FORCE ROW LEVEL SECURITY;
ALTER TABLE concloud."FilingReceipt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE concloud."FilingReceipt" FORCE ROW LEVEL SECURITY;
ALTER TABLE concloud."Ticket" ENABLE ROW LEVEL SECURITY;
ALTER TABLE concloud."Ticket" FORCE ROW LEVEL SECURITY;
ALTER TABLE concloud."TicketMessage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE concloud."TicketMessage" FORCE ROW LEVEL SECURITY;
ALTER TABLE concloud."AuditEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE concloud."AuditEvent" FORCE ROW LEVEL SECURITY;
ALTER TABLE concloud."IntegrationConnection" ENABLE ROW LEVEL SECURITY;
ALTER TABLE concloud."IntegrationConnection" FORCE ROW LEVEL SECURITY;
ALTER TABLE concloud."ExternalReference" ENABLE ROW LEVEL SECURITY;
ALTER TABLE concloud."ExternalReference" FORCE ROW LEVEL SECURITY;
ALTER TABLE concloud."OutboxEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE concloud."OutboxEvent" FORCE ROW LEVEL SECURITY;
ALTER TABLE concloud."WebhookEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE concloud."WebhookEvent" FORCE ROW LEVEL SECURITY;
ALTER TABLE concloud."SyncRun" ENABLE ROW LEVEL SECURITY;
ALTER TABLE concloud."SyncRun" FORCE ROW LEVEL SECURITY;
ALTER TABLE concloud."AiInsight" ENABLE ROW LEVEL SECURITY;
ALTER TABLE concloud."AiInsight" FORCE ROW LEVEL SECURITY;
ALTER TABLE concloud."ServicePlan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE concloud."ServicePlan" FORCE ROW LEVEL SECURITY;
ALTER TABLE concloud."CompanyServiceAgreement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE concloud."CompanyServiceAgreement" FORCE ROW LEVEL SECURITY;

CREATE POLICY membership_read ON concloud."CompanyMembership" FOR SELECT TO concloud_runtime USING (("userId"=concloud.actor() AND active) OR concloud.org_admin("organizationId"));
CREATE FUNCTION concloud.company_access(org uuid, company uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER AS $$ SELECT concloud.org_admin(org) OR EXISTS(SELECT 1 FROM concloud."CompanyMembership" WHERE "organizationId"=org AND "companyId"=company AND "userId"=concloud.actor() AND active) $$;
CREATE FUNCTION concloud.staff_access(org uuid, company uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER AS $$ SELECT concloud.org_admin(org) OR EXISTS(SELECT 1 FROM concloud."CompanyMembership" WHERE "organizationId"=org AND "companyId"=company AND "userId"=concloud.actor() AND active AND role IN ('ACCOUNTANT','ASSISTANT')) $$;
CREATE POLICY invitation_read ON concloud."Invitation" FOR SELECT TO concloud_runtime USING(concloud.org_admin("organizationId") OR ("tokenHash"=concloud.invite_hash() AND email=concloud.actor_email()));
CREATE POLICY invitation_create ON concloud."Invitation" FOR INSERT TO concloud_runtime WITH CHECK(concloud.org_admin("organizationId"));
CREATE POLICY invitation_accept ON concloud."Invitation" FOR UPDATE TO concloud_runtime USING("tokenHash"=concloud.invite_hash() AND email=concloud.actor_email() AND "acceptedAt" IS NULL AND "expiresAt">now()) WITH CHECK("tokenHash"=concloud.invite_hash() AND email=concloud.actor_email());
CREATE POLICY membership_create ON concloud."CompanyMembership" FOR INSERT TO concloud_runtime WITH CHECK(concloud.org_admin("organizationId") OR ("userId"=concloud.actor() AND EXISTS(SELECT 1 FROM concloud."Invitation" i WHERE i."companyId"="CompanyMembership"."companyId" AND i."organizationId"="CompanyMembership"."organizationId" AND i.role="CompanyMembership".role AND i."tokenHash"=concloud.invite_hash() AND i.email=concloud.actor_email() AND i."acceptedAt" IS NULL AND i."expiresAt">now())));
CREATE POLICY membership_update ON concloud."CompanyMembership" FOR UPDATE TO concloud_runtime USING(concloud.org_admin("organizationId")) WITH CHECK(concloud.org_admin("organizationId"));
CREATE POLICY read_rows ON concloud."CompanyPartner" FOR SELECT TO concloud_runtime USING(concloud.company_access("organizationId","companyId"));
CREATE POLICY insert_rows ON concloud."CompanyPartner" FOR INSERT TO concloud_runtime WITH CHECK(concloud.staff_access("organizationId","companyId"));
CREATE POLICY update_rows ON concloud."CompanyPartner" FOR UPDATE TO concloud_runtime USING(concloud.staff_access("organizationId","companyId")) WITH CHECK(concloud.staff_access("organizationId","companyId"));
CREATE POLICY read_rows ON concloud."CompanyTaxProfileHistory" FOR SELECT TO concloud_runtime USING(concloud.company_access("organizationId","companyId"));
CREATE POLICY insert_rows ON concloud."CompanyTaxProfileHistory" FOR INSERT TO concloud_runtime WITH CHECK(concloud.staff_access("organizationId","companyId"));
CREATE POLICY update_rows ON concloud."CompanyTaxProfileHistory" FOR UPDATE TO concloud_runtime USING(concloud.staff_access("organizationId","companyId")) WITH CHECK(concloud.staff_access("organizationId","companyId"));
CREATE POLICY read_rows ON concloud."OnboardingItem" FOR SELECT TO concloud_runtime USING(concloud.company_access("organizationId","companyId"));
CREATE POLICY insert_rows ON concloud."OnboardingItem" FOR INSERT TO concloud_runtime WITH CHECK(concloud.staff_access("organizationId","companyId"));
CREATE POLICY update_rows ON concloud."OnboardingItem" FOR UPDATE TO concloud_runtime USING(concloud.staff_access("organizationId","companyId")) WITH CHECK(concloud.staff_access("organizationId","companyId"));
CREATE POLICY read_rows ON concloud."Contact" FOR SELECT TO concloud_runtime USING(concloud.company_access("organizationId","companyId"));
CREATE POLICY insert_rows ON concloud."Contact" FOR INSERT TO concloud_runtime WITH CHECK(concloud.company_access("organizationId","companyId"));
CREATE POLICY update_rows ON concloud."Contact" FOR UPDATE TO concloud_runtime USING(concloud.company_access("organizationId","companyId")) WITH CHECK(concloud.company_access("organizationId","companyId"));
CREATE POLICY read_rows ON concloud."BankAccount" FOR SELECT TO concloud_runtime USING(concloud.company_access("organizationId","companyId"));
CREATE POLICY insert_rows ON concloud."BankAccount" FOR INSERT TO concloud_runtime WITH CHECK(concloud.company_access("organizationId","companyId"));
CREATE POLICY update_rows ON concloud."BankAccount" FOR UPDATE TO concloud_runtime USING(concloud.company_access("organizationId","companyId")) WITH CHECK(concloud.company_access("organizationId","companyId"));
CREATE POLICY read_rows ON concloud."FinancialCategory" FOR SELECT TO concloud_runtime USING(concloud.company_access("organizationId","companyId"));
CREATE POLICY insert_rows ON concloud."FinancialCategory" FOR INSERT TO concloud_runtime WITH CHECK(concloud.company_access("organizationId","companyId"));
CREATE POLICY update_rows ON concloud."FinancialCategory" FOR UPDATE TO concloud_runtime USING(concloud.company_access("organizationId","companyId")) WITH CHECK(concloud.company_access("organizationId","companyId"));
CREATE POLICY read_rows ON concloud."CostCenter" FOR SELECT TO concloud_runtime USING(concloud.company_access("organizationId","companyId"));
CREATE POLICY insert_rows ON concloud."CostCenter" FOR INSERT TO concloud_runtime WITH CHECK(concloud.company_access("organizationId","companyId"));
CREATE POLICY update_rows ON concloud."CostCenter" FOR UPDATE TO concloud_runtime USING(concloud.company_access("organizationId","companyId")) WITH CHECK(concloud.company_access("organizationId","companyId"));
CREATE POLICY read_rows ON concloud."FinancialTitle" FOR SELECT TO concloud_runtime USING(concloud.company_access("organizationId","companyId"));
CREATE POLICY insert_rows ON concloud."FinancialTitle" FOR INSERT TO concloud_runtime WITH CHECK(concloud.company_access("organizationId","companyId"));
CREATE POLICY update_rows ON concloud."FinancialTitle" FOR UPDATE TO concloud_runtime USING(concloud.company_access("organizationId","companyId")) WITH CHECK(concloud.company_access("organizationId","companyId"));
CREATE POLICY read_rows ON concloud."Installment" FOR SELECT TO concloud_runtime USING(concloud.company_access("organizationId","companyId"));
CREATE POLICY insert_rows ON concloud."Installment" FOR INSERT TO concloud_runtime WITH CHECK(concloud.company_access("organizationId","companyId"));
CREATE POLICY update_rows ON concloud."Installment" FOR UPDATE TO concloud_runtime USING(concloud.company_access("organizationId","companyId")) WITH CHECK(concloud.company_access("organizationId","companyId"));
CREATE POLICY read_rows ON concloud."Settlement" FOR SELECT TO concloud_runtime USING(concloud.company_access("organizationId","companyId"));
CREATE POLICY insert_rows ON concloud."Settlement" FOR INSERT TO concloud_runtime WITH CHECK(concloud.company_access("organizationId","companyId"));
CREATE POLICY update_rows ON concloud."Settlement" FOR UPDATE TO concloud_runtime USING(concloud.company_access("organizationId","companyId")) WITH CHECK(concloud.company_access("organizationId","companyId"));
CREATE POLICY read_rows ON concloud."Transfer" FOR SELECT TO concloud_runtime USING(concloud.company_access("organizationId","companyId"));
CREATE POLICY insert_rows ON concloud."Transfer" FOR INSERT TO concloud_runtime WITH CHECK(concloud.company_access("organizationId","companyId"));
CREATE POLICY update_rows ON concloud."Transfer" FOR UPDATE TO concloud_runtime USING(concloud.company_access("organizationId","companyId")) WITH CHECK(concloud.company_access("organizationId","companyId"));
CREATE POLICY read_rows ON concloud."RecurrenceRule" FOR SELECT TO concloud_runtime USING(concloud.company_access("organizationId","companyId"));
CREATE POLICY insert_rows ON concloud."RecurrenceRule" FOR INSERT TO concloud_runtime WITH CHECK(concloud.company_access("organizationId","companyId"));
CREATE POLICY update_rows ON concloud."RecurrenceRule" FOR UPDATE TO concloud_runtime USING(concloud.company_access("organizationId","companyId")) WITH CHECK(concloud.company_access("organizationId","companyId"));
CREATE POLICY read_rows ON concloud."BankImport" FOR SELECT TO concloud_runtime USING(concloud.company_access("organizationId","companyId"));
CREATE POLICY insert_rows ON concloud."BankImport" FOR INSERT TO concloud_runtime WITH CHECK(concloud.company_access("organizationId","companyId"));
CREATE POLICY update_rows ON concloud."BankImport" FOR UPDATE TO concloud_runtime USING(concloud.company_access("organizationId","companyId")) WITH CHECK(concloud.company_access("organizationId","companyId"));
CREATE POLICY read_rows ON concloud."BankTransaction" FOR SELECT TO concloud_runtime USING(concloud.company_access("organizationId","companyId"));
CREATE POLICY insert_rows ON concloud."BankTransaction" FOR INSERT TO concloud_runtime WITH CHECK(concloud.company_access("organizationId","companyId"));
CREATE POLICY update_rows ON concloud."BankTransaction" FOR UPDATE TO concloud_runtime USING(concloud.company_access("organizationId","companyId")) WITH CHECK(concloud.company_access("organizationId","companyId"));
CREATE POLICY read_rows ON concloud."Reconciliation" FOR SELECT TO concloud_runtime USING(concloud.company_access("organizationId","companyId"));
CREATE POLICY insert_rows ON concloud."Reconciliation" FOR INSERT TO concloud_runtime WITH CHECK(concloud.company_access("organizationId","companyId"));
CREATE POLICY update_rows ON concloud."Reconciliation" FOR UPDATE TO concloud_runtime USING(concloud.company_access("organizationId","companyId")) WITH CHECK(concloud.company_access("organizationId","companyId"));
CREATE POLICY read_rows ON concloud."Document" FOR SELECT TO concloud_runtime USING(concloud.company_access("organizationId","companyId") AND (visibility='PUBLISHED' OR concloud.staff_access("organizationId","companyId") OR "uploadedBy"=concloud.actor()));
CREATE POLICY insert_rows ON concloud."Document" FOR INSERT TO concloud_runtime WITH CHECK(concloud.company_access("organizationId","companyId"));
CREATE POLICY update_rows ON concloud."Document" FOR UPDATE TO concloud_runtime USING(concloud.company_access("organizationId","companyId")) WITH CHECK(concloud.company_access("organizationId","companyId"));
CREATE POLICY read_rows ON concloud."DocumentVersion" FOR SELECT TO concloud_runtime USING(EXISTS(SELECT 1 FROM concloud."Document" d WHERE d.id="DocumentVersion"."documentId"));
CREATE POLICY insert_rows ON concloud."DocumentVersion" FOR INSERT TO concloud_runtime WITH CHECK(concloud.company_access("organizationId","companyId"));
CREATE POLICY read_rows ON concloud."DocumentRequest" FOR SELECT TO concloud_runtime USING(concloud.company_access("organizationId","companyId"));
CREATE POLICY insert_rows ON concloud."DocumentRequest" FOR INSERT TO concloud_runtime WITH CHECK(concloud.company_access("organizationId","companyId"));
CREATE POLICY update_rows ON concloud."DocumentRequest" FOR UPDATE TO concloud_runtime USING(concloud.company_access("organizationId","companyId")) WITH CHECK(concloud.company_access("organizationId","companyId"));
CREATE POLICY read_rows ON concloud."AccountingPeriod" FOR SELECT TO concloud_runtime USING(concloud.company_access("organizationId","companyId"));
CREATE POLICY insert_rows ON concloud."AccountingPeriod" FOR INSERT TO concloud_runtime WITH CHECK(concloud.company_access("organizationId","companyId"));
CREATE POLICY update_rows ON concloud."AccountingPeriod" FOR UPDATE TO concloud_runtime USING(concloud.company_access("organizationId","companyId")) WITH CHECK(concloud.company_access("organizationId","companyId"));
CREATE POLICY read_rows ON concloud."ClosingTask" FOR SELECT TO concloud_runtime USING(concloud.company_access("organizationId","companyId"));
CREATE POLICY insert_rows ON concloud."ClosingTask" FOR INSERT TO concloud_runtime WITH CHECK(concloud.staff_access("organizationId","companyId"));
CREATE POLICY update_rows ON concloud."ClosingTask" FOR UPDATE TO concloud_runtime USING(concloud.staff_access("organizationId","companyId")) WITH CHECK(concloud.staff_access("organizationId","companyId"));
CREATE POLICY read_rows ON concloud."ClosingTransition" FOR SELECT TO concloud_runtime USING(concloud.company_access("organizationId","companyId"));
CREATE POLICY insert_rows ON concloud."ClosingTransition" FOR INSERT TO concloud_runtime WITH CHECK(concloud.staff_access("organizationId","companyId"));
CREATE POLICY read_rows ON concloud."ExportBatch" FOR SELECT TO concloud_runtime USING(concloud.staff_access("organizationId","companyId"));
CREATE POLICY insert_rows ON concloud."ExportBatch" FOR INSERT TO concloud_runtime WITH CHECK(concloud.staff_access("organizationId","companyId"));
CREATE POLICY update_rows ON concloud."ExportBatch" FOR UPDATE TO concloud_runtime USING(concloud.staff_access("organizationId","companyId")) WITH CHECK(concloud.staff_access("organizationId","companyId"));
CREATE POLICY read_rows ON concloud."ProcessingBatch" FOR SELECT TO concloud_runtime USING(concloud.staff_access("organizationId","companyId"));
CREATE POLICY insert_rows ON concloud."ProcessingBatch" FOR INSERT TO concloud_runtime WITH CHECK(concloud.staff_access("organizationId","companyId"));
CREATE POLICY read_rows ON concloud."Review" FOR SELECT TO concloud_runtime USING(concloud.staff_access("organizationId","companyId"));
CREATE POLICY insert_rows ON concloud."Review" FOR INSERT TO concloud_runtime WITH CHECK(concloud.staff_access("organizationId","companyId"));
CREATE POLICY read_rows ON concloud."TaxObligation" FOR SELECT TO concloud_runtime USING(concloud.company_access("organizationId","companyId"));
CREATE POLICY insert_rows ON concloud."TaxObligation" FOR INSERT TO concloud_runtime WITH CHECK(concloud.staff_access("organizationId","companyId"));
CREATE POLICY update_rows ON concloud."TaxObligation" FOR UPDATE TO concloud_runtime USING(concloud.staff_access("organizationId","companyId")) WITH CHECK(concloud.staff_access("organizationId","companyId"));
CREATE POLICY read_rows ON concloud."TaxGuide" FOR SELECT TO concloud_runtime USING(concloud.company_access("organizationId","companyId"));
CREATE POLICY insert_rows ON concloud."TaxGuide" FOR INSERT TO concloud_runtime WITH CHECK(concloud.staff_access("organizationId","companyId"));
CREATE POLICY update_rows ON concloud."TaxGuide" FOR UPDATE TO concloud_runtime USING(concloud.staff_access("organizationId","companyId")) WITH CHECK(concloud.staff_access("organizationId","companyId"));
CREATE POLICY read_rows ON concloud."TaxPayment" FOR SELECT TO concloud_runtime USING(concloud.company_access("organizationId","companyId"));
CREATE POLICY insert_rows ON concloud."TaxPayment" FOR INSERT TO concloud_runtime WITH CHECK(concloud.company_access("organizationId","companyId"));
CREATE POLICY update_rows ON concloud."TaxPayment" FOR UPDATE TO concloud_runtime USING(concloud.company_access("organizationId","companyId")) WITH CHECK(concloud.company_access("organizationId","companyId"));
CREATE POLICY read_rows ON concloud."FilingReceipt" FOR SELECT TO concloud_runtime USING(concloud.company_access("organizationId","companyId"));
CREATE POLICY insert_rows ON concloud."FilingReceipt" FOR INSERT TO concloud_runtime WITH CHECK(concloud.staff_access("organizationId","companyId"));
CREATE POLICY update_rows ON concloud."FilingReceipt" FOR UPDATE TO concloud_runtime USING(concloud.staff_access("organizationId","companyId")) WITH CHECK(concloud.staff_access("organizationId","companyId"));
CREATE POLICY read_rows ON concloud."Ticket" FOR SELECT TO concloud_runtime USING(concloud.company_access("organizationId","companyId"));
CREATE POLICY insert_rows ON concloud."Ticket" FOR INSERT TO concloud_runtime WITH CHECK(concloud.company_access("organizationId","companyId"));
CREATE POLICY update_rows ON concloud."Ticket" FOR UPDATE TO concloud_runtime USING(concloud.company_access("organizationId","companyId")) WITH CHECK(concloud.company_access("organizationId","companyId"));
CREATE POLICY read_rows ON concloud."TicketMessage" FOR SELECT TO concloud_runtime USING(concloud.company_access("organizationId","companyId"));
CREATE POLICY insert_rows ON concloud."TicketMessage" FOR INSERT TO concloud_runtime WITH CHECK(concloud.company_access("organizationId","companyId"));
CREATE POLICY update_rows ON concloud."TicketMessage" FOR UPDATE TO concloud_runtime USING(concloud.company_access("organizationId","companyId")) WITH CHECK(concloud.company_access("organizationId","companyId"));
CREATE POLICY read_rows ON concloud."AuditEvent" FOR SELECT TO concloud_runtime USING(concloud.company_access("organizationId","companyId") AND (concloud.staff_access("organizationId","companyId") OR "actorId"=concloud.actor()));
CREATE POLICY insert_rows ON concloud."AuditEvent" FOR INSERT TO concloud_runtime WITH CHECK(concloud.company_access("organizationId","companyId"));
CREATE POLICY read_rows ON concloud."IntegrationConnection" FOR SELECT TO concloud_runtime USING(concloud.company_access("organizationId","companyId"));
CREATE POLICY insert_rows ON concloud."IntegrationConnection" FOR INSERT TO concloud_runtime WITH CHECK(concloud.staff_access("organizationId","companyId"));
CREATE POLICY update_rows ON concloud."IntegrationConnection" FOR UPDATE TO concloud_runtime USING(concloud.staff_access("organizationId","companyId")) WITH CHECK(concloud.staff_access("organizationId","companyId"));
CREATE POLICY read_rows ON concloud."ExternalReference" FOR SELECT TO concloud_runtime USING(concloud.company_access("organizationId","companyId"));
CREATE POLICY insert_rows ON concloud."ExternalReference" FOR INSERT TO concloud_runtime WITH CHECK(concloud.staff_access("organizationId","companyId"));
CREATE POLICY update_rows ON concloud."ExternalReference" FOR UPDATE TO concloud_runtime USING(concloud.staff_access("organizationId","companyId")) WITH CHECK(concloud.staff_access("organizationId","companyId"));
CREATE POLICY read_rows ON concloud."OutboxEvent" FOR SELECT TO concloud_runtime USING(concloud.staff_access("organizationId","companyId"));
CREATE POLICY insert_rows ON concloud."OutboxEvent" FOR INSERT TO concloud_runtime WITH CHECK(concloud.staff_access("organizationId","companyId"));
CREATE POLICY update_rows ON concloud."OutboxEvent" FOR UPDATE TO concloud_runtime USING(concloud.staff_access("organizationId","companyId")) WITH CHECK(concloud.staff_access("organizationId","companyId"));
CREATE POLICY read_rows ON concloud."WebhookEvent" FOR SELECT TO concloud_runtime USING(concloud.staff_access("organizationId","companyId"));
CREATE POLICY insert_rows ON concloud."WebhookEvent" FOR INSERT TO concloud_runtime WITH CHECK(concloud.staff_access("organizationId","companyId"));
CREATE POLICY update_rows ON concloud."WebhookEvent" FOR UPDATE TO concloud_runtime USING(concloud.staff_access("organizationId","companyId")) WITH CHECK(concloud.staff_access("organizationId","companyId"));
CREATE POLICY read_rows ON concloud."SyncRun" FOR SELECT TO concloud_runtime USING(concloud.staff_access("organizationId","companyId"));
CREATE POLICY insert_rows ON concloud."SyncRun" FOR INSERT TO concloud_runtime WITH CHECK(concloud.staff_access("organizationId","companyId"));
CREATE POLICY update_rows ON concloud."SyncRun" FOR UPDATE TO concloud_runtime USING(concloud.staff_access("organizationId","companyId")) WITH CHECK(concloud.staff_access("organizationId","companyId"));
CREATE POLICY read_rows ON concloud."AiInsight" FOR SELECT TO concloud_runtime USING(concloud.staff_access("organizationId","companyId"));
CREATE POLICY insert_rows ON concloud."AiInsight" FOR INSERT TO concloud_runtime WITH CHECK(concloud.staff_access("organizationId","companyId"));
CREATE POLICY update_rows ON concloud."AiInsight" FOR UPDATE TO concloud_runtime USING(concloud.staff_access("organizationId","companyId")) WITH CHECK(concloud.staff_access("organizationId","companyId"));
CREATE POLICY read_rows ON concloud."ServicePlan" FOR SELECT TO concloud_runtime USING(concloud.company_access("organizationId","companyId"));
CREATE POLICY insert_rows ON concloud."ServicePlan" FOR INSERT TO concloud_runtime WITH CHECK(concloud.staff_access("organizationId","companyId"));
CREATE POLICY update_rows ON concloud."ServicePlan" FOR UPDATE TO concloud_runtime USING(concloud.staff_access("organizationId","companyId")) WITH CHECK(concloud.staff_access("organizationId","companyId"));
CREATE POLICY read_rows ON concloud."CompanyServiceAgreement" FOR SELECT TO concloud_runtime USING(concloud.company_access("organizationId","companyId"));
CREATE POLICY insert_rows ON concloud."CompanyServiceAgreement" FOR INSERT TO concloud_runtime WITH CHECK(concloud.staff_access("organizationId","companyId"));
CREATE POLICY update_rows ON concloud."CompanyServiceAgreement" FOR UPDATE TO concloud_runtime USING(concloud.staff_access("organizationId","companyId")) WITH CHECK(concloud.staff_access("organizationId","companyId"));
REVOKE UPDATE,DELETE ON concloud."AuditEvent" FROM concloud_runtime;
REVOKE UPDATE,DELETE ON concloud."ClosingTransition" FROM concloud_runtime;
REVOKE UPDATE,DELETE ON concloud."DocumentVersion" FROM concloud_runtime;
REVOKE UPDATE,DELETE ON concloud."Review" FROM concloud_runtime;
REVOKE UPDATE,DELETE ON concloud."ProcessingBatch" FROM concloud_runtime;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA concloud FROM PUBLIC;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA concloud TO concloud_runtime;
ALTER TABLE concloud."FinancialTitle" ADD CONSTRAINT title_kind CHECK(kind IN ('PAYABLE','RECEIVABLE')), ADD CONSTRAINT title_positive CHECK(amount>0);
ALTER TABLE concloud."Installment" ADD CONSTRAINT installment_positive CHECK(amount>0 AND number>0);
ALTER TABLE concloud."Settlement" ADD CONSTRAINT settlement_positive CHECK(principal>0 AND interest>=0 AND fine>=0 AND discount>=0 AND principal+interest+fine-discount>=0), ADD CONSTRAINT reversal_reason CHECK(("reversedAt" IS NULL AND "reversalReason" IS NULL) OR ("reversedAt" IS NOT NULL AND length("reversalReason")>=8));
ALTER TABLE concloud."Transfer" ADD CONSTRAINT different_accounts CHECK("sourceId"<>"targetId" AND amount>0);
ALTER TABLE concloud."Reconciliation" ADD CONSTRAINT reconciliation_positive CHECK(amount>0);
ALTER TABLE concloud."Document" ADD CONSTRAINT document_visibility CHECK(visibility IN ('INTERNAL','PUBLISHED'));
ALTER TABLE concloud."DocumentVersion" ADD CONSTRAINT document_size CHECK(size>0 AND size<=10485760);
ALTER TABLE concloud."AccountingPeriod" ADD CONSTRAINT separate_reviewer CHECK("responsibleId"<>"reviewerId"), ADD CONSTRAINT valid_competence CHECK(competence ~ '^\d{4}-(0[1-9]|1[0-2])$');
ALTER TABLE concloud."CompanyTaxProfileHistory" ADD CONSTRAINT tax_dates CHECK("validTo" IS NULL OR "validTo">="validFrom");
ALTER TABLE concloud."TaxPayment" ADD CONSTRAINT payment_state CHECK(status IN ('REPORTED','PROOF_ATTACHED','VERIFIED')), ADD CONSTRAINT payment_positive CHECK(amount>0);
ALTER TABLE concloud."Contact" ADD CONSTRAINT contact_kind CHECK(kind IN ('CUSTOMER','SUPPLIER','BOTH'));
ALTER TABLE concloud."CompanyPartner" ADD CONSTRAINT partner_share CHECK(share>=0 AND share<=100);
CREATE INDEX audit_timeline ON concloud."AuditEvent"("companyId","createdAt" DESC);
CREATE INDEX outbox_pending ON concloud."OutboxEvent"("createdAt") WHERE "completedAt" IS NULL;
CREATE INDEX installment_due ON concloud."Installment"("companyId","dueDate");

-- CreateEnum
CREATE TYPE "EstablishmentRole" AS ENUM ('DEPOSIT', 'DESTINATION');

-- CreateTable
CREATE TABLE "IbgeUf" (
    "id" INTEGER NOT NULL,
    "sigla" VARCHAR(2) NOT NULL,
    "nome" TEXT NOT NULL,

    CONSTRAINT "IbgeUf_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IbgeMunicipio" (
    "id" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "ufId" INTEGER NOT NULL,

    CONSTRAINT "IbgeMunicipio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityBranch" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "EstablishmentRole" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivityBranch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Establishment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "activityBranchId" TEXT NOT NULL,
    "role" "EstablishmentRole" NOT NULL,
    "legalName" TEXT NOT NULL,
    "tradeName" TEXT NOT NULL,
    "cnpj" VARCHAR(18),
    "stateReg" VARCHAR(32),
    "municipalReg" VARCHAR(32),
    "cep" VARCHAR(9),
    "street" VARCHAR(255),
    "number" VARCHAR(32),
    "complement" VARCHAR(128),
    "district" VARCHAR(128),
    "cityName" VARCHAR(128),
    "ufSigla" VARCHAR(2),
    "ibgeCityCode" INTEGER,
    "receitaPayload" JSONB,
    "legalRepFullName" TEXT,
    "legalRepCpf" VARCHAR(14),
    "legalRepEmail" TEXT,
    "legalRepPhone" TEXT,
    "legalRepDocPath" VARCHAR(512),
    "legacyAddress" TEXT,
    "code" VARCHAR(32),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Establishment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IbgeUf_sigla_key" ON "IbgeUf"("sigla");
CREATE INDEX "IbgeMunicipio_ufId_idx" ON "IbgeMunicipio"("ufId");
CREATE INDEX "ActivityBranch_tenantId_idx" ON "ActivityBranch"("tenantId");
CREATE UNIQUE INDEX "ActivityBranch_tenantId_name_role_key" ON "ActivityBranch"("tenantId", "name", "role");
CREATE INDEX "Establishment_tenantId_idx" ON "Establishment"("tenantId");
CREATE INDEX "Establishment_tenantId_role_idx" ON "Establishment"("tenantId", "role");
CREATE INDEX "Establishment_activityBranchId_idx" ON "Establishment"("activityBranchId");

ALTER TABLE "IbgeMunicipio" ADD CONSTRAINT "IbgeMunicipio_ufId_fkey" FOREIGN KEY ("ufId") REFERENCES "IbgeUf"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActivityBranch" ADD CONSTRAINT "ActivityBranch_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Establishment" ADD CONSTRAINT "Establishment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Establishment" ADD CONSTRAINT "Establishment_activityBranchId_fkey" FOREIGN KEY ("activityBranchId") REFERENCES "ActivityBranch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- UFs (IBGE)
INSERT INTO "IbgeUf" ("id", "sigla", "nome") VALUES
(11,'RO','Rondônia'),(12,'AC','Acre'),(13,'AM','Amazonas'),(14,'RR','Roraima'),(15,'PA','Pará'),
(16,'AP','Amapá'),(17,'TO','Tocantins'),(21,'MA','Maranhão'),(22,'PI','Piauí'),(23,'CE','Ceará'),
(24,'RN','Rio Grande do Norte'),(25,'PB','Paraíba'),(26,'PE','Pernambuco'),(27,'AL','Alagoas'),
(28,'SE','Sergipe'),(29,'BA','Bahia'),(31,'MG','Minas Gerais'),(32,'ES','Espírito Santo'),
(33,'RJ','Rio de Janeiro'),(35,'SP','São Paulo'),(41,'PR','Paraná'),(42,'SC','Santa Catarina'),
(43,'RS','Rio Grande do Sul'),(50,'MS','Mato Grosso do Sul'),(51,'MT','Mato Grosso'),
(52,'GO','Goiás'),(53,'DF','Distrito Federal');

-- Ramos padrão por tenant
INSERT INTO "ActivityBranch" ("id","tenantId","name","role","active","createdAt","updatedAt")
SELECT gen_random_uuid(), t."id", 'Depósito', 'DEPOSIT', true, NOW(), NOW() FROM "Tenant" t;

INSERT INTO "ActivityBranch" ("id","tenantId","name","role","active","createdAt","updatedAt")
SELECT gen_random_uuid(), t."id", 'Destino final', 'DESTINATION', true, NOW(), NOW() FROM "Tenant" t;

-- Migrar depósitos (mantém mesmo id)
INSERT INTO "Establishment" (
  "id","tenantId","activityBranchId","role","legalName","tradeName","cnpj",
  "legacyAddress","code","active","createdAt","updatedAt"
)
SELECT
  d."id",
  d."tenantId",
  ab."id",
  'DEPOSIT'::"EstablishmentRole",
  d."name",
  d."name",
  NULL,
  d."address",
  d."code",
  d."active",
  d."createdAt",
  d."updatedAt"
FROM "Deposit" d
INNER JOIN "ActivityBranch" ab ON ab."tenantId" = d."tenantId" AND ab."role" = 'DEPOSIT' AND ab."name" = 'Depósito';

-- Migrar centros de destinação
INSERT INTO "Establishment" (
  "id","tenantId","activityBranchId","role","legalName","tradeName","cnpj",
  "legacyAddress","code","active","createdAt","updatedAt"
)
SELECT
  rc."id",
  rc."tenantId",
  ab."id",
  'DESTINATION'::"EstablishmentRole",
  rc."name",
  rc."name",
  NULLIF(TRIM(rc."document"), ''),
  rc."address",
  rc."code",
  rc."active",
  rc."createdAt",
  rc."updatedAt"
FROM "RecyclingCenter" rc
INNER JOIN "ActivityBranch" ab ON ab."tenantId" = rc."tenantId" AND ab."role" = 'DESTINATION' AND ab."name" = 'Destino final';

-- Stock: trocar FKs para Establishment
ALTER TABLE "StockBalance" DROP CONSTRAINT "StockBalance_depositId_fkey";
ALTER TABLE "StockBalance" RENAME COLUMN "depositId" TO "establishmentId";
ALTER TABLE "StockBalance" ADD CONSTRAINT "StockBalance_establishmentId_fkey" FOREIGN KEY ("establishmentId") REFERENCES "Establishment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StockMovement" DROP CONSTRAINT "StockMovement_depositFromId_fkey";
ALTER TABLE "StockMovement" DROP CONSTRAINT "StockMovement_depositToId_fkey";
ALTER TABLE "StockMovement" RENAME COLUMN "depositFromId" TO "establishmentFromId";
ALTER TABLE "StockMovement" RENAME COLUMN "depositToId" TO "establishmentToId";
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_establishmentFromId_fkey" FOREIGN KEY ("establishmentFromId") REFERENCES "Establishment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_establishmentToId_fkey" FOREIGN KEY ("establishmentToId") REFERENCES "Establishment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

DROP INDEX IF EXISTS "StockMovement_depositToId_idx";
DROP INDEX IF EXISTS "StockMovement_depositFromId_idx";
CREATE INDEX "StockMovement_establishmentToId_idx" ON "StockMovement"("establishmentToId");
CREATE INDEX "StockMovement_establishmentFromId_idx" ON "StockMovement"("establishmentFromId");

ALTER TABLE "StockExit" DROP CONSTRAINT "StockExit_centerId_fkey";
ALTER TABLE "StockExit" RENAME COLUMN "centerId" TO "establishmentId";
ALTER TABLE "StockExit" ADD CONSTRAINT "StockExit_establishmentId_fkey" FOREIGN KEY ("establishmentId") REFERENCES "Establishment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

DROP INDEX IF EXISTS "StockExit_centerId_idx";
CREATE INDEX "StockExit_establishmentId_idx" ON "StockExit"("establishmentId");

DROP TABLE "Deposit";
DROP TABLE "RecyclingCenter";

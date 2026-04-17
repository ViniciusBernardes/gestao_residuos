-- Brasão do município (menu e relatórios)
ALTER TABLE "Tenant" ADD COLUMN "coatOfArmsFilePath" VARCHAR(512);
ALTER TABLE "Tenant" ADD COLUMN "coatOfArmsOriginalName" VARCHAR(255);

-- Acesso total ao sistema (antigo administrador)
ALTER TABLE "PermissionProfile" ADD COLUMN "fullAccess" BOOLEAN NOT NULL DEFAULT false;

-- Perfis padrão por tenant (JSON completo para gestor; restrito para operador)
-- Gestor: todos os módulos view+edit, sem fullAccess (não passa em rotas só @Roles(ADMIN))
INSERT INTO "PermissionProfile" ("id", "tenantId", "name", "description", "permissions", "active", "fullAccess", "createdAt", "updatedAt")
SELECT gen_random_uuid(), t.id, 'Acesso total', 'Equivalente ao antigo administrador do sistema', '{}'::jsonb, true, true, NOW(), NOW()
FROM "Tenant" t;

INSERT INTO "PermissionProfile" ("id", "tenantId", "name", "description", "permissions", "active", "fullAccess", "createdAt", "updatedAt")
SELECT gen_random_uuid(), t.id, 'Gestor', 'Acesso amplo a cadastros e operações', '{"dashboard":{"view":true,"edit":true},"config_ramos":{"view":true,"edit":true},"config_tipos_material":{"view":true,"edit":true},"config_unidades":{"view":true,"edit":true},"materiais":{"view":true,"edit":true},"estabelecimentos":{"view":true,"edit":true},"integracoes":{"view":true,"edit":true},"estoque":{"view":true,"edit":true},"saidas":{"view":true,"edit":true},"usuarios":{"view":true,"edit":true},"relatorios":{"view":true,"edit":true},"auditoria":{"view":true,"edit":true},"admin":{"view":true,"edit":true},"permissoes":{"view":true,"edit":true}}'::jsonb, true, false, NOW(), NOW()
FROM "Tenant" t;

INSERT INTO "PermissionProfile" ("id", "tenantId", "name", "description", "permissions", "active", "fullAccess", "createdAt", "updatedAt")
SELECT gen_random_uuid(), t.id, 'Operador', 'Consulta e operações de estoque/saídas', '{"dashboard":{"view":true,"edit":false},"config_ramos":{"view":false,"edit":false},"config_tipos_material":{"view":false,"edit":false},"config_unidades":{"view":false,"edit":false},"materiais":{"view":true,"edit":false},"estabelecimentos":{"view":true,"edit":false},"integracoes":{"view":true,"edit":false},"estoque":{"view":true,"edit":true},"saidas":{"view":true,"edit":true},"usuarios":{"view":false,"edit":false},"relatorios":{"view":true,"edit":false},"auditoria":{"view":false,"edit":false},"admin":{"view":false,"edit":false},"permissoes":{"view":false,"edit":false}}'::jsonb, true, false, NOW(), NOW()
FROM "Tenant" t;

-- Vincular usuários existentes ao perfil adequado (por papel antigo)
UPDATE "User" u SET "permissionProfileId" = p.id
FROM "PermissionProfile" p
WHERE p."tenantId" = u."tenantId" AND p."name" = 'Acesso total' AND u."role" = 'ADMIN';

UPDATE "User" u SET "permissionProfileId" = p.id
FROM "PermissionProfile" p
WHERE p."tenantId" = u."tenantId" AND p."name" = 'Gestor' AND u."role" = 'MANAGER';

UPDATE "User" u SET "permissionProfileId" = p.id
FROM "PermissionProfile" p
WHERE p."tenantId" = u."tenantId" AND p."name" = 'Operador' AND u."role" = 'OPERATOR';

-- Garantir que ninguém ficou sem perfil (fallback operador)
UPDATE "User" u SET "permissionProfileId" = (
  SELECT p.id FROM "PermissionProfile" p WHERE p."tenantId" = u."tenantId" AND p."name" = 'Operador' LIMIT 1
)
WHERE u."permissionProfileId" IS NULL;

ALTER TABLE "User" DROP COLUMN "role";

ALTER TABLE "User" ALTER COLUMN "permissionProfileId" SET NOT NULL;

ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_permissionProfileId_fkey";
ALTER TABLE "User" ADD CONSTRAINT "User_permissionProfileId_fkey" FOREIGN KEY ("permissionProfileId") REFERENCES "PermissionProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

DROP TYPE IF EXISTS "UserRole";

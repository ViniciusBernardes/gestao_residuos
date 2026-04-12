import { PrismaClient, MovementType, EstablishmentRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const operadorPermissions = {
  dashboard: { view: true, edit: false },
  config_ramos: { view: false, edit: false },
  config_tipos_material: { view: false, edit: false },
  config_unidades: { view: false, edit: false },
  materiais: { view: true, edit: false },
  estabelecimentos: { view: true, edit: false },
  integracoes: { view: true, edit: false },
  estoque: { view: true, edit: true },
  saidas: { view: true, edit: true },
  usuarios: { view: false, edit: false },
  relatorios: { view: true, edit: false },
  auditoria: { view: false, edit: false },
  admin: { view: false, edit: false },
  permissoes: { view: false, edit: false },
};

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo-municipio' },
    update: {},
    create: {
      name: 'Município Demonstração',
      slug: 'demo-municipio',
      active: true,
    },
  });

  let profAdmin = await prisma.permissionProfile.findFirst({
    where: { tenantId: tenant.id, name: 'Acesso total' },
  });
  if (!profAdmin) {
    profAdmin = await prisma.permissionProfile.create({
      data: {
        tenantId: tenant.id,
        name: 'Acesso total',
        description: 'Acesso total ao sistema',
        fullAccess: true,
        permissions: {},
      },
    });
  }

  let profOp = await prisma.permissionProfile.findFirst({
    where: { tenantId: tenant.id, name: 'Operador' },
  });
  if (!profOp) {
    profOp = await prisma.permissionProfile.create({
      data: {
        tenantId: tenant.id,
        name: 'Operador',
        description: 'Consulta e operações de estoque/saídas',
        fullAccess: false,
        permissions: operadorPermissions,
      },
    });
  }

  const hash = await bcrypt.hash('Admin@123', 10);
  await prisma.user.upsert({
    where: {
      tenantId_email: { tenantId: tenant.id, email: 'admin@demo.local' },
    },
    update: { passwordHash: hash, permissionProfileId: profAdmin.id },
    create: {
      tenantId: tenant.id,
      email: 'admin@demo.local',
      passwordHash: hash,
      name: 'Administrador',
      active: true,
      permissionProfileId: profAdmin.id,
    },
  });

  const opHash = await bcrypt.hash('Operador@123', 10);
  await prisma.user.upsert({
    where: {
      tenantId_email: { tenantId: tenant.id, email: 'operador@demo.local' },
    },
    update: { passwordHash: opHash, permissionProfileId: profOp.id },
    create: {
      tenantId: tenant.id,
      email: 'operador@demo.local',
      passwordHash: opHash,
      name: 'Operador',
      active: true,
      permissionProfileId: profOp.id,
    },
  });

  const tipoPapel = await prisma.materialType.upsert({
    where: {
      tenantId_name: { tenantId: tenant.id, name: 'Papel e papelão' },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Papel e papelão',
      description: 'Resíduos de papel',
      active: true,
    },
  });

  const kg = await prisma.unitOfMeasure.upsert({
    where: {
      tenantId_code: { tenantId: tenant.id, code: 'KG' },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      code: 'KG',
      name: 'Quilograma',
      active: true,
    },
  });

  const material = await prisma.recyclableMaterial.upsert({
    where: {
      tenantId_name: { tenantId: tenant.id, name: 'Papelão ondulado' },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      materialTypeId: tipoPapel.id,
      unitId: kg.id,
      name: 'Papelão ondulado',
      code: 'PAPEL-001',
      active: true,
    },
  });

  const branchDep = await prisma.activityBranch.upsert({
    where: {
      tenantId_name_role: {
        tenantId: tenant.id,
        name: 'Depósito',
        role: EstablishmentRole.DEPOSIT,
      },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Depósito',
      role: EstablishmentRole.DEPOSIT,
      active: true,
    },
  });

  const branchDest = await prisma.activityBranch.upsert({
    where: {
      tenantId_name_role: {
        tenantId: tenant.id,
        name: 'Destino final',
        role: EstablishmentRole.DESTINATION,
      },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Destino final',
      role: EstablishmentRole.DESTINATION,
      active: true,
    },
  });

  let deposito = await prisma.establishment.findFirst({
    where: { tenantId: tenant.id, code: 'DEP-01' },
  });
  if (!deposito) {
    deposito = await prisma.establishment.create({
      data: {
        tenantId: tenant.id,
        activityBranchId: branchDep.id,
        role: EstablishmentRole.DEPOSIT,
        legalName: 'Galpão Central LTDA',
        tradeName: 'Galpão Central',
        cnpj: '00000000000191',
        legacyAddress: 'Rua Exemplo, 100',
        code: 'DEP-01',
        active: true,
      },
    });
  }

  let destino = await prisma.establishment.findFirst({
    where: { tenantId: tenant.id, code: 'CTR-01' },
  });
  if (!destino) {
    destino = await prisma.establishment.create({
      data: {
        tenantId: tenant.id,
        activityBranchId: branchDest.id,
        role: EstablishmentRole.DESTINATION,
        legalName: 'Cooperativa Verde LTDA',
        tradeName: 'Cooperativa Verde',
        cnpj: '33014556000196',
        code: 'CTR-01',
        active: true,
      },
    });
  }

  await prisma.stockBalance.upsert({
    where: {
      tenantId_establishmentId_materialId: {
        tenantId: tenant.id,
        establishmentId: deposito.id,
        materialId: material.id,
      },
    },
    update: { quantity: 100 },
    create: {
      tenantId: tenant.id,
      establishmentId: deposito.id,
      materialId: material.id,
      quantity: 100,
    },
  });

  const seedMov = await prisma.stockMovement.count({
    where: { tenantId: tenant.id, reference: 'COLETA-001' },
  });
  if (seedMov === 0) {
    await prisma.stockMovement.create({
      data: {
        tenantId: tenant.id,
        materialId: material.id,
        type: MovementType.ENTRY,
        quantity: 100,
        establishmentToId: deposito.id,
        reference: 'COLETA-001',
        notes: 'Entrada inicial (seed)',
      },
    });
  }

  await prisma.systemParameter.upsert({
    where: {
      tenantId_key: { tenantId: tenant.id, key: 'app.version' },
    },
    update: { value: { v: '1.0.0-poc' } },
    create: {
      tenantId: tenant.id,
      key: 'app.version',
      value: { v: '1.0.0-poc' },
    },
  });

  await prisma.schemaVersion.upsert({
    where: { tenantId: tenant.id },
    update: { version: '1.0.0' },
    create: { tenantId: tenant.id, version: '1.0.0' },
  });

  console.log('Seed OK. Tenant:', tenant.slug);
  console.log('Login admin: admin@demo.local / Admin@123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

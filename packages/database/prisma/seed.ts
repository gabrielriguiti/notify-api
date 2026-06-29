import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('🌱 Seeding database...');

  const tenant = await prisma.tenant.upsert({
    where: { id: 'tenant-dev-001' },
    update: {},
    create: {
      id: 'tenant-dev-001',
      name: 'Dev Tenant',
    },
  });

  const apiKey = await prisma.apiKey.upsert({
    where: { key: 'dev-api-key-12345' },
    update: {},
    create: {
      key: 'dev-api-key-12345',
      tenantId: tenant.id,
    },
  });

  console.log('✅ Tenant created:', tenant.name);
  console.log('✅ API Key created:', apiKey.key);
  console.log('\n👉 Use this key in your requests:');
  console.log('   x-api-key: dev-api-key-12345\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

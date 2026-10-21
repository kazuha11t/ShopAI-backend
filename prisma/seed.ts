import 'dotenv/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../src/generated/prisma/client';
import { hashPassword } from '../src/auth/password';
import products from './products.seed.json';

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! }) });
  try {
    for (const product of products) {
      // Re-running seed never overwrites stock or manually edited products.
      await prisma.product.upsert({ where: { id: product.id }, create: product, update: {} });
    }
    if (process.env.SEED_DEMO === 'true') {
      await prisma.user.upsert({
        where: { email: 'demo@shopai.com' }, update: {},
        create: { email: 'demo@shopai.com', name: 'Khách Demo', passwordHash: await hashPassword('123456') },
      });
    }
    console.log('Catalog seeded. Demo account enabled only when SEED_DEMO=true.');
  } finally { await prisma.$disconnect(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

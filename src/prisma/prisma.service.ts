
import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../generated/prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error('DATABASE_URL chưa được cấu hình trong file .env');
    }

    const adapter = new PrismaBetterSqlite3({
      url: connectionString,
    });

    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
    console.log('Prisma connected to SQLite successfully.');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

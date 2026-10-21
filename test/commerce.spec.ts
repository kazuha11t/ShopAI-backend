import { Test } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { mkdtempSync, rmSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import Database from 'better-sqlite3';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AiService } from '../src/ai/ai.service';
jest.setTimeout(30000);

describe('ShopAI real SQLite API journey', () => {
  let app: INestApplication;
  let db: PrismaService;
  let folder: string;
  let token: string;
  let otherToken: string;
  let orderId: string;
  const originalDb = process.env.DATABASE_URL;
  const originalJwt = process.env.JWT_SECRET;
  const input = {
    requestId: 'checkout-test-request-0001',
    expectedTotal: 225000,
    items: [{ productId: 1, quantity: 2 }],
    customerName: 'Test Customer', customerPhone: '0987654321', customerAddress: '123 Test Street',
  };

  beforeAll(async () => {
    folder = mkdtempSync(join(tmpdir(), 'shopai-test-'));
    process.env.DATABASE_URL = `file:${join(folder, 'test.db').replaceAll('\\', '/')}`;
    process.env.JWT_SECRET = 'test-only-secret-with-more-than-32-characters';
    const sqlite = new Database(join(folder, 'test.db'));
    try {
      for (const migration of readdirSync('prisma/migrations').filter(name => /^\d/.test(name)).sort()) {
        sqlite.exec(readFileSync(join('prisma/migrations', migration, 'migration.sql'), 'utf8'));
      }
    } finally { sqlite.close(); }
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AiService).useValue({ chat: async () => 'AI test response' }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    db = app.get(PrismaService);
    await db.product.create({ data: { id: 1, name: 'Test Product', price: 100000, stock: 10 } });
  }, 120000);

  afterAll(async () => {
    if (app) await app.close();
    if (originalDb === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = originalDb;
    if (originalJwt === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = originalJwt;
    if (folder && resolve(folder).startsWith(resolve(tmpdir()) + '\\shopai-test-') ||
        folder && resolve(folder).startsWith(resolve(tmpdir()) + '/shopai-test-')) {
      rmSync(folder, { recursive: true, force: true });
    }
  });

  it('registers, normalizes email, hashes passwords and rejects duplicates', async () => {
    const response = await request(app.getHttpServer()).post('/api/auth/register')
      .send({ name: 'Alice', email: 'Alice@example.com', password: 'secret123' }).expect(201);
    token = response.body.accessToken;
    expect(response.body.user.passwordHash).toBeUndefined();
    const user = await db.user.findUniqueOrThrow({ where: { email: 'alice@example.com' } });
    expect(user.passwordHash).not.toContain('secret123');
    await request(app.getHttpServer()).post('/api/auth/register')
      .send({ name: 'Alice', email: 'alice@example.com', password: 'secret123' }).expect(409);
    const other = await request(app.getHttpServer()).post('/api/auth/register')
      .send({ name: 'Bob', email: 'bob@example.com', password: 'secret123' }).expect(201);
    otherToken = other.body.accessToken;
  });
  it('logs in with a real password and rejects invalid credentials', async () => {
    await request(app.getHttpServer()).post('/api/auth/login')
      .send({ email: 'alice@example.com', password: 'incorrect' }).expect(401);
    const response = await request(app.getHttpServer()).post('/api/auth/login')
      .send({ email: 'alice@example.com', password: 'secret123' }).expect(200);
    expect(response.body.accessToken).toEqual(expect.any(String));
  });
  it('paginates real products and rejects invalid page and public writes', async () => {
    const response = await request(app.getHttpServer()).get('/api/products?page=1&limit=1').expect(200);
    expect(response.body).toMatchObject({ total: 1, data: [{ id: '1', price: 100000 }] });
    await request(app.getHttpServer()).get('/api/products?page=0').expect(400);
    await request(app.getHttpServer()).post('/api/products').send({ name: 'Attack', price: 1 }).expect(403);
  });
  it('requires JWT for orders and AI', async () => {
    await request(app.getHttpServer()).get('/api/orders').expect(401);
    await request(app.getHttpServer()).post('/api/orders').send(input).expect(401);
    await request(app.getHttpServer()).post('/api/ai/chat').send({ message: 'Hello' }).expect(401);
    await request(app.getHttpServer()).get('/api/orders').auth('invalid-token', { type: 'bearer' }).expect(401);
  });
  it('calculates prices on the server and rejects tampered totals and quantities', async () => {
    const quote = await request(app.getHttpServer()).post('/api/orders/quote').auth(token, { type: 'bearer' })
      .send({ items: input.items, voucherCode: 'SALE10' }).expect(201);
    expect(quote.body).toMatchObject({ subtotal: 200000, discount: 20000, shippingFee: 25000, totalAmount: 205000 });
    await request(app.getHttpServer()).post('/api/orders').auth(token, { type: 'bearer' })
      .send({ ...input, totalAmount: 1 }).expect(400);
    await request(app.getHttpServer()).post('/api/orders').auth(token, { type: 'bearer' })
      .send({ ...input, items: [{ productId: 1, quantity: -1 }] }).expect(400);
  });
  it('creates PENDING once, reserves stock once and prevents overselling', async () => {
    const first = await request(app.getHttpServer()).post('/api/orders').auth(token, { type: 'bearer' }).send(input).expect(201);
    orderId = first.body.id;
    expect(first.body).toMatchObject({ status: 'PENDING', totalAmount: 225000 });
    const retry = await request(app.getHttpServer()).post('/api/orders').auth(token, { type: 'bearer' }).send(input).expect(201);
    expect(retry.body.id).toBe(orderId);
    expect((await db.product.findUniqueOrThrow({ where: { id: 1 } })).stock).toBe(8);
    await request(app.getHttpServer()).post('/api/orders').auth(token, { type: 'bearer' })
      .send({ ...input, requestId: 'checkout-test-request-0002', items: [{ productId: 1, quantity: 9 }] }).expect(400);
  });
  it('isolates order history and payment between users', async () => {
    const other = await request(app.getHttpServer()).get('/api/orders').auth(otherToken, { type: 'bearer' }).expect(200);
    expect(other.body).toEqual([]);
    await request(app.getHttpServer()).get(`/api/orders/${orderId}`).auth(otherToken, { type: 'bearer' }).expect(404);
    await request(app.getHttpServer()).post(`/api/orders/${orderId}/pay`).auth(otherToken, { type: 'bearer' }).expect(404);
  });
  it('pays idempotently and persists PAID across database reconnect', async () => {
    for (let attempt = 0; attempt < 2; attempt++) {
      const result = await request(app.getHttpServer()).post(`/api/orders/${orderId}/pay`).auth(token, { type: 'bearer' }).expect(201);
      expect(result.body.status).toBe('PAID');
    }
    await db.$disconnect(); await db.$connect();
    const order = await request(app.getHttpServer()).get(`/api/orders/${orderId}`).auth(token, { type: 'bearer' }).expect(200);
    expect(order.body.status).toBe('PAID');
    expect((await db.product.findUniqueOrThrow({ where: { id: 1 } })).stock).toBe(8);
  });
  it('validates AI history without calling a paid external API', async () => {
    await request(app.getHttpServer()).post('/api/ai/chat').auth(token, { type: 'bearer' })
      .send({ message: 'Hello', history: [{ role: 'invalid', content: 'x' }] }).expect(400);
    const response = await request(app.getHttpServer()).post('/api/ai/chat').auth(token, { type: 'bearer' })
      .send({ message: 'Hello' }).expect(201);
    expect(response.body.reply).toBe('AI test response');
  });
});

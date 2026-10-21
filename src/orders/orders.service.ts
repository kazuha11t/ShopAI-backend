import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto, QuoteDto } from './orders.dto';
import type { Prisma } from '../generated/prisma/client';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  private async calculate(db: Prisma.TransactionClient, dto: QuoteDto) {
    const ids = dto.items.map(item => item.productId);
    if (new Set(ids).size !== ids.length) throw new BadRequestException('Sản phẩm trùng trong giỏ.');
    const products = await db.product.findMany({ where: { id: { in: ids }, isActive: true } });
    const items = dto.items.map(item => {
      const product = products.find(p => p.id === item.productId);
      if (!product || product.stock < item.quantity) {
        throw new BadRequestException('Sản phẩm không còn đủ hàng.');
      }
      if (!Number.isSafeInteger(product.price) || product.price < 0) {
        throw new BadRequestException('Giá sản phẩm không hợp lệ.');
      }
      return {
        productId: product.id, name: product.name, image: product.imageUrl ?? '',
        price: product.price, quantity: item.quantity,
      };
    });
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const discount = dto.voucherCode === 'SALE10' ? Math.round(subtotal * 0.1)
      : dto.voucherCode === 'GIAM50K' ? Math.min(50000, subtotal) : 0;
    // Fixed delivery tariff for course checkout. GPS remains an estimate only.
    const shippingFee = dto.voucherCode === 'FREESHIP' ? 0 : 25000;
    const totalAmount = subtotal - discount + shippingFee;
    if (!Number.isSafeInteger(totalAmount) || totalAmount > 2147483647) {
      throw new BadRequestException('Tổng đơn vượt giới hạn cho phép.');
    }
    return { items, subtotal, discount, shippingFee, totalAmount };
  }

  quote(dto: QuoteDto) { return this.calculate(this.prisma, dto); }

  async create(userId: string, dto: CreateOrderDto) {
    const existing = await this.prisma.order.findUnique({
      where: { userId_requestId: { userId, requestId: dto.requestId } }, include: { items: true },
    });
    if (existing) return this.serialize(existing);
    try {
      const order = await this.prisma.$transaction(async tx => {
        const quote = await this.calculate(tx, dto);
        if (dto.expectedTotal !== quote.totalAmount) {
          throw new BadRequestException('Giá đã thay đổi. Vui lòng tải lại báo giá trước khi đặt hàng.');
        }
        for (const item of quote.items) {
          const result = await tx.product.updateMany({
            where: { id: item.productId, isActive: true, stock: { gte: item.quantity } },
            data: { stock: { decrement: item.quantity } },
          });
          if (result.count !== 1) throw new BadRequestException('Sản phẩm vừa hết hàng.');
        }
        return tx.order.create({
          data: {
            userId, requestId: dto.requestId,
            customerName: dto.customerName.trim(), customerPhone: dto.customerPhone,
            customerAddress: dto.customerAddress.trim(),
            totalAmount: quote.totalAmount, shippingFee: quote.shippingFee, discount: quote.discount,
            items: { create: quote.items },
          },
          include: { items: true },
        });
      });
      return this.serialize(order);
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        const retry = await this.prisma.order.findUnique({
          where: { userId_requestId: { userId, requestId: dto.requestId } }, include: { items: true },
        });
        if (retry) return this.serialize(retry);
      }
      throw error;
    }
  }

  async list(userId: string) {
    const orders = await this.prisma.order.findMany({
      where: { userId }, include: { items: true }, orderBy: { createdAt: 'desc' }, take: 100,
    });
    return orders.map(order => this.serialize(order));
  }

  async detail(userId: string, id: string) {
    const order = await this.prisma.order.findFirst({ where: { id, userId }, include: { items: true } });
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng.');
    return this.serialize(order);
  }

  async pay(userId: string, id: string) {
    const order = await this.detail(userId, id);
    if (order.status !== 'PENDING' && order.status !== 'PAID') {
      throw new BadRequestException('Không thể thanh toán đơn này.');
    }
    await this.prisma.order.updateMany({
      where: { id, userId, status: 'PENDING' }, data: { status: 'PAID', paidAt: new Date() },
    });
    return this.detail(userId, id);
  }

  private serialize(order: Prisma.OrderGetPayload<{ include: { items: true } }>) {
    return { ...order, items: order.items.map(item => ({ ...item, id: String(item.productId) })) };
  }
}

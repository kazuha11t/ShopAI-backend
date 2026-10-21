import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateProductDto) {
    return this.prisma.product.create({
      data: {
        name: dto.name,
        description: dto.description,
        price: dto.price,
        imageUrl: dto.imageUrl,
        stock: dto.stock,
        isActive: dto.isActive,
      },
    });
  }

  async findAll(page = 1, limit = 6) {
    if (page < 1 || page > 100000 || limit < 1 || limit > 100) {
      throw new BadRequestException('Phân trang không hợp lệ.');
    }
    const [products, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where: { isActive: true }, orderBy: { id: 'asc' },
        skip: (page - 1) * limit, take: limit,
      }),
      this.prisma.product.count({ where: { isActive: true } }),
    ]);
    return { data: products.map(p => ({ ...p, id: String(p.id), image: p.imageUrl ?? '' })), total };
  }

  async findOne(id: number) {
    const product = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!product || !product.isActive) {
      throw new NotFoundException(`Không tìm thấy sản phẩm ID ${id}`);
    }

    return { ...product, id: String(product.id), image: product.imageUrl ?? '' };
  }

  async update(id: number, dto: UpdateProductDto) {
    await this.findOne(id);

    return this.prisma.product.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: number) {
    await this.findOne(id);

    return this.prisma.product.update({
      where: { id },
      data: { isActive: false },
    });
  }
}

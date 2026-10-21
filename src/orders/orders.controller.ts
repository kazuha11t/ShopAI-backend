import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthRequest } from '../auth/auth.guard';
import { CreateOrderDto, QuoteDto } from './orders.dto';
import { OrdersService } from './orders.service';

@Controller('orders')
@UseGuards(AuthGuard)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}
  @Post('quote')
  quote(@Body() dto: QuoteDto) { return this.orders.quote(dto); }
  @Post()
  create(@Req() req: AuthRequest, @Body() dto: CreateOrderDto) { return this.orders.create(req.user.id, dto); }
  @Get()
  list(@Req() req: AuthRequest) { return this.orders.list(req.user.id); }
  @Get(':id')
  detail(@Req() req: AuthRequest, @Param('id') id: string) { return this.orders.detail(req.user.id, id); }
  @Post(':id/pay')
  pay(@Req() req: AuthRequest, @Param('id') id: string) { return this.orders.pay(req.user.id, id); }
}

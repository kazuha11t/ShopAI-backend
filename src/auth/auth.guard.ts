import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';

export type AuthRequest = Request & { user: { id: string } };

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService, private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const match = /^Bearer (.+)$/.exec(request.headers.authorization ?? '');
    if (!match) throw new UnauthorizedException();
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string }>(match[1], {
        algorithms: ['HS256'],
      });
      if (typeof payload.sub !== 'string') throw new Error('Invalid subject');
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user) throw new Error('Unknown user');
      request.user = { id: user.id };
      return true;
    } catch {
      throw new UnauthorizedException('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
    }
  }
}

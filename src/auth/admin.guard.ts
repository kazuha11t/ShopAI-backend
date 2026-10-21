import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';

/** Maintenance credential is server-side only; never shipped with the app. */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const expected = Buffer.from(process.env.ADMIN_API_KEY ?? '');
    const actual = Buffer.from(String(request.headers['x-admin-key'] ?? ''));
    if (expected.length < 32 || actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      throw new ForbiddenException();
    }
    return true;
  }
}

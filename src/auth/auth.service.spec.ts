import { AuthService } from './auth.service';
import { hashPassword } from './password';
import type { PrismaService } from '../prisma/prisma.service';
import type { JwtService } from '@nestjs/jwt';
describe('AuthService', () => {
  it('does not issue a token for a wrong password', async () => {
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue({
      id: 'u1', passwordHash: await hashPassword('correct-password'),
    }) } };
    const jwt = { signAsync: jest.fn() };
    const service = new AuthService(prisma as unknown as PrismaService, jwt as unknown as JwtService);
    await expect(service.login({ email: 'user@example.com', password: 'incorrect' })).rejects.toMatchObject({ status: 401 });
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });
});

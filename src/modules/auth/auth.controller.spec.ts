import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  const authService = {
    syncCurrentUser: jest.fn(),
  } as unknown as AuthService;

  it('is defined', () => {
    expect(new AuthController(authService)).toBeDefined();
  });
});

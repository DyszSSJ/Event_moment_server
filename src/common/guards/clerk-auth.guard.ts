import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { getAuth, type ExpressRequestWithAuth } from '@clerk/express';

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<ExpressRequestWithAuth>();
    const auth = getAuth(request);

    if (!auth.isAuthenticated || !auth.userId) {
      throw new UnauthorizedException({
        statusCode: 401,
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
    }

    return true;
  }
}

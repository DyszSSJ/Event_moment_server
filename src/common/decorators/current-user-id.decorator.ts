import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { getAuth, type ExpressRequestWithAuth } from '@clerk/express';

export const CurrentUserId = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<ExpressRequestWithAuth>();
    const auth = getAuth(request);

    if (!auth.userId) {
      throw new UnauthorizedException({
        statusCode: 401,
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
    }

    return auth.userId;
  },
);

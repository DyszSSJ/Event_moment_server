import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { getAuth, type ExpressRequestWithAuth } from '@clerk/express';

import { CurrentUserId } from '../../common/decorators/current-user-id.decorator';
import { ClerkAuthGuard } from '../../common/guards/clerk-auth.guard';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('me')
  @UseGuards(ClerkAuthGuard)
  async getMe(
    @CurrentUserId() userId: string,
    @Req() request: ExpressRequestWithAuth,
  ) {
    const auth = getAuth(request);
    const user = await this.authService.syncCurrentUser(userId);

    return {
      user,
      clerkUserId: userId,
      sessionId: auth.sessionId,
      orgId: auth.orgId,
    };
  }
}

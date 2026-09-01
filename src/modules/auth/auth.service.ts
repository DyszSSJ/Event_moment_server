import { Injectable, Logger } from '@nestjs/common';
import { clerkClient } from '@clerk/express';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly prisma: PrismaService) {}

  async syncCurrentUser(clerkId: string) {
    const email = await this.getPrimaryEmail(clerkId);

    return this.prisma.user.upsert({
      where: { clerkId },
      create: {
        clerkId,
        email,
      },
      update: {
        email,
      },
      select: {
        id: true,
        clerkId: true,
        email: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  private async getPrimaryEmail(clerkId: string) {
    try {
      const user = await clerkClient.users.getUser(clerkId);
      const primaryEmail = user.primaryEmailAddress?.emailAddress;

      if (primaryEmail) {
        return primaryEmail;
      }

      return user.emailAddresses[0]?.emailAddress ?? null;
    } catch (error) {
      this.logger.warn(
        `Unable to fetch Clerk user email for ${clerkId}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );

      return null;
    }
  }
}

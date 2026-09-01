jest.mock('@clerk/express', () => ({
  clerkClient: {
    users: {
      getUser: jest.fn(),
    },
  },
}));

import { clerkClient } from '@clerk/express';

import { AuthService } from './auth.service';

describe('AuthService', () => {
  const clerkUsersMock = jest.mocked(clerkClient.users);
  const prisma = {
    user: {
      upsert: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('upserts the current Clerk user with primary email', async () => {
    clerkUsersMock.getUser.mockResolvedValue({
      primaryEmailAddress: {
        emailAddress: 'host@example.com',
      },
      emailAddresses: [],
    } as never);

    prisma.user.upsert.mockResolvedValue({
      id: 'user_1',
      clerkId: 'clerk_1',
      email: 'host@example.com',
    });

    const service = new AuthService(prisma as never);
    const user = await service.syncCurrentUser('clerk_1');

    expect(prisma.user.upsert).toHaveBeenCalledWith({
      where: { clerkId: 'clerk_1' },
      create: {
        clerkId: 'clerk_1',
        email: 'host@example.com',
      },
      update: {
        email: 'host@example.com',
      },
      select: {
        id: true,
        clerkId: true,
        email: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    expect(user).toEqual({
      id: 'user_1',
      clerkId: 'clerk_1',
      email: 'host@example.com',
    });
  });

  it('does not block sync when Clerk email lookup fails', async () => {
    clerkUsersMock.getUser.mockRejectedValue(new Error('Clerk unavailable'));

    prisma.user.upsert.mockResolvedValue({
      id: 'user_1',
      clerkId: 'clerk_1',
      email: null,
    });

    const service = new AuthService(prisma as never);

    await service.syncCurrentUser('clerk_1');

    expect(prisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: {
          clerkId: 'clerk_1',
          email: null,
        },
        update: {
          email: null,
        },
      }),
    );
  });
});

/* eslint-disable @typescript-eslint/no-require-imports */
import { NextRequest } from 'next/server';
import { POST, PATCH } from './route';

// Mock the drizzle operations
jest.mock('@/lib/drizzle/operations', () => ({
  findUserByAddress: jest.fn(),
  upsertUser: jest.fn(),
}));

const mockFindUserByAddress = require('@/lib/drizzle/operations').findUserByAddress;
const mockUpsertUser = require('@/lib/drizzle/operations').upsertUser;

// Mock NextResponse
jest.mock('next/server', () => ({
  NextRequest: jest.fn(),
  NextResponse: {
    json: jest.fn((data, options) => ({ data, options }))
  }
}));

describe('Auth User API Route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    console.error = jest.fn();
  });

  describe('POST - Get or create user', () => {
    it('should create new user when user does not exist', async () => {
      const mockUser = {
        id: 1,
        address: '0x1234567890123456789012345678901234567890',
        deployedTokens: [],
        vestingSchedules: []
      };

      mockFindUserByAddress
        .mockResolvedValueOnce(null) // First call returns null
        .mockResolvedValueOnce(mockUser); // Second call returns created user
      mockUpsertUser.mockResolvedValue(mockUser);

      const request = {
        json: jest.fn().mockResolvedValue({
          address: '0x1234567890123456789012345678901234567890'
        })
      } as any;

      const response = await POST(request as NextRequest);

      expect(mockFindUserByAddress).toHaveBeenCalledTimes(2);
      expect(mockUpsertUser).toHaveBeenCalledWith('0x1234567890123456789012345678901234567890');
      expect((response as any).data).toEqual({
        ...mockUser,
        stats: {
          tokensDeployed: 0,
          totalBeneficiaries: 0,
          tokensReceiving: 0,
          totalTokensVested: 0,
          totalTokensClaimed: 0
        },
        isNewUser: true
      });
    });

    it('should return existing user when user exists', async () => {
      const mockUser = {
        id: 1,
        address: '0x1234567890123456789012345678901234567890',
        deployedTokens: [
          {
            vestingSchedules: [
              { totalAmount: '1000', releasedAmount: '500' },
              { totalAmount: '2000', releasedAmount: '1000' }
            ]
          }
        ],
        vestingSchedules: [
          { totalAmount: '500', releasedAmount: '250' }
        ]
      };

      mockFindUserByAddress.mockResolvedValue(mockUser);

      const request = {
        json: jest.fn().mockResolvedValue({
          address: '0x1234567890123456789012345678901234567890'
        })
      } as any;

      const response = await POST(request as NextRequest);

      expect(mockFindUserByAddress).toHaveBeenCalledTimes(1);
      expect(mockUpsertUser).not.toHaveBeenCalled();
      expect((response as any).data).toEqual({
        ...mockUser,
        stats: {
          tokensDeployed: 1,
          totalBeneficiaries: 2,
          tokensReceiving: 1,
          totalTokensVested: 500,
          totalTokensClaimed: 250
        },
        isNewUser: false
      });
    });

    it('should handle invalid address format', async () => {
      const request = {
        json: jest.fn().mockResolvedValue({
          address: 'invalid-address'
        })
      } as any;

      const response = await POST(request as NextRequest);

      expect((response as any).data).toEqual({ error: 'Failed to authenticate user' });
      expect((response as any).options).toEqual({ status: 500 });
      expect(console.error).toHaveBeenCalled();
    });

    it('should handle missing address', async () => {
      const request = {
        json: jest.fn().mockResolvedValue({})
      } as any;

      const response = await POST(request as NextRequest);

      expect((response as any).data).toEqual({ error: 'Failed to authenticate user' });
      expect((response as any).options).toEqual({ status: 500 });
      expect(console.error).toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      mockFindUserByAddress.mockRejectedValue(new Error('Database error'));

      const request = {
        json: jest.fn().mockResolvedValue({
          address: '0x1234567890123456789012345678901234567890'
        })
      } as any;

      const response = await POST(request as NextRequest);

      expect((response as any).data).toEqual({ error: 'Failed to authenticate user' });
      expect((response as any).options).toEqual({ status: 500 });
      expect(console.error).toHaveBeenCalled();
    });

    it('should handle user creation failure', async () => {
      mockFindUserByAddress
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      mockUpsertUser.mockResolvedValue(undefined);

      const request = {
        json: jest.fn().mockResolvedValue({
          address: '0x1234567890123456789012345678901234567890'
        })
      } as any;

      const response = await POST(request as NextRequest);

      expect((response as any).data).toEqual({ error: 'Failed to authenticate user' });
      expect((response as any).options).toEqual({ status: 500 });
      expect(console.error).toHaveBeenCalled();
    });

    it('should calculate statistics correctly for complex data', async () => {
      const mockUser = {
        id: 1,
        address: '0x1234567890123456789012345678901234567890',
        deployedTokens: [
          {
            vestingSchedules: [
              { totalAmount: '1000.5', releasedAmount: '500.25' },
              { totalAmount: '2000.75', releasedAmount: '1000.125' }
            ]
          },
          {
            vestingSchedules: [
              { totalAmount: '500.25', releasedAmount: '250.125' }
            ]
          }
        ],
        vestingSchedules: [
          { totalAmount: '750.5', releasedAmount: '375.25' },
          { totalAmount: '1250.75', releasedAmount: '625.375' }
        ]
      };

      mockFindUserByAddress.mockResolvedValue(mockUser);

      const request = {
        json: jest.fn().mockResolvedValue({
          address: '0x1234567890123456789012345678901234567890'
        })
      } as any;

      const response = await POST(request as NextRequest);

      expect((response as any).data.stats).toEqual({
        tokensDeployed: 2,
        totalBeneficiaries: 3,
        tokensReceiving: 2,
        totalTokensVested: 2001.25, // 750.5 + 1250.75
        totalTokensClaimed: 1000.625 // 375.25 + 625.375
      });
    });
  });

  describe('PATCH - Update user profile', () => {
    it('should update user profile successfully', async () => {
      const mockUpdatedUser = {
        id: 1,
        address: '0x1234567890123456789012345678901234567890',
        name: 'John Doe',
        email: 'john@example.com'
      };

      mockUpsertUser.mockResolvedValue(mockUpdatedUser);

      const request = {
        json: jest.fn().mockResolvedValue({
          address: '0x1234567890123456789012345678901234567890',
          name: 'John Doe',
          email: 'john@example.com'
        })
      } as any;

      const response = await PATCH(request as NextRequest);

      expect(mockUpsertUser).toHaveBeenCalledWith(
        '0x1234567890123456789012345678901234567890',
        { name: 'John Doe', email: 'john@example.com' }
      );
      expect((response as any).data).toEqual(mockUpdatedUser);
    });

    it('should handle partial profile updates', async () => {
      const mockUpdatedUser = {
        id: 1,
        address: '0x1234567890123456789012345678901234567890',
        name: 'John Doe'
      };

      mockUpsertUser.mockResolvedValue(mockUpdatedUser);

      const request = {
        json: jest.fn().mockResolvedValue({
          address: '0x1234567890123456789012345678901234567890',
          name: 'John Doe'
        })
      } as any;

      const response = await PATCH(request as NextRequest);

      expect(mockUpsertUser).toHaveBeenCalledWith(
        '0x1234567890123456789012345678901234567890',
        { name: 'John Doe' }
      );
      expect((response as any).data).toEqual(mockUpdatedUser);
    });

    it('should handle invalid email format', async () => {
      const request = {
        json: jest.fn().mockResolvedValue({
          address: '0x1234567890123456789012345678901234567890',
          email: 'invalid-email'
        })
      } as any;

      const response = await PATCH(request as NextRequest);

      expect((response as any).data).toEqual({ error: 'Failed to update profile' });
      expect((response as any).options).toEqual({ status: 500 });
      expect(console.error).toHaveBeenCalled();
    });

    it('should handle empty name', async () => {
      const request = {
        json: jest.fn().mockResolvedValue({
          address: '0x1234567890123456789012345678901234567890',
          name: ''
        })
      } as any;

      const response = await PATCH(request as NextRequest);

      expect((response as any).data).toEqual({ error: 'Failed to update profile' });
      expect((response as any).options).toEqual({ status: 500 });
      expect(console.error).toHaveBeenCalled();
    });

    it('should handle name too long', async () => {
      const longName = 'a'.repeat(101); // 101 characters
      const request = {
        json: jest.fn().mockResolvedValue({
          address: '0x1234567890123456789012345678901234567890',
          name: longName
        })
      } as any;

      const response = await PATCH(request as NextRequest);

      expect((response as any).data).toEqual({ error: 'Failed to update profile' });
      expect((response as any).options).toEqual({ status: 500 });
      expect(console.error).toHaveBeenCalled();
    });

    it('should handle missing address', async () => {
      const request = {
        json: jest.fn().mockResolvedValue({
          name: 'John Doe'
        })
      } as any;

      const response = await PATCH(request as NextRequest);

      expect((response as any).data).toEqual({ error: 'Failed to update profile' });
      expect((response as any).options).toEqual({ status: 500 });
      expect(console.error).toHaveBeenCalled();
    });

    it('should handle database errors during update', async () => {
      mockUpsertUser.mockRejectedValue(new Error('Database error'));

      const request = {
        json: jest.fn().mockResolvedValue({
          address: '0x1234567890123456789012345678901234567890',
          name: 'John Doe'
        })
      } as any;

      const response = await PATCH(request as NextRequest);

      expect((response as any).data).toEqual({ error: 'Failed to update profile' });
      expect((response as any).options).toEqual({ status: 500 });
      expect(console.error).toHaveBeenCalled();
    });

    it('should handle malformed JSON', async () => {
      const request = {
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON'))
      } as any;

      const response = await PATCH(request as NextRequest);

      expect((response as any).data).toEqual({ error: 'Failed to update profile' });
      expect((response as any).options).toEqual({ status: 500 });
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('Edge cases', () => {
    it('should handle very long valid names', async () => {
      const longName = 'a'.repeat(100); // Exactly 100 characters
      const mockUpdatedUser = {
        id: 1,
        address: '0x1234567890123456789012345678901234567890',
        name: longName
      };

      mockUpsertUser.mockResolvedValue(mockUpdatedUser);

      const request = {
        json: jest.fn().mockResolvedValue({
          address: '0x1234567890123456789012345678901234567890',
          name: longName
        })
      } as any;

      const response = await PATCH(request as NextRequest);

      expect((response as any).data).toEqual(mockUpdatedUser);
    });

    it('should handle special characters in names', async () => {
      const specialName = 'José María O\'Connor-Smith';
      const mockUpdatedUser = {
        id: 1,
        address: '0x1234567890123456789012345678901234567890',
        name: specialName
      };

      mockUpsertUser.mockResolvedValue(mockUpdatedUser);

      const request = {
        json: jest.fn().mockResolvedValue({
          address: '0x1234567890123456789012345678901234567890',
          name: specialName
        })
      } as any;

      const response = await PATCH(request as NextRequest);

      expect((response as any).data).toEqual(mockUpdatedUser);
    });

    it('should handle complex email addresses', async () => {
      const complexEmail = 'user.name+tag@subdomain.example.co.uk';
      const mockUpdatedUser = {
        id: 1,
        address: '0x1234567890123456789012345678901234567890',
        email: complexEmail
      };

      mockUpsertUser.mockResolvedValue(mockUpdatedUser);

      const request = {
        json: jest.fn().mockResolvedValue({
          address: '0x1234567890123456789012345678901234567890',
          email: complexEmail
        })
      } as any;

      const response = await PATCH(request as NextRequest);

      expect((response as any).data).toEqual(mockUpdatedUser);
    });
  });
});

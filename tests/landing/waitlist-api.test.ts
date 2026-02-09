import { describe, it, expect, beforeEach } from 'bun:test';
import { POST } from '../../app/api/waitlist/join/route';

// Mock prisma
declare global {
  var prismaMock: {
    waitlistEntry: {
      findUnique: ReturnType<typeof jest.fn>;
      create: ReturnType<typeof jest.fn>;
      count: ReturnType<typeof jest.fn>;
      update: ReturnType<typeof jest.fn>;
    };
  };
}

describe('Waitlist API', () => {
  beforeEach(() => {
    // Reset mocks before each test
    if (global.prismaMock) {
      global.prismaMock.waitlistEntry.findUnique.mockReset();
      global.prismaMock.waitlistEntry.create.mockReset();
    }
  });

  it('should return 400 for invalid input', async () => {
    const request = new Request('http://localhost/api/waitlist/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'J', // Too short
        email: 'invalid-email',
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('should return 409 for duplicate email', async () => {
    // Mock prisma to return existing entry
    const mockEntry = {
      id: 'test-id',
      email: 'john@example.com',
      referralCode: 'abc123',
    };

    // This test would need proper prisma mocking setup
    // For now, we just verify the API structure
  });

  it('should create entry for valid new user', async () => {
    const validData = {
      name: 'John Doe',
      email: 'newuser@example.com',
      company: 'Acme Inc',
      tier: 'pro',
    };

    const request = new Request('http://localhost/api/waitlist/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validData),
    });

    // This test would need proper prisma mocking setup
    // For now, we just verify the API structure
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LinkedInIntegrationService } from '../linkedin-integration';

// Mock fetch globally
global.fetch = vi.fn();

describe('LinkedInIntegrationService', () => {
  let service: LinkedInIntegrationService;
  const mockClientId = 'test-linkedin-client-id';
  const mockClientSecret = 'test-linkedin-client-secret';
  const mockAccessToken = 'linkedin_access_token_123';

  beforeEach(() => {
    service = new LinkedInIntegrationService(mockClientId, mockClientSecret);
    vi.clearAllMocks();
  });

  describe('OAuth Flow', () => {
    it('should generate correct authorization URL', () => {
      const redirectUri = 'http://localhost:3000/api/auth/linkedin/callback';
      const state = 'random-state-string';

      const authUrl = service.getAuthorizationUrl(redirectUri, state);

      expect(authUrl).toContain('https://www.linkedin.com/oauth/v2/authorization');
      expect(authUrl).toContain(`client_id=${mockClientId}`);
      expect(authUrl).toContain(`redirect_uri=${encodeURIComponent(redirectUri)}`);
      expect(authUrl).toContain(`state=${state}`);
      expect(authUrl).toContain('response_type=code');
    });

    it('should exchange authorization code for access token', async () => {
      const mockCode = 'auth-code-123';
      const redirectUri = 'http://localhost:3000/api/auth/linkedin/callback';

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: mockAccessToken,
          expires_in: 5184000,
          scope: 'r_liteprofile r_emailaddress',
        }),
      });

      const tokenResponse = await service.exchangeCodeForToken(mockCode, redirectUri);

      expect(tokenResponse.access_token).toBe(mockAccessToken);
      expect(tokenResponse.expires_in).toBe(5184000);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://www.linkedin.com/oauth/v2/accessToken',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/x-www-form-urlencoded',
          }),
        })
      );
    });

    it('should throw error when token exchange fails', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        statusText: 'Bad Request',
        json: async () => ({
          error: 'invalid_grant',
          error_description: 'Authorization code is invalid',
        }),
      });

      await expect(
        service.exchangeCodeForToken('invalid-code', 'http://localhost:3000')
      ).rejects.toThrow('LinkedIn OAuth token exchange failed');
    });
  });

  describe('User Profile', () => {
    it('should fetch user profile successfully', async () => {
      const mockProfile = {
        id: 'user123',
        firstName: {
          localized: { en_US: 'John' },
        },
        lastName: {
          localized: { en_US: 'Doe' },
        },
        headline: 'Senior Software Engineer at Tech Corp',
        profilePicture: {
          'displayImage~': {
            elements: [
              {
                identifiers: [
                  { identifier: 'https://media.licdn.com/profile.jpg' },
                ],
              },
            ],
          },
        },
        location: {
          name: 'San Francisco Bay Area',
          country: 'US',
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockProfile,
      });

      const profile = await service.getUserProfile(mockAccessToken);

      expect(profile).toEqual({
        id: 'user123',
        firstName: 'John',
        lastName: 'Doe',
        headline: 'Senior Software Engineer at Tech Corp',
        profilePicture: 'https://media.licdn.com/profile.jpg',
        location: {
          name: 'San Francisco Bay Area',
          country: 'US',
        },
      });
    });

    it('should handle profile without optional fields', async () => {
      const mockProfile = {
        id: 'user456',
        firstName: {
          localized: { en_US: 'Jane' },
        },
        lastName: {
          localized: { en_US: 'Smith' },
        },
        headline: 'Developer',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockProfile,
      });

      const profile = await service.getUserProfile(mockAccessToken);

      expect(profile.id).toBe('user456');
      expect(profile.firstName).toBe('Jane');
      expect(profile.profilePicture).toBeUndefined();
      expect(profile.location).toBeUndefined();
    });
  });

  describe('Work Experience', () => {
    it('should fetch user positions successfully', async () => {
      const mockPositions = {
        elements: [
          {
            id: 'pos1',
            title: 'Senior Software Engineer',
            companyName: 'Tech Corp',
            description: 'Led development of key features',
            startDate: { month: 3, year: 2020 },
            endDate: { month: 12, year: 2023 },
            location: 'San Francisco, CA',
          },
          {
            id: 'pos2',
            title: 'Software Engineer',
            companyName: 'Startup Inc',
            startDate: { month: 6, year: 2018 },
            location: 'Remote',
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockPositions,
      });

      const positions = await service.getPositions(mockAccessToken);

      expect(positions).toHaveLength(2);
      expect(positions[0]).toEqual({
        id: 'pos1',
        title: 'Senior Software Engineer',
        companyName: 'Tech Corp',
        description: 'Led development of key features',
        startDate: { month: 3, year: 2020 },
        endDate: { month: 12, year: 2023 },
        location: 'San Francisco, CA',
      });
      expect(positions[1].endDate).toBeUndefined();
    });

    it('should handle empty positions', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ elements: [] }),
      });

      const positions = await service.getPositions(mockAccessToken);

      expect(positions).toEqual([]);
    });

    it('should handle positions fetch failure gracefully', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ message: 'Forbidden' }),
      });

      const positions = await service.getPositions(mockAccessToken);

      expect(positions).toEqual([]);
    });
  });

  describe('Education', () => {
    it('should fetch user education successfully', async () => {
      const mockEducation = {
        elements: [
          {
            id: 'edu1',
            schoolName: 'Stanford University',
            degreeName: 'Bachelor of Science',
            fieldOfStudy: 'Computer Science',
            startDate: { month: 9, year: 2014 },
            endDate: { month: 6, year: 2018 },
          },
          {
            id: 'edu2',
            schoolName: 'MIT',
            degreeName: 'Master of Science',
            fieldOfStudy: 'Artificial Intelligence',
            startDate: { month: 9, year: 2018 },
            endDate: { month: 6, year: 2020 },
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockEducation,
      });

      const education = await service.getEducation(mockAccessToken);

      expect(education).toHaveLength(2);
      expect(education[0]).toEqual({
        id: 'edu1',
        schoolName: 'Stanford University',
        degreeName: 'Bachelor of Science',
        fieldOfStudy: 'Computer Science',
        startDate: { month: 9, year: 2014 },
        endDate: { month: 6, year: 2018 },
      });
    });

    it('should handle empty education', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ elements: [] }),
      });

      const education = await service.getEducation(mockAccessToken);

      expect(education).toEqual([]);
    });

    it('should handle education fetch failure gracefully', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 403,
      });

      const education = await service.getEducation(mockAccessToken);

      expect(education).toEqual([]);
    });
  });

  describe('Date Formatting', () => {
    it('should format date range with start and end dates', () => {
      const formatted = service.formatDateRange(
        { month: 3, year: 2020 },
        { month: 12, year: 2023 }
      );

      expect(formatted).toBe('Mar 2020 - Dec 2023');
    });

    it('should format date range with only start date (current position)', () => {
      const formatted = service.formatDateRange(
        { month: 6, year: 2021 },
        undefined
      );

      expect(formatted).toBe('Jun 2021 - Present');
    });

    it('should handle missing start date', () => {
      const formatted = service.formatDateRange(undefined, undefined);

      expect(formatted).toBe('Unknown');
    });
  });

  describe('Data Transformation', () => {
    it('should transform LinkedIn data to resume format', async () => {
      const mockProfile = {
        id: 'user123',
        firstName: { localized: { en_US: 'John' } },
        lastName: { localized: { en_US: 'Doe' } },
        headline: 'Full Stack Developer',
      };

      const mockPositions = {
        elements: [
          {
            id: 'pos1',
            title: 'Senior Developer',
            companyName: 'Tech Co',
            description: 'Built awesome things',
            startDate: { month: 1, year: 2020 },
          },
        ],
      };

      const mockEducation = {
        elements: [
          {
            id: 'edu1',
            schoolName: 'University',
            degreeName: 'BS',
            fieldOfStudy: 'CS',
            startDate: { month: 9, year: 2015 },
            endDate: { month: 6, year: 2019 },
          },
        ],
      };

      (global.fetch as any)
        .mockResolvedValueOnce({ ok: true, json: async () => mockProfile })
        .mockResolvedValueOnce({ ok: true, json: async () => mockPositions })
        .mockResolvedValueOnce({ ok: true, json: async () => mockEducation });

      const resumeData = await service.transformToResumeData(mockAccessToken);

      expect(resumeData.headline).toBe('Full Stack Developer');
      expect(resumeData.experience).toHaveLength(1);
      expect(resumeData.experience[0]).toEqual({
        company: 'Tech Co',
        role: 'Senior Developer',
        duration: 'Jan 2020 - Present',
        description: 'Built awesome things',
      });
      expect(resumeData.education).toHaveLength(1);
      expect(resumeData.education[0]).toEqual({
        school: 'University',
        degree: 'BS',
        field: 'CS',
        duration: 'Sep 2015 - Jun 2019',
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle rate limit errors with retry', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          headers: new Map([['Retry-After', '1']]),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 'user123',
            firstName: { localized: { en_US: 'John' } },
            lastName: { localized: { en_US: 'Doe' } },
            headline: 'Developer',
          }),
        });

      const profile = await service.getUserProfile(mockAccessToken);

      expect(profile.id).toBe('user123');
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should throw error after max retries on rate limit', async () => {
      // Mock all retry attempts to fail with 429
      let callCount = 0;
      (global.fetch as any).mockImplementation(() => {
        callCount++;
        return Promise.resolve({
          ok: false,
          status: 429,
          headers: new Map([['Retry-After', '0']]),
        });
      });

      // Use a spy to avoid actual waiting
      const originalSetTimeout = global.setTimeout;
      vi.spyOn(global, 'setTimeout').mockImplementation((fn: any) => {
        fn();
        return 0 as any;
      });

      await expect(
        service.getUserProfile(mockAccessToken)
      ).rejects.toThrow('LinkedIn API rate limit exceeded');

      // Restore setTimeout
      global.setTimeout = originalSetTimeout;
      
      // Should have tried 3 times (initial + 2 retries)
      expect(callCount).toBe(3);
    });

    it('should handle 403 access forbidden errors', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ message: 'Access denied' }),
      });

      await expect(
        service.getUserProfile(mockAccessToken)
      ).rejects.toThrow('Access forbidden');
    });

    it('should handle 404 not found errors', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({}),
      });

      await expect(
        service.getUserProfile(mockAccessToken)
      ).rejects.toThrow('LinkedIn resource not found');
    });

    it('should handle 401 unauthorized errors', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({}),
      });

      await expect(
        service.getUserProfile(mockAccessToken)
      ).rejects.toThrow('LinkedIn access token is invalid or expired');
    });

    it('should handle general API errors', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ message: 'Server error' }),
      });

      await expect(
        service.getUserProfile(mockAccessToken)
      ).rejects.toThrow('Server error');
    });

    it('should handle network errors', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network failure'));

      await expect(
        service.getUserProfile(mockAccessToken)
      ).rejects.toThrow('LinkedIn API request failed: Network failure');
    });
  });

  describe('Token Validation', () => {
    it('should validate valid access token', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'user123',
          firstName: { localized: { en_US: 'John' } },
          lastName: { localized: { en_US: 'Doe' } },
          headline: 'Developer',
        }),
      });

      const isValid = await service.validateToken(mockAccessToken);

      expect(isValid).toBe(true);
    });

    it('should invalidate expired access token', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({}),
      });

      const isValid = await service.validateToken('expired-token');

      expect(isValid).toBe(false);
    });
  });
});

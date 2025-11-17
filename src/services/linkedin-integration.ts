import { LinkedInData } from '@/types';

export interface LinkedInProfile {
  id: string;
  firstName: string;
  lastName: string;
  headline: string;
  summary?: string;
  profilePicture?: string;
  location?: {
    name: string;
    country: string;
  };
}

export interface LinkedInPosition {
  id: string;
  title: string;
  companyName: string;
  description?: string;
  startDate: {
    month: number;
    year: number;
  };
  endDate?: {
    month: number;
    year: number;
  };
  location?: string;
}

export interface LinkedInEducation {
  id: string;
  schoolName: string;
  degreeName?: string;
  fieldOfStudy?: string;
  startDate?: {
    month: number;
    year: number;
  };
  endDate?: {
    month: number;
    year: number;
  };
}

export interface LinkedInOAuthTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  scope: string;
}

export interface LinkedInAPIError {
  status: number;
  message: string;
  serviceErrorCode?: number;
}

export class LinkedInIntegrationService {
  private readonly baseUrl = 'https://api.linkedin.com/v2';
  private readonly oauthUrl = 'https://www.linkedin.com/oauth/v2';
  
  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string
  ) {}

  /**
   * Generate OAuth authorization URL for LinkedIn
   */
  getAuthorizationUrl(redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: redirectUri,
      state,
      scope: 'r_liteprofile r_emailaddress w_member_social',
    });
    
    return `${this.oauthUrl}/authorization?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code: string, redirectUri: string): Promise<LinkedInOAuthTokenResponse> {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });

    const response = await fetch(`${this.oauthUrl}/accessToken`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({})) as any;
      throw new Error(`LinkedIn OAuth token exchange failed: ${error.error_description || response.statusText}`);
    }

    return response.json();
  }

  /**
   * Fetch user profile information
   */
  async getUserProfile(accessToken: string): Promise<LinkedInProfile> {
    const response = await this.makeRequest(
      '/me?projection=(id,firstName,lastName,profilePicture(displayImage~:playableStreams),headline,vanityName,location)',
      accessToken
    );

    return {
      id: response.id,
      firstName: response.firstName?.localized?.en_US || response.firstName?.preferredLocale?.language || '',
      lastName: response.lastName?.localized?.en_US || response.lastName?.preferredLocale?.language || '',
      headline: response.headline || '',
      profilePicture: this.extractProfilePicture(response.profilePicture),
      location: response.location ? {
        name: response.location.name || '',
        country: response.location.country || '',
      } : undefined,
    };
  }

  /**
   * Fetch user's work experience/positions
   */
  async getPositions(accessToken: string): Promise<LinkedInPosition[]> {
    try {
      const response = await this.makeRequest(
        '/positions?projection=(elements*(id,title,companyName,description,startDate,endDate,location))',
        accessToken
      );

      if (!response.elements || response.elements.length === 0) {
        return [];
      }

      return response.elements.map((position: any) => ({
        id: position.id || '',
        title: position.title || '',
        companyName: position.companyName || '',
        description: position.description || undefined,
        startDate: position.startDate || { month: 1, year: 2020 },
        endDate: position.endDate || undefined,
        location: position.location || undefined,
      }));
    } catch (error) {
      // Positions endpoint might not be available with limited scope
      console.warn('Failed to fetch LinkedIn positions:', error);
      return [];
    }
  }

  /**
   * Fetch user's education information
   */
  async getEducation(accessToken: string): Promise<LinkedInEducation[]> {
    try {
      const response = await this.makeRequest(
        '/educations?projection=(elements*(id,schoolName,degreeName,fieldOfStudy,startDate,endDate))',
        accessToken
      );

      if (!response.elements || response.elements.length === 0) {
        return [];
      }

      return response.elements.map((education: any) => ({
        id: education.id || '',
        schoolName: education.schoolName || '',
        degreeName: education.degreeName || undefined,
        fieldOfStudy: education.fieldOfStudy || undefined,
        startDate: education.startDate || undefined,
        endDate: education.endDate || undefined,
      }));
    } catch (error) {
      // Education endpoint might not be available with limited scope
      console.warn('Failed to fetch LinkedIn education:', error);
      return [];
    }
  }

  /**
   * Extract profile picture URL from LinkedIn response
   */
  private extractProfilePicture(profilePicture: any): string | undefined {
    if (!profilePicture || !profilePicture['displayImage~']) {
      return undefined;
    }

    const elements = profilePicture['displayImage~'].elements;
    if (!elements || elements.length === 0) {
      return undefined;
    }

    // Get the largest image
    const largestImage = elements[elements.length - 1];
    return largestImage?.identifiers?.[0]?.identifier;
  }

  /**
   * Format date range for display
   */
  formatDateRange(
    startDate?: { month: number; year: number },
    endDate?: { month: number; year: number }
  ): string {
    if (!startDate) {
      return 'Unknown';
    }

    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];

    const startMonth = monthNames[startDate.month - 1] || '';
    const startYear = startDate.year;
    const start = `${startMonth} ${startYear}`;

    if (!endDate) {
      return `${start} - Present`;
    }

    const endMonth = monthNames[endDate.month - 1] || '';
    const endYear = endDate.year;
    const end = `${endMonth} ${endYear}`;

    return `${start} - ${end}`;
  }

  /**
   * Transform LinkedIn data to resume format
   */
  async transformToResumeData(accessToken: string): Promise<LinkedInData> {
    const [profile, positions, education] = await Promise.all([
      this.getUserProfile(accessToken),
      this.getPositions(accessToken),
      this.getEducation(accessToken),
    ]);

    return {
      headline: profile.headline,
      summary: '', // LinkedIn API v2 doesn't provide summary with basic scope
      experience: positions.map(position => ({
        company: position.companyName,
        role: position.title,
        duration: this.formatDateRange(position.startDate, position.endDate),
        description: position.description || '',
      })),
      education: education.map(edu => ({
        school: edu.schoolName,
        degree: edu.degreeName || '',
        field: edu.fieldOfStudy || '',
        duration: this.formatDateRange(edu.startDate, edu.endDate),
      })),
    };
  }

  /**
   * Handle API rate limiting with exponential backoff
   */
  private async handleRateLimit(retryAfter?: number): Promise<void> {
    const waitTime = retryAfter ? retryAfter * 1000 : 60000; // Default 1 minute
    console.warn(`LinkedIn API rate limit hit. Waiting ${waitTime}ms before retry.`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }

  /**
   * Make authenticated request to LinkedIn API with error handling
   */
  private async makeRequest(endpoint: string, accessToken: string, retries = 2): Promise<any> {
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0',
        },
      });

      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        
        if (retries > 0) {
          await this.handleRateLimit(retryAfter ? parseInt(retryAfter) : undefined);
          return this.makeRequest(endpoint, accessToken, retries - 1);
        }
        
        throw this.createAPIError(429, 'LinkedIn API rate limit exceeded. Please try again later.');
      }

      // Handle access restrictions
      if (response.status === 403) {
        throw this.createAPIError(
          403,
          'Access forbidden. The application may not have the required permissions or the user has restricted access.'
        );
      }

      // Handle not found
      if (response.status === 404) {
        throw this.createAPIError(404, `LinkedIn resource not found: ${endpoint}`);
      }

      // Handle unauthorized
      if (response.status === 401) {
        throw this.createAPIError(401, 'LinkedIn access token is invalid or expired.');
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as any;
        throw this.createAPIError(
          response.status,
          errorData.message || `LinkedIn API request failed: ${response.statusText}`,
          errorData.serviceErrorCode
        );
      }

      return response.json();
    } catch (error) {
      if (error instanceof Error && 'status' in error) {
        throw error; // Re-throw our custom API errors
      }
      
      // Handle network errors
      throw new Error(`LinkedIn API request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a structured API error
   */
  private createAPIError(status: number, message: string, serviceErrorCode?: number): LinkedInAPIError {
    const error = new Error(message) as Error & LinkedInAPIError;
    error.status = status;
    error.message = message;
    error.serviceErrorCode = serviceErrorCode;
    return error as LinkedInAPIError;
  }

  /**
   * Validate access token
   */
  async validateToken(accessToken: string): Promise<boolean> {
    try {
      await this.getUserProfile(accessToken);
      return true;
    } catch (error) {
      return false;
    }
  }
}

// Export singleton instance
export const linkedInIntegrationService = new LinkedInIntegrationService(
  process.env.LINKEDIN_CLIENT_ID || '',
  process.env.LINKEDIN_CLIENT_SECRET || ''
);

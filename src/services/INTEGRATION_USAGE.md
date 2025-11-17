# External Integration Services Usage Guide

This document provides examples of how to use the GitHub and LinkedIn integration services.

## GitHub Integration

### Setup

```typescript
import { githubIntegrationService } from '@/services';

// Or create a custom instance
import { GitHubIntegrationService } from '@/services';
const customService = new GitHubIntegrationService(
  'your-client-id',
  'your-client-secret'
);
```

### OAuth Flow

```typescript
// 1. Generate authorization URL
const authUrl = githubIntegrationService.getAuthorizationUrl(
  'http://localhost:3000/api/auth/github/callback',
  'random-state-string'
);
// Redirect user to authUrl

// 2. Exchange code for token (in callback handler)
const accessToken = await githubIntegrationService.exchangeCodeForToken(
  code,
  'http://localhost:3000/api/auth/github/callback'
);
```

### Fetch User Data

```typescript
// Get user profile
const profile = await githubIntegrationService.getUserProfile(accessToken);
console.log(profile.login, profile.name, profile.bio);

// Get pinned repositories
const pinnedRepos = await githubIntegrationService.getPinnedRepositories(
  'username',
  accessToken
);

// Get contribution graph
const contributions = await githubIntegrationService.getContributionGraph(
  'username',
  accessToken
);
```

### Enrich Resume Data

```typescript
// Get all GitHub data for resume enrichment
const githubData = await githubIntegrationService.enrichResumeData(
  'username',
  accessToken
);

// Use in resume
console.log(githubData.repositories); // Array of repos with metadata
```

### Extract README and Technology Tags

```typescript
// Get README snippet
const readme = await githubIntegrationService.getRepositoryReadme(
  'owner',
  'repo-name',
  accessToken
);

// Parse technology tags
const repo = pinnedRepos[0];
const techTags = githubIntegrationService.parseTechnologyTags(repo);
console.log(techTags); // ['TypeScript', 'react', 'nextjs']
```

## LinkedIn Integration

### Setup

```typescript
import { linkedInIntegrationService } from '@/services';

// Or create a custom instance
import { LinkedInIntegrationService } from '@/services';
const customService = new LinkedInIntegrationService(
  'your-client-id',
  'your-client-secret'
);
```

### OAuth Flow

```typescript
// 1. Generate authorization URL
const authUrl = linkedInIntegrationService.getAuthorizationUrl(
  'http://localhost:3000/api/auth/linkedin/callback',
  'random-state-string'
);
// Redirect user to authUrl

// 2. Exchange code for token (in callback handler)
const tokenResponse = await linkedInIntegrationService.exchangeCodeForToken(
  code,
  'http://localhost:3000/api/auth/linkedin/callback'
);
const accessToken = tokenResponse.access_token;
```

### Fetch User Data

```typescript
// Get user profile
const profile = await linkedInIntegrationService.getUserProfile(accessToken);
console.log(profile.firstName, profile.lastName, profile.headline);

// Get work experience
const positions = await linkedInIntegrationService.getPositions(accessToken);
positions.forEach(pos => {
  console.log(pos.title, pos.companyName);
});

// Get education
const education = await linkedInIntegrationService.getEducation(accessToken);
education.forEach(edu => {
  console.log(edu.schoolName, edu.degreeName);
});
```

### Transform to Resume Format

```typescript
// Get all LinkedIn data in resume format
const linkedInData = await linkedInIntegrationService.transformToResumeData(
  accessToken
);

console.log(linkedInData.headline);
console.log(linkedInData.experience); // Formatted experience array
console.log(linkedInData.education); // Formatted education array
```

### Error Handling

```typescript
try {
  const profile = await linkedInIntegrationService.getUserProfile(accessToken);
} catch (error) {
  if (error.status === 429) {
    // Rate limit exceeded - service automatically retries
    console.log('Rate limited, retrying...');
  } else if (error.status === 403) {
    // Access forbidden - insufficient permissions
    console.log('Access denied. Check OAuth scopes.');
  } else if (error.status === 401) {
    // Token expired
    console.log('Token expired. Re-authenticate user.');
  }
}
```

### Validate Token

```typescript
const isValid = await linkedInIntegrationService.validateToken(accessToken);
if (!isValid) {
  // Redirect to re-authenticate
}
```

## Environment Variables

Make sure to set these in your `.env` file:

```bash
# GitHub
GITHUB_CLIENT_ID="your-github-client-id"
GITHUB_CLIENT_SECRET="your-github-client-secret"

# LinkedIn
LINKEDIN_CLIENT_ID="your-linkedin-client-id"
LINKEDIN_CLIENT_SECRET="your-linkedin-client-secret"
```

## API Endpoints Example

Here's how you might use these services in Next.js API routes:

### GitHub Callback Handler

```typescript
// app/api/auth/github/callback/route.ts
import { githubIntegrationService } from '@/services';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  if (!code) {
    return NextResponse.json({ error: 'No code provided' }, { status: 400 });
  }

  try {
    const accessToken = await githubIntegrationService.exchangeCodeForToken(
      code,
      `${process.env.NEXTAUTH_URL}/api/auth/github/callback`
    );

    const profile = await githubIntegrationService.getUserProfile(accessToken);
    const githubData = await githubIntegrationService.enrichResumeData(
      profile.login,
      accessToken
    );

    // Store in session/database
    return NextResponse.json({ success: true, data: githubData });
  } catch (error) {
    return NextResponse.json(
      { error: 'GitHub authentication failed' },
      { status: 500 }
    );
  }
}
```

### LinkedIn Callback Handler

```typescript
// app/api/auth/linkedin/callback/route.ts
import { linkedInIntegrationService } from '@/services';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.json({ error: 'No code provided' }, { status: 400 });
  }

  try {
    const tokenResponse = await linkedInIntegrationService.exchangeCodeForToken(
      code,
      `${process.env.NEXTAUTH_URL}/api/auth/linkedin/callback`
    );

    const linkedInData = await linkedInIntegrationService.transformToResumeData(
      tokenResponse.access_token
    );

    // Store in session/database
    return NextResponse.json({ success: true, data: linkedInData });
  } catch (error) {
    return NextResponse.json(
      { error: 'LinkedIn authentication failed' },
      { status: 500 }
    );
  }
}
```

## Notes

- **GitHub**: Uses both REST API and GraphQL API for optimal data fetching
- **LinkedIn**: API v2 has limited scope with basic permissions. Some endpoints may require additional OAuth scopes
- **Rate Limiting**: Both services handle rate limiting gracefully with automatic retries
- **Error Handling**: All methods throw descriptive errors that can be caught and handled appropriately
- **Testing**: Both services have comprehensive test coverage with mocked API responses

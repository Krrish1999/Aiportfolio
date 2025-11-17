import { NextRequest, NextResponse } from 'next/server';
import { DeploymentService } from '@/services/deployment';
import { StaticSiteGenerator } from '@/services/static-site-generator';
import { createDatabaseService } from '@/config/database';
import { createError, formatErrorResponse, isResumeProcessingError } from '@/utils/errors';
import { CloudflareWorkersEnv, isWorkersEnvironment } from '@/config/cloudflare-env';
import { ParsedResumeData, Template } from '@/types';

// Configure edge runtime for Cloudflare Workers
export const runtime = 'edge';

/**
 * POST /api/deploy
 * Deploy a portfolio to Cloudflare Pages
 */
export async function POST(request: NextRequest) {
  try {
    // Get Cloudflare Workers environment from request context
    const env = (request as any).env as CloudflareWorkersEnv | undefined;
    
    if (!env || !isWorkersEnvironment(env)) {
      const error = createError(
        'DATABASE_ERROR',
        'Cloudflare environment not available',
        'Service temporarily unavailable. Please try again later.'
      );
      return NextResponse.json(formatErrorResponse(error), { status: error.statusCode });
    }

    // Parse request body
    const body = await request.json() as {
      sessionId?: string;
      resumeData?: ParsedResumeData;
      template?: Template;
      customizations?: any;
      seoConfig?: any;
      customDomain?: string;
    };
    const {
      sessionId,
      resumeData,
      template,
      customizations,
      seoConfig,
      customDomain,
    } = body;

    // Validate required fields
    if (!sessionId || !resumeData || !template) {
      const error = createError(
        'VALIDATION_ERROR',
        'Missing required fields',
        'Session ID, resume data, and template are required.'
      );
      return NextResponse.json(formatErrorResponse(error), { status: error.statusCode });
    }

    // Get Cloudflare credentials from environment
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;

    if (!accountId || !apiToken) {
      const error = createError(
        'DATABASE_ERROR',
        'Cloudflare credentials not configured',
        'Deployment service is not properly configured.'
      );
      return NextResponse.json(formatErrorResponse(error), { status: error.statusCode });
    }

    // Generate static site files
    const siteGenerator = new StaticSiteGenerator();
    const site = siteGenerator.generateSite(
      resumeData as ParsedResumeData,
      template as Template,
      customizations,
      seoConfig
    );

    // Generate additional files
    const baseUrl = seoConfig?.customDomain || `https://${sessionId}.pages.dev`;
    const sitemap = siteGenerator.generateSitemap(baseUrl);
    const robotsTxt = siteGenerator.generateRobotsTxt(`${baseUrl}/sitemap.xml`);

    // Prepare deployment files
    const files = {
      'index.html': site.html,
      'styles.css': site.css,
      'sitemap.xml': sitemap,
      'robots.txt': robotsTxt,
    };

    // Create deployment service
    const deploymentService = new DeploymentService(accountId, apiToken);

    // Deploy to Cloudflare Pages
    const deploymentResult = await deploymentService.deploy(files, {
      platform: 'cloudflare-pages',
      seoConfig: {
        title: site.metadata.title,
        description: site.metadata.description,
        keywords: site.metadata.keywords,
        ogImage: seoConfig?.ogImage,
      },
      customDomain: customDomain,
    });

    if (!deploymentResult.success) {
      const error = createError(
        'DATABASE_ERROR',
        deploymentResult.error || 'Deployment failed',
        'Failed to deploy portfolio. Please try again.'
      );
      return NextResponse.json(formatErrorResponse(error), { status: error.statusCode });
    }

    // Save deployment info to database
    try {
      const db = createDatabaseService(env);
      // Get userId from session or use a default
      const userId = crypto.randomUUID(); // In production, get from auth session
      await db.createPortfolio({
        userId,
        sessionId,
        templateId: template.id,
        customizations: customizations || {},
        deploymentUrl: deploymentResult.url,
        isPublished: true,
      });
    } catch (dbError) {
      // Log but don't fail the deployment if database save fails
      console.warn('Failed to save portfolio to database:', dbError);
    }

    // Setup custom domain if provided
    if (customDomain && deploymentResult.url) {
      try {
        const projectName = deploymentResult.url.split('.')[0].replace('https://', '');
        await deploymentService.setupCustomDomain({
          domain: customDomain,
          projectName,
          deploymentId: deploymentResult.deploymentId,
        });
      } catch (domainError) {
        console.warn('Failed to setup custom domain:', domainError);
        // Don't fail the deployment, just log the warning
      }
    }

    // Return success response with Cloudflare Pages URL
    return NextResponse.json({
      success: true,
      data: {
        deploymentId: deploymentResult.deploymentId,
        url: deploymentResult.url, // *.pages.dev URL
        platform: 'cloudflare-pages',
        customDomain: customDomain,
        deployedAt: new Date().toISOString(),
        status: 'deployed',
        message: 'Portfolio deployed successfully to Cloudflare Pages.',
      },
    }, { status: 201 });

  } catch (error) {
    console.error('Deployment error:', error);

    if (isResumeProcessingError(error)) {
      return NextResponse.json(formatErrorResponse(error), { status: error.statusCode });
    }

    // Handle unexpected errors
    const unexpectedError = createError(
      'DATABASE_ERROR',
      `Unexpected deployment error: ${error}`,
      'An unexpected error occurred during deployment. Please try again.'
    );
    
    return NextResponse.json(formatErrorResponse(unexpectedError), { 
      status: unexpectedError.statusCode 
    });
  }
}

// Handle unsupported methods
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST to deploy a portfolio.' },
    { status: 405 }
  );
}

export async function PUT() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}

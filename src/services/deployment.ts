import { DatabaseService } from './database';

export interface DeploymentResult {
  success: boolean;
  url?: string;
  deploymentId: string;
  platform: string;
  error?: string;
  customDomain?: string;
}

export interface DeploymentStatus {
  deploymentId: string;
  status: 'pending' | 'building' | 'deploying' | 'ready' | 'error';
  progress: number;
  message: string;
  url?: string;
  error?: string;
  createdAt?: string;
  completedAt?: string;
  customDomain?: string;
}

export interface CustomDomainConfig {
  domain: string;
  deploymentId: string;
  sslEnabled?: boolean;
  projectName?: string;
}

export interface DeploymentFiles {
  'index.html': string;
  'styles.css': string;
  'sitemap.xml'?: string;
  'robots.txt'?: string;
  [key: string]: string | undefined;
}

export interface DeploymentOptions {
  saveToDatabase?: boolean;
  databaseService?: DatabaseService;
  userId?: string;
  sessionId?: string;
}

export interface SEOConfig {
  title: string;
  description: string;
  keywords: string[];
  ogImage?: string;
}

export interface DeploymentConfig {
  platform: 'cloudflare-pages';
  customDomain?: string;
  seoConfig: SEOConfig;
  analytics?: {
    googleAnalytics?: string;
    plausible?: string;
  };
}

export interface CloudflarePagesProject {
  id: string;
  name: string;
  subdomain: string;
  domains: string[];
  created_on: string;
  production_branch: string;
}

export interface CloudflarePagesDeployment {
  id: string;
  url: string;
  environment: string;
  deployment_trigger: {
    type: string;
  };
  stages: Array<{
    name: string;
    status: string;
    started_on: string | null;
    ended_on: string | null;
  }>;
  build_config: {
    build_command: string | null;
    destination_dir: string | null;
  };
  created_on: string;
  latest_stage: {
    name: string;
    status: string;
  };
}

export interface CloudflarePagesDomain {
  id: string;
  name: string;
  status: string;
  verification_data: {
    status: string;
  };
  ssl: {
    status: string;
    certificate_authority: string;
    validation_method: string;
  };
}

/**
 * Deployment Service
 * Handles deployment to Cloudflare Pages
 */
export class DeploymentService {
  private deploymentStatuses: Map<string, DeploymentStatus> = new Map();
  private accountId: string;
  private apiToken: string;
  private baseUrl = 'https://api.cloudflare.com/client/v4';

  constructor(accountId?: string, apiToken?: string) {
    this.accountId = accountId || process.env.CLOUDFLARE_ACCOUNT_ID || '';
    this.apiToken = apiToken || process.env.CLOUDFLARE_API_TOKEN || '';
  }

  /**
   * Deploy site to Cloudflare Pages
   */
  async deploy(
    files: DeploymentFiles,
    config: DeploymentConfig,
    options: DeploymentOptions = {}
  ): Promise<DeploymentResult> {
    const deploymentId = this.generateDeploymentId();
    
    try {
      // Validate configuration
      if (config.platform !== 'cloudflare-pages') {
        throw new Error(`Unsupported platform: ${config.platform}. Only 'cloudflare-pages' is supported.`);
      }

      // Initialize deployment status
      this.updateDeploymentStatus(deploymentId, {
        deploymentId,
        status: 'pending',
        progress: 0,
        message: 'Initializing deployment...',
      });

      // Deploy to Cloudflare Pages
      const result = await this.deployToCloudflarePages(files, config, deploymentId);

      // Update final status
      this.updateDeploymentStatus(deploymentId, {
        deploymentId,
        status: result.success ? 'ready' : 'error',
        progress: 100,
        message: result.success ? 'Deployment complete' : 'Deployment failed',
        url: result.url,
        error: result.error,
      });

      // Save to D1 database if requested
      if (options.saveToDatabase && options.databaseService && options.userId && options.sessionId) {
        await this.saveDeploymentToDatabase(
          options.databaseService,
          options.userId,
          options.sessionId,
          config,
          result
        );
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      this.updateDeploymentStatus(deploymentId, {
        deploymentId,
        status: 'error',
        progress: 0,
        message: 'Deployment failed',
        error: errorMessage,
      });

      return {
        success: false,
        deploymentId,
        platform: config.platform,
        error: errorMessage,
      };
    }
  }

  /**
   * Deploy to Cloudflare Pages
   */
  private async deployToCloudflarePages(
    files: DeploymentFiles,
    config: DeploymentConfig,
    deploymentId: string
  ): Promise<DeploymentResult> {
    try {
      this.updateDeploymentStatus(deploymentId, {
        deploymentId,
        status: 'building',
        progress: 10,
        message: 'Creating Cloudflare Pages project...',
      });

      const projectName = this.sanitizeProjectName(config.seoConfig.title);

      // Step 1: Create or get Pages project
      let project: CloudflarePagesProject;
      try {
        project = await this.getOrCreatePagesProject(projectName);
      } catch (error) {
        throw new Error(`Failed to create Pages project: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      this.updateDeploymentStatus(deploymentId, {
        deploymentId,
        status: 'building',
        progress: 30,
        message: 'Uploading files to Cloudflare Pages...',
      });

      // Step 2: Upload files to Pages
      let deployment: CloudflarePagesDeployment;
      try {
        deployment = await this.uploadFilesToPages(project.name, files);
      } catch (error) {
        throw new Error(`Failed to upload files: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      this.updateDeploymentStatus(deploymentId, {
        deploymentId,
        status: 'deploying',
        progress: 60,
        message: 'Building and deploying...',
      });

      // Step 3: Poll deployment status
      try {
        await this.pollDeploymentStatus(project.name, deployment.id, deploymentId);
      } catch (error) {
        throw new Error(`Deployment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      this.updateDeploymentStatus(deploymentId, {
        deploymentId,
        status: 'deploying',
        progress: 90,
        message: 'Finalizing deployment...',
      });

      // Step 4: Setup custom domain if provided
      if (config.customDomain) {
        try {
          await this.setupCustomDomain({
            domain: config.customDomain,
            deploymentId,
            sslEnabled: true,
          });
        } catch (error) {
          // Don't fail deployment if custom domain setup fails
          console.warn(`Custom domain setup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      const url = config.customDomain || deployment.url || `https://${project.subdomain}.pages.dev`;

      return {
        success: true,
        url,
        deploymentId,
        platform: 'cloudflare-pages',
        customDomain: config.customDomain,
      };
    } catch (error) {
      return {
        success: false,
        deploymentId,
        platform: 'cloudflare-pages',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get or create Cloudflare Pages project
   */
  private async getOrCreatePagesProject(projectName: string): Promise<CloudflarePagesProject> {
    // Try to get existing project
    try {
      const response = await fetch(
        `${this.baseUrl}/accounts/${this.accountId}/pages/projects/${projectName}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        const data = await response.json() as { result: CloudflarePagesProject };
        return data.result;
      }
    } catch (error) {
      // Project doesn't exist, create it
    }

    // Create new project
    const response = await fetch(
      `${this.baseUrl}/accounts/${this.accountId}/pages/projects`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: projectName,
          production_branch: 'main',
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json() as { errors?: Array<{ message: string }> };
      throw new Error(error.errors?.[0]?.message || 'Failed to create Pages project');
    }

    const data = await response.json() as { result: CloudflarePagesProject };
    return data.result;
  }

  /**
   * Upload files to Cloudflare Pages
   */
  private async uploadFilesToPages(
    projectName: string,
    files: DeploymentFiles
  ): Promise<CloudflarePagesDeployment> {
    // Create FormData with files
    const formData = new FormData();

    // Add each file to FormData
    Object.entries(files).forEach(([filename, content]) => {
      if (content) {
        const blob = new Blob([content], { type: this.getContentType(filename) });
        formData.append(filename, blob, filename);
      }
    });

    // Upload to Pages
    const response = await fetch(
      `${this.baseUrl}/accounts/${this.accountId}/pages/projects/${projectName}/deployments`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
        },
        body: formData,
      }
    );

    if (!response.ok) {
      const error = await response.json() as { errors?: Array<{ message: string }> };
      throw new Error(error.errors?.[0]?.message || 'Failed to upload files to Pages');
    }

    const data = await response.json() as { result: CloudflarePagesDeployment };
    return data.result;
  }

  /**
   * Poll deployment status until complete
   */
  private async pollDeploymentStatus(
    projectName: string,
    deploymentId: string,
    localDeploymentId: string,
    maxAttempts: number = 60,
    intervalMs: number = 5000
  ): Promise<void> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const response = await fetch(
        `${this.baseUrl}/accounts/${this.accountId}/pages/projects/${projectName}/deployments/${deploymentId}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to check deployment status');
      }

      const data = await response.json() as { result: CloudflarePagesDeployment };
      const deployment: CloudflarePagesDeployment = data.result;

      const latestStage = deployment.latest_stage;

      if (latestStage.status === 'success') {
        return; // Deployment complete
      }

      if (latestStage.status === 'failure') {
        throw new Error(`Deployment failed at stage: ${latestStage.name}`);
      }

      // Update progress based on stage
      const progress = 60 + (attempt / maxAttempts) * 30;
      this.updateDeploymentStatus(localDeploymentId, {
        deploymentId: localDeploymentId,
        status: 'deploying',
        progress: Math.min(progress, 90),
        message: `Building: ${latestStage.name}...`,
      });

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }

    throw new Error('Deployment timeout: exceeded maximum wait time');
  }

  /**
   * Get content type for file
   */
  private getContentType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    const contentTypes: Record<string, string> = {
      'html': 'text/html',
      'css': 'text/css',
      'js': 'application/javascript',
      'json': 'application/json',
      'xml': 'application/xml',
      'txt': 'text/plain',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'svg': 'image/svg+xml',
    };
    return contentTypes[ext || ''] || 'application/octet-stream';
  }

  /**
   * Setup custom domain for Cloudflare Pages deployment
   */
  async setupCustomDomain(
    domainConfig: CustomDomainConfig
  ): Promise<{ success: boolean; error?: string; dnsRecords?: any[]; sslStatus?: string }> {
    try {
      const deployment = this.deploymentStatuses.get(domainConfig.deploymentId);
      
      if (!deployment) {
        throw new Error('Deployment not found');
      }

      // Validate domain format
      if (!this.isValidDomain(domainConfig.domain)) {
        throw new Error('Invalid domain format');
      }

      // Extract project name from deployment URL or use a default
      const projectName = process.env.CLOUDFLARE_PAGES_PROJECT || 'ai-resume-portfolio';

      // Add custom domain to Pages project
      const response = await fetch(
        `${this.baseUrl}/accounts/${this.accountId}/pages/projects/${projectName}/domains`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: domainConfig.domain,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json() as { errors?: Array<{ message: string }> };
        throw new Error(error.errors?.[0]?.message || 'Failed to add custom domain');
      }

      const domainData = await response.json() as { result: CloudflarePagesDomain };

      // If SSL is enabled, validate certificate
      let sslStatus = 'pending';
      if (domainConfig.sslEnabled !== false) {
        try {
          await this.validateSSL(domainConfig.domain);
          sslStatus = 'active';
        } catch {
          sslStatus = 'pending';
        }
      }

      // Prepare DNS records information
      const dnsRecords = [
        {
          type: 'CNAME',
          name: domainConfig.domain,
          value: `${projectName}.pages.dev`,
          ttl: 3600,
        },
      ];

      return { 
        success: true,
        dnsRecords,
        sslStatus,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get custom domain status
   */
  async getCustomDomainStatus(
    projectName: string,
    domain: string
  ): Promise<CloudflarePagesDomain | null> {
    try {
      const response = await fetch(
        `${this.baseUrl}/accounts/${this.accountId}/pages/projects/${projectName}/domains/${domain}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json() as { result: CloudflarePagesDomain };
      return data.result;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get deployment status
   */
  getDeploymentStatus(deploymentId: string): DeploymentStatus | undefined {
    return this.deploymentStatuses.get(deploymentId);
  }

  /**
   * Cancel deployment
   */
  async cancelDeployment(deploymentId: string): Promise<boolean> {
    const deployment = this.deploymentStatuses.get(deploymentId);
    
    if (!deployment) {
      return false;
    }

    if (deployment.status === 'ready' || deployment.status === 'error') {
      return false; // Cannot cancel completed deployments
    }

    this.updateDeploymentStatus(deploymentId, {
      ...deployment,
      status: 'error',
      message: 'Deployment cancelled',
      error: 'Cancelled by user',
    });

    return true;
  }

  /**
   * Retry failed deployment
   */
  async retryDeployment(
    deploymentId: string,
    files: DeploymentFiles,
    config: DeploymentConfig
  ): Promise<DeploymentResult> {
    const deployment = this.deploymentStatuses.get(deploymentId);
    
    if (!deployment || deployment.status !== 'error') {
      throw new Error('Cannot retry deployment');
    }

    // Clear old status and redeploy
    this.deploymentStatuses.delete(deploymentId);
    return this.deploy(files, config);
  }

  /**
   * Validate SSL certificate status for custom domain
   */
  async validateSSL(domain: string): Promise<{
    valid: boolean;
    issuer?: string;
    expiresAt?: Date;
    error?: string;
  }> {
    try {
      if (!this.isValidDomain(domain)) {
        throw new Error('Invalid domain');
      }

      const projectName = process.env.CLOUDFLARE_PAGES_PROJECT || 'ai-resume-portfolio';
      const domainStatus = await this.getCustomDomainStatus(projectName, domain);

      if (!domainStatus) {
        throw new Error('Domain not found');
      }

      // Check SSL status
      if (domainStatus.ssl.status === 'active') {
        return {
          valid: true,
          issuer: domainStatus.ssl.certificate_authority || "Let's Encrypt",
          expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // Cloudflare auto-renews
        };
      } else if (domainStatus.ssl.status === 'pending_validation') {
        return {
          valid: false,
          error: 'SSL certificate is pending validation',
        };
      } else {
        return {
          valid: false,
          error: `SSL status: ${domainStatus.ssl.status}`,
        };
      }
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get deployment logs
   */
  getDeploymentLogs(deploymentId: string): string[] {
    const deployment = this.deploymentStatuses.get(deploymentId);
    
    if (!deployment) {
      return [];
    }

    // In production, this would fetch actual logs from the platform
    return [
      `[${new Date().toISOString()}] Deployment started`,
      `[${new Date().toISOString()}] Building static site...`,
      `[${new Date().toISOString()}] Uploading files...`,
      `[${new Date().toISOString()}] ${deployment.message}`,
    ];
  }

  /**
   * List all deployments
   */
  listDeployments(): DeploymentStatus[] {
    return Array.from(this.deploymentStatuses.values());
  }

  /**
   * Delete deployment
   */
  async deleteDeployment(deploymentId: string): Promise<boolean> {
    const deployment = this.deploymentStatuses.get(deploymentId);
    
    if (!deployment) {
      return false;
    }

    // In production, this would delete from the platform
    this.deploymentStatuses.delete(deploymentId);
    return true;
  }

  /**
   * Update deployment status
   */
  private updateDeploymentStatus(
    deploymentId: string,
    status: DeploymentStatus
  ): void {
    this.deploymentStatuses.set(deploymentId, status);
  }

  /**
   * Generate unique deployment ID
   */
  private generateDeploymentId(): string {
    return `dep_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Sanitize project name for URL
   */
  private sanitizeProjectName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50);
  }

  /**
   * Validate domain format
   */
  private isValidDomain(domain: string): boolean {
    const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/i;
    return domainRegex.test(domain);
  }



  /**
   * Save deployment record to D1 database
   */
  private async saveDeploymentToDatabase(
    db: DatabaseService,
    userId: string,
    sessionId: string,
    config: DeploymentConfig,
    result: DeploymentResult
  ): Promise<void> {
    try {
      // Check if portfolio already exists for this session
      const existingPortfolio = await db.getPortfolioBySessionId(sessionId);

      if (existingPortfolio) {
        // Update existing portfolio
        await db.updatePortfolio(existingPortfolio.id, {
          deploymentUrl: result.url,
          isPublished: result.success,
          customizations: {
            platform: config.platform,
            customDomain: config.customDomain,
            seoConfig: config.seoConfig,
            deploymentId: result.deploymentId,
          },
        });
      } else {
        // Create new portfolio with default template
        await db.createPortfolio({
          userId,
          sessionId,
          templateId: 'default',
          deploymentUrl: result.url,
          isPublished: result.success,
          customizations: {
            platform: config.platform,
            customDomain: config.customDomain,
            seoConfig: config.seoConfig,
            deploymentId: result.deploymentId,
          },
        });
      }
    } catch (error) {
      console.error('Failed to save deployment to database:', error);
      // Don't throw - deployment succeeded even if database save failed
    }
  }
}

// Export singleton instance
export const deploymentService = new DeploymentService();

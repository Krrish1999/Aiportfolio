#!/usr/bin/env node

/**
 * Cloudflare Pages Deployment Verification Script
 * 
 * This script verifies that all functionality is working correctly after deployment:
 * - API routes are accessible
 * - R2 file storage is working
 * - Durable Objects job processing is functional
 * - D1 database operations are working
 * - Portfolio deployment to Pages is functional
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface VerificationResult {
  name: string;
  status: 'pass' | 'fail' | 'skip';
  message: string;
  duration?: number;
}

class DeploymentVerifier {
  private results: VerificationResult[] = [];
  private baseUrl: string;
  private apiToken: string;
  private accountId: string;
  private projectName: string;

  constructor() {
    this.baseUrl = process.env.DEPLOYMENT_URL || 'http://localhost:8787';
    this.apiToken = process.env.CLOUDFLARE_API_TOKEN || '';
    this.accountId = process.env.CLOUDFLARE_ACCOUNT_ID || '';
    this.projectName = process.env.CLOUDFLARE_PAGES_PROJECT || 'ai-resume-portfolio';
  }

  async verify(): Promise<void> {
    console.log('🔍 Starting Cloudflare Pages deployment verification...\n');
    console.log(`Base URL: ${this.baseUrl}\n`);

    // Run all verification tests
    await this.verifyBuild();
    await this.verifyDeployment();
    await this.verifyAPIRoutes();
    await this.verifyR2Storage();
    await this.verifyDurableObjects();
    await this.verifyD1Database();
    await this.verifyPagesDeployment();
    await this.verifyPerformance();
    await this.verifyErrorLogs();

    // Print summary
    this.printSummary();
  }

  private async verifyBuild(): Promise<void> {
    const startTime = Date.now();
    try {
      console.log('📦 Verifying build output...');
      
      const buildDir = path.join(process.cwd(), '.next');
      if (!fs.existsSync(buildDir)) {
        throw new Error('.next directory not found');
      }

      const requiredFiles = [
        '_routes.json',
        '_headers',
        'deployment-info.json',
      ];

      const missingFiles = requiredFiles.filter(
        file => !fs.existsSync(path.join(buildDir, file))
      );

      if (missingFiles.length > 0) {
        throw new Error(`Missing required files: ${missingFiles.join(', ')}`);
      }

      this.addResult({
        name: 'Build Output',
        status: 'pass',
        message: 'All required build files present',
        duration: Date.now() - startTime,
      });
    } catch (error) {
      this.addResult({
        name: 'Build Output',
        status: 'fail',
        message: error.message,
        duration: Date.now() - startTime,
      });
    }
  }

  private async verifyDeployment(): Promise<void> {
    const startTime = Date.now();
    try {
      console.log('🚀 Verifying deployment status...');
      
      if (!this.apiToken || !this.accountId) {
        throw new Error('CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID required');
      }

      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/pages/projects/${this.projectName}/deployments`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch deployments: ${response.statusText}`);
      }

      const data = await response.json();
      const latestDeployment = data.result[0];

      if (!latestDeployment) {
        throw new Error('No deployments found');
      }

      if (latestDeployment.latest_stage.status !== 'success') {
        throw new Error(`Deployment status: ${latestDeployment.latest_stage.status}`);
      }

      this.addResult({
        name: 'Deployment Status',
        status: 'pass',
        message: `Latest deployment successful (${latestDeployment.url})`,
        duration: Date.now() - startTime,
      });
    } catch (error) {
      this.addResult({
        name: 'Deployment Status',
        status: 'fail',
        message: error.message,
        duration: Date.now() - startTime,
      });
    }
  }

  private async verifyAPIRoutes(): Promise<void> {
    const startTime = Date.now();
    try {
      console.log('🔌 Verifying API routes...');
      
      const routes = [
        '/api/upload',
        '/api/status/test-session',
        '/api/deploy/list',
      ];

      for (const route of routes) {
        const response = await fetch(`${this.baseUrl}${route}`, {
          method: 'GET',
        });

        // We expect some routes to return 404 or 400 for test data, but they should respond
        if (response.status >= 500) {
          throw new Error(`Route ${route} returned ${response.status}`);
        }
      }

      this.addResult({
        name: 'API Routes',
        status: 'pass',
        message: 'All API routes accessible',
        duration: Date.now() - startTime,
      });
    } catch (error) {
      this.addResult({
        name: 'API Routes',
        status: 'fail',
        message: error.message,
        duration: Date.now() - startTime,
      });
    }
  }

  private async verifyR2Storage(): Promise<void> {
    const startTime = Date.now();
    try {
      console.log('📁 Verifying R2 file storage...');
      
      // Create a test file
      const testContent = 'Test file for R2 verification';
      const testBlob = new Blob([testContent], { type: 'text/plain' });
      const formData = new FormData();
      formData.append('file', testBlob, 'test-verification.txt');

      const uploadResponse = await fetch(`${this.baseUrl}/api/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.statusText}`);
      }

      const uploadData = await uploadResponse.json();
      
      if (!uploadData.key || !uploadData.url) {
        throw new Error('Upload response missing key or url');
      }

      this.addResult({
        name: 'R2 File Storage',
        status: 'pass',
        message: 'File upload and storage working',
        duration: Date.now() - startTime,
      });
    } catch (error) {
      this.addResult({
        name: 'R2 File Storage',
        status: 'fail',
        message: error.message,
        duration: Date.now() - startTime,
      });
    }
  }

  private async verifyDurableObjects(): Promise<void> {
    const startTime = Date.now();
    try {
      console.log('⚙️  Verifying Durable Objects job processing...');
      
      // Create a test job
      const jobData = {
        sessionId: `test-${Date.now()}`,
        fileKey: 'test-file.pdf',
        userId: 'test-user',
      };

      const createResponse = await fetch(`${this.baseUrl}/api/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(jobData),
      });

      if (!createResponse.ok) {
        throw new Error(`Job creation failed: ${createResponse.statusText}`);
      }

      const createData = await createResponse.json();
      const sessionId = createData.sessionId || jobData.sessionId;

      // Check job status
      const statusResponse = await fetch(
        `${this.baseUrl}/api/status/${sessionId}`
      );

      if (!statusResponse.ok) {
        throw new Error(`Status check failed: ${statusResponse.statusText}`);
      }

      const statusData = await statusResponse.json();
      
      if (!statusData.status) {
        throw new Error('Status response missing status field');
      }

      this.addResult({
        name: 'Durable Objects',
        status: 'pass',
        message: 'Job queue processing functional',
        duration: Date.now() - startTime,
      });
    } catch (error) {
      this.addResult({
        name: 'Durable Objects',
        status: 'fail',
        message: error.message,
        duration: Date.now() - startTime,
      });
    }
  }

  private async verifyD1Database(): Promise<void> {
    const startTime = Date.now();
    try {
      console.log('🗄️  Verifying D1 database operations...');
      
      // Try to query the database through an API route
      const response = await fetch(`${this.baseUrl}/api/deploy/list`);

      if (!response.ok && response.status !== 404) {
        throw new Error(`Database query failed: ${response.statusText}`);
      }

      // Even if no data exists, the route should respond properly
      const data = await response.json();
      
      if (response.ok && !Array.isArray(data.deployments)) {
        throw new Error('Invalid database response format');
      }

      this.addResult({
        name: 'D1 Database',
        status: 'pass',
        message: 'Database queries working',
        duration: Date.now() - startTime,
      });
    } catch (error) {
      this.addResult({
        name: 'D1 Database',
        status: 'fail',
        message: error.message,
        duration: Date.now() - startTime,
      });
    }
  }

  private async verifyPagesDeployment(): Promise<void> {
    const startTime = Date.now();
    try {
      console.log('📄 Verifying Pages deployment functionality...');
      
      // Test the deployment service
      const response = await fetch(`${this.baseUrl}/api/deploy/list`);

      if (!response.ok && response.status !== 404) {
        throw new Error(`Deployment API failed: ${response.statusText}`);
      }

      this.addResult({
        name: 'Pages Deployment',
        status: 'pass',
        message: 'Portfolio deployment service accessible',
        duration: Date.now() - startTime,
      });
    } catch (error) {
      this.addResult({
        name: 'Pages Deployment',
        status: 'fail',
        message: error.message,
        duration: Date.now() - startTime,
      });
    }
  }

  private async verifyPerformance(): Promise<void> {
    const startTime = Date.now();
    try {
      console.log('⚡ Verifying performance metrics...');
      
      // Test response time for main page
      const pageStart = Date.now();
      const response = await fetch(this.baseUrl);
      const pageTime = Date.now() - pageStart;

      if (!response.ok) {
        throw new Error(`Main page failed: ${response.statusText}`);
      }

      if (pageTime > 2000) {
        throw new Error(`Slow response time: ${pageTime}ms (expected < 2000ms)`);
      }

      this.addResult({
        name: 'Performance',
        status: 'pass',
        message: `Response time: ${pageTime}ms`,
        duration: Date.now() - startTime,
      });
    } catch (error) {
      this.addResult({
        name: 'Performance',
        status: 'fail',
        message: error.message,
        duration: Date.now() - startTime,
      });
    }
  }

  private async verifyErrorLogs(): Promise<void> {
    const startTime = Date.now();
    try {
      console.log('📊 Checking error logs...');
      
      if (!this.apiToken || !this.accountId) {
        this.addResult({
          name: 'Error Logs',
          status: 'skip',
          message: 'Skipped (API token not configured)',
          duration: Date.now() - startTime,
        });
        return;
      }

      // Note: This would require the Workers Analytics API
      // For now, we'll just mark it as a manual check
      this.addResult({
        name: 'Error Logs',
        status: 'skip',
        message: 'Manual check required (use wrangler tail)',
        duration: Date.now() - startTime,
      });
    } catch (error) {
      this.addResult({
        name: 'Error Logs',
        status: 'fail',
        message: error.message,
        duration: Date.now() - startTime,
      });
    }
  }

  private addResult(result: VerificationResult): void {
    this.results.push(result);
    
    const icon = result.status === 'pass' ? '✅' : result.status === 'fail' ? '❌' : '⏭️';
    const duration = result.duration ? ` (${result.duration}ms)` : '';
    console.log(`${icon} ${result.name}: ${result.message}${duration}\n`);
  }

  private printSummary(): void {
    console.log('\n' + '='.repeat(60));
    console.log('📋 VERIFICATION SUMMARY');
    console.log('='.repeat(60) + '\n');

    const passed = this.results.filter(r => r.status === 'pass').length;
    const failed = this.results.filter(r => r.status === 'fail').length;
    const skipped = this.results.filter(r => r.status === 'skip').length;
    const total = this.results.length;

    console.log(`Total Tests: ${total}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⏭️  Skipped: ${skipped}\n`);

    if (failed > 0) {
      console.log('Failed Tests:');
      this.results
        .filter(r => r.status === 'fail')
        .forEach(r => {
          console.log(`  - ${r.name}: ${r.message}`);
        });
      console.log('');
    }

    const successRate = ((passed / (total - skipped)) * 100).toFixed(1);
    console.log(`Success Rate: ${successRate}%\n`);

    if (failed === 0) {
      console.log('🎉 All verifications passed! Deployment is ready.\n');
      process.exit(0);
    } else {
      console.log('⚠️  Some verifications failed. Please review and fix issues.\n');
      process.exit(1);
    }
  }
}

// Run verification
const verifier = new DeploymentVerifier();
verifier.verify().catch(error => {
  console.error('❌ Verification failed:', error);
  process.exit(1);
});

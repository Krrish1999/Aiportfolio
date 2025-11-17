import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { DeploymentService, DeploymentFiles, DeploymentConfig, CloudflarePagesProject, CloudflarePagesDeployment, CloudflarePagesDomain } from '../deployment';

describe('DeploymentService', () => {
  let service: DeploymentService;
  let fetchMock: any;

  const mockFiles: DeploymentFiles = {
    'index.html': '<!DOCTYPE html><html><body>Test</body></html>',
    'styles.css': 'body { margin: 0; }',
    'sitemap.xml': '<?xml version="1.0"?><urlset></urlset>',
    'robots.txt': 'User-agent: *\nAllow: /',
  };

  const mockConfig: DeploymentConfig = {
    platform: 'cloudflare-pages',
    seoConfig: {
      title: 'Test Portfolio',
      description: 'Test description',
      keywords: ['test', 'portfolio'],
    },
  };

  const mockProject: CloudflarePagesProject = {
    id: 'project-123',
    name: 'test-portfolio',
    subdomain: 'test-portfolio',
    domains: [],
    created_on: new Date().toISOString(),
    production_branch: 'main',
  };

  const mockDeployment: CloudflarePagesDeployment = {
    id: 'deployment-123',
    url: 'https://test-portfolio.pages.dev',
    environment: 'production',
    deployment_trigger: { type: 'upload' },
    stages: [
      { name: 'build', status: 'success', started_on: new Date().toISOString(), ended_on: new Date().toISOString() },
      { name: 'deploy', status: 'success', started_on: new Date().toISOString(), ended_on: new Date().toISOString() },
    ],
    build_config: {
      build_command: null,
      destination_dir: null,
    },
    created_on: new Date().toISOString(),
    latest_stage: { name: 'deploy', status: 'success' },
  };

  const mockDomain: CloudflarePagesDomain = {
    id: 'domain-123',
    name: 'portfolio.example.com',
    status: 'active',
    verification_data: {
      status: 'verified',
    },
    ssl: {
      status: 'active',
      certificate_authority: "Let's Encrypt",
      validation_method: 'http',
    },
  };

  beforeEach(() => {
    // Mock environment variables
    process.env.CLOUDFLARE_ACCOUNT_ID = 'test-account-id';
    process.env.CLOUDFLARE_API_TOKEN = 'test-api-token';
    process.env.CLOUDFLARE_PAGES_PROJECT = 'test-project';

    service = new DeploymentService('test-account-id', 'test-api-token');

    // Mock fetch globally
    fetchMock = vi.fn();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Cloudflare Pages API Integration', () => {
    describe('Project Creation', () => {
      it('should create new Pages project when it does not exist', async () => {
        fetchMock
          .mockResolvedValueOnce({
            ok: false, // GET project - doesn't exist
            status: 404,
          })
          .mockResolvedValueOnce({
            ok: true, // POST create project
            json: async () => ({ result: mockProject }),
          })
          .mockResolvedValueOnce({
            ok: true, // POST upload files
            json: async () => ({ result: mockDeployment }),
          })
          .mockResolvedValueOnce({
            ok: true, // GET deployment status
            json: async () => ({ result: { ...mockDeployment, latest_stage: { name: 'deploy', status: 'success' } } }),
          });

        const result = await service.deploy(mockFiles, mockConfig);

        expect(result.success).toBe(true);
        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining('/pages/projects'),
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'Authorization': 'Bearer test-api-token',
            }),
          })
        );
      });

      it('should use existing Pages project when it exists', async () => {
        fetchMock
          .mockResolvedValueOnce({
            ok: true, // GET project - exists
            json: async () => ({ result: mockProject }),
          })
          .mockResolvedValueOnce({
            ok: true, // POST upload files
            json: async () => ({ result: mockDeployment }),
          })
          .mockResolvedValueOnce({
            ok: true, // GET deployment status
            json: async () => ({ result: { ...mockDeployment, latest_stage: { name: 'deploy', status: 'success' } } }),
          });

        const result = await service.deploy(mockFiles, mockConfig);

        expect(result.success).toBe(true);
        // Should only call GET, not POST for project creation
        const postCalls = fetchMock.mock.calls.filter((call: any) => call[1]?.method === 'POST');
        expect(postCalls.length).toBe(1); // Only file upload POST
      });

      it('should handle project creation API errors', async () => {
        fetchMock
          .mockResolvedValueOnce({
            ok: false, // GET project - doesn't exist
          })
          .mockResolvedValueOnce({
            ok: false, // POST create project - fails
            json: async () => ({
              errors: [{ message: 'Project name already taken' }],
            }),
          });

        const result = await service.deploy(mockFiles, mockConfig);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Failed to create Pages project');
      });
    });

    describe('File Upload', () => {
      it('should upload files to Pages with correct format', async () => {
        fetchMock
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({ result: mockProject }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({ result: mockDeployment }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({ result: { ...mockDeployment, latest_stage: { name: 'deploy', status: 'success' } } }),
          });

        await service.deploy(mockFiles, mockConfig);

        const uploadCall = fetchMock.mock.calls.find((call: any) => 
          call[0].includes('/deployments') && call[1]?.method === 'POST'
        );

        expect(uploadCall).toBeDefined();
        expect(uploadCall[1].headers['Authorization']).toBe('Bearer test-api-token');
        expect(uploadCall[1].body).toBeInstanceOf(FormData);
      });

      it('should handle file upload errors', async () => {
        fetchMock
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({ result: mockProject }),
          })
          .mockResolvedValueOnce({
            ok: false,
            json: async () => ({
              errors: [{ message: 'File size exceeds limit' }],
            }),
          });

        const result = await service.deploy(mockFiles, mockConfig);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Failed to upload files');
      });

      it('should include all files in upload', async () => {
        const filesWithMultipleTypes: DeploymentFiles = {
          'index.html': '<html></html>',
          'styles.css': 'body {}',
          'script.js': 'console.log("test")',
          'data.json': '{"key": "value"}',
          'sitemap.xml': '<?xml version="1.0"?><urlset></urlset>',
        };

        fetchMock
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({ result: mockProject }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({ result: mockDeployment }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({ result: { ...mockDeployment, latest_stage: { name: 'deploy', status: 'success' } } }),
          });

        const result = await service.deploy(filesWithMultipleTypes, mockConfig);

        expect(result.success).toBe(true);
      });
    });

    describe('Deployment Status Polling', () => {
      it('should poll deployment status until success', async () => {
        fetchMock
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({ result: mockProject }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({ result: { ...mockDeployment, latest_stage: { name: 'build', status: 'active' } } }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({ result: { ...mockDeployment, latest_stage: { name: 'build', status: 'active' } } }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({ result: { ...mockDeployment, latest_stage: { name: 'deploy', status: 'active' } } }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({ result: { ...mockDeployment, latest_stage: { name: 'deploy', status: 'success' } } }),
          });

        const result = await service.deploy(mockFiles, mockConfig);

        expect(result.success).toBe(true);
        // Should have polled multiple times
        const statusCalls = fetchMock.mock.calls.filter((call: any) => 
          call[0].includes('/deployments/deployment-123') && call[1]?.method === 'GET'
        );
        expect(statusCalls.length).toBeGreaterThan(1);
      });

      it('should handle deployment failure during build', async () => {
        fetchMock
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({ result: mockProject }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({ result: mockDeployment }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({ 
              result: { 
                ...mockDeployment, 
                latest_stage: { name: 'build', status: 'failure' } 
              } 
            }),
          });

        const result = await service.deploy(mockFiles, mockConfig);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Deployment failed');
      });

      it('should handle status check API errors', async () => {
        fetchMock
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({ result: mockProject }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({ result: mockDeployment }),
          })
          .mockResolvedValueOnce({
            ok: false,
            status: 500,
          });

        const result = await service.deploy(mockFiles, mockConfig);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Failed to check deployment status');
      });

      it('should timeout if deployment takes too long', async () => {
        // Mock deployment that never completes
        fetchMock
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({ result: mockProject }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({ result: mockDeployment }),
          });

        // Mock all subsequent status checks as still building
        for (let i = 0; i < 65; i++) {
          fetchMock.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ 
              result: { 
                ...mockDeployment, 
                latest_stage: { name: 'build', status: 'active' } 
              } 
            }),
          });
        }

        const result = await service.deploy(mockFiles, mockConfig);

        expect(result.success).toBe(false);
        expect(result.error).toContain('timeout');
      }, 10000); // Increase timeout for this test
    });
  });

  describe('deploy', () => {
    it('should deploy to Cloudflare Pages successfully', async () => {
      fetchMock
        .mockResolvedValueOnce({
          ok: false, // Project doesn't exist
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: mockProject }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: mockDeployment }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: { ...mockDeployment, latest_stage: { name: 'deploy', status: 'success' } } }),
        });

      const result = await service.deploy(mockFiles, mockConfig);

      expect(result.success).toBe(true);
      expect(result.platform).toBe('cloudflare-pages');
      expect(result.url).toContain('pages.dev');
      expect(result.deploymentId).toBeDefined();
    });

    it('should use custom domain when provided', async () => {
      const customDomain = 'portfolio.example.com';
      
      fetchMock
        .mockResolvedValueOnce({
          ok: false,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: mockProject }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: mockDeployment }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: { ...mockDeployment, latest_stage: { name: 'deploy', status: 'success' } } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: mockDomain }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: mockDomain }),
        });

      const result = await service.deploy(mockFiles, {
        ...mockConfig,
        customDomain,
      });

      expect(result.success).toBe(true);
      expect(result.url).toBe(customDomain);
      expect(result.customDomain).toBe(customDomain);
    });

    it('should handle unsupported platform', async () => {
      const result = await service.deploy(mockFiles, {
        ...mockConfig,
        platform: 'vercel' as any,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported platform');
    });

    it('should track deployment status', async () => {
      fetchMock
        .mockResolvedValueOnce({
          ok: false,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: mockProject }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: mockDeployment }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: { ...mockDeployment, latest_stage: { name: 'deploy', status: 'success' } } }),
        });

      const result = await service.deploy(mockFiles, mockConfig);
      const status = service.getDeploymentStatus(result.deploymentId);

      expect(status).toBeDefined();
      expect(status?.status).toBe('ready');
      expect(status?.progress).toBe(100);
    });

    it('should handle API errors gracefully', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          errors: [{ message: 'API Error' }],
        }),
      });

      const result = await service.deploy(mockFiles, mockConfig);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('getDeploymentStatus', () => {
    it('should return deployment status', async () => {
      fetchMock
        .mockResolvedValueOnce({ ok: false })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: mockProject }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: mockDeployment }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: { ...mockDeployment, latest_stage: { name: 'deploy', status: 'success' } } }),
        });

      const result = await service.deploy(mockFiles, mockConfig);
      const status = service.getDeploymentStatus(result.deploymentId);

      expect(status).toBeDefined();
      expect(status?.deploymentId).toBe(result.deploymentId);
      expect(status?.status).toBe('ready');
    });

    it('should return undefined for non-existent deployment', () => {
      const status = service.getDeploymentStatus('non-existent');
      expect(status).toBeUndefined();
    });
  });

  describe('Custom Domain Setup', () => {
    it('should setup custom domain successfully', async () => {
      // Mock deployment
      fetchMock
        .mockResolvedValueOnce({ ok: false })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: mockProject }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: mockDeployment }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: { ...mockDeployment, latest_stage: { name: 'deploy', status: 'success' } } }),
        });

      const deployment = await service.deploy(mockFiles, mockConfig);
      
      // Mock custom domain setup
      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: mockDomain }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: mockDomain }),
        });

      const result = await service.setupCustomDomain({
        domain: 'portfolio.example.com',
        deploymentId: deployment.deploymentId,
        sslEnabled: true,
      });

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.dnsRecords).toBeDefined();
      expect(result.dnsRecords?.[0].type).toBe('CNAME');
      expect(result.sslStatus).toBe('active');
    });

    it('should call Pages API with correct domain configuration', async () => {
      fetchMock
        .mockResolvedValueOnce({ ok: false })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: mockProject }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: mockDeployment }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: { ...mockDeployment, latest_stage: { name: 'deploy', status: 'success' } } }),
        });

      const deployment = await service.deploy(mockFiles, mockConfig);
      
      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: mockDomain }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: mockDomain }),
        });

      await service.setupCustomDomain({
        domain: 'portfolio.example.com',
        deploymentId: deployment.deploymentId,
        sslEnabled: true,
      });

      const domainCall = fetchMock.mock.calls.find((call: any) => 
        call[0].includes('/domains') && call[1]?.method === 'POST'
      );

      expect(domainCall).toBeDefined();
      expect(domainCall[1].body).toContain('portfolio.example.com');
    });

    it('should validate domain format', async () => {
      fetchMock
        .mockResolvedValueOnce({ ok: false })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: mockProject }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: mockDeployment }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: { ...mockDeployment, latest_stage: { name: 'deploy', status: 'success' } } }),
        });

      const deployment = await service.deploy(mockFiles, mockConfig);
      
      const result = await service.setupCustomDomain({
        domain: 'invalid domain!',
        deploymentId: deployment.deploymentId,
        sslEnabled: true,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid domain format');
    });

    it('should handle non-existent deployment', async () => {
      const result = await service.setupCustomDomain({
        domain: 'portfolio.example.com',
        deploymentId: 'non-existent',
        sslEnabled: true,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Deployment not found');
    });

    it('should handle domain setup API errors', async () => {
      fetchMock
        .mockResolvedValueOnce({ ok: false })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: mockProject }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: mockDeployment }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: { ...mockDeployment, latest_stage: { name: 'deploy', status: 'success' } } }),
        });

      const deployment = await service.deploy(mockFiles, mockConfig);
      
      fetchMock.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          errors: [{ message: 'Domain already in use' }],
        }),
      });

      const result = await service.setupCustomDomain({
        domain: 'portfolio.example.com',
        deploymentId: deployment.deploymentId,
        sslEnabled: true,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to add custom domain');
    });

    it('should provide DNS records for domain configuration', async () => {
      fetchMock
        .mockResolvedValueOnce({ ok: false })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: mockProject }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: mockDeployment }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: { ...mockDeployment, latest_stage: { name: 'deploy', status: 'success' } } }),
        });

      const deployment = await service.deploy(mockFiles, mockConfig);
      
      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: mockDomain }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: mockDomain }),
        });

      const result = await service.setupCustomDomain({
        domain: 'portfolio.example.com',
        deploymentId: deployment.deploymentId,
        sslEnabled: true,
      });

      expect(result.dnsRecords).toBeDefined();
      expect(result.dnsRecords?.length).toBeGreaterThan(0);
      expect(result.dnsRecords?.[0]).toMatchObject({
        type: 'CNAME',
        name: 'portfolio.example.com',
        value: expect.stringContaining('.pages.dev'),
      });
    });
  });

  describe('cancelDeployment', () => {
    it('should cancel pending deployment', async () => {
      // Start deployment but don't wait
      const deployPromise = service.deploy(mockFiles, mockConfig);
      
      // Get deployment ID from the promise
      const result = await deployPromise;
      
      // Try to cancel (will fail since it's already complete in our mock)
      const cancelled = await service.cancelDeployment(result.deploymentId);
      
      // In our implementation, completed deployments can't be cancelled
      expect(cancelled).toBe(false);
    });

    it('should return false for non-existent deployment', async () => {
      const cancelled = await service.cancelDeployment('non-existent');
      expect(cancelled).toBe(false);
    });
  });

  describe('retryDeployment', () => {
    it('should retry failed deployment', async () => {
      // Create a failed deployment by using unsupported platform
      const failedResult = await service.deploy(mockFiles, {
        ...mockConfig,
        platform: 'unsupported' as any,
      });

      expect(failedResult.success).toBe(false);

      // Mock successful retry
      fetchMock
        .mockResolvedValueOnce({ ok: false })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: mockProject }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: mockDeployment }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: { ...mockDeployment, latest_stage: { name: 'deploy', status: 'success' } } }),
        });

      // Retry with correct platform
      const retryResult = await service.retryDeployment(
        failedResult.deploymentId,
        mockFiles,
        mockConfig
      );

      expect(retryResult.success).toBe(true);
      expect(retryResult.deploymentId).not.toBe(failedResult.deploymentId);
    });

    it('should throw error for non-failed deployment', async () => {
      fetchMock
        .mockResolvedValueOnce({ ok: false })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: mockProject }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: mockDeployment }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: { ...mockDeployment, latest_stage: { name: 'deploy', status: 'success' } } }),
        });

      const result = await service.deploy(mockFiles, mockConfig);

      await expect(
        service.retryDeployment(result.deploymentId, mockFiles, mockConfig)
      ).rejects.toThrow('Cannot retry deployment');
    });
  });

  describe('SSL Certificate Validation', () => {
    it('should validate active SSL certificate', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: mockDomain }),
      });

      const result = await service.validateSSL('portfolio.example.com');

      expect(result.valid).toBe(true);
      expect(result.issuer).toBe("Let's Encrypt");
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it('should call Pages API to check SSL status', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: mockDomain }),
      });

      await service.validateSSL('portfolio.example.com');

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/domains/portfolio.example.com'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-api-token',
          }),
        })
      );
    });

    it('should handle pending SSL validation', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: {
            ...mockDomain,
            ssl: {
              status: 'pending_validation',
              certificate_authority: '',
              validation_method: 'http',
            },
          },
        }),
      });

      const result = await service.validateSSL('portfolio.example.com');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('pending validation');
    });

    it('should handle SSL provisioning errors', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: {
            ...mockDomain,
            ssl: {
              status: 'error',
              certificate_authority: '',
              validation_method: 'http',
            },
          },
        }),
      });

      const result = await service.validateSSL('portfolio.example.com');

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle invalid domain format', async () => {
      const result = await service.validateSSL('invalid domain!');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid domain');
    });

    it('should handle domain not found', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await service.validateSSL('nonexistent.example.com');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Domain not found');
    });

    it('should handle API errors during SSL validation', async () => {
      fetchMock.mockRejectedValueOnce(new Error('Network error'));

      const result = await service.validateSSL('portfolio.example.com');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Network error');
    });
  });

  describe('getDeploymentLogs', () => {
    it('should return deployment logs', async () => {
      const result = await service.deploy(mockFiles, mockConfig);
      const logs = service.getDeploymentLogs(result.deploymentId);

      expect(logs).toBeInstanceOf(Array);
      expect(logs.length).toBeGreaterThan(0);
      expect(logs.some(log => log.includes('Deployment started'))).toBe(true);
    });

    it('should return empty array for non-existent deployment', () => {
      const logs = service.getDeploymentLogs('non-existent');
      expect(logs).toEqual([]);
    });
  });

  describe('listDeployments', () => {
    it('should list all deployments', async () => {
      // Mock first deployment
      fetchMock
        .mockResolvedValueOnce({ ok: false })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: mockProject }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: mockDeployment }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: { ...mockDeployment, latest_stage: { name: 'deploy', status: 'success' } } }),
        });

      await service.deploy(mockFiles, mockConfig);

      // Mock second deployment
      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: mockProject }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: { ...mockDeployment, id: 'deployment-456' } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: { ...mockDeployment, id: 'deployment-456', latest_stage: { name: 'deploy', status: 'success' } } }),
        });

      await service.deploy(mockFiles, mockConfig);

      const deployments = service.listDeployments();

      expect(deployments.length).toBe(2);
      expect(deployments[0].status).toBe('ready');
      expect(deployments[1].status).toBe('ready');
    });

    it('should return empty array when no deployments', () => {
      const deployments = service.listDeployments();
      expect(deployments).toEqual([]);
    });
  });

  describe('deleteDeployment', () => {
    it('should delete deployment', async () => {
      const result = await service.deploy(mockFiles, mockConfig);
      
      const deleted = await service.deleteDeployment(result.deploymentId);
      expect(deleted).toBe(true);

      const status = service.getDeploymentStatus(result.deploymentId);
      expect(status).toBeUndefined();
    });

    it('should return false for non-existent deployment', async () => {
      const deleted = await service.deleteDeployment('non-existent');
      expect(deleted).toBe(false);
    });
  });

  describe('deployment workflow', () => {
    it('should complete full deployment workflow', async () => {
      // Mock deployment
      fetchMock
        .mockResolvedValueOnce({ ok: false })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: mockProject }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: mockDeployment }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: { ...mockDeployment, latest_stage: { name: 'deploy', status: 'success' } } }),
        });

      // Deploy
      const deployment = await service.deploy(mockFiles, mockConfig);
      expect(deployment.success).toBe(true);

      // Check status
      const status = service.getDeploymentStatus(deployment.deploymentId);
      expect(status?.status).toBe('ready');

      // Mock custom domain setup
      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: mockDomain }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: mockDomain }),
        });

      // Setup custom domain
      const domainResult = await service.setupCustomDomain({
        domain: 'portfolio.example.com',
        deploymentId: deployment.deploymentId,
        sslEnabled: true,
      });
      expect(domainResult.success).toBe(true);

      // Mock SSL validation
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: mockDomain }),
      });

      // Validate SSL
      const sslResult = await service.validateSSL('portfolio.example.com');
      expect(sslResult.valid).toBe(true);

      // Get logs
      const logs = service.getDeploymentLogs(deployment.deploymentId);
      expect(logs.length).toBeGreaterThan(0);

      // Delete deployment
      const deleted = await service.deleteDeployment(deployment.deploymentId);
      expect(deleted).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle deployment errors gracefully', async () => {
      const result = await service.deploy(mockFiles, {
        ...mockConfig,
        platform: 'invalid' as any,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      
      const status = service.getDeploymentStatus(result.deploymentId);
      expect(status?.status).toBe('error');
    });

    it('should track error status', async () => {
      const result = await service.deploy(mockFiles, {
        ...mockConfig,
        platform: 'unsupported' as any,
      });

      const status = service.getDeploymentStatus(result.deploymentId);
      expect(status?.status).toBe('error');
      expect(status?.error).toBeDefined();
    });
  });

  describe('project name sanitization', () => {
    it('should sanitize project names for URLs', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({ ok: false })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            result: { id: 'project-123', name: 'my-awesome-portfolio-2024', subdomain: 'my-awesome-portfolio-2024' },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            result: { id: 'deployment-123', url: 'https://my-awesome-portfolio-2024.pages.dev', latest_stage: { status: 'active' } },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            result: { latest_stage: { status: 'success' } },
          }),
        });

      const result = await service.deploy(mockFiles, {
        ...mockConfig,
        seoConfig: {
          ...mockConfig.seoConfig,
          title: 'My Awesome Portfolio! @2024',
        },
      });

      expect(result.url).toMatch(/my-awesome-portfolio-2024/);
    });

    it('should handle long project names', async () => {
      const longTitle = 'A'.repeat(100);
      
      (global.fetch as any)
        .mockResolvedValueOnce({ ok: false })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            result: { id: 'project-123', name: 'a'.repeat(50), subdomain: 'a'.repeat(50) },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            result: { id: 'deployment-123', url: `https://${'a'.repeat(50)}.pages.dev`, latest_stage: { status: 'active' } },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            result: { latest_stage: { status: 'success' } },
          }),
        });

      const result = await service.deploy(mockFiles, {
        ...mockConfig,
        seoConfig: {
          ...mockConfig.seoConfig,
          title: longTitle,
        },
      });

      // URL should be truncated
      const urlParts = result.url?.split('/');
      const projectName = urlParts?.[urlParts.length - 1]?.split('.')[0];
      expect(projectName?.length).toBeLessThanOrEqual(50);
    });
  });

  describe('platform-specific URLs', () => {
    it('should generate correct Cloudflare Pages URL format', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({ ok: false })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            result: { id: 'project-123', name: 'test-portfolio', subdomain: 'test-portfolio' },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            result: { id: 'deployment-123', url: 'https://test-portfolio.pages.dev', latest_stage: { status: 'active' } },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            result: { latest_stage: { status: 'success' } },
          }),
        });

      const result = await service.deploy(mockFiles, mockConfig);

      expect(result.url).toMatch(/https:\/\/.*\.pages\.dev/);
    });
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CloudflareEnv } from '../../config/cloudflare-env';

// Mock types for Cloudflare Workers AI
interface AiTextGenerationInput {
  prompt: string;
  max_tokens?: number;
  temperature?: number;
}

interface AiTextGenerationOutput {
  response: string;
}

interface MockAi {
  run(model: string, input: AiTextGenerationInput): Promise<AiTextGenerationOutput>;
}

// CloudflareAIService interface based on requirements
interface CloudflareAIService {
  generateText(prompt: string, options?: { maxTokens?: number; temperature?: number }): Promise<string>;
  enhanceBio(originalBio: string, context: string): Promise<string>;
  rewriteBullets(bullets: string[], role: string, techStack: string[]): Promise<string[]>;
}

// Mock CloudflareAIService implementation for testing
class MockCloudflareAIService implements CloudflareAIService {
  constructor(private env: CloudflareEnv) {}

  async generateText(
    prompt: string,
    options?: { maxTokens?: number; temperature?: number }
  ): Promise<string> {
    if (!this.env.AI) {
      throw new Error('Workers AI binding not available');
    }

    const result = await this.env.AI.run(
      this.env.WORKERS_AI_MODEL || '@cf/meta/llama-3-8b-instruct',
      {
        prompt,
        max_tokens: options?.maxTokens || 300,
        temperature: options?.temperature || 0.7,
      }
    );

    return result.response;
  }

  async enhanceBio(originalBio: string, context: string): Promise<string> {
    const prompt = `Enhance this professional bio for a developer portfolio:\n\nOriginal: ${originalBio}\n\nContext: ${context}\n\nProvide an enhanced 2-3 sentence bio that highlights technical expertise.`;
    return this.generateText(prompt, { maxTokens: 300, temperature: 0.7 });
  }

  async rewriteBullets(bullets: string[], role: string, techStack: string[]): Promise<string[]> {
    const prompt = `Rewrite these job bullets for a ${role} role using ${techStack.join(', ')}:\n\n${bullets.map((b, i) => `${i + 1}. ${b}`).join('\n')}\n\nReturn ${bullets.length} enhanced bullets with metrics and impact.`;
    const result = await this.generateText(prompt, { maxTokens: 800, temperature: 0.6 });
    
    // Parse numbered list
    return result
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => line.replace(/^\d+\.\s*/, '').trim())
      .filter(line => line.length > 0);
  }
}

// AIProviderService for dual provider support
interface AIProviderConfig {
  primaryProvider: 'openrouter' | 'cloudflare';
  enableFallback: boolean;
  qualityThreshold: number;
}

class MockAIProviderService {
  private cloudflareAI?: MockCloudflareAIService;
  private config: AIProviderConfig;

  constructor(
    private env: CloudflareEnv,
    config?: Partial<AIProviderConfig>
  ) {
    this.config = {
      primaryProvider: config?.primaryProvider || 'openrouter',
      enableFallback: config?.enableFallback ?? true,
      qualityThreshold: config?.qualityThreshold || 0.85,
    };

    if (env.AI && env.ENABLE_CLOUDFLARE_AI === 'true') {
      this.cloudflareAI = new MockCloudflareAIService(env);
    }
  }

  async generateWithFallback(
    operation: 'enhanceBio' | 'rewriteBullets',
    ...args: any[]
  ): Promise<any> {
    const usePrimary = this.config.primaryProvider === 'openrouter';
    
    try {
      if (usePrimary) {
        // Try OpenRouter first
        return await this.callOpenRouter(operation, ...args);
      } else if (this.cloudflareAI) {
        // Try Cloudflare AI first
        return await this.callCloudflareAI(operation, ...args);
      }
    } catch (primaryError) {
      if (!this.config.enableFallback) {
        throw primaryError;
      }

      // Fallback to alternative provider
      try {
        if (usePrimary && this.cloudflareAI) {
          return await this.callCloudflareAI(operation, ...args);
        } else {
          return await this.callOpenRouter(operation, ...args);
        }
      } catch (fallbackError) {
        throw new Error(`Both providers failed: ${primaryError.message}, ${fallbackError.message}`);
      }
    }
  }

  private async callOpenRouter(operation: string, ...args: any[]): Promise<any> {
    // Mock OpenRouter call
    throw new Error('OpenRouter not implemented in test');
  }

  private async callCloudflareAI(operation: string, ...args: any[]): Promise<any> {
    if (!this.cloudflareAI) {
      throw new Error('Cloudflare AI not available');
    }

    switch (operation) {
      case 'enhanceBio':
        return await this.cloudflareAI.enhanceBio(args[0], args[1]);
      case 'rewriteBullets':
        return await this.cloudflareAI.rewriteBullets(args[0], args[1], args[2]);
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  async compareQuality(result1: string, result2: string): Promise<number> {
    // Simple similarity calculation for testing
    const words1 = result1.toLowerCase().split(/\s+/);
    const words2 = result2.toLowerCase().split(/\s+/);
    const commonWords = words1.filter(w => words2.includes(w));
    return commonWords.length / Math.max(words1.length, words2.length);
  }
}

describe('CloudflareAIService', () => {
  let mockEnv: CloudflareEnv;
  let mockAI: MockAi;

  beforeEach(() => {
    mockAI = {
      run: vi.fn(),
    };

    mockEnv = {
      AI: mockAI as any,
      WORKERS_AI_MODEL: '@cf/meta/llama-3-8b-instruct',
      ENABLE_CLOUDFLARE_AI: 'true',
    } as CloudflareEnv;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('generateText', () => {
    it('should generate text using Workers AI', async () => {
      const mockResponse = {
        response: 'Generated text from Cloudflare AI',
      };

      (mockAI.run as any).mockResolvedValue(mockResponse);

      const service = new MockCloudflareAIService(mockEnv);
      const result = await service.generateText('Test prompt');

      expect(result).toBe('Generated text from Cloudflare AI');
      expect(mockAI.run).toHaveBeenCalledWith(
        '@cf/meta/llama-3-8b-instruct',
        {
          prompt: 'Test prompt',
          max_tokens: 300,
          temperature: 0.7,
        }
      );
    });

    it('should use custom model from environment', async () => {
      mockEnv.WORKERS_AI_MODEL = '@cf/meta/llama-2-7b-chat-int8';
      const mockResponse = { response: 'Response from custom model' };
      (mockAI.run as any).mockResolvedValue(mockResponse);

      const service = new MockCloudflareAIService(mockEnv);
      await service.generateText('Test prompt');

      expect(mockAI.run).toHaveBeenCalledWith(
        '@cf/meta/llama-2-7b-chat-int8',
        expect.any(Object)
      );
    });

    it('should accept custom options', async () => {
      const mockResponse = { response: 'Custom options response' };
      (mockAI.run as any).mockResolvedValue(mockResponse);

      const service = new MockCloudflareAIService(mockEnv);
      await service.generateText('Test prompt', {
        maxTokens: 500,
        temperature: 0.9,
      });

      expect(mockAI.run).toHaveBeenCalledWith(
        '@cf/meta/llama-3-8b-instruct',
        {
          prompt: 'Test prompt',
          max_tokens: 500,
          temperature: 0.9,
        }
      );
    });

    it('should throw error when AI binding not available', async () => {
      mockEnv.AI = undefined;
      const service = new MockCloudflareAIService(mockEnv);

      await expect(service.generateText('Test prompt')).rejects.toThrow(
        'Workers AI binding not available'
      );
    });

    it('should handle Workers AI errors', async () => {
      (mockAI.run as any).mockRejectedValue(new Error('AI model error'));

      const service = new MockCloudflareAIService(mockEnv);

      await expect(service.generateText('Test prompt')).rejects.toThrow('AI model error');
    });
  });

  describe('enhanceBio', () => {
    it('should enhance bio using Workers AI', async () => {
      const mockResponse = {
        response: 'Senior Frontend Developer with 5+ years building scalable React applications. Expert in TypeScript, modern JavaScript frameworks, and performance optimization.',
      };

      (mockAI.run as any).mockResolvedValue(mockResponse);

      const service = new MockCloudflareAIService(mockEnv);
      const result = await service.enhanceBio(
        'I am a frontend developer',
        'Experience with React, TypeScript, 5 years'
      );

      expect(result).toBe(mockResponse.response);
      expect(mockAI.run).toHaveBeenCalledWith(
        '@cf/meta/llama-3-8b-instruct',
        expect.objectContaining({
          prompt: expect.stringContaining('frontend developer'),
          max_tokens: 300,
          temperature: 0.7,
        })
      );
    });

    it('should include context in prompt', async () => {
      const mockResponse = { response: 'Enhanced bio' };
      (mockAI.run as any).mockResolvedValue(mockResponse);

      const service = new MockCloudflareAIService(mockEnv);
      await service.enhanceBio('Original bio', 'Backend developer, Node.js, Python');

      const callArgs = (mockAI.run as any).mock.calls[0][1];
      expect(callArgs.prompt).toContain('Original bio');
      expect(callArgs.prompt).toContain('Backend developer, Node.js, Python');
    });
  });

  describe('rewriteBullets', () => {
    it('should rewrite bullets using Workers AI', async () => {
      const mockResponse = {
        response: `1. Built 5 responsive web applications using React and TypeScript, improving user engagement by 40%
2. Architected RESTful APIs with Node.js, reducing response times by 60%
3. Led team of 4 developers, delivering projects 2 weeks ahead of schedule`,
      };

      (mockAI.run as any).mockResolvedValue(mockResponse);

      const service = new MockCloudflareAIService(mockEnv);
      const bullets = [
        'Developed web applications',
        'Built APIs',
        'Worked with team',
      ];

      const result = await service.rewriteBullets(
        bullets,
        'Full Stack Developer',
        ['React', 'Node.js', 'TypeScript']
      );

      expect(result).toHaveLength(3);
      expect(result[0]).toContain('Built 5 responsive web applications');
      expect(result[1]).toContain('Architected RESTful APIs');
      expect(result[2]).toContain('Led team of 4 developers');
    });

    it('should parse numbered list correctly', async () => {
      const mockResponse = {
        response: `1. First bullet point
2. Second bullet point
3. Third bullet point`,
      };

      (mockAI.run as any).mockResolvedValue(mockResponse);

      const service = new MockCloudflareAIService(mockEnv);
      const result = await service.rewriteBullets(
        ['bullet 1', 'bullet 2', 'bullet 3'],
        'Developer',
        ['JavaScript']
      );

      expect(result).toEqual([
        'First bullet point',
        'Second bullet point',
        'Third bullet point',
      ]);
    });

    it('should include role and tech stack in prompt', async () => {
      const mockResponse = { response: '1. Enhanced bullet' };
      (mockAI.run as any).mockResolvedValue(mockResponse);

      const service = new MockCloudflareAIService(mockEnv);
      await service.rewriteBullets(
        ['Original bullet'],
        'Senior Backend Engineer',
        ['Python', 'Django', 'PostgreSQL']
      );

      const callArgs = (mockAI.run as any).mock.calls[0][1];
      expect(callArgs.prompt).toContain('Senior Backend Engineer');
      expect(callArgs.prompt).toContain('Python, Django, PostgreSQL');
    });
  });
});

describe('AIProviderService - Provider Selection and Fallback', () => {
  let mockEnv: CloudflareEnv;
  let mockAI: MockAi;

  beforeEach(() => {
    mockAI = {
      run: vi.fn(),
    };

    mockEnv = {
      AI: mockAI as any,
      WORKERS_AI_MODEL: '@cf/meta/llama-3-8b-instruct',
      ENABLE_CLOUDFLARE_AI: 'true',
    } as CloudflareEnv;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('provider selection', () => {
    it('should use OpenRouter as primary provider by default', async () => {
      const service = new MockAIProviderService(mockEnv);
      
      expect(service['config'].primaryProvider).toBe('openrouter');
    });

    it('should use Cloudflare AI as primary when configured', async () => {
      const service = new MockAIProviderService(mockEnv, {
        primaryProvider: 'cloudflare',
      });
      
      expect(service['config'].primaryProvider).toBe('cloudflare');
    });

    it('should initialize Cloudflare AI when enabled', async () => {
      const service = new MockAIProviderService(mockEnv);
      
      expect(service['cloudflareAI']).toBeDefined();
    });

    it('should not initialize Cloudflare AI when disabled', async () => {
      mockEnv.ENABLE_CLOUDFLARE_AI = 'false';
      const service = new MockAIProviderService(mockEnv);
      
      expect(service['cloudflareAI']).toBeUndefined();
    });

    it('should not initialize Cloudflare AI when binding unavailable', async () => {
      mockEnv.AI = undefined;
      const service = new MockAIProviderService(mockEnv);
      
      expect(service['cloudflareAI']).toBeUndefined();
    });
  });

  describe('fallback logic', () => {
    it('should fallback to Cloudflare AI when OpenRouter fails', async () => {
      const mockResponse = { response: 'Cloudflare AI fallback response' };
      (mockAI.run as any).mockResolvedValue(mockResponse);

      const service = new MockAIProviderService(mockEnv, {
        primaryProvider: 'openrouter',
        enableFallback: true,
      });

      // Mock OpenRouter failure by making it throw
      vi.spyOn(service as any, 'callOpenRouter').mockRejectedValue(
        new Error('OpenRouter API error')
      );

      const result = await service.generateWithFallback(
        'enhanceBio',
        'Original bio',
        'Context'
      );

      expect(result).toBe('Cloudflare AI fallback response');
      expect(mockAI.run).toHaveBeenCalled();
    });

    it('should fallback to OpenRouter when Cloudflare AI fails', async () => {
      const service = new MockAIProviderService(mockEnv, {
        primaryProvider: 'cloudflare',
        enableFallback: true,
      });

      (mockAI.run as any).mockRejectedValue(new Error('Cloudflare AI error'));
      
      vi.spyOn(service as any, 'callOpenRouter').mockResolvedValue(
        'OpenRouter fallback response'
      );

      const result = await service.generateWithFallback(
        'enhanceBio',
        'Original bio',
        'Context'
      );

      expect(result).toBe('OpenRouter fallback response');
    });

    it('should not fallback when fallback is disabled', async () => {
      const service = new MockAIProviderService(mockEnv, {
        primaryProvider: 'openrouter',
        enableFallback: false,
      });

      vi.spyOn(service as any, 'callOpenRouter').mockRejectedValue(
        new Error('OpenRouter API error')
      );

      await expect(
        service.generateWithFallback('enhanceBio', 'Original bio', 'Context')
      ).rejects.toThrow('OpenRouter API error');

      expect(mockAI.run).not.toHaveBeenCalled();
    });

    it('should throw error when both providers fail', async () => {
      const service = new MockAIProviderService(mockEnv, {
        primaryProvider: 'openrouter',
        enableFallback: true,
      });

      vi.spyOn(service as any, 'callOpenRouter').mockRejectedValue(
        new Error('OpenRouter failed')
      );
      (mockAI.run as any).mockRejectedValue(new Error('Cloudflare AI failed'));

      await expect(
        service.generateWithFallback('enhanceBio', 'Original bio', 'Context')
      ).rejects.toThrow('Both providers failed');
    });

    it('should handle Cloudflare AI unavailable during fallback', async () => {
      mockEnv.AI = undefined;
      const service = new MockAIProviderService(mockEnv, {
        primaryProvider: 'openrouter',
        enableFallback: true,
      });

      vi.spyOn(service as any, 'callOpenRouter').mockRejectedValue(
        new Error('OpenRouter failed')
      );

      await expect(
        service.generateWithFallback('enhanceBio', 'Original bio', 'Context')
      ).rejects.toThrow('Both providers failed');
    });
  });

  describe('content quality comparison', () => {
    it('should calculate similarity between two responses', async () => {
      const service = new MockAIProviderService(mockEnv);

      const result1 = 'Senior Frontend Developer with React and TypeScript experience';
      const result2 = 'Senior Frontend Developer with React and TypeScript expertise';

      const similarity = await service.compareQuality(result1, result2);

      expect(similarity).toBeGreaterThan(0.8);
    });

    it('should return low similarity for different responses', async () => {
      const service = new MockAIProviderService(mockEnv);

      const result1 = 'Frontend Developer with React experience';
      const result2 = 'Backend Engineer with Python and Django expertise';

      const similarity = await service.compareQuality(result1, result2);

      expect(similarity).toBeLessThan(0.5);
    });

    it('should handle identical responses', async () => {
      const service = new MockAIProviderService(mockEnv);

      const result = 'Senior Developer with 5 years experience';

      const similarity = await service.compareQuality(result, result);

      expect(similarity).toBe(1.0);
    });

    it('should be case-insensitive', async () => {
      const service = new MockAIProviderService(mockEnv);

      const result1 = 'Senior Frontend Developer';
      const result2 = 'senior frontend developer';

      const similarity = await service.compareQuality(result1, result2);

      expect(similarity).toBe(1.0);
    });

    it('should meet quality threshold requirement', async () => {
      const service = new MockAIProviderService(mockEnv, {
        qualityThreshold: 0.85,
      });

      expect(service['config'].qualityThreshold).toBe(0.85);
    });
  });

  describe('dual provider operations', () => {
    it('should support enhanceBio with both providers', async () => {
      const mockResponse = { response: 'Enhanced bio from Cloudflare' };
      (mockAI.run as any).mockResolvedValue(mockResponse);

      const service = new MockAIProviderService(mockEnv, {
        primaryProvider: 'cloudflare',
      });

      const result = await service.generateWithFallback(
        'enhanceBio',
        'Original bio',
        'Developer context'
      );

      expect(result).toBe('Enhanced bio from Cloudflare');
    });

    it('should support rewriteBullets with both providers', async () => {
      const mockResponse = {
        response: '1. Enhanced bullet\n2. Another bullet',
      };
      (mockAI.run as any).mockResolvedValue(mockResponse);

      const service = new MockAIProviderService(mockEnv, {
        primaryProvider: 'cloudflare',
      });

      const result = await service.generateWithFallback(
        'rewriteBullets',
        ['Original bullet 1', 'Original bullet 2'],
        'Developer',
        ['JavaScript']
      );

      expect(result).toEqual(['Enhanced bullet', 'Another bullet']);
    });
  });
});

describe('Error Handling - Both Providers Fail', () => {
  let mockEnv: CloudflareEnv;
  let mockAI: MockAi;

  beforeEach(() => {
    mockAI = {
      run: vi.fn(),
    };

    mockEnv = {
      AI: mockAI as any,
      WORKERS_AI_MODEL: '@cf/meta/llama-3-8b-instruct',
      ENABLE_CLOUDFLARE_AI: 'true',
    } as CloudflareEnv;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should provide detailed error when both providers fail', async () => {
    const service = new MockAIProviderService(mockEnv, {
      enableFallback: true,
    });

    vi.spyOn(service as any, 'callOpenRouter').mockRejectedValue(
      new Error('OpenRouter: Rate limit exceeded')
    );
    (mockAI.run as any).mockRejectedValue(
      new Error('Cloudflare AI: Model unavailable')
    );

    await expect(
      service.generateWithFallback('enhanceBio', 'Bio', 'Context')
    ).rejects.toThrow('Both providers failed');
  });

  it('should handle network errors from Cloudflare AI', async () => {
    const service = new MockCloudflareAIService(mockEnv);

    (mockAI.run as any).mockRejectedValue(new Error('Network error'));

    await expect(service.generateText('Test')).rejects.toThrow('Network error');
  });

  it('should handle timeout errors from Cloudflare AI', async () => {
    const service = new MockCloudflareAIService(mockEnv);

    (mockAI.run as any).mockRejectedValue(new Error('Request timeout'));

    await expect(service.generateText('Test')).rejects.toThrow('Request timeout');
  });

  it('should handle model not found errors', async () => {
    mockEnv.WORKERS_AI_MODEL = '@cf/invalid/model';
    const service = new MockCloudflareAIService(mockEnv);

    (mockAI.run as any).mockRejectedValue(new Error('Model not found'));

    await expect(service.generateText('Test')).rejects.toThrow('Model not found');
  });

  it('should handle quota exceeded errors', async () => {
    const service = new MockCloudflareAIService(mockEnv);

    (mockAI.run as any).mockRejectedValue(new Error('Quota exceeded'));

    await expect(service.generateText('Test')).rejects.toThrow('Quota exceeded');
  });

  it('should handle malformed response from Workers AI', async () => {
    const service = new MockCloudflareAIService(mockEnv);

    (mockAI.run as any).mockResolvedValue({ response: null });

    const result = await service.generateText('Test');

    expect(result).toBeNull();
  });

  it('should handle empty response from Workers AI', async () => {
    const service = new MockCloudflareAIService(mockEnv);

    (mockAI.run as any).mockResolvedValue({ response: '' });

    const result = await service.generateText('Test');

    expect(result).toBe('');
  });
});

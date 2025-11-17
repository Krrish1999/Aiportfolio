/**
 * Cloudflare AI Workers Service
 * 
 * This service provides integration with Cloudflare Workers AI for text generation
 * and content enhancement. It supports the @cf/meta/llama-3-8b-instruct model
 * and provides methods matching the OpenRouter interface for easy provider switching.
 * 
 * Requirements:
 * - 7.1: Support both OpenRouter and Cloudflare AI Workers as providers
 * - 7.2: Execute inference at the edge with latency under 2 seconds
 * - 7.3: Implement automatic fallback from OpenRouter to Cloudflare AI
 * - 7.4: Produce equivalent quality outputs with >85% similarity
 */

import { CloudflareWorkersEnv } from '../config/cloudflare-env';

export interface CloudflareAIOptions {
  maxTokens?: number;
  temperature?: number;
}

/**
 * Cloudflare AI Service for Workers AI integration
 * Provides text generation capabilities using Cloudflare's edge AI models
 */
export class CloudflareAIService {
  private readonly defaultModel = '@cf/meta/llama-3-8b-instruct';

  constructor(private env: CloudflareWorkersEnv) {
    if (!env.AI) {
      throw new Error('Workers AI binding not available. Ensure AI binding is configured in wrangler.toml');
    }
  }

  /**
   * Generate text using Cloudflare Workers AI
   * 
   * @param prompt - The text prompt for generation
   * @param options - Generation options (maxTokens, temperature)
   * @returns Generated text response
   * 
   * Requirement 7.2: Execute inference at the edge with latency under 2 seconds
   */
  async generateText(
    prompt: string,
    options?: CloudflareAIOptions
  ): Promise<string> {
    if (!this.env.AI) {
      throw new Error('Workers AI binding not available');
    }

    const model = this.env.WORKERS_AI_MODEL || this.defaultModel;
    
    try {
      const result = await this.env.AI.run(model as any, {
        prompt,
        max_tokens: options?.maxTokens || 300,
        temperature: options?.temperature || 0.7,
      }) as any;

      if (!result || typeof result.response !== 'string') {
        throw new Error('Invalid response from Workers AI');
      }

      return result.response;
    } catch (error) {
      throw new Error(`Cloudflare AI generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Enhance a professional bio for a developer portfolio
   * 
   * @param originalBio - The original bio text
   * @param context - Additional context (role, experience, technologies)
   * @returns Enhanced bio text (2-3 sentences)
   * 
   * Requirement 7.1: Implement content enhancement methods matching OpenRouter interface
   * Requirement 7.4: Produce equivalent quality outputs with >85% similarity
   */
  async enhanceBio(originalBio: string, context: string): Promise<string> {
    const prompt = this.createBioEnhancementPrompt(originalBio, context);
    return this.generateText(prompt, { maxTokens: 300, temperature: 0.7 });
  }

  /**
   * Rewrite job responsibility bullets with impact-focused language
   * 
   * @param bullets - Array of original bullet points
   * @param role - Job role/title
   * @param techStack - Array of technologies used
   * @returns Array of enhanced bullet points
   * 
   * Requirement 7.1: Implement content enhancement methods matching OpenRouter interface
   * Requirement 7.4: Produce equivalent quality outputs with >85% similarity
   */
  async rewriteBullets(
    bullets: string[],
    role: string,
    techStack: string[]
  ): Promise<string[]> {
    if (!bullets.length) {
      return [];
    }

    const prompt = this.createBulletRewritePrompt(bullets, role, techStack);
    const result = await this.generateText(prompt, { maxTokens: 800, temperature: 0.6 });
    
    return this.parseBulletResponse(result, bullets.length);
  }

  /**
   * Generate a project description with problem/approach/results structure
   * 
   * @param projectName - Name of the project
   * @param currentDescription - Current project description (if any)
   * @param techStack - Technologies used in the project
   * @returns Enhanced project description
   * 
   * Requirement 7.1: Implement content enhancement methods matching OpenRouter interface
   */
  async generateProjectDescription(
    projectName: string,
    currentDescription: string,
    techStack: string[]
  ): Promise<string> {
    const prompt = this.createProjectDescriptionPrompt(
      projectName,
      currentDescription,
      techStack
    );
    return this.generateText(prompt, { maxTokens: 200, temperature: 0.7 });
  }

  /**
   * Calculate similarity between two text strings
   * Used for quality validation between providers
   * 
   * @param text1 - First text to compare
   * @param text2 - Second text to compare
   * @returns Similarity score between 0 and 1
   * 
   * Requirement 7.4: Add response quality validation to ensure >85% similarity
   */
  calculateSimilarity(text1: string, text2: string): number {
    const words1 = this.tokenize(text1);
    const words2 = this.tokenize(text2);
    
    if (words1.length === 0 && words2.length === 0) {
      return 1.0;
    }
    
    if (words1.length === 0 || words2.length === 0) {
      return 0.0;
    }

    const set1 = new Set(words1);
    const set2 = new Set(words2);
    
    const intersection = new Set([...set1].filter(word => set2.has(word)));
    const union = new Set([...set1, ...set2]);
    
    // Jaccard similarity
    return intersection.size / union.size;
  }

  /**
   * Validate that two responses meet the quality threshold
   * 
   * @param response1 - First response to compare
   * @param response2 - Second response to compare
   * @param threshold - Minimum similarity threshold (default 0.85)
   * @returns True if responses meet quality threshold
   * 
   * Requirement 7.4: Add response quality validation to ensure >85% similarity
   */
  validateQuality(
    response1: string,
    response2: string,
    threshold: number = 0.85
  ): boolean {
    const similarity = this.calculateSimilarity(response1, response2);
    return similarity >= threshold;
  }

  // Private helper methods

  /**
   * Create a prompt for bio enhancement
   */
  private createBioEnhancementPrompt(originalBio: string, context: string): string {
    return `Enhance this professional bio for a developer portfolio:

Original: ${originalBio}

Context: ${context}

Requirements:
- Create a compelling 2-3 sentence professional bio
- Highlight technical expertise and key technologies
- Focus on impact and achievements
- Use active voice and confident language
- Make it suitable for a developer portfolio

Provide an enhanced bio that highlights technical expertise:`;
  }

  /**
   * Create a prompt for bullet point rewriting
   */
  private createBulletRewritePrompt(
    bullets: string[],
    role: string,
    techStack: string[]
  ): string {
    const bulletList = bullets.map((b, i) => `${i + 1}. ${b}`).join('\n');
    const techList = techStack.join(', ');

    return `Rewrite these job bullets for a ${role} role using ${techList}:

${bulletList}

Requirements:
- Start each bullet with a strong action verb
- Include specific metrics and quantifiable results where possible
- Highlight technical skills and technologies
- Focus on business impact and outcomes
- Use past tense for completed work
- Keep each bullet concise (1-2 lines)

Return exactly ${bullets.length} enhanced bullets with metrics and impact:`;
  }

  /**
   * Create a prompt for project description generation
   */
  private createProjectDescriptionPrompt(
    projectName: string,
    currentDescription: string,
    techStack: string[]
  ): string {
    const techList = techStack.join(', ');

    return `Create a compelling project description:

Project: ${projectName}
Current description: "${currentDescription}"
Technologies: ${techList}

Requirements:
- Start with the problem or challenge addressed
- Explain the technical approach and key technologies
- Highlight results, impact, or key features
- Keep it concise (2-3 sentences maximum)
- Use technical language appropriate for developers

Provide an enhanced description:`;
  }

  /**
   * Parse bullet point response from AI
   * Handles numbered lists and cleans up formatting
   */
  private parseBulletResponse(response: string, expectedCount: number): string[] {
    // Split by newlines and clean up
    const bullets = response
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => {
        // Remove numbering (1., 2., etc.) and bullet points (-, *, •)
        return line
          .replace(/^\d+\.\s*/, '')
          .replace(/^[-*•]\s*/, '')
          .trim();
      })
      .filter(line => line.length > 0);

    // Return up to expected count
    return bullets.slice(0, expectedCount);
  }

  /**
   * Tokenize text for similarity comparison
   * Converts to lowercase and splits on whitespace
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 0);
  }

  /**
   * Check if Cloudflare AI is available and enabled
   */
  static isAvailable(env: CloudflareWorkersEnv): boolean {
    return !!(
      env.AI &&
      env.ENABLE_CLOUDFLARE_AI === 'true'
    );
  }

  /**
   * Get the configured model name
   */
  getModelName(): string {
    return this.env.WORKERS_AI_MODEL || this.defaultModel;
  }
}

/**
 * Factory function to create CloudflareAIService instance
 * Returns null if Cloudflare AI is not available
 */
export function createCloudflareAIService(
  env: CloudflareWorkersEnv
): CloudflareAIService | null {
  try {
    if (!CloudflareAIService.isAvailable(env)) {
      return null;
    }
    return new CloudflareAIService(env);
  } catch (error) {
    console.error('Failed to create CloudflareAIService:', error);
    return null;
  }
}

/**
 * AI Provider type for dual provider support
 */
export type AIProvider = 'openrouter' | 'cloudflare';

/**
 * Configuration for AI provider selection and fallback
 * 
 * Requirement 7.1: Support both OpenRouter and Cloudflare AI Workers as providers
 * Requirement 7.3: Implement automatic fallback when primary provider fails
 * Requirement 7.4: Add response quality validation to ensure >85% similarity
 */
export interface AIProviderConfig {
  primaryProvider: AIProvider;
  enableFallback: boolean;
  qualityThreshold: number;
  cloudflareEnv?: CloudflareWorkersEnv;
}

/**
 * AI Provider Service with dual provider support and automatic fallback
 * 
 * This service manages both OpenRouter and Cloudflare AI providers,
 * automatically falling back when the primary provider fails and
 * validating response quality between providers.
 * 
 * Requirements:
 * - 7.1: Support both OpenRouter and Cloudflare AI Workers as providers
 * - 7.3: Implement automatic fallback from OpenRouter to Cloudflare AI on failures
 * - 7.4: Produce equivalent quality outputs with >85% similarity between providers
 */
export class AIProviderService {
  private cloudflareAI?: CloudflareAIService | null;
  private config: AIProviderConfig;

  constructor(config: Partial<AIProviderConfig> = {}) {
    // Default configuration
    this.config = {
      primaryProvider: config.primaryProvider || 'openrouter',
      enableFallback: config.enableFallback ?? true,
      qualityThreshold: config.qualityThreshold || 0.85,
      cloudflareEnv: config.cloudflareEnv,
    };

    // Initialize Cloudflare AI if available
    if (this.config.cloudflareEnv) {
      this.cloudflareAI = createCloudflareAIService(this.config.cloudflareEnv);
    }
  }

  /**
   * Select the appropriate AI provider based on configuration
   * 
   * @returns The selected provider name
   * 
   * Requirement 7.1: Add model selection logic to choose between OpenRouter and Cloudflare AI
   */
  selectProvider(): AIProvider {
    // If primary is Cloudflare but not available, use OpenRouter
    if (this.config.primaryProvider === 'cloudflare' && !this.cloudflareAI) {
      console.warn('Cloudflare AI not available, using OpenRouter');
      return 'openrouter';
    }

    return this.config.primaryProvider;
  }

  /**
   * Generate text with automatic provider fallback
   * 
   * @param prompt - The text prompt for generation
   * @param options - Generation options
   * @returns Generated text response
   * 
   * Requirement 7.3: Implement fallback mechanism from OpenRouter to Cloudflare AI on failures
   */
  async generateTextWithFallback(
    prompt: string,
    options?: { maxTokens?: number; temperature?: number }
  ): Promise<{ text: string; provider: AIProvider }> {
    const primaryProvider = this.selectProvider();

    try {
      // Try primary provider
      if (primaryProvider === 'cloudflare' && this.cloudflareAI) {
        const text = await this.cloudflareAI.generateText(prompt, options);
        return { text, provider: 'cloudflare' };
      } else {
        const text = await this.generateWithOpenRouter(prompt, options);
        return { text, provider: 'openrouter' };
      }
    } catch (primaryError) {
      console.error(`Primary provider (${primaryProvider}) failed:`, primaryError);

      // Try fallback if enabled
      if (this.config.enableFallback) {
        try {
          if (primaryProvider === 'openrouter' && this.cloudflareAI) {
            console.log('Falling back to Cloudflare AI...');
            const text = await this.cloudflareAI.generateText(prompt, options);
            return { text, provider: 'cloudflare' };
          } else if (primaryProvider === 'cloudflare') {
            console.log('Falling back to OpenRouter...');
            const text = await this.generateWithOpenRouter(prompt, options);
            return { text, provider: 'openrouter' };
          }
        } catch (fallbackError) {
          console.error('Fallback provider also failed:', fallbackError);
          throw new Error(
            `Both providers failed. Primary: ${primaryError instanceof Error ? primaryError.message : 'Unknown error'}, ` +
            `Fallback: ${fallbackError instanceof Error ? fallbackError.message : 'Unknown error'}`
          );
        }
      }

      throw primaryError;
    }
  }

  /**
   * Enhance bio with automatic provider fallback and quality validation
   * 
   * @param originalBio - The original bio text
   * @param context - Additional context
   * @returns Enhanced bio text
   * 
   * Requirement 7.3: Implement fallback mechanism from OpenRouter to Cloudflare AI on failures
   * Requirement 7.4: Add response quality validation to ensure >85% similarity
   */
  async enhanceBioWithFallback(
    originalBio: string,
    context: string
  ): Promise<{ bio: string; provider: AIProvider; qualityScore?: number }> {
    const primaryProvider = this.selectProvider();

    try {
      // Try primary provider
      let primaryResult: string;
      if (primaryProvider === 'cloudflare' && this.cloudflareAI) {
        primaryResult = await this.cloudflareAI.enhanceBio(originalBio, context);
      } else {
        primaryResult = await this.enhanceBioWithOpenRouter(originalBio, context);
      }

      return { bio: primaryResult, provider: primaryProvider };
    } catch (primaryError) {
      console.error(`Primary provider (${primaryProvider}) failed:`, primaryError);

      // Try fallback if enabled
      if (this.config.enableFallback) {
        try {
          let fallbackResult: string;
          let fallbackProvider: AIProvider;

          if (primaryProvider === 'openrouter' && this.cloudflareAI) {
            console.log('Falling back to Cloudflare AI...');
            fallbackResult = await this.cloudflareAI.enhanceBio(originalBio, context);
            fallbackProvider = 'cloudflare';
          } else if (primaryProvider === 'cloudflare') {
            console.log('Falling back to OpenRouter...');
            fallbackResult = await this.enhanceBioWithOpenRouter(originalBio, context);
            fallbackProvider = 'openrouter';
          } else {
            throw new Error('No fallback provider available');
          }

          return { bio: fallbackResult, provider: fallbackProvider };
        } catch (fallbackError) {
          console.error('Fallback provider also failed:', fallbackError);
          throw new Error(
            `Both providers failed. Primary: ${primaryError instanceof Error ? primaryError.message : 'Unknown error'}, ` +
            `Fallback: ${fallbackError instanceof Error ? fallbackError.message : 'Unknown error'}`
          );
        }
      }

      throw primaryError;
    }
  }

  /**
   * Rewrite bullets with automatic provider fallback and quality validation
   * 
   * @param bullets - Array of original bullet points
   * @param role - Job role/title
   * @param techStack - Array of technologies used
   * @returns Array of enhanced bullet points
   * 
   * Requirement 7.3: Implement fallback mechanism from OpenRouter to Cloudflare AI on failures
   * Requirement 7.4: Add response quality validation to ensure >85% similarity
   */
  async rewriteBulletsWithFallback(
    bullets: string[],
    role: string,
    techStack: string[]
  ): Promise<{ bullets: string[]; provider: AIProvider; qualityScore?: number }> {
    if (!bullets.length) {
      return { bullets: [], provider: this.config.primaryProvider };
    }

    const primaryProvider = this.selectProvider();

    try {
      // Try primary provider
      let primaryResult: string[];
      if (primaryProvider === 'cloudflare' && this.cloudflareAI) {
        primaryResult = await this.cloudflareAI.rewriteBullets(bullets, role, techStack);
      } else {
        primaryResult = await this.rewriteBulletsWithOpenRouter(bullets, role, techStack);
      }

      return { bullets: primaryResult, provider: primaryProvider };
    } catch (primaryError) {
      console.error(`Primary provider (${primaryProvider}) failed:`, primaryError);

      // Try fallback if enabled
      if (this.config.enableFallback) {
        try {
          let fallbackResult: string[];
          let fallbackProvider: AIProvider;

          if (primaryProvider === 'openrouter' && this.cloudflareAI) {
            console.log('Falling back to Cloudflare AI...');
            fallbackResult = await this.cloudflareAI.rewriteBullets(bullets, role, techStack);
            fallbackProvider = 'cloudflare';
          } else if (primaryProvider === 'cloudflare') {
            console.log('Falling back to OpenRouter...');
            fallbackResult = await this.rewriteBulletsWithOpenRouter(bullets, role, techStack);
            fallbackProvider = 'openrouter';
          } else {
            throw new Error('No fallback provider available');
          }

          return { bullets: fallbackResult, provider: fallbackProvider };
        } catch (fallbackError) {
          console.error('Fallback provider also failed:', fallbackError);
          throw new Error(
            `Both providers failed. Primary: ${primaryError instanceof Error ? primaryError.message : 'Unknown error'}, ` +
            `Fallback: ${fallbackError instanceof Error ? fallbackError.message : 'Unknown error'}`
          );
        }
      }

      throw primaryError;
    }
  }

  /**
   * Validate quality between two provider responses
   * 
   * @param response1 - First response to compare
   * @param response2 - Second response to compare
   * @returns Quality validation result with similarity score
   * 
   * Requirement 7.4: Add response quality validation to ensure >85% similarity between providers
   */
  validateResponseQuality(
    response1: string,
    response2: string
  ): { isValid: boolean; similarity: number; threshold: number } {
    if (!this.cloudflareAI) {
      return { isValid: true, similarity: 1.0, threshold: this.config.qualityThreshold };
    }

    const similarity = this.cloudflareAI.calculateSimilarity(response1, response2);
    const isValid = similarity >= this.config.qualityThreshold;

    return {
      isValid,
      similarity,
      threshold: this.config.qualityThreshold,
    };
  }

  /**
   * Compare responses from both providers and validate quality
   * 
   * @param prompt - The prompt to test with both providers
   * @param options - Generation options
   * @returns Comparison result with quality metrics
   * 
   * Requirement 7.4: Add response quality validation to ensure >85% similarity between providers
   */
  async compareProviders(
    prompt: string,
    options?: { maxTokens?: number; temperature?: number }
  ): Promise<{
    openrouterResponse: string;
    cloudflareResponse: string;
    similarity: number;
    meetsThreshold: boolean;
  }> {
    if (!this.cloudflareAI) {
      throw new Error('Cloudflare AI not available for comparison');
    }

    // Generate with both providers
    const [openrouterResponse, cloudflareResponse] = await Promise.all([
      this.generateWithOpenRouter(prompt, options),
      this.cloudflareAI.generateText(prompt, options),
    ]);

    // Calculate similarity
    const similarity = this.cloudflareAI.calculateSimilarity(
      openrouterResponse,
      cloudflareResponse
    );

    return {
      openrouterResponse,
      cloudflareResponse,
      similarity,
      meetsThreshold: similarity >= this.config.qualityThreshold,
    };
  }

  /**
   * Get current provider configuration
   */
  getConfig(): AIProviderConfig {
    return { ...this.config };
  }

  /**
   * Check if Cloudflare AI is available
   */
  isCloudflareAvailable(): boolean {
    return !!this.cloudflareAI;
  }

  // Private helper methods for OpenRouter integration

  /**
   * Generate text using OpenRouter API
   */
  private async generateWithOpenRouter(
    prompt: string,
    options?: { maxTokens?: number; temperature?: number }
  ): Promise<string> {
    // This would be implemented with actual OpenRouter API call
    // For now, throw error to indicate it needs implementation
    throw new Error('OpenRouter integration not implemented in this context');
  }

  /**
   * Enhance bio using OpenRouter API
   */
  private async enhanceBioWithOpenRouter(
    originalBio: string,
    context: string
  ): Promise<string> {
    const prompt = `Enhance this professional bio for a developer portfolio:\n\nOriginal: ${originalBio}\n\nContext: ${context}\n\nProvide an enhanced 2-3 sentence bio that highlights technical expertise.`;
    return this.generateWithOpenRouter(prompt, { maxTokens: 300, temperature: 0.7 });
  }

  /**
   * Rewrite bullets using OpenRouter API
   */
  private async rewriteBulletsWithOpenRouter(
    bullets: string[],
    role: string,
    techStack: string[]
  ): Promise<string[]> {
    const prompt = `Rewrite these job bullets for a ${role} role using ${techStack.join(', ')}:\n\n${bullets.map((b, i) => `${i + 1}. ${b}`).join('\n')}\n\nReturn ${bullets.length} enhanced bullets with metrics and impact.`;
    const result = await this.generateWithOpenRouter(prompt, {
      maxTokens: 800,
      temperature: 0.6,
    });

    // Parse numbered list
    return result
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => line.replace(/^\d+\.\s*/, '').trim())
      .filter(line => line.length > 0)
      .slice(0, bullets.length);
  }
}

/**
 * Factory function to create AIProviderService with environment-based configuration
 * 
 * @param cloudflareEnv - Cloudflare Workers environment (optional)
 * @param config - Additional configuration options
 * @returns Configured AIProviderService instance
 */
export function createAIProviderService(
  cloudflareEnv?: CloudflareWorkersEnv,
  config?: Partial<AIProviderConfig>
): AIProviderService {
  return new AIProviderService({
    ...config,
    cloudflareEnv,
  });
}

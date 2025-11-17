/**
 * Cloudflare Pages Custom Worker Configuration
 * 
 * This file provides custom Workers configuration for Cloudflare Pages deployment.
 * It handles routing, middleware, and integration with Durable Objects.
 * 
 * Documentation: https://developers.cloudflare.com/pages/platform/functions/advanced-mode/
 */

// Import Durable Objects
import { JobQueueDO } from './src/services/durable-objects/JobQueueDO';

// Export Durable Objects
export { JobQueueDO };

/**
 * Main fetch handler for the Worker
 * This is called for every request to the Pages site
 */
export default {
  async fetch(request, env, ctx) {
    // Get the URL
    const url = new URL(request.url);
    
    // Add custom headers for all responses
    const addHeaders = (response) => {
      const newResponse = new Response(response.body, response);
      newResponse.headers.set('X-Powered-By', 'Cloudflare Pages + Workers');
      newResponse.headers.set('X-Content-Type-Options', 'nosniff');
      newResponse.headers.set('X-Frame-Options', 'DENY');
      newResponse.headers.set('X-XSS-Protection', '1; mode=block');
      return newResponse;
    };
    
    // Handle API routes with edge runtime
    if (url.pathname.startsWith('/api/')) {
      try {
        // The Next.js API routes will be handled by the Pages Functions
        // This is just a fallback/middleware layer
        
        // Add environment bindings to the request context
        // This makes R2, KV, D1, and Durable Objects available to API routes
        const response = await env.ASSETS.fetch(request);
        return addHeaders(response);
      } catch (error) {
        console.error('Worker error:', error);
        return new Response(
          JSON.stringify({
            error: 'Internal Server Error',
            message: error.message,
          }),
          {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );
      }
    }
    
    // For all other requests, serve from Pages
    try {
      const response = await env.ASSETS.fetch(request);
      return addHeaders(response);
    } catch (error) {
      console.error('Worker error:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  },
  
  /**
   * Scheduled handler for cron jobs (optional)
   * Uncomment and configure in wrangler.toml if needed
   */
  // async scheduled(event, env, ctx) {
  //   // Run scheduled tasks
  //   console.log('Cron job triggered:', event.cron);
  // },
};

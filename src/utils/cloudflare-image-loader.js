/**
 * Custom image loader for Cloudflare Pages
 * This loader is used when images.loader is set to 'custom' in next.config.js
 * 
 * For Cloudflare Pages, we serve images directly without optimization
 * In the future, this can be updated to use Cloudflare Images service
 */
export default function cloudflareImageLoader({ src, width, quality }) {
  // For now, return the source as-is since we have unoptimized: true
  // In production, you could use Cloudflare Images:
  // return `https://imagedelivery.net/${ACCOUNT_HASH}/${src}/w=${width},q=${quality || 75}`
  return src;
}

#!/usr/bin/env node

/**
 * Prepare Next.js build for Cloudflare Pages deployment
 * 
 * This script:
 * 1. Copies necessary files to the .next directory
 * 2. Creates a _routes.json file for Pages routing
 * 3. Ensures all static assets are properly organized
 */

const fs = require('fs');
const path = require('path');

const BUILD_DIR = path.join(process.cwd(), '.next');
const WORKER_FILE = path.join(process.cwd(), '_worker.js');
const ROUTES_FILE = path.join(BUILD_DIR, '_routes.json');

console.log('📦 Preparing Cloudflare Pages deployment...');

// Step 1: Copy _worker.js to .next directory if it exists
if (fs.existsSync(WORKER_FILE)) {
  const destWorkerFile = path.join(BUILD_DIR, '_worker.js');
  fs.copyFileSync(WORKER_FILE, destWorkerFile);
  console.log('✅ Copied _worker.js to build directory');
} else {
  console.log('⚠️  No _worker.js found, skipping...');
}

// Step 2: Create _routes.json for Cloudflare Pages routing
// This tells Cloudflare which routes should be handled by Workers vs served as static assets
const routes = {
  version: 1,
  include: [
    '/api/*',           // All API routes go through Workers
    '/_next/data/*',    // Next.js data routes
  ],
  exclude: [
    '/favicon.ico',
    '/_next/static/*',  // Static assets served directly
    '/images/*',        // Static images
    '/fonts/*',         // Static fonts
    '/*.css',           // CSS files
    '/*.js',            // JS files (except API routes)
    '/*.json',          // JSON files (except API routes)
    '/*.png',
    '/*.jpg',
    '/*.jpeg',
    '/*.gif',
    '/*.svg',
    '/*.ico',
    '/*.webp',
  ],
};

fs.writeFileSync(ROUTES_FILE, JSON.stringify(routes, null, 2));
console.log('✅ Created _routes.json for Pages routing');

// Step 3: Create _headers file for custom headers
const headersFile = path.join(BUILD_DIR, '_headers');
const headers = `# Custom headers for Cloudflare Pages

# Security headers for all routes
/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  X-XSS-Protection: 1; mode=block
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()

# Cache static assets for 1 year
/_next/static/*
  Cache-Control: public, max-age=31536000, immutable

# Cache images for 1 week
/images/*
  Cache-Control: public, max-age=604800

# Don't cache API routes
/api/*
  Cache-Control: no-store, no-cache, must-revalidate
`;

fs.writeFileSync(headersFile, headers);
console.log('✅ Created _headers file for custom headers');

// Step 4: Verify build output
const requiredDirs = ['static', 'server'];
const missingDirs = requiredDirs.filter(dir => !fs.existsSync(path.join(BUILD_DIR, dir)));

if (missingDirs.length > 0) {
  console.warn(`⚠️  Warning: Missing directories in build: ${missingDirs.join(', ')}`);
  console.warn('   This might indicate an incomplete build.');
}

// Step 5: Create a deployment info file
const deploymentInfo = {
  buildTime: new Date().toISOString(),
  nextVersion: require('../package.json').dependencies.next,
  nodeVersion: process.version,
  platform: 'cloudflare-pages',
};

fs.writeFileSync(
  path.join(BUILD_DIR, 'deployment-info.json'),
  JSON.stringify(deploymentInfo, null, 2)
);
console.log('✅ Created deployment info file');

console.log('\n✨ Cloudflare Pages deployment preparation complete!');
console.log('\nNext steps:');
console.log('  1. Run: npm run cf:deploy');
console.log('  2. Or deploy manually: wrangler pages deploy .next --project-name=ai-resume-portfolio');
console.log('\nFor local testing:');
console.log('  Run: npm run cf:dev');

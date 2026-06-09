#!/usr/bin/env node
/**
 * ATLAS Build Script
 * Copies HTML files, CSS (already handled by Vite), and static assets to dist/
 * Run after `vite build`
 */
import { copyFileSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DIST = join(ROOT, 'dist');

// Ensure dist directories exist
mkdirSync(join(DIST, 'modules', 'ui'), { recursive: true });
mkdirSync(join(DIST, 'firebase'), { recursive: true });
mkdirSync(join(DIST, 'docs'), { recursive: true });

// Copy HTML files
['index.html', 'assess.html', '_psych_html.html', '_v86_html.html'].forEach(f => {
  try { copyFileSync(join(ROOT, f), join(DIST, f)); console.log('Copied', f); }
  catch(e) { console.warn('Skip', f, e.message); }
});

// Copy config files
['wrangler.toml', '.assetsignore'].forEach(f => {
  try { copyFileSync(join(ROOT, f), join(DIST, f)); } catch(e) {}
});

// Copy CSS (Vite handles JS; copy CSS separately if needed)
try {
  copyFileSync(join(ROOT, 'modules', 'ui', 'atlas.css'), join(DIST, 'modules', 'ui', 'atlas.css'));
  console.log('Copied atlas.css');
} catch(e) {}

// Copy firebase rules
['database.rules.json', 'firebase.json', '.firebaserc'].forEach(f => {
  try { copyFileSync(join(ROOT, 'firebase', f), join(DIST, 'firebase', f)); } catch(e) {}
});

console.log('\nBuild complete -> dist/');
console.log('Deploy: wrangler deploy --config wrangler.prod.toml');

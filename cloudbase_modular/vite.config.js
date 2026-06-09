import { defineConfig } from 'vite';
import { resolve } from 'path';
import { readdirSync } from 'fs';

// Build all JS modules as separate output files (not bundled together)
// This preserves the modular structure for Cloudflare deployment
// while still minifying each file individually

function getModuleEntries() {
  const entries = {};
  const moduleDir = resolve(__dirname, 'modules');

  // Root-level modules
  try {
    readdirSync(moduleDir).forEach(file => {
      if (file.endsWith('.js')) {
        const name = 'modules/' + file.replace('.js', '');
        entries[name] = resolve(moduleDir, file);
      }
    });
  } catch(e) {}

  // Root JS files
  ['_worker', '_psych_js', '_v86_js'].forEach(name => {
    entries[name] = resolve(__dirname, name + '.js');
  });

  return entries;
}

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false, // Keep console logs for now — remove in strict prod
        pure_funcs: [],
      },
      mangle: false, // Don't mangle names — global scope functions must stay named
      format: {
        comments: false,
      },
    },
    rollupOptions: {
      input: getModuleEntries(),
      output: {
        // Keep each module as its own file — don't bundle
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name].js',
        assetFileNames: '[name][extname]',
        // No code splitting — keep global scope intact
        inlineDynamicImports: false,
        preserveModules: true,
        preserveModulesRoot: '',
        format: 'iife', // IIFE wrapping preserves global scope
        // Each file gets its own IIFE so globals leak to window correctly
        name: '_atlas_module',
      },
    },
    // Copy HTML files and static assets to dist
    copyPublicDir: false,
  },
  // Process CSS separately
  css: {
    devSourcemap: true,
  },
});

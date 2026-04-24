#!/usr/bin/env node
/**
 * Smart Bundler - copies pre-built HBC bundle + creates dummy source maps
 */
const fs = require('fs');
const path = require('path');

const args = process.argv;
let bundleOutput = null;
let assetsDir = null;
let sourcemapOutput = null;

for (let i = 0; i < args.length; i++) {
    if (args[i] === '--bundle-output' && args[i + 1]) bundleOutput = args[i + 1];
    if (args[i] === '--assets-dest' && args[i + 1]) assetsDir = args[i + 1];
    if (args[i] === '--sourcemap-output' && args[i + 1]) sourcemapOutput = args[i + 1];
}

const preBuiltBundle = path.resolve(__dirname, 'android', 'app', 'src', 'main', 'assets', 'index.android.bundle');

if (!bundleOutput) { process.exit(0); }

if (!fs.existsSync(preBuiltBundle)) {
    console.error('[smart_bundler] ERROR: Pre-built bundle not found at:', preBuiltBundle);
    process.exit(1);
}

// Copy bundle
fs.mkdirSync(path.dirname(bundleOutput), { recursive: true });
fs.copyFileSync(preBuiltBundle, bundleOutput);
console.log('[smart_bundler] Copied bundle (' + Math.round(fs.statSync(preBuiltBundle).size / 1024) + ' KB)');

// Create dummy packager source map (required by compose-source-maps)
if (sourcemapOutput) {
    fs.mkdirSync(path.dirname(sourcemapOutput), { recursive: true });
    fs.writeFileSync(sourcemapOutput, JSON.stringify({version:3,sources:[],mappings:""}));
    console.log('[smart_bundler] Created dummy source map at', sourcemapOutput);
}

process.exit(0);

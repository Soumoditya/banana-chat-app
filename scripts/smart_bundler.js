#!/usr/bin/env node
/**
 * Smart JS Bundler - copies pre-built bundle to Gradle's expected output.
 * Used in place of Metro during Gradle builds to avoid OOM.
 * 
 * The actual JS bundle must be pre-built via:
 *   npx expo export:embed --platform android --entry-file node_modules/expo-router/entry.js \
 *     --bundle-output android/app/src/main/assets/index.android.bundle \
 *     --assets-dest android/app/src/main/res --dev false
 */
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);

// Parse --bundle-output and --assets-dest from args
let bundleDest = '';
let assetsDest = '';

for (let i = 0; i < args.length; i++) {
    if (args[i] === '--bundle-output' && args[i + 1]) {
        bundleDest = args[i + 1];
    }
    if (args[i] === '--assets-dest' && args[i + 1]) {
        assetsDest = args[i + 1];
    }
}

const preBuiltBundle = path.join(__dirname, 'android', 'app', 'src', 'main', 'assets', 'index.android.bundle');

if (bundleDest) {
    console.log(`[smart-bundler] Copying pre-built bundle to: ${bundleDest}`);
    const destDir = path.dirname(bundleDest);
    fs.mkdirSync(destDir, { recursive: true });
    
    if (fs.existsSync(preBuiltBundle)) {
        fs.copyFileSync(preBuiltBundle, bundleDest);
        console.log('[smart-bundler] Bundle copied successfully.');
    } else {
        console.log('[smart-bundler] WARNING: Pre-built bundle not found, creating empty placeholder.');
        fs.writeFileSync(bundleDest, '// placeholder bundle');
    }

    // Create the .packager.map sourcemap placeholder that compose-source-maps expects
    const sourcemapDir = path.join(__dirname, 'android', 'app', 'build', 'intermediates', 'sourcemaps', 'react', 'release');
    fs.mkdirSync(sourcemapDir, { recursive: true });
    const mapFile = path.join(sourcemapDir, 'index.android.bundle.packager.map');
    if (!fs.existsSync(mapFile)) {
        fs.writeFileSync(mapFile, JSON.stringify({ version: 3, sources: [], mappings: '' }));
        console.log('[smart-bundler] Created sourcemap placeholder.');
    }
} else {
    console.log('[smart-bundler] No --bundle-output specified, skipping.');
}

if (assetsDest) {
    console.log(`[smart-bundler] Assets dest: ${assetsDest}`);
    fs.mkdirSync(assetsDest, { recursive: true });
}

console.log('[smart-bundler] Done!');
process.exit(0);

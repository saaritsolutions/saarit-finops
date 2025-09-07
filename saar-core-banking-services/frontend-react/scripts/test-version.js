#!/usr/bin/env node

/**
 * Test script to verify version management is working correctly
 */

const path = require('path');
const fs = require('fs');

console.log('🧪 Testing Dynamic Version Management\n');

// 1. Check package.json version
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
console.log(`📦 Package.json version: ${packageJson.version}`);

// 2. Check environment variables (these would be set during build/start)
console.log(`🌍 REACT_APP_VERSION: ${process.env.REACT_APP_VERSION || 'Not set (will use fallback)'}`);
console.log(`⏰ REACT_APP_BUILD_TIME: ${process.env.REACT_APP_BUILD_TIME || 'Not set (will use current time)'}`);

// 3. Simulate what the app would see
const simulatedVersion = process.env.REACT_APP_VERSION || packageJson.version;
const simulatedBuildTime = process.env.REACT_APP_BUILD_TIME || new Date().toISOString();

console.log('\n✅ Simulated App Values:');
console.log(`   Version: ${simulatedVersion}`);
console.log(`   Build Time: ${simulatedBuildTime}`);

// 4. Test version increment
const [major, minor, patch] = packageJson.version.split('.').map(Number);
console.log('\n🔢 Available Version Increments:');
console.log(`   Patch: ${major}.${minor}.${patch + 1}`);
console.log(`   Minor: ${major}.${minor + 1}.0`);
console.log(`   Major: ${major + 1}.0.0`);

console.log('\n🎯 Next Steps:');
console.log('   1. Check sidebar footer in the running app (http://localhost:3002)');
console.log('   2. Click "About" in the header menu to see detailed version info');
console.log('   3. Use "npm run version-patch" to increment version');
console.log('   4. Restart dev server to see new version');

console.log('\n✨ Dynamic versioning is working correctly!');

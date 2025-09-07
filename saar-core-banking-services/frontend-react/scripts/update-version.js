#!/usr/bin/env node

/**
 * Version update script for the React frontend
 * Usage: node scripts/update-version.js [patch|minor|major]
 */

const fs = require('fs');
const path = require('path');

const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

function incrementVersion(version, type = 'patch') {
  const [major, minor, patch] = version.split('.').map(Number);
  
  switch (type) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
    default:
      return `${major}.${minor}.${patch + 1}`;
  }
}

const versionType = process.argv[2] || 'patch';
const currentVersion = packageJson.version;
const newVersion = incrementVersion(currentVersion, versionType);

packageJson.version = newVersion;

fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

console.log(`✅ Version updated from ${currentVersion} to ${newVersion}`);
console.log(`📝 Run 'npm start' to see the new version in the application`);

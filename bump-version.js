#!/usr/bin/env node
/**
 * SlipUp — Bump asset versions and service worker cache for deploys.
 * Single source of truth: version.json. HTML + sw.js are always updated to match.
 *
 * Usage: node bump-version.js [newVersion]
 *   newVersion = number to set (e.g. 42). If omitted, bumps current + 1.
 *   Workflow uses: node bump-version.js ${{ github.run_number }}
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname);
const VERSION_JSON = path.join(ROOT, 'version.json');
const HTML_FILES = ['index.html', 'inside.html', 'landing.html', 'landing-inside.html', 'auth-inside.html', 'privacy.html', 'terms.html', 'refund.html'];
const SW_FILE = 'sw.js';

function readVersionFromJson() {
  if (!fs.existsSync(VERSION_JSON)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(VERSION_JSON, 'utf8'));
    const v = data != null && typeof data.version === 'number' ? data.version : null;
    return v >= 1 ? v : null;
  } catch (e) {
    return null;
  }
}

function getCurrentVersionFromHtml(content) {
  const m = content.match(/\?v=(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

function getCurrentSwVersion(content) {
  const m = content.match(/slip-track-v(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

function bootstrapVersionJson() {
  let currentVersion = null;
  for (const name of HTML_FILES) {
    const p = path.join(ROOT, name);
    if (fs.existsSync(p)) {
      const v = getCurrentVersionFromHtml(fs.readFileSync(p, 'utf8'));
      if (v !== null) currentVersion = currentVersion === null ? v : Math.max(currentVersion, v);
    }
  }
  const swPath = path.join(ROOT, SW_FILE);
  if (fs.existsSync(swPath)) {
    const swV = getCurrentSwVersion(fs.readFileSync(swPath, 'utf8'));
    if (swV !== null) currentVersion = currentVersion === null ? swV : Math.max(currentVersion, swV);
  }
  const v = currentVersion !== null ? currentVersion : 1;
  fs.writeFileSync(VERSION_JSON, JSON.stringify({ version: v }, null, 0) + '\n', 'utf8');
  console.log('Created ' + path.basename(VERSION_JSON) + ' with version ' + v);
  return v;
}

function bumpHtml(htmlPath, newV) {
  let content = fs.readFileSync(htmlPath, 'utf8');
  content = content.replace(/\?v=\d+/g, `?v=${newV}`);
  fs.writeFileSync(htmlPath, content, 'utf8');
  console.log('  ' + path.basename(htmlPath));
}

function bumpSw(swPath, newV) {
  let content = fs.readFileSync(swPath, 'utf8');
  content = content.replace(/slip-track-v\d+/g, `slip-track-v${newV}`);
  content = content.replace(/\.\/styles\.css(\?v=\d+)?/g, `./styles.css?v=${newV}`);
  content = content.replace(/\.\/entryInsightsData\.js(\?v=\d+)?/g, `./entryInsightsData.js?v=${newV}`);
  content = content.replace(/\.\/app\.js(\?v=\d+)?/g, `./app.js?v=${newV}`);
  fs.writeFileSync(swPath, content, 'utf8');
  console.log('  ' + path.basename(swPath));
}

function verifyConsistency(targetVersion) {
  const errors = [];
  for (const name of HTML_FILES) {
    const p = path.join(ROOT, name);
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, 'utf8');
      const matches = content.match(/\?v=(\d+)/g);
      if (matches) {
        const bad = matches.filter(s => s !== `?v=${targetVersion}`);
        if (bad.length) errors.push(name + ' has ?v= not equal to ' + targetVersion);
      }
    }
  }
  const swPath = path.join(ROOT, SW_FILE);
  if (fs.existsSync(swPath)) {
    const swContent = fs.readFileSync(swPath, 'utf8');
    if (!swContent.includes('slip-track-v' + targetVersion)) {
      errors.push('sw.js CACHE_NAME does not equal slip-track-v' + targetVersion);
    }
    if (!swContent.includes('./styles.css?v=' + targetVersion) || !swContent.includes('./app.js?v=' + targetVersion)) {
      errors.push('sw.js STATIC_ASSETS do not use ?v=' + targetVersion);
    }
  }
  if (errors.length) {
    console.error('Consistency check failed:');
    errors.forEach(e => console.error('  - ' + e));
    process.exit(1);
  }
}

const newVersion = process.argv[2] ? parseInt(process.argv[2], 10) : null;
if (newVersion !== null && (isNaN(newVersion) || newVersion < 1)) {
  console.error('Usage: node bump-version.js [newVersion]');
  process.exit(1);
}

let currentVersion = readVersionFromJson();
if (currentVersion === null) {
  currentVersion = bootstrapVersionJson();
}

const targetVersion = newVersion !== null ? newVersion : currentVersion + 1;

fs.writeFileSync(VERSION_JSON, JSON.stringify({ version: targetVersion }, null, 0) + '\n', 'utf8');

console.log('Bumping asset version: ' + currentVersion + ' → ' + targetVersion + ' (source: version.json)');
console.log('');

console.log('HTML files:');
for (const name of HTML_FILES) {
  const p = path.join(ROOT, name);
  if (fs.existsSync(p)) bumpHtml(p, targetVersion);
}

console.log('Service worker:');
bumpSw(path.join(ROOT, SW_FILE), targetVersion);

verifyConsistency(targetVersion);
console.log('\nDone. All versions match. Commit and push to deploy.');

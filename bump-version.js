#!/usr/bin/env node
/**
 * SlipUp — Bump asset versions and service worker cache for deploys.
 * Run before pushing to GitHub Pages so users get fresh CSS/JS.
 *
 * Usage: node bump-version.js [newVersion]
 *   If newVersion omitted, bumps current + 1 (e.g. 5 → 6).
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname);
const HTML_FILES = ['index.html', 'inside.html', 'landing.html', 'privacy.html', 'terms.html', 'refund.html'];
const SW_FILE = 'sw.js';

function getCurrentVersion(content) {
  const m = content.match(/\?v=(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

function getCurrentSwVersion(content) {
  const m = content.match(/slip-track-v(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

function bumpHtml(htmlPath, newV) {
  let content = fs.readFileSync(htmlPath, 'utf8');
  content = content.replace(/\?v=\d+/g, `?v=${newV}`);
  fs.writeFileSync(htmlPath, content, 'utf8');
  console.log('  ' + path.basename(htmlPath));
}

function bumpSw(swPath, oldV, newV) {
  let content = fs.readFileSync(swPath, 'utf8');
  content = content.replace(`slip-track-v${oldV}`, `slip-track-v${newV}`);
  content = content.replace(/\.\/styles\.css(\?v=\d+)?/g, `./styles.css?v=${newV}`);
  content = content.replace(/\.\/app\.js(\?v=\d+)?/g, `./app.js?v=${newV}`);
  fs.writeFileSync(swPath, content, 'utf8');
  console.log('  ' + path.basename(swPath));
}

const newVersion = process.argv[2] ? parseInt(process.argv[2], 10) : null;
if (newVersion !== null && (isNaN(newVersion) || newVersion < 1)) {
  console.error('Usage: node bump-version.js [newVersion]');
  process.exit(1);
}

let currentVersion = null;
for (const name of HTML_FILES) {
  const p = path.join(ROOT, name);
  if (fs.existsSync(p)) {
    const v = getCurrentVersion(fs.readFileSync(p, 'utf8'));
    if (v !== null) currentVersion = currentVersion === null ? v : Math.max(currentVersion, v);
  }
}

const targetVersion = newVersion !== null ? newVersion : (currentVersion !== null ? currentVersion + 1 : 1);
const currentSwV = getCurrentSwVersion(fs.readFileSync(path.join(ROOT, SW_FILE), 'utf8')) || 1;
const targetSwV = newVersion !== null ? newVersion : (currentSwV + 1);

console.log('Bumping asset version: ' + (currentVersion || 0) + ' → ' + targetVersion);
console.log('Bumping SW cache: slip-track-v' + currentSwV + ' → slip-track-v' + targetSwV);
console.log('');

console.log('HTML files:');
for (const name of HTML_FILES) {
  const p = path.join(ROOT, name);
  if (fs.existsSync(p)) bumpHtml(p, targetVersion);
}

console.log('Service worker:');
bumpSw(path.join(ROOT, SW_FILE), currentSwV, targetSwV);

console.log('\nDone. Commit and push to deploy.');

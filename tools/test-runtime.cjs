'use strict';
// Browser automation is optional: the Demo itself has no npm dependencies.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

function loadPlaywright() {
  if (process.env.PLAYWRIGHT_MODULE) return require(process.env.PLAYWRIGHT_MODULE);
  try { return require('playwright'); }
  catch (error) {
    if (error.code !== 'MODULE_NOT_FOUND' || !error.message.includes("'playwright'")) throw error;
    const bundled = path.join(os.homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime',
      'dependencies', 'node', 'node_modules', 'playwright');
    if (fs.existsSync(path.join(bundled, 'package.json'))) return require(bundled);
    throw new Error('Browser tests need Playwright. Run npm install and npx playwright install chromium, or set PLAYWRIGHT_MODULE.');
  }
}

function browserOptions() {
  const options = { headless: true };
  if (process.env.EDGE_PATH) {
    options.executablePath = process.env.EDGE_PATH;
    return options;
  }
  if (process.platform === 'win32') {
    const roots = [process.env['ProgramFiles(x86)'], process.env.ProgramFiles, process.env.LOCALAPPDATA].filter(Boolean);
    const edge = roots.map(root => path.join(root, 'Microsoft', 'Edge', 'Application', 'msedge.exe')).find(p => fs.existsSync(p));
    if (edge) options.executablePath = edge;
  }
  // Without an installed Edge, Playwright resolves its downloaded Chromium.
  return options;
}

module.exports = { ...loadPlaywright(), browserOptions };

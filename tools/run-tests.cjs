'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const mode = process.argv[2] || 'all';
const prototypeModels = fs.readdirSync(path.join(root, 'prototype')).filter(name => name.endsWith('.test.cjs')).sort().map(name => 'prototype/' + name);
const browserTests = ['admin-flow', 'app-smoke', 'monitor-ui', 'map-drilldown'].map(name => 'demo/tests/' + name + '.cjs');
const tasks = {
  model: [['--test', 'demo/tests/model.test.cjs']],
  prototype: [['--test', ...prototypeModels]],
  browser: browserTests.map(file => [file]),
};
tasks.demo = [...tasks.model, ...tasks.browser];
tasks.all = [...tasks.model, ...tasks.prototype, ...tasks.browser];
if (!Object.hasOwn(tasks, mode)) {
  console.error('Unknown test group: ' + mode + '. Use all, demo, model, prototype or browser.');
  process.exit(2);
}
for (const args of tasks[mode]) {
  console.log('Running ' + args.join(' '));
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit', env: process.env });
  if (result.error) { console.error(result.error.message); process.exit(1); }
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log('Completed test group: ' + mode);

#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const distDir = path.join(root, 'dist');
const publicDir = path.join(root, 'public');

if (!fs.existsSync(path.join(distDir, 'index.html'))) {
  throw new Error('Missing dist/index.html. Run npm run build first.');
}

for (const name of ['index.html', 'DEPLOY_VERSION.txt', 'assets', 'landmarks', 'models']) {
  const from = path.join(distDir, name);
  const to = path.join(publicDir, name);
  if (!fs.existsSync(from)) continue;
  fs.rmSync(to, { recursive: true, force: true });
  fs.cpSync(from, to, { recursive: true });
}

console.log('Synced built static files from dist/ to public/.');

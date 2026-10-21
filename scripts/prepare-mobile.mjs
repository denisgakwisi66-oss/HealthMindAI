import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const webDir = path.join(root, 'www');
const apiUrl = process.env.HEALTHMIND_API_URL?.trim().replace(/\/+$/, '') || '';
const requireApiUrl = process.argv.includes('--require-api-url');

if (requireApiUrl && !apiUrl) {
  throw new Error('Set HEALTHMIND_API_URL to the public HTTPS FastAPI origin before building the mobile app.');
}

if (apiUrl) {
  const parsedUrl = new URL(apiUrl);
  if (parsedUrl.protocol !== 'https:' || parsedUrl.username || parsedUrl.password || parsedUrl.pathname !== '/') {
    throw new Error('HEALTHMIND_API_URL must be an HTTPS origin without credentials or a path.');
  }
}

await rm(webDir, { recursive: true, force: true });
await mkdir(webDir, { recursive: true });

for (const directory of ['css', 'js', 'images', 'icons', 'fonts', 'assets']) {
  const source = path.join(root, directory);
  try {
    await cp(source, path.join(webDir, directory), { recursive: true });
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

const rootFiles = await readdir(root, { withFileTypes: true });
for (const entry of rootFiles) {
  if (!entry.isFile()) continue;
  const extension = path.extname(entry.name).toLowerCase();
  if (extension === '.html' || ['.svg', '.jpg', '.jpeg', '.png', '.webp', '.ico'].includes(extension)) {
    await cp(path.join(root, entry.name), path.join(webDir, entry.name));
  }
}

for (const file of ['manifest.json', 'service-worker.js']) {
  try {
    await cp(path.join(root, file), path.join(webDir, file));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

await writeFile(
  path.join(webDir, 'js', 'runtime-config.js'),
  `globalThis.HEALTHMIND_API_URL = ${JSON.stringify(apiUrl)};\n`,
  'utf8',
);

for (const entry of await readdir(webDir, { withFileTypes: true })) {
  if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== '.html') continue;
  const filePath = path.join(webDir, entry.name);
  const html = await readFile(filePath, 'utf8');
  if (!html.includes('/js/runtime-config.js')) {
    const updatedHtml = html.replace(
      /<\/head>/i,
      '  <script src="/js/runtime-config.js"></script>\n</head>',
    );
    if (updatedHtml === html) throw new Error(`Could not add mobile API configuration to ${entry.name}.`);
    await writeFile(filePath, updatedHtml, 'utf8');
  }
}

console.log(`Prepared local mobile web assets${apiUrl ? ' with an HTTPS API origin' : ' (API origin not configured)'}.`);

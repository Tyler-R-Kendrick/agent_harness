import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const templatePath = path.join(packageRoot, 'manifest.template.json');
const distPath = path.join(packageRoot, 'dist');
const manifestPath = path.join(distPath, 'manifest.json');

const manifest = JSON.parse(await readFile(templatePath, 'utf8'));
const configuredOrigins = process.env.LOCAL_MODEL_CONNECTOR_ALLOWED_ORIGINS
  ?.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

if (configuredOrigins?.length) {
  manifest.externally_connectable.matches = configuredOrigins.map((origin) => (
    origin.endsWith('/*') ? origin : `${origin.replace(/\/+$/, '')}/*`
  ));
}

await mkdir(distPath, { recursive: true });
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

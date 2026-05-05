import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPO_ROOT = path.resolve(__dirname, '..');
const DETERMINISTIC_ZIP_DOS_TIME = 0;
const DETERMINISTIC_ZIP_DOS_DATE = 33;

export function buildDownloadPackages(repoRoot = DEFAULT_REPO_ROOT) {
  return [
    {
      name: 'local-model-connector-extension',
      sourceDirectory: path.join(repoRoot, 'ext', 'local-model-connector', 'dist'),
      outputFile: path.join(repoRoot, 'agent-browser', 'public', 'downloads', 'local-model-connector-extension.zip'),
    },
    {
      name: 'agent-harness-local-inference-daemon',
      sourceDirectory: path.join(repoRoot, 'agent-daemon'),
      outputFile: path.join(repoRoot, 'agent-browser', 'public', 'downloads', 'agent-harness-local-inference-daemon.zip'),
    },
  ];
}

export function normalizeZipEntryPath(rootName, relativePath) {
  return `${rootName}/${relativePath.replace(/\\/g, '/')}`.replace(/\/+/g, '/');
}

async function collectFiles(sourceDirectory, rootName, currentDirectory = sourceDirectory) {
  const entries = await readdir(currentDirectory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolutePath = path.join(currentDirectory, entry.name);
    const relativePath = path.relative(sourceDirectory, absolutePath);
    if (entry.isDirectory()) {
      files.push(...await collectFiles(sourceDirectory, rootName, absolutePath));
    } else if (entry.isFile()) {
      if (entry.name.endsWith('.zip')) continue;
      const entryPath = normalizeZipEntryPath(rootName, relativePath);
      files.push({ entryPath, absolutePath });
    }
  }
  return files.sort((a, b) => a.entryPath.localeCompare(b.entryPath));
}

function makeCrcTable() {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let value = i;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[i] = value >>> 0;
  }
  return table;
}

const CRC_TABLE = makeCrcTable();

function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zipLocalHeader(nameBytes, dataBytes, crc) {
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(10, 4);
  header.writeUInt16LE(0, 6);
  header.writeUInt16LE(0, 8);
  header.writeUInt16LE(DETERMINISTIC_ZIP_DOS_TIME, 10);
  header.writeUInt16LE(DETERMINISTIC_ZIP_DOS_DATE, 12);
  header.writeUInt32LE(crc, 14);
  header.writeUInt32LE(dataBytes.length, 18);
  header.writeUInt32LE(dataBytes.length, 22);
  header.writeUInt16LE(nameBytes.length, 26);
  header.writeUInt16LE(0, 28);
  return Buffer.concat([header, nameBytes, dataBytes]);
}

function zipCentralDirectoryHeader(nameBytes, dataBytes, crc, offset) {
  const header = Buffer.alloc(46);
  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(10, 6);
  header.writeUInt16LE(0, 8);
  header.writeUInt16LE(0, 10);
  header.writeUInt16LE(DETERMINISTIC_ZIP_DOS_TIME, 12);
  header.writeUInt16LE(DETERMINISTIC_ZIP_DOS_DATE, 14);
  header.writeUInt32LE(crc, 16);
  header.writeUInt32LE(dataBytes.length, 20);
  header.writeUInt32LE(dataBytes.length, 24);
  header.writeUInt16LE(nameBytes.length, 28);
  header.writeUInt16LE(0, 30);
  header.writeUInt16LE(0, 32);
  header.writeUInt16LE(0, 34);
  header.writeUInt16LE(0, 36);
  header.writeUInt32LE(0, 38);
  header.writeUInt32LE(offset, 42);
  return Buffer.concat([header, nameBytes]);
}

function zipEndOfCentralDirectory(fileCount, centralDirectorySize, centralDirectoryOffset) {
  const header = Buffer.alloc(22);
  header.writeUInt32LE(0x06054b50, 0);
  header.writeUInt16LE(0, 4);
  header.writeUInt16LE(0, 6);
  header.writeUInt16LE(fileCount, 8);
  header.writeUInt16LE(fileCount, 10);
  header.writeUInt32LE(centralDirectorySize, 12);
  header.writeUInt32LE(centralDirectoryOffset, 16);
  header.writeUInt16LE(0, 20);
  return header;
}

export async function createZipFromDirectory(sourceDirectory, outputFile, rootName = path.basename(outputFile, '.zip')) {
  await stat(sourceDirectory);
  const files = await collectFiles(sourceDirectory, rootName);
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = Buffer.from(file.entryPath);
    const dataBytes = await readFile(file.absolutePath);
    const crc = crc32(dataBytes);
    const localHeader = zipLocalHeader(nameBytes, dataBytes, crc);
    localParts.push(localHeader);
    centralParts.push(zipCentralDirectoryHeader(nameBytes, dataBytes, crc, offset));
    offset += localHeader.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const archive = Buffer.concat([
    ...localParts,
    centralDirectory,
    zipEndOfCentralDirectory(files.length, centralDirectory.length, offset),
  ]);

  await mkdir(path.dirname(outputFile), { recursive: true });
  await writeFile(outputFile, archive);
}

export async function packageExtensionDownloads(repoRoot = DEFAULT_REPO_ROOT) {
  const downloads = buildDownloadPackages(repoRoot);
  await mkdir(path.join(repoRoot, 'ext', 'local-inference-daemon', 'dist'), { recursive: true });

  for (const download of downloads) {
    await createZipFromDirectory(download.sourceDirectory, download.outputFile, download.name);
  }

  const daemonPublicZip = downloads.find((download) => download.name === 'agent-harness-local-inference-daemon')?.outputFile;
  if (daemonPublicZip) {
    const daemonExtensionZip = path.join(
      repoRoot,
      'ext',
      'local-inference-daemon',
      'dist',
      'agent-harness-local-inference-daemon.zip',
    );
    await writeFile(daemonExtensionZip, await readFile(daemonPublicZip));
  }

  const connectorPublicZip = downloads.find((download) => download.name === 'local-model-connector-extension')?.outputFile;
  if (connectorPublicZip) {
    const connectorExtensionZip = path.join(
      repoRoot,
      'ext',
      'local-model-connector',
      'dist',
      'local-model-connector-extension.zip',
    );
    await writeFile(connectorExtensionZip, await readFile(connectorPublicZip));
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await rm(path.join(DEFAULT_REPO_ROOT, 'agent-browser', 'public', 'downloads'), { recursive: true, force: true });
  await packageExtensionDownloads(DEFAULT_REPO_ROOT);
}

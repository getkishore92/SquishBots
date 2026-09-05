import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { unzipSync } from 'fflate';

const source = 'https://api.fontshare.com/v2/fonts/download/satoshi';
const destination = new URL('../frontend/src/assets/fonts/', import.meta.url);
const files = {
  'Satoshi_Complete/Fonts/WEB/fonts/Satoshi-Variable.woff2': 'Satoshi-Variable.woff2',
  'Satoshi_Complete/Fonts/WEB/fonts/Satoshi-VariableItalic.woff2': 'Satoshi-VariableItalic.woff2',
  'Satoshi_Complete/License/FFL.txt': 'FFL.txt',
};

try {
  const response = await fetch(source, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`Fontshare returned HTTP ${response.status}`);
  const archive = unzipSync(new Uint8Array(await response.arrayBuffer()), {
    filter: entry => Object.hasOwn(files, entry.name),
  });
  for (const name of Object.keys(files)) {
    if (!archive[name]?.length) throw new Error(`Official archive is missing ${name}`);
  }
  await mkdir(destination, { recursive: true });
  for (const [name, filename] of Object.entries(files)) {
    await writeFile(new URL(filename, destination), archive[name]);
  }
  console.log(`Satoshi installed from Fontshare in ${fileURLToPath(destination)}`);
  console.log('Original files and ITF Free Font License retained. Font binaries are local build inputs and must not be committed.');
} catch (error) {
  console.error(`Font setup failed: ${error.message}`);
  process.exitCode = 1;
}

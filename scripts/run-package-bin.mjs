import path from 'node:path';
import { fileURLToPath } from 'node:url';

export * from './run-package-bin-lib.mjs';
import { main } from './run-package-bin-lib.mjs';

/* node:coverage ignore next 3 */
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}

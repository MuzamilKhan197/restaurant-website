import { resolve } from 'node:path';
import { ensureSetup } from '../server/setup.js';
await ensureSetup(resolve('.'));
console.log('Local setup is ready. Initial administrator email and password are in .env. Existing credentials were preserved.');

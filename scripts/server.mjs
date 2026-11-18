import { resolve } from 'node:path';
import { createApplication } from '../server/http.js';
import { ensureSetup } from '../server/setup.js';
const projectRoot = resolve('.');
const config = { ...await ensureSetup(projectRoot), ...process.env };
const app = createApplication({ root: resolve(config.SERVE_DIST === '1' ? 'dist' : '.'), dbPath: resolve(config.DB_PATH || 'storage/restaurant.sqlite'), adminPassword: config.ADMIN_PASSWORD, adminEmail: config.ADMIN_EMAIL, publicOrigin: config.PUBLIC_ORIGIN || '' });
const port = Number(config.PORT || 3000);
app.server.on('error', error => { console.error(error.message); app.store.close(); process.exitCode = 1; });
app.server.listen(port, '127.0.0.1', () => {
  console.log(`Saffron & Ember: http://localhost:${port}`);
  console.log(`Management: http://localhost:${port}/admin`);
  console.log('Initial administrator credentials: .env (not exposed over HTTP).');
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => app.server.close(() => { app.store.close(); process.exit(0); }));

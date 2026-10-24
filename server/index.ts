import 'dotenv/config';
import { createApp } from './app.js';
import { getConfig, missingKeys } from './config.js';

const config = getConfig();
const port = Number(process.env.PORT || 4318);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('PORT must be an integer from 1024 to 65535.');
const app = createApp({ config });
const server = app.listen(port, '127.0.0.1', () => {
  console.log(`Needle API ready at http://127.0.0.1:${port}`);
  console.log(`Default: ${config.defaultMode}. Live discovery: ${missingKeys(config).length ? 'not configured' : 'configured'}. Checkout is always simulated.`);
});
server.on('error', error => { console.error(`Needle could not start: ${error.message}`); process.exitCode = 1; });
for (const signal of ['SIGTERM', 'SIGINT'] as const) process.on(signal, () => server.close(() => { app.locals.database.close(); process.exit(0); }));

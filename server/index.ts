import { join } from 'node:path';
import { createApp } from './app.js';
import { Store } from './store.js';

function argValue(name: string): string | undefined {
  const idx = process.argv.indexOf(name);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
}

const host = argValue('--host') ?? '127.0.0.1';
const port = Number(argValue('--port') ?? process.env.PORT ?? 3001);
const dataFile = process.env.DATA_FILE ?? join(process.cwd(), 'server', 'data', 'bakery.json');

const store = new Store(dataFile);
const app = createApp(store);

const server = app.listen(port, host, () => {
  console.log(`bakery api listening on http://${host}:${port} (data: ${dataFile})`);
});

server.on('error', (err) => {
  console.error(`无法绑定 ${host}:${port} -`, err.message);
  process.exit(1);
});

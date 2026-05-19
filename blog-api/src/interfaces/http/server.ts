import { serve } from '@hono/node-server';
import { createContainer } from '../../infrastructure/container.js';
import { createApp } from './app.js';

const container = createContainer();
const app = createApp(container);

serve({ fetch: app.fetch, port: 3000 }, (info) => {
  console.log(`blog-api listening on http://localhost:${info.port}`);
});

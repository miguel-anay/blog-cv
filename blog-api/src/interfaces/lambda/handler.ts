import { handle } from 'hono/aws-lambda';
import { createContainer } from '../../infrastructure/container.js';
import { createApp } from '../http/app.js';

const container = createContainer();
const app = createApp(container);
export const handler = handle(app);

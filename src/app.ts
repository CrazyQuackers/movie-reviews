import express from 'express';
import routes from './routes';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler';

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use(routes);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

export default createApp();

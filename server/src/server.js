import mongoose from 'mongoose';
import app from './app.js';
import { env } from './config/env.js';

try {
  await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 10000 });
  const server = app.listen(env.port, () => console.info(`AI Mystery Room API listening on http://localhost:${env.port}`));
  const shutdown = async () => { server.close(); await mongoose.disconnect(); process.exit(0); };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
} catch (error) {
  console.error(`Unable to connect to MongoDB: ${error.message}`);
  process.exit(1);
}

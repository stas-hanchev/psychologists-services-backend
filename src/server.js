import 'dotenv/config';
import dns from 'node:dns';

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { errors } from "celebrate";

import { connectMongoDB } from './db/connectMongoDB.js';
import { logger } from './middleware/logger.js';
import { notFoundHandler } from './middleware/notFoundHandler.js';
import { errorHandler } from './middleware/errorHandler.js';
import { apiLimiter } from './middleware/rateLimit.js';
import cookieParser from "cookie-parser";

import authRoutes from './routes/authRoutes.js';
import psychologistsRoutes from './routes/psychologistsRoutes.js';
import favoritesRoutes from './routes/favoritesRoutes.js';

dns.setServers(['1.1.1.1', '8.8.8.8']);

const app = express();
const PORT = process.env.PORT ?? 3000;

app.set('trust proxy', Number(process.env.TRUST_PROXY ?? 0));
app.disable('x-powered-by');

const allowedOrigins = (process.env.CORS_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(logger);
app.use(helmet());
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());
app.use(apiLimiter);

app.get('/', (req, res) => {
  res.status(200).json({ message: 'Hello world!' });
});

app.use(authRoutes);
app.use(psychologistsRoutes);
app.use(favoritesRoutes);

app.use(notFoundHandler);
app.use(errors());
app.use(errorHandler);

await connectMongoDB();

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

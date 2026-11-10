import { rateLimit } from 'express-rate-limit';
import { FIFTEEN_MINUTES } from '../constants/time.js';

export const authLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Too many attempts, please try again later.' },
});

export const apiLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  limit: 500,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' },
});

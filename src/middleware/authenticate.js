import createHttpError from 'http-errors';
import { Session } from '../models/session.js';
import { User } from '../models/user.js';
import { hashToken } from '../services/auth.js';
import { getAuthCookies } from '../utils/cookies.js';

export const authenticate = async (req, res, next) => {
  const { sessionId, accessToken } = getAuthCookies(req);

  if (!sessionId || !accessToken) {
    throw createHttpError(401, 'Missing session credentials');
  }

  const session = await Session.findOne({
    _id: sessionId,
    accessToken: hashToken(accessToken),
  });

  if (!session || session.accessTokenValidUntil < new Date()) {
    throw createHttpError(401, 'Session expired');
  }

  const user = await User.findById(session.userId);

  if (!user) {
    throw createHttpError(401, 'User not found');
  }

  req.user = user;

  next();
};

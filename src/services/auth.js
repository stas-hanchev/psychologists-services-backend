import crypto from 'crypto';
import { FIFTEEN_MINUTES, ONE_DAY } from '../constants/time.js';
import { Session } from '../models/session.js';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  path: '/',
};

export const hashToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

export const createSession = async (userId) => {
  const accessToken = crypto.randomBytes(32).toString('hex');
  const refreshToken = crypto.randomBytes(32).toString('hex');

  const session = await Session.create({
    userId,
    accessToken: hashToken(accessToken),
    refreshToken: hashToken(refreshToken),
    accessTokenValidUntil: new Date(Date.now() + FIFTEEN_MINUTES),
    refreshTokenValidUntil: new Date(Date.now() + ONE_DAY),
  });

  return { sessionId: session._id.toString(), accessToken, refreshToken };
};

export const setSessionCookies = (res, { sessionId, accessToken, refreshToken }) => {
  res.cookie('accessToken', accessToken, { ...COOKIE_OPTIONS, maxAge: FIFTEEN_MINUTES });
  res.cookie('refreshToken', refreshToken, { ...COOKIE_OPTIONS, maxAge: ONE_DAY });
  res.cookie('sessionId', sessionId, { ...COOKIE_OPTIONS, maxAge: ONE_DAY });
};

export const clearSessionCookies = (res) => {
  res.clearCookie('sessionId', COOKIE_OPTIONS);
  res.clearCookie('accessToken', COOKIE_OPTIONS);
  res.clearCookie('refreshToken', COOKIE_OPTIONS);
};

export const consumeRefreshSession = (sessionId, refreshToken) =>
  Session.findOneAndDelete({
    _id: sessionId,
    refreshToken: hashToken(refreshToken),
  });

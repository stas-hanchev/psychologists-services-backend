import { isValidObjectId } from 'mongoose';

export const getStringCookie = (req, name) => {
  const value = req.cookies?.[name];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
};

export const getAuthCookies = (req) => {
  const sessionId = getStringCookie(req, 'sessionId');

  return {
    sessionId: sessionId && isValidObjectId(sessionId) ? sessionId : undefined,
    accessToken: getStringCookie(req, 'accessToken'),
    refreshToken: getStringCookie(req, 'refreshToken'),
  };
};

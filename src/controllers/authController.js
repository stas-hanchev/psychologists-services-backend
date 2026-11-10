import bcrypt from "bcrypt";
import createHttpError from 'http-errors';
import { User } from '../models/user.js';

import {
  createSession,
  setSessionCookies,
  clearSessionCookies,
  consumeRefreshSession,
  hashToken,
} from '../services/auth.js';
import { Session } from "../models/session.js";
import { getAuthCookies } from '../utils/cookies.js';

export const registerUser = async (req, res) => {
  const { name, email, password } = req.body;

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw createHttpError(409, 'Email in use');
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const newUser = await User.create({
    name,
    email,
    password: hashedPassword,
  });

  const newSession = await createSession(newUser._id);
  setSessionCookies(res, newSession);

  res.status(201).json(newUser);
};

export const loginUser = async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user) {
    throw createHttpError(401, 'Invalid credentials');
  }

  const isValidPassword = await bcrypt.compare(password, user.password);
  if (!isValidPassword) {
    throw createHttpError(401, 'Invalid credentials');
  }

  const newSession = await createSession(user._id);
  setSessionCookies(res, newSession);

  res.status(200).json(user);
};

export const logoutUser = async (req, res) => {
  const { sessionId } = getAuthCookies(req);

  if (sessionId) {
    await Session.deleteOne({ _id: sessionId });
  }

  clearSessionCookies(res);

  res.status(204).send();
};

const rotateSession = async (req, res) => {
  const { sessionId, refreshToken } = getAuthCookies(req);

  if (!sessionId || !refreshToken) {
    clearSessionCookies(res);
    throw createHttpError(401, 'Missing session credentials');
  }

  const session = await consumeRefreshSession(sessionId, refreshToken);

  if (!session || session.refreshTokenValidUntil < new Date()) {
    clearSessionCookies(res);
    throw createHttpError(401, 'Session expired');
  }

  const newSession = await createSession(session.userId);
  setSessionCookies(res, newSession);
};

export const refreshUserSession = async (req, res) => {
  await rotateSession(req, res);

  res.status(200).json({
    message: 'Session refreshed',
  });
};

export const getSession = async (req, res) => {
  const { sessionId, accessToken } = getAuthCookies(req);

  if (sessionId && accessToken) {
    const session = await Session.findOne({
      _id: sessionId,
      accessToken: hashToken(accessToken),
    });

    if (session && session.accessTokenValidUntil > new Date()) {
      return res.status(200).json({ success: true });
    }
  }

  await rotateSession(req, res);

  res.status(200).json({ success: true });
};

export const getMe = async (req, res) => {
  res.status(200).json(req.user);
};

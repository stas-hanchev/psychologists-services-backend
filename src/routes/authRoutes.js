import { Router } from 'express';
import { celebrate } from 'celebrate';
import { authenticate } from '../middleware/authenticate.js';
import { authLimiter } from '../middleware/rateLimit.js';
import {
  loginUser,
  logoutUser,
  refreshUserSession,
  registerUser,
  getSession,
  getMe
} from '../controllers/authController.js';
import { loginUserSchema, registerUserSchema } from '../validations/authValidation.js';

const router = Router();

router.post('/auth/register', authLimiter, celebrate(registerUserSchema), registerUser);
router.post('/auth/login', authLimiter, celebrate(loginUserSchema), loginUser);
router.post('/auth/logout', logoutUser);
router.post('/auth/refresh', authLimiter, refreshUserSession);
router.get('/auth/session', getSession);
router.get('/auth/me', authenticate, getMe);

export default router;

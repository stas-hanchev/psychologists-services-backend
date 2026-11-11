import { Router } from 'express';
import { celebrate } from 'celebrate';
import { authenticate } from '../middleware/authenticate.js';
import { psychologistIdParamSchema } from '../validations/psychologistsValidation.js';
import { getFavorites, addFavorite, removeFavorite } from '../controllers/favoritesController.js';

const router = Router();

router.get('/favorites', authenticate, getFavorites);
router.post('/favorites/:psychologistId', authenticate, celebrate(psychologistIdParamSchema), addFavorite);
router.delete('/favorites/:psychologistId', authenticate, celebrate(psychologistIdParamSchema), removeFavorite);

export default router;

import { Router } from 'express';
import { celebrate } from 'celebrate';
import { authenticate } from '../middleware/authenticate.js';
import { psychologistIdParamSchema } from '../validations/favoritesValidation.js';
import { getFavorites, addFavorite, removeFavorite } from '../controllers/favoritesController.js';

const router = Router();

router.use(authenticate);

router.get('/favorites', getFavorites);
router.post('/favorites/:teacherId', celebrate(psychologistIdParamSchema), addFavorite);
router.delete('/favorites/:teacherId', celebrate(psychologistIdParamSchema), removeFavorite);

export default router;

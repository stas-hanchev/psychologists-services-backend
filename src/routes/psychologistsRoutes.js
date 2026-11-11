import { Router } from 'express';
import { celebrate } from 'celebrate';

import { getPsychologists, getPsychologistById } from '../controllers/psychologistsController.js';
import { psychologistIdParamSchema, getPsychologistsSchema } from '../validations/psychologistsValidation.js';

const router = Router();

router.get('/psychologists', celebrate(getPsychologistsSchema), getPsychologists);

router.get('/psychologists/:psychologistId', celebrate(psychologistIdParamSchema), getPsychologistById);

export default router;

import { Router } from 'express';
import { celebrate } from 'celebrate';

import { getPsychologists, getPsychologistById } from '../controllers/psychologistsController.js';
import { psychologistIdParamSchema, getPsychologistsSchema } from '../validations/psychologistsValidation.js';

const router = Router();

router.get('/teachers', celebrate(getPsychologistsSchema), getPsychologists);

router.get('/teachers/:teacherId', celebrate(psychologistIdParamSchema), getPsychologistById);

export default router;

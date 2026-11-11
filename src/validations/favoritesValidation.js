import { Joi, Segments } from 'celebrate';
import { isValidObjectId } from 'mongoose';

const objectIdValidator = (value, helpers) =>
  !isValidObjectId(value) ? helpers.message('Invalid id format') : value;

export const psychologistIdParamSchema = {
  [Segments.PARAMS]: Joi.object({
    psychologistId: Joi.string().custom(objectIdValidator).required(),
  }),
};

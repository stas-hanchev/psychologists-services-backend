import { Joi, Segments } from 'celebrate';
import { isValidObjectId } from 'mongoose';
import { DEFAULT_PER_PAGE } from '../constants/pagination.js';

const objectIdValidator = (value, helpers) => {
  return !isValidObjectId(value) ? helpers.message('Invalid id format') : value;
};

export const psychologistIdParamSchema = {
  [Segments.PARAMS]: Joi.object({
    psychologistId: Joi.string().custom(objectIdValidator).required(),
  }),
};

export const getPsychologistsSchema = {
  [Segments.QUERY]: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    perPage: Joi.number().integer().min(3).max(20).default(DEFAULT_PER_PAGE),
    sortBy: Joi.string().valid("_id", "name", "rating", "price_per_hour").default("_id"),
    sortOrder: Joi.string().valid("asc", "desc").default("asc"),
  }),
};

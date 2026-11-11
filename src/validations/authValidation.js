import { Joi, Segments } from 'celebrate';

export const registerUserSchema = {
  [Segments.BODY]: Joi.object({
    name: Joi.string().trim().min(2).max(30).required(),
    email: Joi.string().trim().lowercase().email().max(254).required(),
    password: Joi.string().min(8).max(72).required(),
  }),
};

export const loginUserSchema = {
  [Segments.BODY]: Joi.object({
    email: Joi.string().trim().lowercase().email().max(254).required(),
    password: Joi.string().max(72).required(),
  }),
};

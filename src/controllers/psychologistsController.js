// import { trusted } from 'mongoose';
import { Psychologist } from '../models/psychologist.js';
import createHttpError from 'http-errors';
import { DEFAULT_PER_PAGE } from '../constants/pagination.js';

export const getPsychologists = async (req, res) => {
  const {
    page = 1,
    perPage = DEFAULT_PER_PAGE,
    sortBy = "_id",
    sortOrder = "asc",
  } = req.query;

  const pageNumber = Number(page);
  const perPageNumber = Number(perPage);

  const skip = (pageNumber - 1) * perPageNumber;

  const [totalItems, psychologists] = await Promise.all([
    Psychologist.countDocuments(),

    Psychologist.find()
      .skip(skip)
      .limit(perPageNumber)
      .sort({ [sortBy]: sortOrder }),
  ]);

  const totalPages = Math.ceil(totalItems / perPageNumber);

  res.status(200).json({
    page: pageNumber,
    perPage: perPageNumber,
    totalItems,
    totalPages,
    psychologists,
  });
};

export const getPsychologistById = async (req, res) => {
  const { psychologistId } = req.params;
  const psychologist = await Psychologist.findById(psychologistId);

  if (!psychologist) {
    throw createHttpError(404, 'Psychologist not found');
  }

  res.status(200).json(psychologist);
};

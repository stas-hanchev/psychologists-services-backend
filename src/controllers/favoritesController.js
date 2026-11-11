import createHttpError from 'http-errors';
import { Favorite } from '../models/favorite.js';
import { Psychologist } from '../models/psychologist.js';

export const getFavorites = async (req, res) => {
  const favorites = await Favorite.find({ userId: req.user._id }).populate('psychologistId');
  res.status(200).json(favorites.map((f) => f.psychologistId).filter(Boolean));
};

export const addFavorite = async (req, res) => {
  const { psychologistId } = req.params;

  const psychologist = await Psychologist.findById(psychologistId);
  if (!psychologist) throw createHttpError(404, 'Psychologist not found');

  try {
    await Favorite.create({ userId: req.user._id, psychologistId });
  } catch (err) {
    if (err.code !== 11000) throw err;
  }

  res.status(201).json({ message: 'Added to favorites' });
};

export const removeFavorite = async (req, res) => {
  const { psychologistId } = req.params;
  await Favorite.deleteOne({ userId: req.user._id, psychologistId });
  res.status(204).send();
};

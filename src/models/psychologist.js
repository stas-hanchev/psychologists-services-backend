import { model, Schema } from 'mongoose';

const psychologistSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    avatar_url: {
      type: String,
      required: true,
    },
    experience: {
      type: String,
      required: true,
    },
    reviews: [
      {
        reviewer: {
          type: String,
          required: true,
          trim: true,
        },
        rating: {
          type: Number,
          required: true,
          min: 1,
          max: 5,
        },
        comment: {
          type: String,
          required: true,
          trim: true,
        },
      },
    ],
    price_per_hour: {
      type: Number,
      required: true,
    },
    rating: {
      type: Number,
      required: true,
    },
    license: {
      type: String,
      required: true,
    },
    specialization: {
      type: String,
      required: true,
    },
    initial_consultation: {
      type: String,
      required: true,
    },
    about: {
      type: String,
      required: true,
    }
  },
  {
    timestamps: true,
  },
);

psychologistSchema.index({ name: 1, _id: 1 });
psychologistSchema.index({ rating: 1, _id: 1 });
psychologistSchema.index({ price_per_hour: 1, _id: 1 });

export const Psychologist = model('Psychologist', psychologistSchema);

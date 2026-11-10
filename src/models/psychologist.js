import { Schema } from 'mongoose';
import { model } from 'mongoose';

const PsychologistSchema = new Schema(
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

teacherSchema.index({ name: 'text', rating: 1, price_per_hour: 1 });

export const Teacher = model('Psychologist', PsychologistSchema);

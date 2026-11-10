import { model, Schema } from 'mongoose';

const favoriteSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    psychologistId: { type: Schema.Types.ObjectId, ref: 'Psychologist', required: true },
  },
  { timestamps: true },
);

favoriteSchema.index({ userId: 1, psychologistId: 1 }, { unique: true });

export const Favorite = model('Favorite', favoriteSchema);

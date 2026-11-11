import mongoose from 'mongoose';
import { Psychologist } from '../models/psychologist.js';
import { Session } from '../models/session.js';
import { User } from '../models/user.js';
import { Favorite } from '../models/favorite.js';

mongoose.set('sanitizeFilter', true);

export const connectMongoDB = async () => {
  try {
    const mongoUrl = process.env.MONGO_URL;
    await mongoose.connect(mongoUrl);
    console.log('✅ MongoDB connection established successfully');
    await Promise.all([
      Psychologist.syncIndexes(),
      Session.syncIndexes(),
      User.syncIndexes(),
      Favorite.syncIndexes(),
    ]);
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error.message);
    process.exit(1);
  }
};

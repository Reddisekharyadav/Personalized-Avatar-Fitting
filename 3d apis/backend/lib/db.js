import mongoose from 'mongoose';

/**
 * MongoDB Connection Helper
 * Requirement A: MONGODB_URI environment variable
 */

let isConnected = false;

/**
 * Connect to MongoDB
 * Uses connection pooling and handles reconnection
 */
export async function connectDB() {
  if (isConnected) {
    console.log('Using existing MongoDB connection');
    return;
  }

  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI environment variable is not defined');
  }

  try {
    await mongoose.connect(MONGODB_URI, {
      // Connection options for stability
      maxPoolSize: 10,
      minPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    isConnected = true;
    console.log('MongoDB connected successfully');

    // Handle connection events
    mongoose.connection.on('error', (error) => {
      console.error('MongoDB connection error:', error);
      isConnected = false;
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB disconnected');
      isConnected = false;
    });

  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    throw error;
  }
}

/**
 * Disconnect from MongoDB (useful for tests)
 */
export async function disconnectDB() {
  if (!isConnected) return;
  
  await mongoose.disconnect();
  isConnected = false;
  console.log('MongoDB disconnected');
}

export default {
  connectDB,
  disconnectDB
};

/**
 * Clear all users from MongoDB
 * Usage: node scripts/clearUsers.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env') });

const MONGODB_URI = process.env.MONGODB_URI;

async function clearUsers() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');

    // Count users before deletion
    const countBefore = await usersCollection.countDocuments();
    console.log(`📊 Found ${countBefore} users in database`);

    if (countBefore === 0) {
      console.log('ℹ️  No users to delete');
    } else {
      // Delete all users
      const result = await usersCollection.deleteMany({});
      console.log(`🗑️  Deleted ${result.deletedCount} users`);
      console.log('✨ Users collection cleared successfully!');
    }

    await mongoose.connection.close();
    console.log('👋 Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error clearing users:', error);
    process.exit(1);
  }
}

// Run the script
clearUsers();

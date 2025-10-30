# Database Management Scripts

Utility scripts for managing users in the MongoDB database during development and testing.

## Available Scripts

### 1. Clear All Users
**Deletes all users from the database**

```bash
cd backend
node scripts/clearUsers.js
```

**Output:**
```
🔌 Connecting to MongoDB...
✅ Connected to MongoDB
📊 Found 21 users in database
🗑️  Deleted 21 users
✨ Users collection cleared successfully!
👋 Disconnected from MongoDB
```

**Use this when:**
- Starting fresh testing
- Cleaning up after multiple test accounts
- Resetting the database before deployment testing

---

### 2. Delete Specific User
**Deletes a single user by email address**

```bash
cd backend
node scripts/deleteUser.js <email>
```

**Example:**
```bash
node scripts/deleteUser.js alice@test.com
```

**Output:**
```
🔌 Connecting to MongoDB...
✅ Connected to MongoDB
📧 Found user: alice (alice@test.com)
🔑 User ID: 507f1f77bcf86cd799439011
👤 Avatar URL: https://models.readyplayer.me/...
🗑️  Deleted 1 user(s)
✨ User deleted successfully!
👋 Disconnected from MongoDB
```

**Use this when:**
- Removing a specific test account
- Fixing data for a single user
- Testing with the same email again

---

### 3. List All Users
**Displays all users in the database with details**

```bash
cd backend
node scripts/listUsers.js
```

**Output:**
```
🔌 Connecting to MongoDB...
✅ Connected to MongoDB

📊 Total users: 3

👥 Users List:
═══════════════════════════════════════════════════════════

1. alice
   📧 Email: alice@test.com
   🔑 ID: 507f1f77bcf86cd799439011
   👤 Avatar: ✓ Has avatar
      URL: https://models.readyplayer.me/68f48...
   📅 Created: 2025-01-15T10:30:00.000Z

2. bob
   📧 Email: bob@test.com
   🔑 ID: 507f191e810c19729de860ea
   👤 Avatar: ✗ No avatar
   📅 Created: 2025-01-15T11:00:00.000Z

═══════════════════════════════════════════════════════════

👋 Disconnected from MongoDB
```

**Use this when:**
- Checking how many test users exist
- Verifying user data
- Finding user IDs for debugging
- Checking which users have avatars

---

## Common Workflows

### Testing Signup Flow
```bash
# 1. Clear all users first
node scripts/clearUsers.js

# 2. Test signup at http://localhost:3000/signup
# Create account with: test@example.com

# 3. Check if user was created
node scripts/listUsers.js

# 4. Test again with same email (should show error)
# 5. Delete that user to retry
node scripts/deleteUser.js test@example.com
```

### Multi-User Testing
```bash
# 1. Start fresh
node scripts/clearUsers.js

# 2. Create multiple test users:
#    - alice@test.com
#    - bob@test.com
#    - charlie@test.com

# 3. Verify all users were created
node scripts/listUsers.js

# 4. Check avatars are isolated per user
# Login as each user and verify wardrobe

# 5. Clean up after testing
node scripts/clearUsers.js
```

### Fixing Incomplete Signups
```bash
# If signup created user but avatar generation failed:

# 1. Check users
node scripts/listUsers.js

# 2. Delete the incomplete user
node scripts/deleteUser.js user@example.com

# 3. Try signup again with same email
```

---

## Important Notes

⚠️ **These scripts are for DEVELOPMENT/TESTING only!**

- Never use in production
- All deletions are permanent
- No confirmation prompts (be careful!)
- Backs up are not created

✅ **Safe to use when:**
- Testing locally
- Database is `virtualdressing` (test database)
- You want to reset test data

🔒 **Environment Variables Required:**
- `MONGODB_URI` must be set in `backend/.env`
- Script automatically loads from `.env` file

---

## Troubleshooting

### Script won't run
```bash
# Make sure you're in the backend directory
cd backend

# Check if Node.js is installed
node --version

# Make sure MongoDB URI is in .env
cat .env | grep MONGODB_URI
```

### Connection errors
- Verify MongoDB is running (if local)
- Check internet connection (if MongoDB Atlas)
- Verify MONGODB_URI in .env is correct
- Check firewall/network settings

### No users found
- This is normal after running `clearUsers.js`
- Create users via signup page
- Run `listUsers.js` again to verify

---

## Adding More Scripts

To create additional database management scripts:

1. Create new file in `backend/scripts/`
2. Use the same import structure
3. Connect to MongoDB using `MONGODB_URI`
4. Perform operations on collections
5. Close connection when done
6. Update this README with usage

---

## Script Structure

All scripts follow this pattern:

```javascript
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Setup __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env') });

async function doSomething() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    
    // Get collection
    const db = mongoose.connection.db;
    const collection = db.collection('users');
    
    // Perform operations
    // ...
    
    // Close connection
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

doSomething();
```

---

## Quick Reference

| Command | Purpose |
|---------|---------|
| `node scripts/clearUsers.js` | Delete all users |
| `node scripts/deleteUser.js <email>` | Delete one user |
| `node scripts/listUsers.js` | Show all users |

---

**Last Updated:** January 2025
**Maintained by:** Development Team

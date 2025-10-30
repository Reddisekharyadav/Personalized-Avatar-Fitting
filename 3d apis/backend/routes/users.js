import express from 'express';
import User from '../models/User.js';
import { authenticateJWT } from '../lib/auth.js';

const router = express.Router();

// POST /api/users/avatar - save or update avatarUrl for the authenticated user
router.post('/avatar', authenticateJWT, async (req, res) => {
  try {
    const { avatarUrl } = req.body;
    if (!avatarUrl) return res.status(400).json({ error: 'Missing avatarUrl' });

    const email = req.user?.email;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.avatarUrl = avatarUrl;
    user.avatarGlbUrl = avatarUrl; // Also update legacy field for backward compatibility
    await user.save();

    console.log(`✅ Avatar saved for user ${email}:`, avatarUrl);

    return res.json({ success: true, user: { _id: user._id, email: user.email, avatarUrl: user.avatarUrl } });
  } catch (error) {
    console.error('Save avatar error:', error);
    return res.status(500).json({ error: 'Failed to save avatar' });
  }
});

export default router;

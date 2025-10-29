import express from 'express';
import User from '../models/User.js';

const router = express.Router();

// GET /api/profile/:email - return user document only
router.get('/:email', async (req, res) => {
  try {
    const user = await User.findOne({ email: req.params.email }).lean();
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json({ user });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

export default router;

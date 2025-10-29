import express from 'express';
import User from '../models/User.js';
import Avatar from '../models/Avatar.js';

const router = express.Router();

// Ready Player Me webhook receiver
// Expect body: { userEmail, avatar_url } or similar payload from RPM
// Protect optionally with a shared secret header: x-rpm-secret
router.post('/webhook', async (req, res) => {
  try {
    const secret = process.env.RPM_WEBHOOK_SECRET;
    if (secret) {
      const hdr = req.headers['x-rpm-secret'];
      if (!hdr || hdr !== secret) return res.status(401).json({ error: 'Invalid webhook secret' });
    }

    const { userEmail, avatar_url, bodyShape, skinTone } = req.body;
    if (!userEmail || !avatar_url) return res.status(400).json({ error: 'Missing userEmail or avatar_url' });

    const user = await User.findOne({ email: userEmail });
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Persist avatar doc
    const avatar = await Avatar.create({ user: user._id, avatarUrl: avatar_url, bodyShape, skinTone });

    // Update user document with latest avatar url for convenience
    user.avatarGlbUrl = avatar_url;
    await user.save();

    return res.json({ success: true, avatar });
  } catch (err) {
    console.error('RPM webhook error', err);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
});

export default router;

import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const router = express.Router();

// Register
router.post('/register', async (req, res) => {
  const { username, email, password, photo } = req.body;
  if (!username || !email || !password) return res.status(400).json({ error: 'Missing fields' });
  try {
    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ error: 'Email already in use' });
    const hash = await bcrypt.hash(password, 10);

    // Create user record first (no avatar yet)
    const user = await User.create({ username, email, password: hash, photo: photo || '' });

    // If photo provided, generate avatar immediately (existing flow)
    if (photo) {
      const avatarGlbUrl = await generate3DModelFromPhoto(photo);
      user.avatarGlbUrl = avatarGlbUrl;
      await user.save();
      return res.json({ success: true, avatarGlbUrl });
    }

    // If frontend provides an avatarGlbUrl (from RPM export), accept and save it
    if (req.body.avatarGlbUrl) {
      user.avatarGlbUrl = req.body.avatarGlbUrl;
      await user.save();
      return res.json({ success: true, avatarGlbUrl: user.avatarGlbUrl });
    }

    // Otherwise return a Ready Player Me creation URL for the frontend to open once
    // Frontend should redirect user to RPM creation flow and RPM will call back our webhook
    const rpmBase = process.env.RPM_CREATION_URL || 'https://readyplayer.me/avatar';
    // Optionally you may append query params (e.g., redirect URI) for a production RPM integration
    return res.json({ success: true, rpmCreationUrl: `${rpmBase}?partner=your-app&email=${encodeURIComponent(email)}` });
  } catch (err) {
    console.error('Registration error', err);
    return res.status(500).json({ error: 'Registration failed' });
  }
});

// Dummy 3D model generation function (replace with real logic)
async function generate3DModelFromPhoto(photo) {
  // Simulate 3D model generation and return a placeholder URL
  // In production, call your 3D avatar service here
  return 'https://example.com/generated-avatar.glb';
}

// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Missing fields' });
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token });
  } catch {
    res.status(500).json({ error: 'Login failed' });
  }
});

export default router;

import express from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { generateToken } from '../lib/auth.js';

const router = express.Router();

/**
 * POST /api/auth/register (or /api/auth/signup)
 * Requirement C: Authentication endpoint for user registration
 * 
 * Body: { username, email, password }
 * Flow: create user, return temp JWT but require avatar creation before full activation
 */
router.post('/register', async (req, res) => {
  const { username, email, password, photo, avatarUrl, avatarId, metadata } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Missing required fields: username, email, password' });
  }
  
  try {
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ error: 'Email already in use' });
    }
    
    if (typeof password !== 'string' || password.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters' });
    }
    const hash = await bcrypt.hash(String(password), 10);

    // Create user record; if avatar already provided (deferred registration), include it now
    const user = await User.create({ 
      username, 
      email, 
      password: hash, 
      photo: photo || '',
      avatarUrl: avatarUrl || undefined,
      avatarGlbUrl: avatarUrl || undefined, // Also set legacy field for backward compatibility
      avatar: avatarUrl ? {
        avatarId: avatarId || undefined,
        rpmUrl: avatarUrl,
        metadata: metadata || {}
      } : undefined
    });

    // Create Ready Player Me guest user for this account
    try {
      const axios = (await import('axios')).default;
      const rpmApiKey = process.env.RPM_API_KEY || process.env.Readyplayerme_api_key;
      const rpmAppId = process.env.RPM_APP_ID;
      if (rpmApiKey && rpmAppId) {
        const rpmResp = await axios.post('https://api.readyplayer.me/v1/users', {
          data: { applicationId: rpmAppId }
        }, { headers: { 'x-api-key': rpmApiKey } });
        const readyPlayerUserId = rpmResp?.data?.data?.id;
        if (readyPlayerUserId) {
          user.readyPlayerUserId = readyPlayerUserId;
          user.isGuest = true;
          await user.save();
        }
      }
    } catch (error_) {
      console.warn('RPM guest create failed:', error_?.response?.data || error_?.message || error_);
      // Continue without RPM guest; user can still proceed
    }

  // Generate JWT token (Requirement H: JWT + cookies)
    const token = generateToken({ userId: user._id.toString(), email: user.email });

    // Set httpOnly cookie (Requirement H: secure cookie)
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // HTTPS only in production
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    return res.json({ 
      success: true,
      token,
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        readyPlayerUserId: user.readyPlayerUserId,
        hasAvatar: !!(user.avatarUrl || (user.avatar && (user.avatar.s3Url || user.avatar.rpmUrl)))
      },
      message: avatarUrl ? 'Account created with avatar.' : 'Account created. Please create your avatar to continue.'
    });
    
  } catch (err) {
    console.error('Registration error', err);
    return res.status(500).json({ error: 'Registration failed' });
  }
});

// Alias for /register
router.post('/signup', async (req, res) => {
  return router.handle(Object.assign(req, { url: '/register', method: 'POST' }), res);
});

/**
 * POST /api/auth/login
 * Requirement C: Authentication endpoint for user login
 * Body: { email, password } -> return JWT cookie
 */
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Missing fields: email, password' });
  }
  
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Guard: ensure password is present
    if (!user.password || typeof password !== 'string') {
      console.error('User found but password invalid/missing for email:', email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const match = await bcrypt.compare(String(password), user.password);
    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Generate JWT token
    const token = generateToken({ userId: user._id.toString(), email: user.email });

    // Set httpOnly cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    return res.json({ 
      success: true,
      token,
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        readyPlayerUserId: user.readyPlayerUserId,
        hasAvatar: !!(user.avatar && user.avatar.s3Url)
      }
    });
    
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/link - link an authorized RPM user to replace guest id
router.post('/link', async (req, res) => {
  try {
    const { email, newUserId } = req.body;
    if (!email || !newUserId) return res.status(400).json({ error: 'Missing email or newUserId' });
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.readyPlayerUserId = newUserId;
    user.isGuest = false;
    await user.save();

    return res.json({ success: true, user: { _id: user._id, email: user.email, readyPlayerUserId: user.readyPlayerUserId, isGuest: user.isGuest } });
  } catch (error) {
    console.error('Link RPM account error:', error);
    return res.status(500).json({ error: 'Failed to link RPM account' });
  }
});

/**
 * POST /api/auth/logout
 * Clear authentication cookie
 */
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  return res.json({ success: true, message: 'Logged out successfully' });
});

export default router;

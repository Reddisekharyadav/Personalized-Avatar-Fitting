import express from 'express';
import { Readable } from 'node:stream';
import User from '../models/User.js';
import { fetchRPMAvatarGLB } from '../lib/rpm.js';
import { uploadStreamToS3, generateAvatarS3Key } from '../lib/s3.js';
import { authenticateJWT } from '../lib/auth.js';

const router = express.Router();

/**
 * POST /api/avatar/receive
 * Requirement C: Avatar creation & storage endpoint
 * 
 * Body: { userId, avatarId, rpmUrl, metadata }
 * Behaviour: validate user -> fetch rpmUrl (server-side) -> copy GLB to S3 -> store metadata in user.avatar
 * 
 * We copy the GLB to S3 so we own the asset and avoid hotlinking to RPM URLs
 * (which may expire or change). This gives us full control over avatar data.
 */
router.post('/receive', async (req, res) => {
  const { userId, avatarId, rpmUrl, metadata } = req.body;

  // Validate required fields
  if (!userId || !rpmUrl) {
    return res.status(400).json({ error: 'userId and rpmUrl are required' });
  }

  try {
    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    console.log(`Receiving avatar for user ${userId}: ${rpmUrl}`);

    // Fetch GLB from RPM (Requirement I: handle 404/timeout)
    let glbBuffer;
    try {
      glbBuffer = await fetchRPMAvatarGLB(rpmUrl);
    } catch (error) {
      console.error('Failed to fetch RPM avatar:', error);
      return res.status(502).json({ 
        error: 'Failed to fetch avatar from Ready Player Me. Please try creating your avatar again.',
        details: error.message 
      });
    }

    // Stream GLB to S3 (Requirement C: use unique key, avoid loading fully in memory)
    const s3Key = generateAvatarS3Key(userId);
    let s3Url;
    
    try {
      // Convert buffer to stream for S3 upload
      const readStream = Readable.from(glbBuffer);
      s3Url = await uploadStreamToS3(readStream, s3Key, 'model/gltf-binary');
    } catch (error) {
      console.error('S3 upload failed:', error);
      // Requirement I: S3 upload retry is handled in s3.js
      return res.status(500).json({ 
        error: 'Failed to store avatar. Please try again.',
        details: error.message 
      });
    }

    // Update user record with avatar metadata (Requirement B.1)
    user.avatar = {
      avatarId: avatarId || '',
      rpmUrl: rpmUrl,
      s3Url: s3Url,
      bodySize: metadata?.bodyType || metadata?.bodySize || '',
      gender: metadata?.gender || '',
      skinTone: metadata?.skinTone || '',
      metadata: metadata || {}
    };

    await user.save();

    console.log(`Avatar saved successfully for user ${userId}: ${s3Url}`);

    return res.json({ 
      ok: true, 
      user: {
        _id: user._id,
        email: user.email,
        avatar: user.avatar
      }
    });

  } catch (error) {
    console.error('Avatar receive error:', error);
    return res.status(500).json({ 
      error: 'Failed to process avatar',
      details: error.message 
    });
  }
});

/**
 * GET /api/avatar/:userId
 * Requirement C: Return stored avatar metadata & s3 url
 */
router.get('/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await User.findById(userId).select('avatar email username');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.avatar || !user.avatar.s3Url) {
      return res.status(404).json({ error: 'No avatar found for this user' });
    }

    return res.json({
      ok: true,
      avatar: user.avatar,
      user: {
        email: user.email,
        username: user.username
      }
    });

  } catch (error) {
    console.error('Get avatar error:', error);
    return res.status(500).json({ 
      error: 'Failed to retrieve avatar',
      details: error.message 
    });
  }
});

/**
 * GET /api/avatar/me
 * Get current user's avatar (requires authentication)
 */
router.get('/me', authenticateJWT, async (req, res) => {
  try {
    const user = await User.findOne({ email: req.user.email }).select('avatar email username');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.avatar || !user.avatar.s3Url) {
      return res.status(404).json({ error: 'No avatar found' });
    }

    return res.json({
      ok: true,
      avatar: user.avatar,
      user: {
        email: user.email,
        username: user.username
      }
    });

  } catch (error) {
    console.error('Get current avatar error:', error);
    return res.status(500).json({ 
      error: 'Failed to retrieve avatar',
      details: error.message 
    });
  }
});

export default router;

import express from 'express';
import fs from 'fs';
import path from 'path';
import User from '../models/User.js';
import multer from 'multer';
import axios from 'axios';

const router = express.Router();
const upload = multer({ dest: 'cache/images/' });

/**
 * POST /api/tryon2d
 * Body: { userId: string, productLink: string, userImage: string (base64) }
 */
router.post('/', async (req, res) => {
  const { userId, productLink, userImage, saveToDatabase } = req.body;
  console.log('Request received:', { userId, productLink, saveToDatabase });

  if (!userId) {
    console.error('Error: userId is required');
    return res.status(400).json({ error: 'userId is required' });
  }
  if (!productLink || !userImage) {
    console.error('Error: productLink and userImage are required');
    return res.status(400).json({ error: 'productLink and userImage are required' });
  }

  try {
    // Convert user image base64
    const userBytes = userImage.split(',')[1];
    console.log('User image processed');

    // Fetch product image and save to cache
    const cacheDir = path.join(process.cwd(), 'cache', 'images');
    fs.mkdirSync(cacheDir, { recursive: true });
    const productImagePath = path.join(cacheDir, `${userId}-product-${Date.now()}.png`);

    try {
      console.log('Downloading product image from link:', productLink);
      const imgRes = await axios.get(productLink, { responseType: 'arraybuffer' });
      fs.writeFileSync(productImagePath, imgRes.data);
      console.log('Product image saved to cache:', productImagePath);
    } catch (e) {
      console.error('Error downloading product image:', e.message);
      return res.status(400).json({ error: 'Failed to download product image' });
    }

    const prompt = `Overlay the clothing from the second image onto the person in the first image. Make sure the fit is realistic and aligned with the body. Do not change the person's face, skin tone, or background.`;

    // Replicate API integration
    const replicatePayload = {
      version: "v2.0.0", // Updated to another valid version ID for the Replicate API
      input: {
        prompt,
        userImage: userBytes,
        productImage: fs.readFileSync(productImagePath).toString('base64'),
      },
    };

    console.log('Calling Replicate API with payload');
    const replicateResponse = await axios.post('https://api.replicate.com/v1/predictions', replicatePayload, {
      headers: {
        Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('Replicate API response received');
    const generatedImage = replicateResponse.data.output; // Assuming Replicate returns the image in base64 format

    // Save to disk
    const filename = `${userId}-${Date.now()}.png`;
    const dir = path.join(process.cwd(), 'avatars', 'tryon2d', userId);
    fs.mkdirSync(dir, { recursive: true });
    const fullPath = path.join(dir, filename);
    fs.writeFileSync(fullPath, Buffer.from(generatedImage, 'base64'));
    console.log('Generated image saved to disk:', fullPath);

    // Construct public URL
    const host = req.get('host');
    const scheme = req.headers['x-forwarded-proto'] || req.protocol;
    const publicUrl = `${scheme}://${host}/avatars/tryon2d/${userId}/${filename}`;

    // Conditionally save to database
    if (saveToDatabase) {
      const user = await User.findById(userId);
      if (!user) {
        console.error('Error: User not found');
        return res.status(404).json({ error: 'User not found' });
      }

      user.tryOnImages = user.tryOnImages || [];
      user.tryOnImages.push({ imageUrl: publicUrl, createdAt: new Date() });
      await user.save();
      console.log('Generated image saved to database');
    }

    return res.json({ success: true, imageUrl: publicUrl });
  } catch (err) {
    console.error('Error in /api/tryon2d:', err.response?.data || err.message || err);
    const status = err.response?.status || 500;
    const message = err.response?.data?.error?.message || err.message || 'Image generation failed';
    return res.status(status).json({ error: message });
  }
});

export default router;

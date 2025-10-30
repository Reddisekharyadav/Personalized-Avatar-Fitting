# FREE Image-to-3D Generation with TripoSR

**✅ 100% FREE - No API costs, no billing, no credits needed!**

This setup uses TripoSR, an open-source (MIT license) model that runs **locally on your computer**.

---

## 🚀 Quick Start (3 Steps)

### Step 1: Run the Setup (One-Time)

Double-click or run:
```bash
setup-triposr.bat
```

This will:
- Download TripoSR (open-source, ~2GB model)
- Install Python dependencies
- Set everything up automatically

**Requirements:**
- Python 3.8+ ([Download here](https://www.python.org/downloads/))
- Git ([Download here](https://git-scm.com/))
- ~6GB disk space
- 6GB RAM (or GPU with 6GB VRAM for faster generation)

---

### Step 2: Test It

Run the test to make sure everything works:
```bash
node test-triposr-local.js
```

This will:
- Download a sample image
- Generate a 3D GLB file
- Show you the result

**First run:** Downloads the model weights (~2GB), takes 2-3 minutes  
**After that:** Generates 3D models in 10-30 seconds (depending on CPU/GPU)

---

### Step 3: Use in Your Backend

The integration is already set up! Example usage:

```javascript
import { generateLocalTripoSR } from './lib/triposrLocal.js';

// Generate from URL
const glbPath = await generateLocalTripoSR(
  'https://example.com/product.jpg',
  './output/model.glb'
);

// Generate from file
const glbPath = await generateLocalTripoSR(
  './uploads/product.jpg',
  './output/model.glb'
);

// Generate from buffer
const imageBuffer = fs.readFileSync('./product.jpg');
const glbPath = await generateLocalTripoSR(
  imageBuffer,
  './output/model.glb'
);
```

---

## 📊 Performance

| Hardware | Generation Time |
|----------|----------------|
| CPU only | 20-30 seconds |
| NVIDIA GPU | 3-10 seconds |
| With CUDA | 0.5-2 seconds |

---

## 🎯 Integration with Your Asset System

Add to `backend/routes/assets.js`:

```javascript
import { generateLocalTripoSR } from '../lib/triposrLocal.js';

// In your generate-from-image endpoint:
router.post('/generate-from-image', async (req, res) => {
  try {
    const { imageUrl, name, userId } = req.body;
    
    // Generate 3D model (FREE!)
    const outputPath = path.join(__dirname, '../temp', `${Date.now()}.glb`);
    const glbPath = await generateLocalTripoSR(imageUrl, outputPath);
    
    // Upload to S3
    const glbBuffer = fs.readFileSync(glbPath);
    const s3Key = await uploadBufferToS3(glbBuffer, 'glb');
    
    // Create asset record
    const asset = new Asset({
      name,
      ownerUserId: userId,
      type: 'clothing',
      glbUrl: s3Key,
      status: 'ready'
    });
    await asset.save();
    
    res.json({ success: true, asset });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

---

## ❓ FAQ

### Is this really free?
**Yes!** TripoSR is open-source (MIT license). No API costs, no billing, ever.

### Do I need internet after setup?
**No!** After the initial download, everything runs locally.

### Can I use this commercially?
**Yes!** MIT license allows commercial use.

### What if Python is not installed?
Download Python 3.8+ from: https://www.python.org/downloads/  
Make sure to check "Add Python to PATH" during installation.

### Can I speed it up?
Yes! If you have an NVIDIA GPU:
1. Install CUDA Toolkit
2. Install PyTorch with CUDA support
3. Generation will be 5-10x faster

### What image formats are supported?
JPG, PNG, WebP - any format that PIL/Pillow can read.

---

## 🐛 Troubleshooting

### "Python not found"
1. Install Python from https://www.python.org/downloads/
2. Make sure "Add Python to PATH" is checked during installation
3. Restart your terminal

### "TripoSR not installed"
Run `setup-triposr.bat` first!

### "Git not found"
1. Install Git from https://git-scm.com/
2. Restart your terminal
3. Run setup again

### "Module not found" errors
Re-run the setup: `setup-triposr.bat`

### Generation is slow
- First run downloads model weights (~2GB), this is normal
- CPU generation takes 20-30 seconds
- For faster results, use a GPU with CUDA

---

## 🆚 Comparison: Free vs Paid Options

| Option | Cost | Speed | Quality | Setup |
|--------|------|-------|---------|-------|
| **TripoSR (Local)** | **FREE** | 10-30s | ⭐⭐⭐⭐ | 5 min |
| Meshy.ai | $20+/mo | 5-10s | ⭐⭐⭐⭐⭐ | 2 min |
| Replicate | $0.01/run | 5-15s | ⭐⭐⭐⭐ | 2 min |
| Hyper3D | Credits | 10-20s | ⭐⭐⭐⭐ | 2 min |

**TripoSR is the best choice if you want free, unlimited generations!**

---

## 📝 License

TripoSR is MIT licensed - free for commercial and personal use.

---

## 🎉 You're All Set!

Run `setup-triposr.bat` to get started!

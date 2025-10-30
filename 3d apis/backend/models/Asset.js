import mongoose from 'mongoose';

/**
 * Asset Schema for RPM-compatible wardrobe items
 * Requirement B.2: stores clothing/texture assets that can be applied to avatars
 */
const AssetSchema = new mongoose.Schema({
  ownerUserId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    default: null // null for public demo assets
  },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  source: { 
    type: String, 
    enum: ['rpm', 'uploaded', 'created-from-amazon'],
    required: true 
  },
  rpmAssetId: { type: String }, // ID returned by RPM Asset Manager (if exists)
  rpmAssetUrl: { type: String }, // RPM asset URL (GLB or texture pack)
  s3Url: { type: String }, // downloaded/processed asset stored in S3
  thumbnails: [{ type: String }], // S3 URLs for preview images
  status: { 
    type: String, 
    enum: ['pending', 'ready', 'failed'],
    default: 'pending'
  },
  metadata: { 
    type: mongoose.Schema.Types.Mixed, 
    default: {} 
    // Can store: targetNode, uvMapping, compatibleBodyTypes, etc.
  },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.models.Asset || mongoose.model('Asset', AssetSchema);

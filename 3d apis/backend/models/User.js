import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }, // passwordHash from bcrypt
  photo: { type: String }, // URL or base64 string (legacy)
  avatarGlbUrl: { type: String }, // legacy field
  outfitGlbUrl: { type: String }, // legacy field
  // RPM integration fields
  readyPlayerUserId: { type: String }, // RPM user id (guest or authorized)
  avatarUrl: { type: String }, // latest RPM avatar URL
  isGuest: { type: Boolean, default: false },
  tryOnImages: [{
    imageUrl: { type: String, required: true },
    productLink: { type: String },
    createdAt: { type: Date, default: Date.now }
  }],
  // New RPM avatar metadata (integrated from requirement B.1)
  avatar: {
    avatarId: { type: String }, // RPM avatar id (if returned)
    rpmUrl: { type: String },   // original RPM GLB URL
    s3Url: { type: String },    // copied GLB in S3 (we own the asset; avoids hotlinking)
    bodySize: { type: String }, // bodyType from RPM (e.g., "fit", "average")
    gender: { type: String },   // gender info
    skinTone: { type: String }, // skinTone from RPM
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} } // additional RPM metadata
  },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.models.User || mongoose.model('User', UserSchema);

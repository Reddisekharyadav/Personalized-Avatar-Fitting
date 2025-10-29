import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  photo: { type: String }, // URL or base64 string
  avatarGlbUrl: { type: String },
  outfitGlbUrl: { type: String },
  tryOnImages: [{
    imageUrl: { type: String, required: true },
    productLink: { type: String },
    createdAt: { type: Date, default: Date.now }
  }],
});

export default mongoose.models.User || mongoose.model('User', UserSchema);

import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

const AvatarSchema = new mongoose.Schema({
  avatarId: { type: String, default: () => uuidv4(), index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  avatarUrl: { type: String, required: true },
  bodyShape: { type: mongoose.Schema.Types.Mixed },
  skinTone: { type: String },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.models.Avatar || mongoose.model('Avatar', AvatarSchema);

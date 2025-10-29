import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

const WardrobeItemSchema = new mongoose.Schema({
  itemId: { type: String, default: () => uuidv4(), index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  itemName: { type: String, required: true },
  itemType: { type: String },
  itemUrl: { type: String, required: true },
  metadata: { type: mongoose.Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.models.WardrobeItem || mongoose.model('WardrobeItem', WardrobeItemSchema);

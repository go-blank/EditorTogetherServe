
import mongoose from "mongoose";

const documentSchema = new mongoose.Schema({
  _id: { type: String, required: true },  // 直接使用字符串作为 ID，和 Hocuspocus 的 documentName 对应
  workspace_id: { type: String, required: true, index: true },
  title: { type: String, required: true },
  status: {
    type: String,
    enum: ['active', 'archived', 'deleted'],
    default: 'active'
  },
  yjs_data: {
    type: mongoose.Schema.Types.Buffer,  // 存储 Yjs 的二进制数据
    required: false
  },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

// documentSchema.pre('save', function(next) {
//   this.updated_at = new Date();
//   next();
// });

// documentSchema.pre('findOneAndUpdate', function(next) {
//   this.set({ updated_at: new Date() });
//   next();
// });

const Document = mongoose.model('Document', documentSchema);
export default Document; 
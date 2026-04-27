
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
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

// 注意：不再需要 yjs_snapshot 字段，Hocuspocus 的 MongoDB 扩展会自动在 collection 中存储 Yjs 数据

documentSchema.pre('save', function(next) {
  this.updated_at = Date.now();
  next();
});

const Document= mongoose.model('Document', documentSchema);
export default Document; 
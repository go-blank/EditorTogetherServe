
import mongoose from "mongoose";

const documentSchema = new mongoose.Schema({
  _id: { type: String, required: true },  // 直接使用字符串作为 ID，和 Hocuspocus 的 documentName 对应
  workspace_id: { type: String, required: true, index: true },
  title: { type: String, required: true },
  created_by_name: { type: String, required: true },
  updated_by_name: { type: String },
  created_by: { type: String, required: true, index: true },
  updated_by: { type: String, index: true },
  status: {
    type: String,
    enum: ['active', 'archived', 'deleted'],
    default: 'active'
  },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
  yjs_data: {
    type: mongoose.Schema.Types.Buffer,  // 存储 Yjs 的二进制数据
    required: false
  },

});

const Document = mongoose.model('Document', documentSchema);
export default Document; 
import mongoose from "mongoose";

const documentMemberSchema = new mongoose.Schema({
  document_id: { 
    type: String,                          // 对应 Document 的 _id (String 类型)
    ref: 'Document', 
    required: true,
    index: true                            // 添加索引，便于按文档查询成员
  },
  user_id: { 
    type: mongoose.Schema.Types.ObjectId,  // 对应 User 的 _id
    ref: 'User', 
    required: true,
    index: true                            // 添加索引，便于按用户查询文档列表
  },
  joined_at: { 
    type: Date, 
    default: Date.now 
  }
});

// 联合唯一索引：防止同一个用户被重复添加到同一个文档
documentMemberSchema.index({ document_id: 1, user_id: 1 }, { unique: true });

const DocumentMember = mongoose.model('DocumentMember', documentMemberSchema);
export default DocumentMember; 
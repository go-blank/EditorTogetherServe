import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  docId: {
    type: String,
    required: true
  },
  docName: {
    type: String,
    required: true
  },
  action: {
    type: String,
    enum: ['Rdelete', 'Cdelete', 'restore'],
    required: true
  },
  operatorName: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  isRead: {
    type: Boolean,
    default: false
  }
});

// 复合索引：按用户查询并按时间倒序
notificationSchema.index({ userId: 1, createdAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;

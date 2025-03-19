const mongoose = require('mongoose');

const newsSchema = new mongoose.Schema({
  topic: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Topic',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  url: {
    type: String,
    required: true,
    trim: true
  },
  source: {
    type: String,
    required: true,
    trim: true
  },
  publishDate: {
    type: Date,
    required: true
  },
  content: {
    type: String,
    required: true
  },
  summary: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// 创建复合索引
newsSchema.index({ topic: 1, url: 1 }, { unique: true });
newsSchema.index({ publishDate: -1 });

// 自动删除7天前的数据
newsSchema.index({ createdAt: 1 }, { 
  expireAfterSeconds: 7 * 24 * 60 * 60 
});

module.exports = mongoose.model('News', newsSchema); 
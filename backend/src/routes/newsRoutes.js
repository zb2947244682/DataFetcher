const express = require('express');
const router = express.Router();
const News = require('../models/News');
const logger = require('../utils/logger').logger;

// 获取所有新闻
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, topic } = req.query;
    const query = topic ? { topic } : {};
    
    const news = await News.find(query)
      .sort({ publishDate: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const count = await News.countDocuments(query);

    res.json({
      news,
      totalPages: Math.ceil(count / limit),
      currentPage: page
    });
  } catch (error) {
    logger.error('Error fetching news:', error);
    res.status(500).json({ message: 'Error fetching news' });
  }
});

// 获取单个新闻详情
router.get('/:id', async (req, res) => {
  try {
    const news = await News.findById(req.params.id);
    if (!news) {
      return res.status(404).json({ message: 'News not found' });
    }
    res.json(news);
  } catch (error) {
    logger.error('Error fetching news detail:', error);
    res.status(500).json({ message: 'Error fetching news detail' });
  }
});

module.exports = router; 
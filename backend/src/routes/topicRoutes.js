const express = require('express');
const Topic = require('../models/Topic');
const News = require('../models/News');
const aiService = require('../services/aiService');
const cronService = require('../services/cronService');
const { setupLogger } = require('../utils/logger');

const router = express.Router();
const logger = setupLogger();

// 获取所有主题
router.get('/', async (req, res) => {
  try {
    const topics = await Topic.find().sort({ createdAt: -1 });
    res.json(topics);
  } catch (error) {
    logger.error('获取主题列表时出错:', error);
    res.status(500).json({ error: '获取主题列表失败' });
  }
});

// 创建新主题
router.post('/', async (req, res) => {
  try {
    const { title, description } = req.body;

    // 检查是否已存在相同标题的主题
    const existingTopic = await Topic.findOne({ title });
    if (existingTopic) {
      return res.status(400).json({ error: '该主题标题已存在' });
    }

    // 创建新主题
    const topic = new Topic({ title, description });
    
    // 生成关键词
    const keywords = await aiService.generateKeywords(topic);
    topic.keywords = keywords;
    
    await topic.save();
    
    // 立即开始爬取数据
    cronService.updateTopicNews(topic).catch(error => {
      logger.error(`新主题首次爬取数据时出错:`, error);
    });

    res.status(201).json(topic);
  } catch (error) {
    logger.error('创建主题时出错:', error);
    res.status(500).json({ error: '创建主题失败' });
  }
});

// 获取特定主题的新闻
router.get('/:topicId/news', async (req, res) => {
  try {
    const { topicId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    // 验证主题是否存在
    const topic = await Topic.findById(topicId);
    if (!topic) {
      return res.status(404).json({ error: '主题不存在' });
    }

    // 获取该主题的新闻
    const news = await News.find({ topic: topicId })
      .sort({ publishDate: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .exec();

    const total = await News.countDocuments({ topic: topicId });

    res.json({
      news,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total
    });
  } catch (error) {
    logger.error('获取主题新闻失败:', error);
    res.status(500).json({ error: '获取主题新闻失败' });
  }
});

// 手动触发特定主题的数据爬取
router.post('/:id/crawl', async (req, res) => {
  try {
    const { id } = req.params;
    const topic = await Topic.findById(id);
    
    if (!topic) {
      return res.status(404).json({ error: '主题不存在' });
    }

    // 异步执行爬取任务
    cronService.updateTopicNews(topic).catch(error => {
      logger.error(`手动触发主题爬取数据时出错:`, error);
    });

    res.json({ message: '数据爬取任务已启动' });
  } catch (error) {
    logger.error('触发数据爬取时出错:', error);
    res.status(500).json({ error: '触发数据爬取失败' });
  }
});

// 获取特定主题的网页列表
router.get('/:topicId/webpages', async (req, res) => {
  try {
    const { topicId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    // 验证主题是否存在
    const topic = await Topic.findById(topicId);
    if (!topic) {
      return res.status(404).json({ error: '主题不存在' });
    }

    // 获取该主题的网页列表
    const webpages = await News.find({ topic: topicId })
      .select('url source publishDate title')
      .sort({ publishDate: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .exec();

    const total = await News.countDocuments({ topic: topicId });

    res.json({
      webpages,
      total,
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    logger.error('获取主题网页列表失败:', error);
    res.status(500).json({ error: '获取主题网页列表失败' });
  }
});

module.exports = router; 
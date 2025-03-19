const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const { setupLogger } = require('../utils/logger');

const router = express.Router();
const logger = setupLogger();

// 获取系统状态
router.get('/', (req, res) => {
  res.json({
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

// 获取最新日志
router.get('/logs', async (req, res) => {
  try {
    const logFile = path.join(__dirname, '../../logs/combined.log');
    const { lines = 100 } = req.query;

    const data = await fs.readFile(logFile, 'utf8');
    const logLines = data.split('\n')
      .filter(line => line.trim())
      .slice(-lines)
      .map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return { message: line, timestamp: new Date().toISOString() };
        }
      });

    res.json(logLines);
  } catch (error) {
    logger.error('读取日志文件时出错:', error);
    res.status(500).json({ error: '获取日志失败' });
  }
});

module.exports = router; 
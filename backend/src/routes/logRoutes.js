const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const { setupLogger, clearLogCache } = require('../utils/logger');

const router = express.Router();
const logger = setupLogger();

// 清除日志文件
router.post('/clear', async (req, res) => {
  try {
    const logsDir = path.join(__dirname, '../../logs');
    const files = await fs.readdir(logsDir);
    
    for (const file of files) {
      if (file.endsWith('.log')) {
        const filePath = path.join(logsDir, file);
        // 完全删除文件而不是清空
        await fs.unlink(filePath);
        // 重新创建空文件
        await fs.writeFile(filePath, '', 'utf8');
      }
    }
    
    // 清除内存中的日志缓存
    clearLogCache();
    
    res.json({ message: '日志已清除' });
  } catch (error) {
    logger.error('清除日志文件时出错:', error);
    res.status(500).json({ error: '清除日志失败' });
  }
});

module.exports = router; 
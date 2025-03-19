require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const cron = require('node-cron');
const { setupLogger } = require('./utils/logger');
const { initializeCronJobs } = require('./services/cronService');
const topicRoutes = require('./routes/topicRoutes');
const newsRoutes = require('./routes/newsRoutes');
const statusRoutes = require('./routes/statusRoutes');
const logRoutes = require('./routes/logRoutes');

const app = express();
const logger = setupLogger();

// 中间件
app.use(cors());
app.use(express.json());

// 连接数据库
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/news_aggregator')
  .then(() => {
    logger.info('Successfully connected to MongoDB.');
  })
  .catch((error) => {
    logger.error('Error connecting to MongoDB:', error);
  });

// 路由
app.use('/api/topics', topicRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/status', statusRoutes);
app.use('/api/logs', logRoutes);

// 错误处理中间件
app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(500).send('Something broke!');
});

// 初始化定时任务
initializeCronJobs();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
}); 
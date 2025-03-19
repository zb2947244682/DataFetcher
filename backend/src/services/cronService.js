const cron = require('node-cron');
const Topic = require('../models/Topic');
const News = require('../models/News');
const crawlerService = require('./crawlerService');
const aiService = require('./aiService');
const { setupLogger, addTopicCrawlLog, clearTopicCrawlLogs } = require('../utils/logger');

const logger = setupLogger();

class CronService {
  constructor() {
    this.isRunning = false;
  }

  initializeCronJobs() {
    // 每天早上9点执行
    cron.schedule('0 9 * * *', async () => {
      await this.runDailyUpdate();
    });

    logger.info('定时任务已初始化');
  }

  async runDailyUpdate() {
    if (this.isRunning) {
      logger.warn('上一次更新任务尚未完成，跳过本次更新');
      return;
    }

    this.isRunning = true;
    logger.info('开始执行每日更新任务');

    try {
      const topics = await Topic.find();
      
      for (const topic of topics) {
        await this.updateTopicNews(topic);
      }

      // 清理7天前的数据（通过MongoDB TTL索引自动完成）
      logger.info('每日更新任务完成');
    } catch (error) {
      logger.error('执行每日更新任务时出错:', error);
    } finally {
      this.isRunning = false;
    }
  }

  async updateTopicNews(topic) {
    logger.info(`开始更新主题 "${topic.title}" 的新闻`);
    addTopicCrawlLog(topic._id, 'info', `开始更新主题 "${topic.title}" 的新闻`);

    try {
      // 清除之前的日志
      clearTopicCrawlLogs(topic._id);

      const crawler = new crawlerService();
      const newsItems = await crawler.fetchNewsForTopic(topic);
      
      addTopicCrawlLog(topic._id, 'info', `成功获取 ${newsItems.length} 条新闻`);

      for (const item of newsItems) {
        try {
          // 使用AI服务生成摘要
          addTopicCrawlLog(topic._id, 'info', `正在处理新闻: ${item.title}`);
          
          const summary = await aiService.generateSummary(item.content);
          const news = new News({
            topic: topic._id,
            title: item.title,
            url: item.url,
            source: item.source,
            publishDate: item.publishDate,
            content: item.content,
            summary: summary
          });

          await news.save();
          addTopicCrawlLog(topic._id, 'info', `成功保存新闻: ${item.title}`);
        } catch (error) {
          logger.error(`处理新闻时出错: ${item.url}`, error);
          addTopicCrawlLog(topic._id, 'error', `处理新闻失败: ${item.url} - ${error.message}`);
          continue;
        }
      }

      addTopicCrawlLog(topic._id, 'info', `主题 "${topic.title}" 的新闻更新完成`);
      logger.info(`主题 "${topic.title}" 的新闻更新完成`);
    } catch (error) {
      logger.error(`更新主题 "${topic.title}" 的新闻时出错:`, error);
      addTopicCrawlLog(topic._id, 'error', `更新失败: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new CronService(); 
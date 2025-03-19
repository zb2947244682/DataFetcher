const cron = require('node-cron');
const Topic = require('../models/Topic');
const News = require('../models/News');
const crawlerService = require('./crawlerService');
const aiService = require('./aiService');
const { setupLogger } = require('../utils/logger');

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
    logger.info(`关键词: ${topic.keywords.join(', ')}`);

    try {
      // 爬取新闻
      logger.info(`开始爬取新闻数据...`);
      const newsItems = [];
      
      for (const keyword of topic.keywords) {
        logger.info(`正在搜索关键词: ${keyword}`);
        const items = await crawlerService.searchNews(keyword);
        logger.info(`找到 ${items.length} 条相关新闻`);
        newsItems.push(...items);
      }

      logger.info(`共爬取到 ${newsItems.length} 条新闻，开始处理...`);

      // 处理每条新闻
      for (const [index, item] of newsItems.entries()) {
        try {
          logger.info(`处理第 ${index + 1}/${newsItems.length} 条新闻: ${item.title}`);
          
          // 检查新闻是否已存在
          const existingNews = await News.findOne({
            topic: topic._id,
            url: item.url
          });

          if (existingNews) {
            logger.info(`新闻已存在，跳过: ${item.url}`);
            continue;
          }

          // 获取新闻内容
          logger.info(`获取新闻内容: ${item.url}`);
          const content = await crawlerService.getNewsContent(item.url);
          
          if (!content) {
            logger.warn(`无法获取新闻内容，跳过: ${item.url}`);
            continue;
          }

          // 生成摘要
          logger.info(`生成新闻摘要...`);
          const summary = await aiService.generateSummary(content);

          // 保存新闻
          const news = new News({
            topic: topic._id,
            title: item.title,
            url: item.url,
            source: item.source,
            publishDate: item.publishDate,
            content: content,
            summary: summary
          });

          await news.save();
          logger.info(`成功保存新闻: ${item.title}`);
        } catch (error) {
          logger.error(`处理新闻时出错: ${item.url}`, error);
          continue;
        }
      }

      logger.info(`主题 "${topic.title}" 的新闻更新完成`);
    } catch (error) {
      logger.error(`更新主题 "${topic.title}" 的新闻时出错:`, error);
      throw error;
    }
  }
}

module.exports = new CronService(); 
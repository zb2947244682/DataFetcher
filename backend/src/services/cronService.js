const cron = require('node-cron');
const Topic = require('../models/Topic');
const News = require('../models/News');
const CrawlerService = require('./crawlerService');
const AIService = require('./aiService');
const { setupLogger, addTopicCrawlLog, clearTopicCrawlLogs } = require('../utils/logger');

const logger = setupLogger();
const aiService = new AIService();

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
    
    // 清除之前的日志
    clearTopicCrawlLogs(topic._id);
    
    // 添加开始日志
    addTopicCrawlLog(topic._id, 'info', `开始更新主题 "${topic.title}" 的新闻`);

    try {
      const crawler = new CrawlerService();
      
      // 检查关键词
      if (!topic.keywords || topic.keywords.length === 0) {
        const errorMsg = '主题没有关键词，尝试重新生成关键词';
        logger.warn(errorMsg);
        addTopicCrawlLog(topic._id, 'warn', errorMsg);
        
        // 重新生成关键词
        topic.keywords = await aiService.generateKeywords(topic);
        await Topic.findByIdAndUpdate(topic._id, { keywords: topic.keywords });
        
        addTopicCrawlLog(topic._id, 'info', `已生成新的关键词: ${topic.keywords.join(', ')}`);
      }

      // 记录使用的关键词
      addTopicCrawlLog(topic._id, 'info', `使用以下关键词进行搜索: ${topic.keywords.join(', ')}`);

      // 为每个关键词抓取新闻
      let allNewsItems = [];
      for (const keyword of topic.keywords) {
        addTopicCrawlLog(topic._id, 'info', `正在搜索关键词: ${keyword}`);
        try {
          const newsItems = await crawler.fetchNewsForTopic(topic, keyword);
          addTopicCrawlLog(topic._id, 'info', `关键词 "${keyword}" 找到 ${newsItems.length} 条新闻`);
          allNewsItems.push(...newsItems);
        } catch (error) {
          const errorMsg = `搜索关键词 "${keyword}" 时出错: ${error.message}`;
          logger.error(errorMsg);
          addTopicCrawlLog(topic._id, 'error', errorMsg);
        }
      }

      // 去重
      const uniqueUrls = new Set();
      allNewsItems = allNewsItems.filter(item => {
        if (uniqueUrls.has(item.url)) {
          return false;
        }
        uniqueUrls.add(item.url);
        return true;
      });

      addTopicCrawlLog(topic._id, 'info', `去重后共获取到 ${allNewsItems.length} 条唯一新闻`);

      // 处理每条新闻
      for (const item of allNewsItems) {
        try {
          addTopicCrawlLog(topic._id, 'info', `正在处理新闻: ${item.title}`);
          
          // 检查新闻是否已存在
          const existingNews = await News.findOne({ topic: topic._id, url: item.url });
          if (existingNews) {
            addTopicCrawlLog(topic._id, 'info', `新闻已存在，跳过: ${item.title}`);
            continue;
          }

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
          const errorMessage = `处理新闻失败: ${item.url}\n错误详情: ${error.message}`;
          logger.error(errorMessage);
          addTopicCrawlLog(topic._id, 'error', errorMessage);
          continue;
        }
      }

      const successMsg = `主题 "${topic.title}" 的新闻更新完成，共处理 ${allNewsItems.length} 条新闻`;
      addTopicCrawlLog(topic._id, 'info', successMsg);
      logger.info(successMsg);
    } catch (error) {
      const errorMessage = `更新主题 "${topic.title}" 的新闻时出错: ${error.message}`;
      logger.error(errorMessage);
      addTopicCrawlLog(topic._id, 'error', errorMessage);
      throw error;
    }
  }
}

module.exports = new CronService(); 
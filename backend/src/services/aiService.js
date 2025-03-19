const axios = require('axios');
const { setupLogger } = require('../utils/logger');

const logger = setupLogger();

class AIService {
  constructor() {
    this.apiKey = process.env.AI_MODEL_API_KEY;
    this.apiEndpoint = process.env.AI_MODEL_ENDPOINT || 'https://api.gemini.google.com/v1/models/gemini-pro:generateContent';
  }

  async generateKeywords(topic) {
    try {
      const prompt = `
        根据以下主题和描述，生成5-10个相关的搜索关键词：
        主题：${topic.title}
        描述：${topic.description}
        
        要求：
        1. 关键词应该与主题高度相关
        2. 包含不同的表达方式
        3. 考虑最新的发展趋势
        4. 返回JSON格式数组
      `;

      const response = await this.callAI(prompt);
      const keywords = this.parseKeywords(response);
      
      logger.info(`为主题 "${topic.title}" 生成关键词:`, keywords);
      return keywords;
    } catch (error) {
      logger.error('生成关键词时出错:', error);
      return [];
    }
  }

  async summarizeNews(newsItems) {
    try {
      const prompt = `
        分析以下新闻内容，生成简洁的总结：
        ${newsItems.map(item => `
          标题：${item.title}
          内容：${item.content}
          来源：${item.source}
          日期：${item.publishDate}
        `).join('\n\n')}
        
        要求：
        1. 每条新闻生成一行简短总结
        2. 格式：YYYY-MM-DD: 总结内容
        3. 保持客观性
        4. 返回JSON格式数组
      `;

      const response = await this.callAI(prompt);
      const summaries = this.parseSummaries(response);
      
      logger.info(`生成新闻总结 ${summaries.length} 条`);
      return summaries;
    } catch (error) {
      logger.error('生成新闻总结时出错:', error);
      return [];
    }
  }

  async callAI(prompt) {
    try {
      const response = await axios.post(
        this.apiEndpoint,
        {
          contents: [{
            parts: [{
              text: prompt
            }]
          }]
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      );

      return response.data.candidates[0].content.parts[0].text;
    } catch (error) {
      logger.error('调用AI API时出错:', error);
      throw error;
    }
  }

  parseKeywords(response) {
    try {
      // 尝试直接解析JSON
      return JSON.parse(response);
    } catch (error) {
      // 如果不是JSON格式，尝试提取关键词
      const keywords = response
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
      return keywords;
    }
  }

  parseSummaries(response) {
    try {
      // 尝试直接解析JSON
      return JSON.parse(response);
    } catch (error) {
      // 如果不是JSON格式，尝试按行分割
      const summaries = response
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0 && line.match(/^\d{4}-\d{2}-\d{2}:/));
      return summaries;
    }
  }
}

module.exports = new AIService(); 
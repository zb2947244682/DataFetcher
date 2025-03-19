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
      // 如果没有配置API，使用默认关键词
      if (!this.apiKey) {
        logger.warn('未配置AI API密钥，使用默认关键词');
        return [topic.title, ...topic.title.split(' ')];
      }

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
      return keywords.length > 0 ? keywords : [topic.title];
    } catch (error) {
      logger.error('生成关键词时出错:', error);
      // 如果生成失败，至少返回主题标题作为关键词
      return [topic.title];
    }
  }

  async generateSummary(content) {
    try {
      if (!this.apiKey) {
        logger.warn('未配置AI API密钥，返回原始内容的前300个字符作为摘要');
        return content.substring(0, 300) + '...';
      }

      const prompt = `
        请为以下内容生成一个简洁的中文摘要（200字以内）：
        ${content}
      `;

      const response = await this.callAI(prompt);
      return response || content.substring(0, 300) + '...';
    } catch (error) {
      logger.error('生成摘要时出错:', error);
      return content.substring(0, 300) + '...';
    }
  }

  async callAI(prompt) {
    try {
      if (!this.apiKey) {
        throw new Error('未配置AI API密钥');
      }

      const response = await axios.post(this.apiEndpoint, {
        prompt: {
          text: prompt
        }
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      return response.data.candidates[0].content.parts[0].text;
    } catch (error) {
      logger.error('调用AI API时出错:', error);
      throw error;
    }
  }

  parseKeywords(response) {
    try {
      // 尝试解析JSON响应
      const keywords = JSON.parse(response);
      if (Array.isArray(keywords)) {
        return keywords.filter(k => typeof k === 'string' && k.trim());
      }
      
      // 如果不是数组，尝试从文本中提取关键词
      return response
        .split(/[,，\n]/)
        .map(k => k.trim())
        .filter(k => k && k.length >= 2);
    } catch (error) {
      logger.error('解析关键词时出错:', error);
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
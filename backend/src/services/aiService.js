const axios = require('axios');
const { setupLogger } = require('../utils/logger');

const logger = setupLogger();

class AIService {
  constructor() {
    this.apiKey = process.env.AI_MODEL_API_KEY || 'sk-b687a6eed73941f294e1b7a5cf4aa2e9';
    this.apiEndpoint = process.env.AI_MODEL_ENDPOINT || 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
  }

  async callAI(prompt, systemPrompt = '你是一个专业的新闻分析助手。') {
    try {
      if (!this.apiKey) {
        throw new Error('未配置AI API密钥');
      }

      const response = await axios.post(
        this.apiEndpoint,
        {
          model: 'qwen-plus',
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user',
              content: prompt
            }
          ]
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data && response.data.choices && response.data.choices[0] && response.data.choices[0].message) {
        return response.data.choices[0].message.content.trim();
      }

      throw new Error('AI响应格式错误');
    } catch (error) {
      logger.error('调用AI API时出错:', error);
      throw error;
    }
  }

  async generateKeywords(topic) {
    try {
      if (!this.apiKey) {
        logger.warn('未配置AI API密钥，返回默认关键词');
        return [topic.title];
      }

      const systemPrompt = '你是一个专业的新闻关键词生成助手。请生成准确、相关的搜索关键词。';
      const prompt = `
        请为以下主题生成3-5个相关的搜索关键词（每个关键词不超过10个字）：
        主题：${topic.title}
        描述：${topic.description}
        
        要求：
        1. 关键词要简洁有力
        2. 与主题高度相关
        3. 适合新闻搜索
        4. 每个关键词独占一行
      `;

      const response = await this.callAI(prompt, systemPrompt);
      const keywords = response
        .split(/[\n]/)
        .map(k => k.trim())
        .filter(k => k && k.length <= 10);

      return keywords.length > 0 ? keywords : [topic.title];
    } catch (error) {
      logger.error('生成关键词时出错:', error);
      return [topic.title];
    }
  }

  async generateSummary(content) {
    try {
      if (!this.apiKey) {
        logger.warn('未配置AI API密钥，返回原始内容的前300个字符作为摘要');
        return content.substring(0, 300) + '...';
      }

      const systemPrompt = '你是一个专业的新闻摘要生成助手。请生成准确、客观的新闻摘要。';
      const prompt = `
        请为以下新闻内容生成一个简洁的中文摘要（200字以内）：
        ${content}
        
        要求：
        1. 保持客观性
        2. 突出重点信息
        3. 语言简洁清晰
        4. 不要包含个人观点
      `;

      const response = await this.callAI(prompt, systemPrompt);
      return response || content.substring(0, 300) + '...';
    } catch (error) {
      logger.error('生成摘要时出错:', error);
      return content.substring(0, 300) + '...';
    }
  }

  async summarizeNews(newsItems) {
    try {
      const systemPrompt = '你是一个专业的新闻分析助手。请对新闻进行分析和总结。';
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
        4. 突出重要信息
      `;

      const response = await this.callAI(prompt, systemPrompt);
      const summaries = response
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0 && line.match(/^\d{4}-\d{2}-\d{2}:/));
      
      logger.info(`生成新闻总结 ${summaries.length} 条`);
      return summaries;
    } catch (error) {
      logger.error('生成新闻总结时出错:', error);
      return [];
    }
  }
}

module.exports = AIService; 
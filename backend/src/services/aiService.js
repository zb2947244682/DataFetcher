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
        
        // 预定义的中英文关键词映射
        const keywordMappings = {
          '人工智能': ['artificial intelligence', 'AI'],
          '大模型': ['large language model', 'LLM'],
          '机器学习': ['machine learning', 'ML'],
          '深度学习': ['deep learning', 'DL'],
          'GPT': ['GPT', 'ChatGPT'],
          '神经网络': ['neural network', 'NN'],
          '自然语言处理': ['natural language processing', 'NLP'],
          '计算机视觉': ['computer vision', 'CV'],
          '强化学习': ['reinforcement learning', 'RL'],
          '语音识别': ['speech recognition', 'ASR']
        };

        // 从标题和描述中提取中文关键词
        const chineseWords = new Set([
          ...topic.title.split(/[\s,，、]+/),
          ...topic.description.split(/[\s,，、]+/).filter(word => word.length >= 2)
        ]);

        // 生成中英文关键词
        const keywords = [];
        for (const word of chineseWords) {
          keywords.push(word); // 添加中文关键词
          // 如果有对应的英文关键词，也添加
          if (keywordMappings[word]) {
            keywords.push(...keywordMappings[word]);
          }
        }

        // 添加一些通用的AI相关英文关键词
        if (topic.title.includes('人工智能') || topic.title.includes('AI')) {
          keywords.push('artificial intelligence', 'AI', 'machine learning', 'deep learning');
        }
        if (topic.title.includes('大模型') || topic.title.includes('LLM')) {
          keywords.push('large language model', 'LLM', 'GPT', 'foundation model');
        }

        const uniqueKeywords = [...new Set(keywords)];
        logger.info(`使用默认方法生成关键词: ${uniqueKeywords.join(', ')}`);
        return uniqueKeywords;
      }

      const prompt = `
        根据以下主题和描述，生成中英文搜索关键词（每个概念都要包含中英文表达）：
        主题：${topic.title}
        描述：${topic.description}
        
        要求：
        1. 关键词应该与主题高度相关
        2. 包含中英文对照
        3. 考虑最新的发展趋势
        4. 包含通用缩写（如AI、ML、LLM等）
        5. 返回JSON格式数组
      `;

      const response = await this.callAI(prompt);
      const keywords = this.parseKeywords(response);
      
      logger.info(`为主题 "${topic.title}" 生成关键词:`, keywords);
      return keywords.length > 0 ? keywords : [topic.title, 'AI', 'artificial intelligence'];
    } catch (error) {
      logger.error('生成关键词时出错:', error);
      // 如果生成失败，返回基本的中英文关键词
      return [topic.title, 'AI', 'artificial intelligence'];
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
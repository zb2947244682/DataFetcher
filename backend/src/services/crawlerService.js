const axios = require('axios');
const cheerio = require('cheerio');
const { setupLogger } = require('../utils/logger');

const logger = setupLogger();

class CrawlerService {
  constructor() {
    this.sources = [
      {
        name: 'TechCrunch',
        baseUrl: 'https://techcrunch.com/search/',
        searchParam: 'q',
        articleSelector: 'article',
        titleSelector: 'h2',
        linkSelector: 'h2 a',
        dateSelector: 'time'
      },
      {
        name: 'TheVerge',
        baseUrl: 'https://www.theverge.com/search',
        searchParam: 'q',
        articleSelector: 'div.duet--article--standard',
        titleSelector: 'h2',
        linkSelector: 'h2 a',
        dateSelector: 'time'
      },
      {
        name: 'Engadget',
        baseUrl: 'https://www.engadget.com/search/',
        searchParam: 'search_query',
        articleSelector: 'article',
        titleSelector: 'h2',
        linkSelector: 'h2 a',
        dateSelector: 'time'
      }
    ];

    // 配置 axios
    this.configureAxios();
  }

  configureAxios() {
    // 设置默认超时
    axios.defaults.timeout = 30000;

    // 添加请求拦截器，记录请求日志
    axios.interceptors.request.use(config => {
      logger.info(`发送请求: ${config.method.toUpperCase()} ${config.url}`);
      if (config.params) {
        logger.info(`请求参数:`, config.params);
      }
      return config;
    }, error => {
      logger.error('请求发送失败:', error);
      return Promise.reject(error);
    });

    // 添加响应拦截器，记录响应日志
    axios.interceptors.response.use(response => {
      logger.info(`收到响应: ${response.status} ${response.statusText}`);
      return response;
    }, error => {
      if (error.response) {
        logger.error(`请求失败: ${error.response.status} ${error.response.statusText}`);
      } else if (error.request) {
        logger.error('未收到响应:', error.message);
      } else {
        logger.error('请求配置错误:', error.message);
      }
      return Promise.reject(error);
    });
  }

  async crawlAllSources(topic, keywords) {
    logger.info(`开始为主题 "${topic.title}" 爬取数据`);
    logger.info(`使用关键词: ${keywords.join(', ')}`);
    
    const allResults = [];
    const errors = [];

    for (const source of this.sources) {
      try {
        logger.info(`开始从 ${source.name} 爬取数据`);
        const results = await this.crawlSource(source, keywords);
        logger.info(`从 ${source.name} 成功爬取 ${results.length} 条数据`);
        allResults.push(...results);
      } catch (error) {
        const errorMessage = `从 ${source.name} 爬取数据失败: ${error.message}`;
        logger.error(errorMessage);
        errors.push(errorMessage);
      }
    }

    logger.info(`爬取完成，共获取 ${allResults.length} 条数据`);
    if (errors.length > 0) {
      logger.warn(`爬取过程中发生 ${errors.length} 个错误:`, errors);
    }

    return allResults;
  }

  async crawlSource(source, keywords) {
    const results = [];
    
    for (const keyword of keywords) {
      logger.info(`从 ${source.name} 搜索关键词: ${keyword}`);
      
      try {
        const url = this.buildSearchUrl(source, keyword);
        logger.info(`访问URL: ${url}`);
        
        const response = await axios.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });

        const $ = cheerio.load(response.data);
        logger.info(`成功加载页面，开始解析数据`);
        
        const articles = $(source.articleSelector);
        logger.info(`找到 ${articles.length} 篇文章`);

        articles.each((i, element) => {
          if (i >= 20) return false; // 限制每个关键词最多20条

          try {
            const $element = $(element);
            const title = $element.find(source.titleSelector).text().trim();
            const link = $element.find(source.linkSelector).attr('href');
            const dateStr = $element.find(source.dateSelector).attr('datetime') || 
                          $element.find(source.dateSelector).text().trim();
            
            if (title && link) {
              results.push({
                title,
                url: link.startsWith('http') ? link : `${new URL(source.baseUrl).origin}${link}`,
                source: source.name,
                publishDate: new Date(dateStr || Date.now()),
                keyword
              });
              logger.info(`解析文章: ${title}`);
            }
          } catch (error) {
            logger.error(`解析文章时出错:`, error);
          }
        });
      } catch (error) {
        logger.error(`搜索关键词 "${keyword}" 时出错:`, error);
      }
    }

    return results;
  }

  async getNewsContent(url) {
    try {
      logger.info(`获取文章内容: ${url}`);
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });

      const $ = cheerio.load(response.data);
      
      // 移除不需要的元素
      $('script, style, nav, header, footer, .ads, .related-articles, .social-share').remove();
      
      // 尝试不同的选择器来找到文章内容
      const selectors = [
        'article',
        '.article-content',
        '.post-content',
        '.entry-content',
        'main',
        '.content'
      ];

      let content = '';
      for (const selector of selectors) {
        const element = $(selector);
        if (element.length > 0) {
          content = element.text().trim();
          logger.info(`使用选择器 "${selector}" 成功提取内容`);
          break;
        }
      }

      if (!content) {
        logger.warn(`无法找到文章内容，将使用整个页面内容`);
        content = $('body').text().trim();
      }

      // 清理内容
      content = content
        .replace(/\s+/g, ' ')
        .replace(/\n+/g, '\n')
        .trim();

      logger.info(`成功获取文章内容，长度: ${content.length} 字符`);
      return content;
    } catch (error) {
      logger.error(`获取文章内容失败: ${url}`, error);
      return null;
    }
  }

  buildSearchUrl(source, keyword) {
    const searchUrl = new URL(source.baseUrl);
    searchUrl.searchParams.set(source.searchParam, keyword);
    return searchUrl.toString();
  }

  async fetchNewsForTopic(topic) {
    logger.info(`开始为主题 "${topic.title}" 抓取新闻`);
    
    try {
      // 使用主题的关键词进行搜索
      const newsItems = await this.crawlAllSources(topic, topic.keywords);
      
      // 获取每篇新闻的详细内容
      const enrichedNewsItems = [];
      for (const item of newsItems) {
        try {
          logger.info(`获取新闻内容: ${item.title}`);
          const content = await this.getNewsContent(item.url);
          if (content) {
            enrichedNewsItems.push({
              ...item,
              content
            });
          }
        } catch (error) {
          logger.error(`获取新闻内容失败: ${item.url}`, error);
        }
      }

      // 去重，只保留唯一的URL
      const uniqueNewsItems = Array.from(
        new Map(enrichedNewsItems.map(item => [item.url, item])).values()
      );

      logger.info(`成功获取 ${uniqueNewsItems.length} 条唯一新闻`);
      return uniqueNewsItems;
    } catch (error) {
      logger.error(`抓取新闻失败: ${error.message}`);
      throw error;
    }
  }
}

module.exports = CrawlerService; 
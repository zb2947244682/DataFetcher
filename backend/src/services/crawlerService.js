const puppeteer = require('puppeteer');
const { setupLogger, addTopicCrawlLog } = require('../utils/logger');

const logger = setupLogger();

class CrawlerService {
  constructor() {
    this.sources = {
      baidu: {
        name: 'Baidu',
        searchUrl: 'https://www.baidu.com/s',
        searchParam: 'wd',
        selector: '.result.c-container',
        titleSelector: 'h3',
        linkSelector: 'h3 a',
        dateSelector: '.c-abstract span:last-child',
        waitForSelector: '.result.c-container h3'
      },
      sogou: {
        name: 'Sogou',
        searchUrl: 'https://www.sogou.com/web',
        searchParam: 'query',
        selector: '.vrwrap',
        titleSelector: 'h3',
        linkSelector: 'h3 a',
        dateSelector: '.news-detail span:last-child',
        waitForSelector: '.results'
      },
      so: {
        name: '360',
        searchUrl: 'https://www.so.com/s',
        searchParam: 'q',
        selector: '.res-list',
        titleSelector: 'h3',
        linkSelector: 'h3 a',
        dateSelector: '.mh-info span:last-child',
        waitForSelector: '.result'
      }
    };
  }

  parseDate(dateStr) {
    if (!dateStr) return new Date();
    
    // 移除多余的空格
    dateStr = dateStr.trim();
    
    // 处理"X分钟前"、"X小时前"的格式
    const minutesAgo = dateStr.match(/(\d+)\s*分钟前/);
    if (minutesAgo) {
      const date = new Date();
      date.setMinutes(date.getMinutes() - parseInt(minutesAgo[1]));
      return date;
    }
    
    const hoursAgo = dateStr.match(/(\d+)\s*小时前/);
    if (hoursAgo) {
      const date = new Date();
      date.setHours(date.getHours() - parseInt(hoursAgo[1]));
      return date;
    }
    
    // 处理"今天 XX:XX"的格式
    if (dateStr.includes('今天')) {
      const timeMatch = dateStr.match(/(\d{2}):(\d{2})/);
      if (timeMatch) {
        const date = new Date();
        date.setHours(parseInt(timeMatch[1]));
        date.setMinutes(parseInt(timeMatch[2]));
        return date;
      }
    }
    
    // 处理"昨天 XX:XX"的格式
    if (dateStr.includes('昨天')) {
      const timeMatch = dateStr.match(/(\d{2}):(\d{2})/);
      if (timeMatch) {
        const date = new Date();
        date.setDate(date.getDate() - 1);
        date.setHours(parseInt(timeMatch[1]));
        date.setMinutes(parseInt(timeMatch[2]));
        return date;
      }
    }
    
    // 处理"YYYY-MM-DD"或"YYYY年MM月DD日"的格式
    const dateMatch = dateStr.match(/(\d{4})[年-](\d{1,2})[月-](\d{1,2})/);
    if (dateMatch) {
      return new Date(parseInt(dateMatch[1]), parseInt(dateMatch[2]) - 1, parseInt(dateMatch[3]));
    }
    
    // 如果无法解析，返回当前时间
    return new Date();
  }

  async fetchNewsForTopic(topic, keyword) {
    const newsItems = [];
    logger.info(`开始从搜索引擎获取关键词 "${keyword}" 的新闻`);
    addTopicCrawlLog(topic._id, 'info', `开始从搜索引擎获取关键词 "${keyword}" 的新闻`);
    
    for (const [sourceId, source] of Object.entries(this.sources)) {
      try {
        const searchUrl = new URL(source.searchUrl);
        searchUrl.searchParams.set(source.searchParam, `${keyword} 新闻`);
        if (sourceId === 'baidu') {
          searchUrl.searchParams.set('rtt', '1');
          searchUrl.searchParams.set('gpc', 'stf=1');
        } else if (sourceId === 'sogou') {
          searchUrl.searchParams.set('type', 'news');
          searchUrl.searchParams.set('sort', 'time');
        } else if (sourceId === 'so') {
          searchUrl.searchParams.set('type', 'news');
          searchUrl.searchParams.set('rank', 'time');
        }
        
        logger.info(`访问搜索页面: ${searchUrl.toString()}`);
        addTopicCrawlLog(topic._id, 'info', `访问搜索页面: ${searchUrl.toString()}`);
        
        const browser = await puppeteer.launch({
          headless: 'new',
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--window-size=1920x1080',
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process',
            '--disable-site-isolation-trials',
            '--disable-blink-features=AutomationControlled'
          ],
          ignoreHTTPSErrors: true,
          timeout: 30000
        });
        
        const page = await browser.newPage();
        page.setDefaultTimeout(30000);
        
        // 注入脚本以绕过检测
        await page.evaluateOnNewDocument(() => {
          Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined
          });
          window.navigator.chrome = {
            runtime: {}
          };
          delete navigator.__proto__.webdriver;
        });
        
        // 设置更真实的 User-Agent
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
        
        // 设置更多的浏览器特征
        await page.evaluateOnNewDocument(() => {
          window.innerWidth = 1920;
          window.innerHeight = 1080;
          window.outerWidth = 1920;
          window.outerHeight = 1080;
          window.screenX = 0;
          window.screenY = 0;
        });
        
        page.on('console', msg => {
          const text = msg.text();
          if (!text.includes('mutation events') && !text.includes('has discard')) {
            logger.info(`浏览器控制台: ${text}`);
            addTopicCrawlLog(topic._id, 'info', `浏览器控制台: ${text}`);
          }
        });
        
        page.on('error', err => {
          logger.error(`页面错误: ${err}`);
          addTopicCrawlLog(topic._id, 'error', `页面错误: ${err}`);
        });
        
        page.on('pageerror', err => {
          logger.error(`页面JS错误: ${err}`);
          addTopicCrawlLog(topic._id, 'error', `页面JS错误: ${err}`);
        });

        // 设置请求拦截
        await page.setRequestInterception(true);
        page.on('request', (request) => {
          if (['image', 'stylesheet', 'font'].includes(request.resourceType())) {
            request.abort();
          } else {
            request.continue();
          }
        });
        
        await page.goto(searchUrl.toString(), { 
          waitUntil: 'networkidle0',
          timeout: 30000
        });
        
        try {
          await page.waitForSelector(source.waitForSelector, { timeout: 10000 });
        } catch (error) {
          const warnMsg = `等待搜索结果超时: ${source.name}`;
          logger.warn(warnMsg);
          addTopicCrawlLog(topic._id, 'warn', warnMsg);
          await browser.close();
          continue;
        }
        
        // 等待一下以确保内容加载完成
        await page.waitForTimeout(2000);
        
        const articles = await page.evaluate((source, parseDate) => {
          return Array.from(document.querySelectorAll(source.selector)).map(result => {
            const titleEl = result.querySelector(source.titleSelector);
            const linkEl = result.querySelector(source.linkSelector);
            const dateEl = result.querySelector(source.dateSelector);
            const snippetEl = result.querySelector('div');
            
            const dateText = dateEl ? dateEl.textContent.trim() : '';
            
            return {
              title: titleEl ? titleEl.textContent.trim() : '',
              url: linkEl ? linkEl.href : '',
              publishDate: dateText,
              content: snippetEl ? snippetEl.textContent.trim() : ''
            };
          });
        }, source);
        
        logger.info(`从 ${source.name} 找到 ${articles.length} 篇文章`);
        addTopicCrawlLog(topic._id, 'info', `从 ${source.name} 找到 ${articles.length} 篇文章`);
        
        const validArticles = articles
          .filter(article => article.title && article.url && article.content)
          .map(article => ({
            ...article,
            source: source.name,
            publishDate: this.parseDate(article.publishDate)
          }));
          
        newsItems.push(...validArticles);
        
        await browser.close();
        logger.info(`完成从 ${source.name} 获取新闻`);
        addTopicCrawlLog(topic._id, 'info', `完成从 ${source.name} 获取新闻`);
      } catch (error) {
        const errorMsg = `从 ${source.name} 获取新闻失败: ${error.message}`;
        logger.error(errorMsg);
        addTopicCrawlLog(topic._id, 'error', errorMsg);
      }
    }
    
    const completionMsg = `完成获取关键词 "${keyword}" 的新闻，共 ${newsItems.length} 条`;
    logger.info(completionMsg);
    addTopicCrawlLog(topic._id, 'info', completionMsg);
    return newsItems;
  }
}

module.exports = CrawlerService; 
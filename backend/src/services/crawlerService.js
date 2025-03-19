const puppeteer = require('puppeteer');
const { setupLogger } = require('../utils/logger');

const logger = setupLogger();

class CrawlerService {
  constructor() {
    this.sources = {
      techcrunch: {
        name: 'TechCrunch',
        searchUrl: 'https://techcrunch.com/search/',
        searchParam: 'q'
      },
      theverge: {
        name: 'TheVerge',
        searchUrl: 'https://www.theverge.com/search',
        searchParam: 'q'
      },
      engadget: {
        name: 'Engadget',
        searchUrl: 'https://www.engadget.com/search/',
        searchParam: 'search_query'
      }
    };
  }

  async fetchNewsForTopic(topic, keyword) {
    const newsItems = [];
    logger.info(`开始从各个源获取关键词 "${keyword}" 的新闻`);
    
    for (const [sourceId, source] of Object.entries(this.sources)) {
      try {
        const searchUrl = new URL(source.searchUrl);
        searchUrl.searchParams.set(source.searchParam, keyword);
        logger.info(`访问搜索页面: ${searchUrl.toString()}`);
        
        const browser = await puppeteer.launch({
          headless: 'new',
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        
        // 设置页面超时
        page.setDefaultTimeout(30000);
        
        // 监听console事件
        page.on('console', msg => logger.info(`浏览器控制台: ${msg.text()}`));
        
        // 监听错误事件
        page.on('error', err => logger.error(`页面错误: ${err}`));
        page.on('pageerror', err => logger.error(`页面JS错误: ${err}`));
        
        await page.goto(searchUrl.toString(), { 
          waitUntil: 'networkidle0',
          timeout: 30000
        });
        
        // 等待搜索结果加载
        try {
          await page.waitForSelector('article, .c-entry-box--compact, .o-hit', { timeout: 5000 });
        } catch (error) {
          logger.warn(`等待搜索结果超时: ${source.name}`);
          await browser.close();
          continue;
        }
        
        // 根据不同网站提取新闻
        let articles = [];
        if (sourceId === 'techcrunch') {
          articles = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('article')).map(article => {
              const titleEl = article.querySelector('h2 a');
              const dateEl = article.querySelector('time');
              return {
                title: titleEl ? titleEl.textContent.trim() : '',
                url: titleEl ? titleEl.href : '',
                publishDate: dateEl ? new Date(dateEl.getAttribute('datetime')) : new Date(),
              };
            });
          });
        } else if (sourceId === 'theverge') {
          articles = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('.c-entry-box--compact')).map(article => {
              const titleEl = article.querySelector('.c-entry-box--compact__title a');
              const dateEl = article.querySelector('time');
              return {
                title: titleEl ? titleEl.textContent.trim() : '',
                url: titleEl ? titleEl.href : '',
                publishDate: dateEl ? new Date(dateEl.getAttribute('datetime')) : new Date(),
              };
            });
          });
        } else if (sourceId === 'engadget') {
          articles = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('.o-hit')).map(article => {
              const titleEl = article.querySelector('h2 a');
              const dateEl = article.querySelector('time');
              return {
                title: titleEl ? titleEl.textContent.trim() : '',
                url: titleEl ? titleEl.href : '',
                publishDate: dateEl ? new Date(dateEl.getAttribute('datetime')) : new Date(),
              };
            });
          });
        }
        
        logger.info(`从 ${source.name} 找到 ${articles.length} 篇文章`);
        
        // 获取每篇文章的详细内容
        for (const article of articles) {
          if (!article.url) continue;
          
          try {
            logger.info(`获取文章内容: ${article.url}`);
            await page.goto(article.url, { 
              waitUntil: 'networkidle0',
              timeout: 30000
            });
            
            // 提取文章内容
            const content = await page.evaluate(() => {
              const contentEl = document.querySelector('article');
              return contentEl ? contentEl.textContent.trim() : '';
            });
            
            if (content) {
              newsItems.push({
                ...article,
                content,
                source: source.name
              });
              logger.info(`成功获取文章内容: ${article.title}`);
            }
          } catch (error) {
            logger.error(`获取文章内容失败: ${article.url}`, error);
          }
        }
        
        await browser.close();
        logger.info(`完成从 ${source.name} 获取新闻`);
      } catch (error) {
        logger.error(`从 ${source.name} 获取新闻失败:`, error);
      }
    }
    
    logger.info(`完成获取关键词 "${keyword}" 的新闻，共 ${newsItems.length} 条`);
    return newsItems;
  }
}

module.exports = CrawlerService; 
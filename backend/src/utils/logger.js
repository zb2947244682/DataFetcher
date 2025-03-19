const winston = require('winston');
const path = require('path');

let logCache = [];
const MAX_CACHE_SIZE = 1000;

// 主题抓取日志缓存
const topicCrawlLogs = new Map();
const MAX_TOPIC_LOGS = 100;

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/error.log'),
      level: 'error'
    }),
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/combined.log')
    })
  ]
});

// 自定义日志格式，添加到缓存
const addToCache = (level, message) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message: typeof message === 'string' ? message : JSON.stringify(message)
  };
  
  logCache.push(logEntry);
  
  // 保持缓存大小在限制内
  if (logCache.length > MAX_CACHE_SIZE) {
    logCache = logCache.slice(-MAX_CACHE_SIZE);
  }
};

// 添加主题抓取日志
const addTopicCrawlLog = (topicId, level, message) => {
  if (!topicCrawlLogs.has(topicId)) {
    topicCrawlLogs.set(topicId, []);
  }

  const logs = topicCrawlLogs.get(topicId);
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message: typeof message === 'string' ? message : JSON.stringify(message)
  };

  logs.push(logEntry);

  // 保持日志数量在限制内
  if (logs.length > MAX_TOPIC_LOGS) {
    topicCrawlLogs.set(topicId, logs.slice(-MAX_TOPIC_LOGS));
  }
};

// 获取主题抓取日志
const getTopicCrawlLogs = (topicId) => {
  return topicCrawlLogs.get(topicId) || [];
};

// 清除主题抓取日志
const clearTopicCrawlLogs = (topicId) => {
  topicCrawlLogs.delete(topicId);
};

// 扩展logger的方法
const originalInfo = logger.info;
const originalError = logger.error;
const originalWarn = logger.warn;

logger.info = (message) => {
  addToCache('info', message);
  originalInfo.call(logger, message);
};

logger.error = (message) => {
  addToCache('error', message);
  originalError.call(logger, message);
};

logger.warn = (message) => {
  addToCache('warn', message);
  originalWarn.call(logger, message);
};

// 获取日志缓存
const getLogCache = () => logCache;

// 清除日志缓存
const clearLogCache = () => {
  logCache = [];
};

// 设置日志实例
const setupLogger = () => logger;

// 创建一个WebSocket日志传输器
class WebSocketTransport extends winston.Transport {
  constructor(wsServer) {
    super();
    this.wsServer = wsServer;
  }

  log(info, callback) {
    setImmediate(() => {
      this.emit('logged', info);
    });

    // 广播日志到所有连接的客户端
    if (this.wsServer) {
      this.wsServer.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: 'log',
            data: info
          }));
        }
      });
    }

    callback();
  }
}

module.exports = {
  setupLogger,
  getLogCache,
  clearLogCache,
  WebSocketTransport,
  addTopicCrawlLog,
  getTopicCrawlLogs,
  clearTopicCrawlLogs
}; 
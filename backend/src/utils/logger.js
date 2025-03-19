const winston = require('winston');
const path = require('path');

// 系统日志缓存
let systemLogCache = [];
const MAX_SYSTEM_CACHE_SIZE = 1000;

// 主题抓取日志缓存 - 使用对象而不是 Map，确保数据结构更简单
let topicCrawlLogs = {};
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

// 添加系统日志到缓存
const addToSystemCache = (level, message) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message: typeof message === 'string' ? message : JSON.stringify(message)
  };
  
  systemLogCache.push(logEntry);
  
  // 保持缓存大小在限制内
  if (systemLogCache.length > MAX_SYSTEM_CACHE_SIZE) {
    systemLogCache = systemLogCache.slice(-MAX_SYSTEM_CACHE_SIZE);
  }
};

// 添加主题抓取日志
const addTopicCrawlLog = (topicId, level, message) => {
  if (!topicId) {
    logger.error('添加主题抓取日志失败: 未提供主题ID');
    return;
  }

  // 确保主题的日志数组存在
  if (!topicCrawlLogs[topicId]) {
    topicCrawlLogs[topicId] = [];
  }

  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message: typeof message === 'string' ? message : JSON.stringify(message)
  };

  // 添加日志到主题特定的数组
  topicCrawlLogs[topicId].push(logEntry);

  // 保持日志数量在限制内
  if (topicCrawlLogs[topicId].length > MAX_TOPIC_LOGS) {
    topicCrawlLogs[topicId] = topicCrawlLogs[topicId].slice(-MAX_TOPIC_LOGS);
  }
};

// 获取主题抓取日志
const getTopicCrawlLogs = (topicId) => {
  if (!topicId) {
    logger.error('获取主题抓取日志失败: 未提供主题ID');
    return [];
  }

  // 返回主题的日志数组，如果不存在则返回空数组
  return topicCrawlLogs[topicId] || [];
};

// 清除主题抓取日志
const clearTopicCrawlLogs = (topicId) => {
  if (!topicId) {
    logger.error('清除主题抓取日志失败: 未提供主题ID');
    return;
  }

  // 直接删除主题的日志数组
  delete topicCrawlLogs[topicId];
};

// 扩展logger的方法
const originalInfo = logger.info;
const originalError = logger.error;
const originalWarn = logger.warn;

logger.info = (message) => {
  addToSystemCache('info', message);
  originalInfo.call(logger, message);
};

logger.error = (message) => {
  addToSystemCache('error', message);
  originalError.call(logger, message);
};

logger.warn = (message) => {
  addToSystemCache('warn', message);
  originalWarn.call(logger, message);
};

// 获取系统日志缓存
const getLogCache = () => systemLogCache;

// 清除系统日志缓存
const clearLogCache = () => {
  systemLogCache = [];
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
# 新闻聚合分析系统

这是一个基于 Vue2 和 Node.js 的新闻聚合分析系统，支持自定义主题的新闻收集和AI分析。

## 功能特点

- 支持自定义主题创建和管理
- 自动生成主题相关搜索关键词
- 自动爬取和分析新闻数据
- 支持手动触发数据更新
- 实时日志显示
- 数据自动清理（保留近7天）

## 技术栈

- 前端：Vue2
- 后端：Node.js (Express)
- 数据库：MongoDB
- 爬虫：Cheerio + Axios
- 容器化：Docker & Docker Compose
- 定时任务：node-cron
- 日志：winston

## 目录结构

```
.
├── frontend/          # Vue2 前端项目
├── backend/           # Node.js 后端项目
├── docker-compose.yml # Docker 编排配置
└── README.md         # 项目说明文档
```

## 运行方式

1. 配置环境变量
```bash
# 在 backend/.env 中配置
AI_MODEL_API_KEY=your_api_key_here
```

2. 启动服务
```bash
docker-compose up -d
```

3. 访问服务
- 前端界面：http://localhost:80
- 后端API：http://localhost:3000

## API 文档

### 主题管理
- GET /api/topics - 获取所有主题
- POST /api/topics - 创建新主题
- GET /api/topics/:id/news - 获取主题新闻
- POST /api/topics/:id/crawl - 触发主题数据爬取

### 数据更新
- GET /api/status - 获取系统状态
- GET /api/logs - 获取系统日志

## 开发说明

1. 前端开发
```bash
cd frontend
npm install
npm run serve
```

2. 后端开发
```bash
cd backend
npm install
npm run dev
```

## 注意事项

- 首次运行需要等待 MongoDB 初始化完成
- 定时任务默认在每天早上9点执行
- 日志文件位于 backend/logs 目录 
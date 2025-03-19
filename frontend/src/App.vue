<template>
  <div id="app">
    <el-container>
      <el-aside width="300px">
        <div class="sidebar">
          <div class="topic-list">
            <h2>主题列表</h2>
            <el-button type="primary" @click="showCreateTopicDialog" style="margin-bottom: 20px">
              新建主题
            </el-button>
            <el-menu
              :default-active="currentTopic?._id"
              @select="handleTopicSelect"
            >
              <el-menu-item
                v-for="topic in topics"
                :key="topic._id"
                :index="topic._id"
              >
                {{ topic.title }}
              </el-menu-item>
            </el-menu>
          </div>
          <div class="log-panel">
            <div class="log-header">
              <h3>系统日志</h3>
              <el-button size="small" type="danger" @click="clearLogs">
                清除日志
              </el-button>
            </div>
            <div class="log-content" ref="logContent">
              <p v-for="(log, index) in logs" :key="index" :class="log.level">
                {{ log.timestamp }}: {{ log.message }}
              </p>
            </div>
          </div>
        </div>
      </el-aside>
      
      <el-main>
        <div v-if="currentTopic" class="main-content">
          <div class="topic-header">
            <h1>{{ currentTopic.title }}</h1>
            <p class="description">{{ currentTopic.description }}</p>
            <div class="action-buttons">
              <el-button type="primary" @click="refreshNews" :loading="isRefreshing">
                刷新资讯
              </el-button>
              <el-button type="success" @click="crawlNews" :loading="isCrawling">
                立即抓取和分析最新数据
              </el-button>
            </div>
          </div>
          
          <el-tabs v-model="activeTab" type="border-card">
            <el-tab-pane label="资讯" name="news">
              <div class="news-list">
                <el-card v-for="item in news" :key="item._id" class="news-item">
                  <div class="news-header">
                    <h3>
                      <a :href="item.url" target="_blank">{{ item.title }}</a>
                    </h3>
                    <div class="news-meta">
                      <span>来源: {{ item.source }}</span>
                      <span>发布时间: {{ new Date(item.publishDate).toLocaleString() }}</span>
                    </div>
                  </div>
                  <p class="news-summary">{{ item.summary }}</p>
                </el-card>
                <el-pagination
                  @current-change="handlePageChange"
                  :current-page.sync="currentPage"
                  :page-size="pageSize"
                  layout="total, prev, pager, next"
                  :total="total">
                </el-pagination>
              </div>
            </el-tab-pane>
            <el-tab-pane label="网页列表" name="webpages">
              <web-page-list :topicId="currentTopic._id"></web-page-list>
            </el-tab-pane>
            <el-tab-pane label="抓取日志" name="crawl-logs">
              <div class="crawl-log-content" ref="crawlLogContent">
                <p v-for="(log, index) in crawlLogs" :key="index" :class="log.level">
                  {{ log.timestamp }}: {{ log.message }}
                </p>
              </div>
            </el-tab-pane>
          </el-tabs>
        </div>
        <div v-else class="empty-state">
          <h2>请选择或创建一个主题</h2>
        </div>
      </el-main>
    </el-container>

    <!-- 创建主题对话框 -->
    <el-dialog
      title="新建主题"
      :visible.sync="createTopicDialogVisible"
      width="50%"
    >
      <el-form :model="newTopic" :rules="topicRules" ref="topicForm">
        <el-form-item label="标题" prop="title">
          <el-input v-model="newTopic.title"></el-input>
        </el-form-item>
        <el-form-item label="描述" prop="description">
          <el-input
            type="textarea"
            v-model="newTopic.description"
            :rows="3"
          ></el-input>
        </el-form-item>
      </el-form>
      <span slot="footer" class="dialog-footer">
        <el-button @click="createTopicDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="createTopic">确定</el-button>
      </span>
    </el-dialog>
  </div>
</template>

<script>
import axios from 'axios';
import WebPageList from './components/WebPageList.vue'

export default {
  name: 'App',
  components: {
    WebPageList
  },
  data() {
    return {
      topics: [],
      currentTopic: null,
      newsList: [],
      logs: [],
      crawlLogs: [],
      isRefreshing: false,
      isCrawling: false,
      createTopicDialogVisible: false,
      newTopic: {
        title: '',
        description: ''
      },
      topicRules: {
        title: [
          { required: true, message: '请输入主题标题', trigger: 'blur' },
          { min: 2, max: 50, message: '长度在 2 到 50 个字符', trigger: 'blur' }
        ],
        description: [
          { required: true, message: '请输入主题描述', trigger: 'blur' },
          { min: 10, max: 200, message: '长度在 10 到 200 个字符', trigger: 'blur' }
        ]
      },
      activeTab: 'news',
      pageSize: 10,
      currentPage: 1,
      total: 0,
      crawlLogPollingInterval: null
    };
  },
  created() {
    this.fetchTopics();
    this.startLogPolling();
  },
  methods: {
    async fetchTopics() {
      try {
        const response = await axios.get('http://localhost:40030/api/topics');
        this.topics = response.data;
        if (this.topics.length > 0 && !this.currentTopic) {
          this.handleTopicSelect(this.topics[0]._id);
        }
      } catch (error) {
        this.$message.error('获取主题列表失败');
      }
    },
    async handleTopicSelect(topicId) {
      this.currentTopic = this.topics.find(t => t._id === topicId);
      if (this.currentTopic) {
        await this.refreshNews();
      }
    },
    async refreshNews() {
      if (!this.currentTopic) return;
      
      this.isRefreshing = true;
      try {
        const response = await axios.get(`http://localhost:40030/api/topics/${this.currentTopic._id}/news`);
        this.newsList = response.data;
      } catch (error) {
        this.$message.error('获取新闻列表失败');
      } finally {
        this.isRefreshing = false;
      }
    },
    async crawlNews() {
      if (!this.currentTopic) return;
      
      this.isCrawling = true;
      this.crawlLogs = [];
      this.activeTab = 'crawl-logs';
      
      try {
        await axios.post(`http://localhost:40030/api/topics/${this.currentTopic._id}/crawl`);
        this.$message.success('数据爬取任务已启动');
        
        // 开始轮询日志
        this.startCrawlLogPolling();
        
        // 每秒检查一次是否完成
        let checkCount = 0;
        const maxChecks = 300; // 最多等待5分钟
        
        const checkInterval = setInterval(async () => {
          try {
            const response = await axios.get(`http://localhost:40030/api/topics/${this.currentTopic._id}/crawl-logs`);
            const logs = response.data;
            
            // 更新日志
            this.crawlLogs = logs;
            
            // 检查是否有完成或错误的标志
            const lastLog = logs[logs.length - 1];
            const isCompleted = lastLog && (
              lastLog.message.includes('新闻更新完成') ||
              lastLog.level === 'error'
            );
            
            if (isCompleted || checkCount >= maxChecks) {
              clearInterval(checkInterval);
              if (this.crawlLogPollingInterval) {
                clearInterval(this.crawlLogPollingInterval);
              }
              this.refreshNews();
              this.isCrawling = false;
              
              if (checkCount >= maxChecks) {
                this.$message.warning('抓取任务超时，请检查日志了解详情');
              }
            }
            
            checkCount++;
          } catch (error) {
            console.error('检查抓取状态失败:', error);
          }
        }, 1000);
      } catch (error) {
        this.$message.error('触发数据爬取失败');
        this.isCrawling = false;
      }
    },
    showCreateTopicDialog() {
      this.createTopicDialogVisible = true;
      this.newTopic = {
        title: '',
        description: ''
      };
    },
    async createTopic() {
      try {
        const valid = await this.$refs.topicForm.validate();
        if (!valid) return;

        const response = await axios.post('http://localhost:40030/api/topics', this.newTopic);
        this.topics.unshift(response.data);
        this.createTopicDialogVisible = false;
        this.$message.success('主题创建成功');
        this.handleTopicSelect(response.data._id);
      } catch (error) {
        this.$message.error('创建主题失败');
      }
    },
    startLogPolling() {
      const pollLogs = async () => {
        try {
          const response = await axios.get('http://localhost:40030/api/status/logs');
          this.logs = response.data;
          if (this.$refs.logContent) {
            this.$refs.logContent.scrollTop = this.$refs.logContent.scrollHeight;
          }
        } catch (error) {
          console.error('获取日志失败:', error);
        }
      };

      pollLogs();
      setInterval(pollLogs, 5000);
    },
    startCrawlLogPolling() {
      if (this.crawlLogPollingInterval) {
        clearInterval(this.crawlLogPollingInterval);
      }

      const pollCrawlLogs = async () => {
        try {
          const response = await axios.get(`http://localhost:40030/api/topics/${this.currentTopic._id}/crawl-logs`);
          this.crawlLogs = response.data;
          if (this.$refs.crawlLogContent) {
            this.$refs.crawlLogContent.scrollTop = this.$refs.crawlLogContent.scrollHeight;
          }
        } catch (error) {
          console.error('获取抓取日志失败:', error);
        }
      };

      // 立即执行一次
      pollCrawlLogs();
      // 每秒轮询一次
      this.crawlLogPollingInterval = setInterval(pollCrawlLogs, 1000);
    },
    formatDate(date) {
      return new Date(date).toLocaleDateString();
    },
    handlePageChange(newPage) {
      this.currentPage = newPage;
      this.refreshNews();
    },
    clearLogs() {
      this.logs = [];
      axios.post('http://localhost:40030/api/logs/clear').catch(error => {
        console.error('清除服务器日志失败:', error);
      });
    }
  }
};
</script>

<style>
#app {
  font-family: 'Helvetica Neue', Helvetica, 'PingFang SC', 'Hiragino Sans GB',
    'Microsoft YaHei', '微软雅黑', Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  height: 100vh;
}

.el-container {
  height: 100%;
}

.sidebar {
  height: 100%;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #e6e6e6;
}

.topic-list {
  padding: 20px;
  flex-grow: 0;
}

.log-panel {
  margin-top: 20px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
}

.log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 0;
  padding: 10px;
  background-color: #f5f7fa;
  border-bottom: 1px solid #dcdfe6;
}

.log-header h3 {
  margin: 0;
}

.log-content {
  height: 400px;
  overflow-y: auto;
  padding: 10px;
  background-color: #1e1e1e;
  color: #fff;
  font-family: monospace;
  font-size: 12px;
  line-height: 1.5;
}

.log-content p {
  margin: 0;
  padding: 2px 0;
  white-space: pre-wrap;
  word-break: break-all;
}

.log-content .info {
  color: #7ec699;
}

.log-content .error {
  color: #ff6b6b;
}

.log-content .warn {
  color: #ffd93d;
}

.main-content {
  padding: 20px;
}

.topic-header {
  margin-bottom: 30px;
}

.description {
  color: #666;
  margin: 10px 0 20px;
}

.action-buttons {
  margin-bottom: 20px;
}

.news-list {
  margin-top: 20px;
}

.empty-state {
  text-align: center;
  color: #909399;
  padding-top: 100px;
}

.news-item {
  margin-bottom: 20px;
}

.news-header {
  margin-bottom: 10px;
}

.news-meta {
  font-size: 12px;
  color: #909399;
  margin-top: 5px;
}

.news-meta span {
  margin-right: 15px;
}

.news-summary {
  color: #606266;
  line-height: 1.6;
}

.el-tabs {
  margin-top: 20px;
}

.crawl-log-content {
  height: 400px;
  overflow-y: auto;
  padding: 10px;
  background-color: #1e1e1e;
  color: #fff;
  font-family: monospace;
  font-size: 12px;
  line-height: 1.5;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
}

.crawl-log-content p {
  margin: 0;
  padding: 2px 0;
  white-space: pre-wrap;
  word-break: break-all;
}
</style> 
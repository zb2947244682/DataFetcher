<template>
  <div class="webpage-list">
    <el-table
      :data="webpages"
      style="width: 100%"
      v-loading="loading"
    >
      <el-table-column
        prop="url"
        label="网址"
        width="300"
      >
        <template slot-scope="scope">
          <el-link :href="scope.row.url" target="_blank" type="primary">{{ scope.row.url }}</el-link>
        </template>
      </el-table-column>
      <el-table-column
        prop="source"
        label="来源"
        width="120">
      </el-table-column>
      <el-table-column
        prop="publishDate"
        label="发布时间"
        width="180">
        <template slot-scope="scope">
          {{ new Date(scope.row.publishDate).toLocaleString() }}
        </template>
      </el-table-column>
      <el-table-column
        prop="title"
        label="标题">
      </el-table-column>
      <el-table-column
        prop="keyword"
        label="关键词"
        width="120">
      </el-table-column>
    </el-table>
    <div class="pagination-container">
      <el-pagination
        @current-change="handlePageChange"
        :current-page.sync="currentPage"
        :page-size="pageSize"
        layout="total, prev, pager, next"
        :total="total">
      </el-pagination>
    </div>
  </div>
</template>

<script>
import axios from 'axios';

export default {
  name: 'WebPageList',
  props: {
    topicId: {
      type: String,
      required: true
    }
  },
  data() {
    return {
      webpages: [],
      loading: false,
      currentPage: 1,
      pageSize: 10,
      total: 0
    }
  },
  methods: {
    async fetchWebpages() {
      this.loading = true;
      try {
        const response = await axios.get(`http://localhost:40030/api/topics/${this.topicId}/webpages`, {
          params: {
            page: this.currentPage,
            limit: this.pageSize
          }
        });
        
        this.webpages = response.data.webpages;
        this.total = response.data.total;
      } catch (error) {
        console.error('获取网页列表失败:', error);
        this.$message.error('获取网页列表失败');
      } finally {
        this.loading = false;
      }
    },
    handlePageChange(page) {
      this.currentPage = page;
      this.fetchWebpages();
    }
  },
  watch: {
    topicId: {
      immediate: true,
      handler() {
        this.currentPage = 1;
        this.fetchWebpages();
      }
    }
  }
}
</script>

<style scoped>
.webpage-list {
  margin-top: 20px;
}
.pagination-container {
  margin-top: 20px;
  text-align: center;
}
</style> 
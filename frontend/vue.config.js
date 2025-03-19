module.exports = {
  devServer: {
    proxy: {
      '/api': {
        target: 'http://localhost:40030',
        changeOrigin: true
      }
    }
  }
}; 
module.exports = {
  mysql: {
    host: process.env.MYSQL_HOST || '127.0.0.1'
  },
  SPU: {
    endpoint: 'http://127.0.0.1:8081/handleEncryption'
  }
}
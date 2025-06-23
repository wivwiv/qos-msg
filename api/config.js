module.exports = {
  SPU: {
    endpoint: 'http://127.0.0.1:8081/handleEncryption'
  },
  mysql: {
    host: process.env.MYSQL_HOST || 'mysql-idea'
  },
  proxyHost:  process.env.PROXY_HOST || 'http://qos-msg-idea:18083',
  jwtSecret: "emqxsecret"
}
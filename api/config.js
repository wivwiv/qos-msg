// 加载 .env 文件
const dotenv = require('dotenv');
const envFile = process.env.NODE_ENV === 'development' ? '.env.development' : '.env';
const result = dotenv.config({ path: envFile });
if (result.error) {
  // 如果指定的环境文件不存在，尝试加载默认的 .env 文件
  dotenv.config();
}

const config = {
  SPU: {
    endpoint: process.env.SPU_ENDPOINT || 'http://my-app-idea:8081/handleEncryption'
  },
  mysql: {
    host: process.env.MYSQL_HOST || 'mysql-idea',
    port: process.env.MYSQL_PORT || 3306,
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || 'public',
    database: process.env.MYSQL_DATABASE || 'iot_data',
  },
  redis: {
    host: process.env.REDIS_HOST || 'redis-idea',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || '',
    db: process.env.REDIS_DB || 0,
    username: process.env.REDIS_USERNAME || ''
  },
  proxyHost: process.env.PROXY_HOST || 'http://qos-msg-idea:18083',
  jwtSecret: process.env.JWT_SECRET || "emqxsecret"
}
console.log(config)

module.exports = config;
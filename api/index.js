const Koa = require('koa');
const bodyParser = require('koa-bodyparser');
const Router = require('koa-router');
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const jwt = require('jsonwebtoken');
const axios = require('axios')

const config = require('./config');
const serveStatic = require('koa-static');


// 创建 Koa 应用
const app = new Koa();
const router = new Router();
router.prefix('/api/v5.1');
// 引入 static 中间件，从 web/ 目录加载静态网页
app.use(serveStatic(path.join(__dirname, '../web')));

// 反向代理 /api/v5/* 到 http://localhost:18083/api/v5/*
const proxy = require('http-proxy').createProxyServer({
  target: config.proxyHost || 'http://localhost:18083',
  changeOrigin: true,
  pathRewrite: {
    '^/api/v5/': '/api/v5/',
  },
})
app.use(async (ctx, next) => {
  if (ctx.path.startsWith('/api/v5/')) {
    return new Promise((resolve, reject) => {
      proxy.web(ctx.req, ctx.res, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  } else {
    await next();
  }
})

// 数据库配置
const dbConfig = {
  host: config.mysql.host,
  user: 'root',
  password: 'public',
  database: 'iot_data',
};

// 创建数据库连接池
const pool = mysql.createPool(dbConfig);

/**
 * curl --location 'http://127.0.0.1:8081/handleEncryption' \
--header 'Content-Type: application/json' \
--data '{
  "topic": "testtopic/1",
  "data": {
    "name": "张三",
    "age": 30,
    "address": "北京市海淀区",
    "telphone": "123456789",
    "cards": {
      "card1": "1234567890123456",
      "card2": "9876543210987654"
    }
  }
}
 */
router.post('/spu-encryption', async (ctx) => {
  /**
   * {
      type: 'encode',
      schema_name: 'spu-encryption',
      payload: 'SGVsbG8gRnJvbSBNUVRUWCBDTEk=',
      opts: ''
    }
   */
  const data = ctx.request.body
  const spuEndpoint = config.SPU.endpoint
  const resp = await axios.post(spuEndpoint, {
    topic: '',
    data: Buffer.from(data.payload, 'base64').toString('utf-8')
  })
  const encrypedData = resp.data.data
  // 将加密后的数据转换为 base64 字符串返回
  ctx.body = Buffer.from(encrypedData).toString('base64')
  ctx.status = 200
})

// 定义消息编码 API 的 POST 请求路由
router.post('/message-encoding', async (ctx) => {
  try {
    // 从请求体中获取必要的参数
    const { payload, type, schema_name, opts } = ctx.request.body;

    // 验证请求体是否包含必要的字段
    if (!payload || !type || !schema_name) {
      ctx.status = 400;
      ctx.body = '请求体缺少必要字段，需要包含 payload、type 和 schema_name';
      return;
    }

    // 这里可以添加实际的 schema_encode 或 schema_decode 逻辑
    // 目前只是简单返回传入的 payload 作为示例
    let result = payload;

    // 设置响应状态码为 200
    ctx.status = 200;
    // 直接返回 Base64 编码后的字符串作为响应体
    ctx.body = result;
  } catch (error) {
    console.error('消息编码 API 处理出错:', error);
    ctx.status = 500;
    ctx.body = '处理请求时发生错误';
  }
});

// 签发 jwt token 的接口
/**
 * {
  "exp": 1706844358,
  "username": "emqx_u",
  "acl": [ // 可选的 ACL 规则数组
    {
      "permission": "allow",
      "action": "subscribe",
      // `eq` 前缀意味着该规则仅适用于主题过滤器 t/1/#，但不适用于 t/1/x 或 t/1/y 等
      "topic": "eq t/1/#",
      // 该规则只匹配 QoS 1 但不匹配 QoS 0 或 2
      "qos": [1]
    },
    {
      // 禁止客户端发布 t/2 主题的保留消息，消息为非保留消息则是允许的
      "permission": "deny",
      "action": "publish",
      "topic": "t/2",
      "retain": true
    },
    {
      // 禁止客户端发布或订阅 t/3 主题，包括所有 QoS 级别和保留消息
      "permission": "deny",
      "action": "all",
      "topic": "t/3"
    }
  ]
}
 */
router.post('/issue-jwt', async (ctx) => {
  try {
    const { exp, username, acl } = ctx.request.body;

    // 验证必要参数
    if (!exp || !username) {
      ctx.status = 429;
      ctx.body =  {
        code: 429,
        message: '请求体缺少必要字段，需要包含 exp 和 username',
      };
      return;
    }
    if (exp < Date.now() / 1000) {
      ctx.status = 429;
      ctx.body = {
        code: 429,
        message: 'exp 必须大于当前时间戳',
      };
      return;
    }
    if (acl && !Array.isArray(acl)) {
      ctx.status = 429;
      ctx.body = {
        code: 429,
        message: 'acl 必须是一个数组',
      };
      return;
    }
    for (const rule of acl) {
      if (!rule.permission ||!rule.action ||!rule.topic) {
        ctx.status = 429;
        ctx.body = {
          code: 429,
          message: 'acl 数组中的每个规则都必须包含 permission、action 和 topic 字段',
        };
        return;
      }
    }

    // 准备要签名的数据
    const payload = {
      username,
      acl,
      exp
    };

    // 使用系统预设的 secret 进行签名
    const token = jwt.sign(payload, config.jwtSecret, {
      algorithm: 'HS256',
      expiresIn: exp
    });

    ctx.status = 200;
    ctx.body = { token };
  } catch (error) {
    console.error('签发 JWT token 出错:', error);
    ctx.status = 500;
    ctx.body = {
      code: 500,
      message: '签发 JWT token 出错',
      error: error.message
    };
  }
});

// 实现数据的查询、过滤与分页的 API 接口
router.get('/message-logs', async (ctx) => {
  const { page = 1, limit = 100, event, topic, qos } = ctx.query;
  const offset = (page - 1) * limit;
  let where = ' WHERE 1 = 1'

  let query = 'SELECT * FROM message_logs';
  const values = [];

  if (event) {
    where += ' AND event = ?';
    values.push(event);
  }
  if (topic) {
    where += ' AND topic = ?';
    values.push(topic);
  }
  if (qos) {
    where += ' AND qos = ?';
    values.push(parseInt(qos));
  }

  // 添加按 id 降序排序
  query += where + ' ORDER BY id DESC';
  query += ` LIMIT ? OFFSET ?`;
  values.push(parseInt(limit), offset);

  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.execute(query, values);
    // 安全地构建 SQL 查询，使用参数化查询避免 SQL 注入
    const countQuery = 'SELECT COUNT(*) AS count FROM message_logs' + where;
    const [totalCount] = await connection.execute(countQuery, values);
    ctx.body = {
      meta: { limit: parseInt(limit), page: parseInt(page), count: totalCount[0].count },
      data: rows.map(row => ({
        id: row.id,
        mid: row.mid,
        topic: row.topic,
        qos: row.qos,
        event: row.event,
        from_clientid: row.from_clientid,
        clientid: row.clientid,
        status: row.status,
        time: row.time,
      }))
    };
  } catch (error) {
    console.error('查询数据失败:', error);
    ctx.status = 500;
    ctx.body = { error: '查询数据失败' };
  } finally {
    connection.release();
  }
});

// 指定 ID 查询消息日志的 API 接口
// 根据请求示例，路径参数应使用 :id 而不是 {id}，同时需要在后续逻辑中处理 404 错误
router.get('/message-logs/:id', async (ctx) => {
  const { id } = ctx.params;
  const query = 'SELECT * FROM message_detail WHERE mid = ?';
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.execute(query, [id]);
    if (rows.length === 0) {
      ctx.status = 404;
      ctx.body = { error: '消息日志不存在' };
      return;
    }
    const query2 = 'SELECT * FROM message_logs WHERE mid =? ORDER BY id ASC';
    const [rows2] = await connection.execute(query2, [id]);
    ctx.body = {
      ...rows[0],
      payload: rows[0]?.payload?.toString(), // 解析 JSON 字符串为 JavaScript 对象
      logs: rows2.map(row => ({
        event: row.event,
        from_clientid: row.from_clientid,
        clientid: row.clientid,
        status: row.status,
        time: row.time,
      }))
    }
  } catch (error) {
    console.error('查询数据失败:', error);
    ctx.status = 500;
    ctx.body = { error: '查询数据失败' };
  }
})

// 消息延迟指标
router.get('/metric-message-latency', async (ctx) => {
  ctx.body = {
    "message.qos0.latency": Math.floor(Math.random() * 6) + 3, // 生成 0 - 5 毫秒的随机数
    "message.qos1.latency": Math.floor(Math.random() * 13) + 3, // 生成 3 - 15 毫秒的随机数
    "message.qos2.latency": Math.floor(Math.random() * 21) + 5 // 生成 5 - 25 毫秒的随机数
  }
})

router.get('/subscribe_logs', async (ctx) => {
  const { page = 1, limit = 100, clientid = '' } = ctx.query;
  const offset = (page - 1) * limit;
  let where = ` WHERE 1 = 1`;
  let values = []
  if (clientid) {
    where += ` AND clientid = ?`;
    values.push(clientid)
  }

  let query = 'SELECT * FROM subscribe_logs';
  query += where + ' ORDER BY id DESC';
  query += ` LIMIT ? OFFSET ?`;
  values.push(parseInt(limit), offset);

  const countQuery = 'SELECT COUNT(*) AS count FROM subscribe_logs' + where;
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.execute(query, values);
    const [totalCount] = await connection.execute(countQuery, values);
    ctx.body = {
      meta: { limit: parseInt(limit), page: parseInt(page), count: totalCount[0].count },
      data: rows.map(row => ({
        id: row.id,
        clientid: row.clientid,
        topic: row.topic,
        qos: row.qos,
        time: row.time,
        event: row.event,
        event_label: row.event === 'session.subscribed' ? '订阅' : '取消订阅'
      }))
    };
  } catch (error) {
    console.error('查询订阅列表失败:', error);
    ctx.status = 500;
    ctx.body = { error: '查询订阅列表失败' };
  } finally {
    connection.release();
  }
})

// 新增获取系统日志的 API 接口
router.get('/sys-logs', async (ctx) => {
  const { page = 1, limit = 100, content_like, module } = ctx.query;
  const offset = (page - 1) * limit;
  let totalCount = 0;
  let paginatedLines = [];
  let currentLineIndex = 0;

  try {
    const logFilePath = path.join(__dirname, '../qos-logs/emqx.log.1');
    const fileStream = fs.createReadStream(logFilePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    for await (const line of rl) {
      let shouldInclude = true;
      if (content_like && !line.includes(content_like)) {
        shouldInclude = false;
      }
      if (module && !line.includes(`tag: ${module}`)) {
        shouldInclude = false;
      }

      if (shouldInclude) {
        totalCount++;
        if (currentLineIndex >= offset && currentLineIndex < offset + parseInt(limit)) {
          paginatedLines.push(line);
        }
        currentLineIndex++;
      }
    }

    ctx.body = {
      meta: { page: parseInt(page), limit: parseInt(limit), count: totalCount },
      contents: paginatedLines
    };
  } catch (error) {
    console.error('读取系统日志失败:', error);
    ctx.status = 500;
    ctx.body = { error: '读取系统日志失败' };
  }
});

router.get('/', async (ctx) => {
  // 返回目前的所有 API
  ctx.body = {
    apis: [
      {
        method: 'GET',
        path: '/api/v5.1/message-logs',
        description: '实现数据的查询、过滤与分页的 API 接口'
      },
      {
        method: 'GET',
        path: '/api/v5.1/message-logs/:id',
        description: '指定 ID 查询消息日志的 API 接口'
      },
      {
        method: 'GET',
        path: '/api/v5.1/subscribe_logs',
        description: '获取订阅日志的 API 接口'
      },
      {
        method: 'GET',
        path: '/api/v5.1/sys-logs',
        description: '获取系统日志的 API 接口'
      },
      {
        method: 'GET',
        path: '/api/v5.1/metric-message-latency',
        description: '消息延迟指标'
      }
    ]
  };
})


// 使用中间件
app.use(bodyParser());
app.use(router.routes());
app.use(router.allowedMethods());

// 在路由匹配之后添加反向代理中间件
app.use(router.routes());
app.use(router.allowedMethods());

// 启动服务器
const port = 8080;
app.listen(port, () => {
  console.log(`服务器已启动，监听端口 ${port}`);
});

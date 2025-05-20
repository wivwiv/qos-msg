const Koa = require('koa');
const bodyParser = require('koa-bodyparser');
const Router = require('koa-router');
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const readline = require('readline');

const config = require('./config');

// 创建 Koa 应用
const app = new Koa();
const router = new Router();
router.prefix('/api/v5.1');

// 数据库配置
const dbConfig = {
  host: config.mysql.host,
  user: 'root',
  password: 'public',
  database: 'iot_data',
};

// 创建数据库连接池
const pool = mysql.createPool(dbConfig);


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

const readFileAsync = promisify(fs.readFile);

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


// 使用中间件
app.use(bodyParser());
app.use(router.routes());
app.use(router.allowedMethods());

// 启动服务器
const port = 3000;
app.listen(port, () => {
  console.log(`服务器已启动，监听端口 ${port}`);
});

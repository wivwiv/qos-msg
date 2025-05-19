const Koa = require('koa');
const bodyParser = require('koa-bodyparser');
const Router = require('koa-router');
const mysql = require('mysql2/promise');

// 创建 Koa 应用
const app = new Koa();
const router = new Router();

// 数据库配置
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: 'public',
  database: 'iot_data',
};

// 创建数据库连接池
const pool = mysql.createPool(dbConfig);


// 实现数据的查询、过滤与分页的 API 接口
router.get('/api/v5/message-logs', async (ctx) => {
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
router.get('/api/v5/message-logs/:id', async (ctx) => {
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

router.get('/api/v5/subscribe_logs', async (ctx) => {
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

// 使用中间件
app.use(bodyParser());
app.use(router.routes());
app.use(router.allowedMethods());

// 启动服务器
const port = 3000;
app.listen(port, () => {
  console.log(`服务器已启动，监听端口 ${port}`);
});

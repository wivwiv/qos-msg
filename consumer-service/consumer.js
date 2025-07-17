const mqtt = require('mqtt');

function getToken(username, sub_topics = [], pub_topics = []) {
  // 发送 HTTP 请求获取 JWT token
  return fetch('http://60.204.205.153:8081/generateJwt', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      // 1 天过期
      exp: Math.floor(Date.now()/1000) + 86400,
      username,
      acl: [
        ...sub_topics.map(topic => ({
          permission: "allow",
          action: "subscribe", 
          topic,
        })),
        ...pub_topics.map(topic => ({
          permission: "allow",
          action: "publish",
          topic,
        })),
      ]
    })
  })
  .then(response => response.text())
  .catch(error => {
    console.error('获取 token 失败:', error);
    return null;
  });
}

// 连接 MQTT 服务器
const client = mqtt.connect('mqtt://60.204.205.153:1889', {
  clean: true, // 不清除会话
  clientId: 'consumer-service-1',
});
const client2 = mqtt.connect('mqtt://60.204.205.153:1889', {
  clean: false, // 不清除会话
  clientId: 'consumer-service-2',
});

client2.on('connect', () => {
  client2.subscribe('t/1', { qos: 1 }, (err) => {
    if (!err) {
      console.log('c2 成功订阅 t/1 主题');
      setTimeout(() => {
        client2.end()
      }, 1000 * 5)
    }
  })
})


// 连接成功回调
client.on('connect', function () {
  // 订阅 t/1 主题
  client.subscribe('t/2', { qos: 1 }, function (err) {
    if (!err) {
      console.log('成功订阅 t/1 主题');
    } else {
      console.error('订阅 t/1 主题失败:', err);
    }
  });
});

// 接收到消息回调
client.on('message', function (topic, message, packet) {
  // 打印消息的 topic, qos, msg
  console.log('c1 接收消息: 已加密');
  console.log('Topic:', topic);
  console.log('QoS:', packet.qos);
  console.log('Message:', message.toString());
});

// 错误处理
client.on('error', function (error) {
  console.error('MQTT 客户端发生错误:', error);
});

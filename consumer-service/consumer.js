const mqtt = require('mqtt');

// 连接本地 MQTT 服务器，根据 docker-compose.yaml 可知端口为 1883
const client = mqtt.connect('mqtt://localhost:1883', {
  clean: true, // 不清除会话
  clientId: 'consumer-service-1',
});
const client2 = mqtt.connect('mqtt://localhost:1883', {
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
  console.log('Topic:', topic);
  console.log('QoS:', packet.qos);
  console.log('Message:', message.toString());
});

// 错误处理
client.on('error', function (error) {
  console.error('MQTT 客户端发生错误:', error);
});

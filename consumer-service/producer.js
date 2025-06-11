const mqtt = require('mqtt');
const client = mqtt.connect('mqtt://localhost', {
  clientId: 'idea-producer',
});
client.on('connect', () => {
  console.log('服务器已连接');
})
const topic = 't/2';
setInterval(() => {
  const message = 'Hello, MQTT!';
  client.publish(topic, JSON.stringify({
    message,
    timestamp: Date.now()
  }), { qos: 2 }, (err) => console.log(err));
  console.log(`已发送消息: ${message}`);
}, 10)
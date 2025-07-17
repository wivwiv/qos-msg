const mqtt = require('mqtt');
const client = mqtt.connect('mqtt://60.204.205.153:1889', {
  clientId: 'idea-producer',
});
client.on('connect', () => {
  console.log('服务器已连接');
})
const topic = 't/2';
setInterval(() => {
  const msg = JSON.stringify({
    message: 'Hello, MQTT!',
    timestamp: Date.now()
  });
  client.publish(topic, msg, { qos: 2 }, (err) => {
    if (!err) {
      console.log('消息已发送', msg);
    }
  });
}, 1000)
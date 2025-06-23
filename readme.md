# 低空经济项目验收

## 运行

Dcker 运行：

```bash
docker compose up -d
```

## 加解密配置

1. config.js 中配置 SPU 服务的 endpoint
2. QoS 中配置 Schema Registry-HTTP 的地址为 http://127.0.0.1:8080/api/v5.1/spu-encryption
3. QoS -> 数据智能中心 -> 消息转换，配置：
  消息来源主题：#
  消息格式转换：
    源格式：无，目标格式：HTTP
  消息属性转换：
    属性：payload
    目标值：payload

## 接口文档

[IDEA 验收页面定制](https://emqx.atlassian.net/wiki/spaces/~984656803/pages/1733328912/IDEA)


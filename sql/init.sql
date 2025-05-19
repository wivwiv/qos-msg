-- 创建名为 iot_data 的数据库
CREATE DATABASE IF NOT EXISTS iot_data;

-- 使用 iot_data 数据库
USE iot_data;

-- 创建 message_logs 数据表
CREATE TABLE IF NOT EXISTS message_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    mid VARCHAR(255) NOT NULL,
    topic VARCHAR(255) NOT NULL,
    qos INT NOT NULL,
    event VARCHAR(255) NOT NULL,
    from_clientid VARCHAR(255) NOT NULL,
    clientid VARCHAR(255) NOT NULL,
    status VARCHAR(255) NOT NULL,
    time DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 创建消息表
CREATE TABLE IF NOT EXISTS message_detail (
    id INT AUTO_INCREMENT PRIMARY KEY,
    mid VARCHAR(255) NOT NULL,
    payload BLOB,

    topic VARCHAR(255) ,
    qos INT DEFAULT 0,
    from_clientid VARCHAR(255),
    clientid VARCHAR(255),
    status VARCHAR(255) DEFAULT '已接收',
    time DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    size INT DEFAULT 100240,
    latency INT DEFAULT 0,
    -- 1747649577890 是一个较大的整数，可能超出 INT 类型范围，改用 BIGINT 存储
    publish_received_time BIGINT DEFAULT 0,
    acked_time BIGINT DEFAULT 0,
    drop_time BIGINT DEFAULT 0
);


-- 创建订阅表
CREATE TABLE IF NOT EXISTS subscribe_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    clientid VARCHAR(255) NOT NULL,
    topic VARCHAR(255) NOT NULL,
    qos INT NOT NULL,
    time DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    event VARCHAR(255) NOT NULL
);

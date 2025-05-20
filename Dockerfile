# 使用 nodejs 20.15.1 精简版基础镜像
FROM node:20.15.1-slim

# 设置工作目录
WORKDIR /app

# 复制 package.json 和 package-lock.json
COPY package*.json ./

# 安装依赖
RUN yarn install

# 复制项目文件
COPY . .

# 暴露端口，假设 api/index.js 监听 3000 端口，可根据实际情况修改
EXPOSE 3000

# 启动 api/index.js
CMD ["node", "api/index.js"]

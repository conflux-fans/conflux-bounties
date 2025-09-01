# Conflux Webhook Relay System

🚀 **生产就绪的区块链事件中继系统**

一个专为 Conflux eSpace 区块链设计的高性能 Webhook 中继系统，实时监控智能合约事件并向 Zapier、Make.com、n8n 等外部自动化平台发送通知。

[![TypeScript](https://img.shields.io/badge/TypeScript-5.2+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://www.docker.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## ✨ 核心特性

### 🔍 实时事件监控
- **亚30秒检测**: 实时监控 Conflux eSpace 智能合约事件
- **多合约支持**: 同时监控多个智能合约地址
- **灵活过滤**: 基于事件参数的高级过滤功能

### 🌐 多平台集成
- **原生格式化**: 为 Zapier、Make.com、n8n 提供专用格式
- **通用 Webhook**: 支持任意 HTTP 端点
- **自定义模板**: 灵活的消息格式定制

### 🔄 可靠交付
- **队列系统**: 基于数据库的持久化队列
- **指数退避**: 智能重试机制，避免服务过载
- **死信队列**: 失败消息的专门处理

### 🏗️ 生产就绪
- **Docker 部署**: 完整的容器化解决方案
- **PostgreSQL 持久化**: 可靠的数据存储
- **全面监控**: 健康检查、指标收集、日志记录
- **热配置重载**: 无需重启即可更新订阅

### 🛡️ 高可用性
- **熔断器模式**: 自动故障检测和恢复
- **连接池**: 优化的数据库连接管理
- **优雅关闭**: 安全的服务停止机制

## 🚀 快速开始

### 📋 环境要求

- **Node.js** 18+ (推荐 LTS 版本)
- **PostgreSQL** 12+ (推荐 14+)
- **Docker** (可选，推荐用于生产部署)
- **Redis** (可选，用于缓存优化)

### 💻 本地安装

1. **克隆仓库**:
```bash
git clone <repository-url>
cd webhook-relay-system
```

2. **安装依赖**:
```bash
npm install
```

3. **数据库设置**:
```bash
# 创建数据库
createdb webhook_relay

# 运行数据库迁移
npm run migrate
```

4. **配置文件**:
```bash
# 复制配置模板
cp config.example.json config.json

# 编辑配置文件
nano config.json
```

5. **启动系统**:
```bash
# 开发模式
npm run dev

# 生产模式
npm run build && npm start
```

### 🔍 验证安装

```bash
# 检查系统健康状态
curl http://localhost:3000/health

# 查看系统指标
curl http://localhost:3000/metrics
```

### 🐳 Docker 部署

#### 生产环境部署

1. **启动完整服务栈**:
```bash
docker-compose up -d
```

这将启动以下服务：
- 🚀 Webhook 中继系统 (端口 3001)
- 🗄️ PostgreSQL 数据库 (端口 5432)
- ⚡ Redis 缓存 (端口 6379)

2. **验证部署**:
```bash
# 检查服务状态
docker-compose ps

# 查看系统健康
curl http://localhost:3001/health

# 查看日志
npm run docker:logs
```

#### 开发环境部署

1. **启动开发环境**:
```bash
npm run docker:dev
```

这将启动：
- 🔧 开发版中继系统 (应用端口 3000，健康检查端口 3002)
- 🚀 生产版中继系统 (端口 3001)
- 🗄️ PostgreSQL 数据库 (端口 5432)
- ⚡ Redis 缓存 (端口 6379)

2. **开发环境管理**:
```bash
# 检查开发环境健康状态
npm run docker:dev:health

# 查看开发环境日志
npm run docker:dev:logs

# 停止开发环境
npm run docker:dev:down
```

3. **清理环境**:
```bash
# 完全清理 Docker 环境
npm run docker:clean
```

## ⚙️ 配置说明

### 📝 基础配置

基于示例创建 `config.json` 配置文件：

```json
{
  "network": {
    "rpcUrl": "https://evm.confluxrpc.com",
    "wsUrl": "wss://evm.confluxrpc.com/ws",
    "chainId": 1030,
    "confirmations": 1
  },
  "database": {
    "url": "postgresql://webhook_user:webhook_pass@postgres:5432/webhook_relay",
    "poolSize": 20,
    "connectionTimeout": 10000
  },
  "subscriptions": [
    {
      "id": "usdt-transfers",
      "contractAddress": "0x1207bd45c1002dC88bf592Ced9b35ec914bCeb4e",
      "eventSignature": "Transfer(address,address,uint256)",
      "filters": {},
      "webhooks": [
        {
          "id": "hookdeck-webhook",
          "url": "https://hkdk.events/m0t8gxe2jfe4j91",
          "format": "generic",
          "headers": {
            "Content-Type": "application/json"
          },
          "timeout": 30000,
          "retryAttempts": 3
        }
      ]
    }
  ]
}
```

### 🌍 环境变量

可以通过环境变量覆盖配置文件中的设置：

| 变量名 | 描述 | 必需 | 默认值 |
|--------|------|------|--------|
| `DATABASE_URL` | PostgreSQL 连接字符串 | ✅ | - |
| `REDIS_URL` | Redis 连接字符串 | ❌ | - |
| `LOG_LEVEL` | 日志级别 (debug/info/warn/error) | ❌ | info |
| `HEALTH_CHECK_PORT` | 健康检查端点端口 | ❌ | 3000 |
| `MAX_CONCURRENT_WEBHOOKS` | 最大并发 Webhook 数量 | ❌ | 10 |
| `NODE_ENV` | 运行环境 (development/production) | ❌ | development |

> **💡 提示**: Redis 是完全可选的。系统可以在没有 Redis 的情况下正常运行，所有功能都将使用数据库存储。

### 🔍 事件过滤器

使用多种操作符过滤事件：

```json
{
  "filters": {
    "value": {
      "operator": "gt",
      "value": "1000000000000000000"
    },
    "from": "0x1234567890123456789012345678901234567890",
    "to": {
      "operator": "in",
      "value": ["0xabc...", "0xdef..."]
    }
  }
}
```

**支持的操作符**:

| 操作符 | 描述 | 示例 |
|--------|------|------|
| `eq` | 等于 | `"value": "1000"` |
| `ne` | 不等于 | `{"operator": "ne", "value": "0"}` |
| `gt` | 大于 | `{"operator": "gt", "value": "1000000"}` |
| `lt` | 小于 | `{"operator": "lt", "value": "5000000"}` |
| `in` | 包含在数组中 | `{"operator": "in", "value": ["0xabc...", "0xdef..."]}` |
| `contains` | 包含子字符串 | `{"operator": "contains", "value": "transfer"}` |

## 🔗 平台集成指南

### 🔄 Zapier 集成

1. 在 Zapier 中创建新的 Zap
2. 选择 "Webhooks by Zapier" 作为触发器
3. 选择 "Catch Hook"
4. 复制 webhook URL
5. 添加到您的配置中:

```json
{
  "webhooks": [
    {
      "id": "zapier-webhook",
      "url": "https://hooks.zapier.com/hooks/catch/123456/abcdef/",
      "format": "zapier",
      "headers": {
        "Content-Type": "application/json"
      },
      "timeout": 30000,
      "retryAttempts": 3
    }
  ]
}
```

系统将以 Zapier 期望的格式格式化事件，并展平字段。

### 🎯 Make.com 集成

1. 在 Make.com 中创建新场景
2. 添加 "Webhooks" 模块
3. 选择 "Custom webhook"
4. 复制 webhook URL
5. 添加到您的配置中:

```json
{
  "webhooks": [
    {
      "id": "make-webhook",
      "url": "https://hook.eu1.make.com/your-webhook-id",
      "format": "make",
      "headers": {
        "Content-Type": "application/json"
      },
      "timeout": 30000,
      "retryAttempts": 3
    }
  ]
}
```

### 🔧 n8n 集成

1. 在 n8n 中创建新工作流
2. 添加 "Webhook" 节点
3. 将 HTTP 方法设置为 POST
4. 复制 webhook URL
5. 添加到您的配置中:

```json
{
  "webhooks": [
    {
      "id": "n8n-webhook",
      "url": "https://your-n8n-instance.com/webhook/your-webhook-id",
      "format": "n8n",
      "headers": {
        "Content-Type": "application/json"
      },
      "timeout": 30000,
      "retryAttempts": 3
    }
  ]
}
```

## 📡 API 接口

### 🏥 健康检查

```
GET /health
```

返回系统健康状态:

```json
{
  "status": "healthy",
  "uptime": 3600,
  "components": {
    "database": "healthy",
    "blockchain": "healthy",
    "queue": "healthy"
  }
}
```

### 📊 系统指标

```http
GET /metrics
```

返回 Prometheus 格式的系统指标。系统收集全面的指标，包括：

#### 可用指标

- `webhook_events_processed_total` - 处理的区块链事件总数
- `webhook_deliveries_total` - Webhook 投递尝试总数
- `webhook_delivery_success_total` - 成功的 Webhook 投递数
- `webhook_delivery_failure_total` - 失败的 Webhook 投递数
- `webhook_response_time_ms` - Webhook 投递响应时间直方图
- `queue_size` - 当前队列大小
- `database_connections_active` - 活跃数据库连接数
- `memory_heap_used_bytes` - 内存堆使用量
- `process_uptime_seconds` - 进程运行时间

#### 示例响应

```prometheus
# HELP webhook_events_processed_total Total number of blockchain events processed
# TYPE webhook_events_processed_total counter
webhook_events_processed_total 1234

# HELP webhook_deliveries_total Total webhook delivery attempts
# TYPE webhook_deliveries_total counter
webhook_deliveries_total{webhook_id="hookdeck-webhook"} 1150

# HELP webhook_response_time_ms Webhook delivery response time
# TYPE webhook_response_time_ms histogram
webhook_response_time_ms{webhook_id="hookdeck-webhook"} 245.5

# HELP queue_size Current queue size
# TYPE queue_size gauge
queue_size 15
```

## 📈 监控和可观测性

系统包含全面的监控功能，包括结构化日志、指标收集、健康检查和告警。详细的监控设置请参见 [MONITORING.zh-CN.md](MONITORING.zh-CN.md)。

### 快速监控设置

1. **检查系统健康**:
```bash
curl http://localhost:3000/health
```

2. **查看指标**:
```bash
curl http://localhost:3000/metrics
```

3. **启用调试日志**:
```bash
LOG_LEVEL=debug npm start
```

## 📈 监控和日志

### 📝 结构化日志

系统使用带有关联ID跟踪的结构化 JSON 日志:

```json
{
  "timestamp": "2025-08-02T05:13:28.635Z",
  "level": "info",
  "message": "Event processed successfully",
  "correlationId": "550e8400-e29b-41d4-a716-446655440000",
  "contractAddress": "0x1207bd45c1002dC88bf592Ced9b35ec914bCeb4e",
  "eventName": "Transfer",
  "blockNumber": 12345,
  "transactionHash": "0xabc123...",
  "processingTime": 150
}
```

#### 日志级别

- `error`: 错误条件
- `warn`: 警告条件
- `info`: 信息性消息（默认）
- `debug`: 调试级别消息

通过环境变量设置日志级别：
```bash
LOG_LEVEL=debug npm start
```

### 📊 关键性能指标

系统跟踪全面的监控指标：

#### 性能指标
- **每秒处理事件数**: 实时事件处理速率
- **Webhook 投递成功率**: 成功投递的百分比
- **平均响应时间**: Webhook 端点的平均响应时间
- **队列处理速率**: 每秒从队列处理的项目数

#### 可靠性指标
- **按组件分类的错误率**: 各系统组件的失败操作统计
- **熔断器激活**: 自动故障保护触发次数
- **重试模式分析**: 投递重试行为分析

#### 资源指标
- **内存使用**: 堆内存和RSS内存消耗
- **CPU 利用率**: 用户/系统模式下的进程CPU时间
- **数据库连接**: 活跃/空闲连接池状态
- **队列深度**: 当前积压大小和处理能力

### 🚨 告警配置

建议为以下情况配置告警：

- ❌ **高错误率**: 错误率超过 5%
- 📈 **队列积压**: 队列深度超过 1000
- 🔗 **Webhook 端点故障**: 连续失败超过 10 次
- 🗄️ **数据库连接问题**: 连接池耗尽
- 💾 **磁盘空间不足**: 可用空间低于 20%
- 🔄 **内存使用过高**: 内存使用率超过 80%

## 🛠️ 开发指南

### 🧪 运行测试

```bash
# 单元测试
npm test

# 集成测试（需要数据库）
npm run test:integration

# E2E 测试（需要 Conflux 测试网访问）
CONFLUX_TESTNET_TESTS=true npm run test:e2e
```

### 📊 测试覆盖率

```bash
# 生成覆盖率报告
npm run test:coverage

# 查看详细覆盖率报告
open coverage/lcov-report/index.html
```

**目标覆盖率**:
- 🎯 **行覆盖率**: > 90%
- 🎯 **分支覆盖率**: > 80%
- 🎯 **函数覆盖率**: > 90%

### 🔍 代码质量

```bash
# ESLint 检查
npm run lint

# 自动修复代码风格问题
npm run lint:fix

# TypeScript 类型检查
npx tsc --noEmit
```

### 🏗️ 构建和部署

```bash
# 构建生产版本
npm run build

# 检查构建产物
ls -la dist/

# 运行生产版本
npm start
```

## 🔧 故障排除

### ❓ 常见问题

**数据库连接错误**
- 验证 PostgreSQL 是否正在运行
- 检查配置中的连接字符串
- 确保数据库存在且已运行迁移

**Webhook 投递失败**
- 检查 webhook 端点是否可访问
- 验证认证头信息
- 检查 webhook 格式兼容性

**内存使用过高**
- 监控队列深度
- 检查事件处理中的内存泄漏
- 调整 `maxConcurrentWebhooks` 设置

**区块链连接问题**
- 验证 RPC/WebSocket URL 是否正确
- 检查网络连接
- 监控是否存在速率限制

### 🐛 调试模式

启用详细日志记录：

```bash
# 启用调试日志
LOG_LEVEL=debug npm start

# 启用性能分析
NODE_ENV=development npm run dev

# 查看详细的数据库查询日志
DEBUG=db:* npm start
```

### ⚡ 性能调优

针对高并发部署的优化建议：

#### 🗄️ 数据库优化
```json
{
  "database": {
    "poolSize": 50,           // 增加连接池大小
    "connectionTimeout": 5000, // 减少连接超时
    "idleTimeout": 30000      // 设置空闲超时
  }
}
```

#### 🔄 并发控制
```json
{
  "maxConcurrentWebhooks": 20,  // 根据基础设施调整
  "queueBatchSize": 100,        // 批量处理队列
  "retryDelay": 500             // 减少重试延迟
}
```

#### 📈 水平扩展
- 🔄 **多实例部署**: 使用负载均衡器分发请求
- 🗄️ **数据库读写分离**: 读取操作使用只读副本
- ⚡ **Redis 集群**: 使用 Redis 集群提高缓存性能
- 🐳 **Kubernetes 部署**: 自动扩缩容

#### 🎯 监控指标
定期监控以下关键指标：
- CPU 使用率 < 70%
- 内存使用率 < 80%
- 数据库连接池使用率 < 90%
- 队列处理延迟 < 5 秒

## 🤝 贡献指南

我们欢迎社区贡献！请遵循以下步骤：

### 📋 贡献流程

1. **🍴 Fork 仓库**
2. **🌿 创建特性分支**: `git checkout -b feature/amazing-feature`
3. **✏️ 提交更改**: `git commit -m 'feat: add amazing feature'`
4. **🧪 添加测试**: 确保新功能有对应的测试用例
5. **✅ 运行测试套件**: `npm run test:all`
6. **📤 推送分支**: `git push origin feature/amazing-feature`
7. **🔄 提交 Pull Request**

### 📝 开发规范

- **代码风格**: 遵循 ESLint 和 Prettier 配置
- **提交信息**: 使用 [Conventional Commits](https://conventionalcommits.org/) 规范
- **测试覆盖**: 新功能必须包含单元测试和集成测试
- **文档更新**: 更新相关的 README 和 API 文档
- **类型安全**: 确保 TypeScript 类型检查通过

### 🏷️ 提交类型

- `feat`: 新功能
- `fix`: 错误修复
- `docs`: 文档更新
- `style`: 代码格式调整
- `refactor`: 代码重构
- `test`: 测试相关
- `chore`: 构建过程或辅助工具的变动

## 📄 许可证

本项目基于 [MIT 许可证](LICENSE) 开源。

## 🆘 支持与帮助

### 📞 获取帮助

- 🐛 **报告问题**: [创建 GitHub Issue](https://github.com/your-repo/issues)
- 📚 **查看文档**: 阅读 [故障排除指南](#-故障排除)
- 💡 **配置示例**: 参考 [配置说明](#️-配置说明)
- 💬 **社区讨论**: 加入我们的讨论区

### 📋 问题模板

报告问题时请提供：

- 🔧 **环境信息**: Node.js 版本、操作系统
- 📝 **配置文件**: 脱敏后的 config.json
- 📊 **错误日志**: 相关的错误信息和堆栈跟踪
- 🔄 **复现步骤**: 详细的问题复现步骤

### 🌟 社区资源

- 📖 **详细文档**: [docs/](docs/) 目录
- 🚀 **部署指南**: [DEPLOYMENT.md](DEPLOYMENT.md)
- 📊 **监控指南**: [MONITORING.md](MONITORING.md)
- ⚡ **性能测试**: [PERFORMANCE_TESTS.md](PERFORMANCE_TESTS.md)

---

**🎉 感谢使用 Conflux Webhook Relay System！**

*Made with ❤️ for the Conflux ecosystem*
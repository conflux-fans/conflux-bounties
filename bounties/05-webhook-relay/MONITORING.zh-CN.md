# 监控指南

本文档提供 Conflux Webhook Relay System 的全面监控设置和配置指南。

## 概述

系统提供内置的监控功能，包括：
- 健康检查端点
- 指标收集和暴露
- 结构化日志记录
- 性能监控
- 数据库指标跟踪

## 健康检查

### 基础健康检查

```http
GET /health
```

返回基本的系统健康状态：

```json
{
  "status": "healthy",
  "uptime": 3600,
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### 详细健康检查

系统监控关键组件的健康状态：
- 数据库连接性
- 区块链连接
- 队列处理状态

## 指标收集

### 可用指标

系统在 `/metrics` 端点以 Prometheus 格式暴露指标。基于实际实现，以下指标可用：

#### 数据库指标
- `database_connections_active` - 活跃数据库连接数
- `database_connections_idle` - 空闲数据库连接数
- `database_query_duration_seconds` - 数据库查询执行时间
- `database_errors_total` - 数据库错误总数

#### Webhook 处理指标
- `webhook_events_processed_total` - 处理的区块链事件总数
- `webhook_deliveries_attempted_total` - Webhook 投递尝试总数
- `webhook_deliveries_successful_total` - 成功的 Webhook 投递数
- `webhook_deliveries_failed_total` - 失败的 Webhook 投递数
- `webhook_delivery_duration_seconds` - Webhook 投递响应时间
- `webhook_queue_size` - 当前队列大小
- `webhook_retry_attempts_total` - 重试尝试总数

#### 系统指标
- `process_cpu_user_seconds_total` - 进程用户模式 CPU 时间
- `process_cpu_system_seconds_total` - 进程系统模式 CPU 时间
- `process_resident_memory_bytes` - 进程常驻内存大小
- `nodejs_heap_size_total_bytes` - 总堆大小
- `nodejs_heap_size_used_bytes` - 已使用堆大小

### 指标端点

```http
GET /metrics
```

示例响应：
```prometheus
# HELP webhook_events_processed_total Total number of blockchain events processed
# TYPE webhook_events_processed_total counter
webhook_events_processed_total 1234

# HELP webhook_deliveries_attempted_total Total webhook delivery attempts
# TYPE webhook_deliveries_attempted_total counter
webhook_deliveries_attempted_total 1150

# HELP webhook_delivery_duration_seconds Webhook delivery response time
# TYPE webhook_delivery_duration_seconds histogram
webhook_delivery_duration_seconds_bucket{le="0.1"} 850
webhook_delivery_duration_seconds_bucket{le="0.5"} 1100
webhook_delivery_duration_seconds_bucket{le="1"} 1140
webhook_delivery_duration_seconds_bucket{le="+Inf"} 1150
webhook_delivery_duration_seconds_sum 245.5
webhook_delivery_duration_seconds_count 1150

# HELP database_connections_active Number of active database connections
# TYPE database_connections_active gauge
database_connections_active 5
```

## Prometheus 配置

### 基础设置

包含的 `monitoring/prometheus.yml` 提供基本的 Prometheus 配置：

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'webhook-relay'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
    scrape_interval: 10s
```

### Docker Compose 集成

将 Prometheus 添加到您的 Docker Compose 设置中：

```yaml
version: '3.8'
services:
  webhook-relay:
    # ... 您的 webhook relay 服务配置
    
  prometheus:
    image: prom/prometheus:latest
    container_name: prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
      - '--web.enable-lifecycle'
```

## Grafana 仪表板

### 设置

1. 启动 Grafana：
```bash
docker run -d -p 3000:3000 --name grafana grafana/grafana
```

2. 访问 Grafana：`http://localhost:3000` (admin/admin)

3. 添加 Prometheus 作为数据源：
   - URL: `http://prometheus:9090` (如果使用 Docker Compose)
   - URL: `http://localhost:9090` (如果本地运行)

### 关键仪表板

#### 系统概览仪表板

监控整体系统健康：
- 事件处理速率
- Webhook 投递成功率
- 队列深度随时间变化
- 错误率
- 响应时间百分位数

#### 性能仪表板

跟踪性能指标：
- CPU 和内存使用情况
- 数据库连接池利用率
- Webhook 投递延迟分布
- 吞吐量指标

#### 错误分析仪表板

监控和分析错误：
- 错误率趋势
- 按端点分类的失败 Webhook 投递
- 数据库连接错误
- 重试尝试模式

### 示例查询

#### 事件处理速率
```promql
rate(webhook_events_processed_total[5m])
```

#### Webhook 成功率
```promql
rate(webhook_deliveries_successful_total[5m]) / rate(webhook_deliveries_attempted_total[5m]) * 100
```

#### 95% 响应时间
```promql
histogram_quantile(0.95, rate(webhook_delivery_duration_seconds_bucket[5m]))
```

#### 队列深度
```promql
webhook_queue_size
```

## 日志记录

### 日志级别

系统支持以下日志级别：
- `error`: 错误条件
- `warn`: 警告条件
- `info`: 信息性消息（默认）
- `debug`: 调试级别消息

通过环境变量设置日志级别：
```bash
LOG_LEVEL=debug npm start
```

### 日志格式

结构化 JSON 日志格式：

```json
{
  "level": "info",
  "message": "Event processed successfully",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "correlationId": "req-123456",
  "contractAddress": "0x1207bd45c1002dC88bf592Ced9b35ec914bCeb4e",
  "eventName": "Transfer",
  "blockNumber": 12345,
  "transactionHash": "0xabc123...",
  "processingTime": 150
}
```

### 日志聚合

对于生产部署，考虑使用：
- **ELK Stack** (Elasticsearch, Logstash, Kibana)
- **Fluentd** 用于日志收集
- **Grafana Loki** 用于日志聚合

## 告警

### 推荐告警

#### 高错误率
```promql
rate(webhook_deliveries_failed_total[5m]) / rate(webhook_deliveries_attempted_total[5m]) > 0.05
```

#### 队列积压
```promql
webhook_queue_size > 1000
```

#### 数据库连接问题
```promql
database_connections_active / database_connections_total > 0.9
```

#### 高响应时间
```promql
histogram_quantile(0.95, rate(webhook_delivery_duration_seconds_bucket[5m])) > 5
```

#### 内存使用
```promql
process_resident_memory_bytes / 1024 / 1024 > 512
```

### Alert Manager 配置

示例 Alertmanager 规则：

```yaml
groups:
  - name: webhook-relay
    rules:
      - alert: HighErrorRate
        expr: rate(webhook_deliveries_failed_total[5m]) / rate(webhook_deliveries_attempted_total[5m]) > 0.05
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "高 Webhook 投递错误率"
          description: "Webhook 投递错误率为 {{ $value | humanizePercentage }}"

      - alert: QueueBacklog
        expr: webhook_queue_size > 1000
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Webhook 队列积压"
          description: "队列大小为 {{ $value }} 项"
```

## 性能监控

### 关键性能指标 (KPIs)

1. **吞吐量**: 每秒处理的事件数
2. **延迟**: 端到端处理时间
3. **可用性**: 系统正常运行时间百分比
4. **错误率**: 失败操作百分比
5. **队列健康**: 队列深度和处理速率

### 监控检查清单

- [ ] Prometheus 抓取 webhook relay 指标
- [ ] Grafana 仪表板已配置
- [ ] 告警规则已定义和测试
- [ ] 日志聚合设置
- [ ] 健康检查监控
- [ ] 数据库性能监控
- [ ] 网络连接监控

## 故障排除

### 常见问题

#### 指标不可用
- 验证 `/metrics` 端点是否可访问
- 检查 Prometheus 配置和连接性
- 确保应用程序正在运行且健康

#### 高内存使用
- 监控堆使用指标
- 检查事件处理中的内存泄漏
- 检查队列大小和处理速率

#### 数据库连接问题
- 监控数据库连接池指标
- 检查数据库服务器健康状态
- 检查连接超时设置

### 调试命令

```bash
# 检查指标端点
curl http://localhost:3000/metrics

# 检查健康状态
curl http://localhost:3000/health

# 使用调试级别查看应用程序日志
LOG_LEVEL=debug npm start

# 监控数据库连接
# (检查 database_connections_active 指标)
```

## 生产部署

### 监控堆栈

对于生产部署，部署完整的监控堆栈：

```yaml
version: '3.8'
services:
  webhook-relay:
    # ... 您的服务配置
    
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    ports:
      - "9090:9090"
      
  grafana:
    image: grafana/grafana:latest
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/grafana/dashboards:/etc/grafana/provisioning/dashboards
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
      
  alertmanager:
    image: prom/alertmanager:latest
    volumes:
      - ./monitoring/alertmanager.yml:/etc/alertmanager/alertmanager.yml
    ports:
      - "9093:9093"

volumes:
  prometheus_data:
  grafana_data:
```

### 安全考虑

- 使用身份验证保护指标端点
- 对外部监控访问使用 HTTPS
- 实施适当的防火墙规则
- 定期更新监控组件的安全补丁

## 最佳实践

1. **监控关键业务指标**: 专注于对您的用例重要的指标
2. **设置适当的告警阈值**: 通过调优阈值避免告警疲劳
3. **使用关联 ID**: 跨系统组件跟踪请求
4. **定期健康检查**: 实施全面的健康检查
5. **容量规划**: 监控趋势以进行容量规划
6. **文档**: 保持监控文档的更新

## 支持

对于监控相关问题：
- 查看故障排除部分
- 查阅 Prometheus 和 Grafana 文档
- 在 GitHub 上创建问题并附上监控日志
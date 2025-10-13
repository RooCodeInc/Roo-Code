import { WIKI_OUTPUT_DIR, SUBTASK_OUTPUT_FILENAMES } from "./constants"

export const DATA_FLOW_INTEGRATION_ANALYSIS_TEMPLATE = `# 数据流和集成深度分析

## 使用场景
从代码仓库中分析数据在系统中的流动路径和集成方式，生成详细的数据流文档，包括数据流转、集成模式、数据一致性等。

## 输入要求
- **前置任务分析结果**:（如果文件不存在则忽略）
  - \`${WIKI_OUTPUT_DIR}${SUBTASK_OUTPUT_FILENAMES.PROJECT_OVERVIEW_TASK_FILE}\`
  - \`${WIKI_OUTPUT_DIR}${SUBTASK_OUTPUT_FILENAMES.OVERALL_ARCHITECTURE_TASK_FILE}\`
  - \`${WIKI_OUTPUT_DIR}${SUBTASK_OUTPUT_FILENAMES.SERVICE_DEPENDENCIES_TASK_FILE}\`
- **完整代码仓库**: 项目的完整源代码
- **数据模型**: 数据库模型和数据结构定义
- **API接口**: 数据传输接口定义
- **消息配置**: 消息队列和数据流配置

# 数据流和集成深度分析任务

## 任务描述
请深度分析项目中的数据流动和集成方式，从数据流转路径、集成模式、数据一致性、数据安全等维度生成完整的数据流技术文档。

## 分析维度

### 1. 数据流路径分析
#### 业务数据流
\`\`\`mermaid
graph TB
    A[用户输入] --> B[API网关]
    B --> C[业务服务]
    C --> D[数据验证]
    D --> E[业务处理]
    E --> F[数据存储]
    F --> G[数据库]
    F --> H[缓存]
    E --> I[消息发送]
    I --> J[消息队列]
    J --> K[消费者服务]
    K --> L[数据处理]
    L --> M[结果存储]
\`\`\`

#### 数据流转模式
- **同步数据流**: 实时数据传输和处理
- **异步数据流**: 基于消息队列的数据流
- **批量数据流**: 批量数据处理和传输
- **实时数据流**: 流式数据处理和分析

### 2. 数据集成模式分析
#### API集成模式
\`\`\`go
// 分析REST API数据集成
// 识别请求响应数据流
\`\`\`

#### 消息集成模式
\`\`\`go
// 分析消息队列数据集成
// 识别发布订阅数据流
\`\`\`

#### 数据库集成模式
- **主从复制**: 主数据库到从数据库的数据同步
- **读写分离**: 读操作和写操作的数据分流
- **分库分表**: 数据水平拆分和集成
- **多数据源**: 多个数据源的数据集成

### 3. 数据格式和协议分析
#### 数据格式
- **JSON**: REST API数据交换格式
- **Protobuf**: gRPC服务数据格式
- **XML**: 配置和遗留系统数据格式
- **Avro**: 消息队列数据格式

#### 传输协议
- **HTTP/HTTPS**: Web服务数据传输
- **gRPC**: 高性能RPC数据传输
- **WebSocket**: 实时双向数据传输
- **MQTT**: IoT设备数据传输

### 4. 数据一致性分析
#### 事务一致性
\`\`\`go
// 分析数据库事务
// 识别ACID特性保证
\`\`\`

#### 最终一致性
- **消息队列**: 异步消息的最终一致性
- **事件溯源**: 基于事件的数据一致性
- **补偿事务**: 失败操作的补偿机制
- **定期对账**: 数据一致性检查和修复

### 5. 数据安全分析
#### 数据加密
- **传输加密**: SSL/TLS数据传输加密
- **存储加密**: 数据库字段加密
- **端到端加密**: 客户端到服务端加密
- **密钥管理**: 加密密钥的生命周期管理

#### 数据脱敏
- **敏感数据**: 个人信息、财务数据脱敏
- **日志数据**: 日志中的敏感信息过滤
- **监控数据**: 监控指标中的敏感信息处理
- **备份数据**: 备份数据的加密和保护

### 6. 数据监控和分析
#### 数据流监控
- **流量监控**: 数据传输流量和频率监控
- **延迟监控**: 数据传输延迟和性能监控
- **错误监控**: 数据传输错误和异常监控
- **一致性监控**: 数据一致性状态监控

#### 数据分析
- **实时分析**: 流式数据的实时分析
- **批量分析**: 历史数据的批量分析
- **预测分析**: 基于历史数据的预测分析
- **可视化分析**: 数据可视化展示和分析

## 输出格式要求

生成完整的数据流和集成分析文档：

### 文档结构
\`\`\`markdown
# {项目名称} 数据流和集成分析

## 数据流概览

### 数据流分类
| 数据流类型 | 描述 | 涉及服务 | 传输方式 |
|-----------|------|----------|----------|
| 业务数据流 | 核心业务数据流转 | Management, IDM | HTTP/REST |
| 事件数据流 | 系统事件和通知 | 所有服务 | Message Queue |
| 日志数据流 | 系统日志和监控 | 所有服务 | File/Stream |
| 配置数据流 | 配置信息同步 | 所有服务 | Config Center |

### 数据流架构图
\`\`\`mermaid
graph TB
    subgraph "数据源"
        A[用户输入]
        B[外部系统]
        C[IoT设备]
    end
    
    subgraph "接入层"
        D[API网关]
        E[WebSocket网关]
        F[消息网关]
    end
    
    subgraph "处理层"
        G[Management服务]
        H[Collector服务]
        I[IDM服务]
    end
    
    subgraph "存储层"
        J[(PostgreSQL)]
        K[(Redis)]
        L[(Pulsar)]
        M[(Elasticsearch)]
    end
    
    subgraph "消费层"
        N[数据分析服务]
        O[报表服务]
        P[通知服务]
    end
    
    A --> D
    B --> D
    C --> F
    D --> G
    D --> H
    D --> I
    E --> G
    F --> L
    G --> J
    G --> K
    H --> J
    H --> L
    H --> M
    I --> J
    I --> K
    L --> N
    L --> O
    L --> P
    J --> N
    M --> N
\`\`\`

## 业务数据流分析

### 用户管理数据流
#### 数据流转路径
\`\`\`mermaid
sequenceDiagram
    participant U as 用户
    participant API as API网关
    participant M as Management服务
    participant I as IDM服务
    participant DB as PostgreSQL
    participant Cache as Redis
    participant MQ as Pulsar
    
    U->>API: 用户注册请求
    API->>M: 转发注册请求
    M->>I: 验证用户信息
    I->>DB: 检查用户是否存在
    DB->>I: 返回检查结果
    I->>M: 返回验证结果
    M->>DB: 创建用户记录
    DB->>M: 返回创建结果
    M->>Cache: 缓存用户信息
    M->>MQ: 发送用户注册事件
    MQ->>P: 事件处理服务
    M->>API: 返回注册结果
    API->>U: 返回成功响应
\`\`\`

#### 数据格式定义
**用户注册请求数据**:
\`\`\`json
{
  "username": "string",
  "email": "string",
  "password": "string",
  "profile": {
    "first_name": "string",
    "last_name": "string",
    "phone": "string"
  }
}
\`\`\`

**用户注册响应数据**:
\`\`\`json
{
  "user_id": "string",
  "username": "string",
  "email": "string",
  "created_at": "timestamp",
  "status": "active"
}
\`\`\`

#### 数据处理逻辑
- **数据验证**: 用户名格式、邮箱格式、密码强度验证
- **数据转换**: 密码加密、数据格式标准化
- **数据存储**: 用户信息存储到数据库，缓存到Redis
- **事件发布**: 发布用户注册事件到消息队列

### 数据收集数据流
#### 数据流转路径
\`\`\`mermaid
graph LR
    A[数据源] --> B[数据收集器]
    B --> C[数据验证]
    C --> D[数据标准化]
    D --> E[数据存储]
    E --> F[PostgreSQL]
    E --> G[Elasticsearch]
    E --> H[Pulsar]
    H --> I[数据处理服务]
    I --> J[数据分析]
    I --> K[报表生成]
\`\`\`

#### 数据格式定义
**原始数据格式**:
\`\`\`json
{
  "source_id": "string",
  "timestamp": "timestamp",
  "data_type": "string",
  "payload": {
    "metric_name": "string",
    "metric_value": "number",
    "tags": {
      "host": "string",
      "service": "string"
    }
  }
}
\`\`\`

**标准化数据格式**:
\`\`\`json
{
  "id": "uuid",
  "source_id": "string",
  "timestamp": "timestamp",
  "metric_name": "string",
  "metric_value": "number",
  "tags": "object",
  "processed_at": "timestamp",
  "status": "processed"
}
\`\`\`

## 集成模式分析

### API集成模式
#### REST API集成
| API端点 | HTTP方法 | 数据格式 | 用途 | 集成服务 |
|---------|----------|----------|------|----------|
| /api/v1/users | POST | JSON | 用户创建 | Management, IDM |
| /api/v1/data | POST | JSON | 数据提交 | Management, Collector |
| /api/v1/auth | POST | JSON | 身份验证 | Management, IDM |

#### API数据流特征
- **同步处理**: 请求-响应模式，实时处理
- **数据验证**: 请求参数验证和格式检查
- **错误处理**: 统一错误码和错误信息
- **性能优化**: 响应缓存和连接池优化

### 消息集成模式
#### 发布订阅模式
| 主题(Topic) | 发布者 | 订阅者 | 消息格式 | 用途 |
|------------|--------|--------|----------|------|
| user-events | Management, IDM | 所有服务 | JSON | 用户事件通知 |
| data-events | Collector | 数据分析服务 | JSON | 数据事件处理 |
| system-events | 所有服务 | 监控服务 | JSON | 系统事件监控 |

#### 消息数据流特征
- **异步处理**: 发布订阅模式，异步处理
- **消息持久化**: 消息持久化存储，保证不丢失
- **顺序保证**: 消息顺序处理保证
- **重试机制**: 消息处理失败重试机制

### 数据库集成模式
#### 主从复制集成
| 数据库 | 角色 | 复制方式 | 延迟 | 用途 |
|--------|------|----------|------|------|
| PostgreSQL主库 | 主库 | 同步复制 | <1s | 写操作 |
| PostgreSQL从库 | 从库 | 异步复制 | <5s | 读操作 |
| Redis主库 | 主库 | 同步复制 | <1s | 写操作 |
| Redis从库 | 从库 | 异步复制 | <3s | 读操作 |

#### 数据分片集成
| 分片策略 | 分片键 | 分片数量 | 数据分布 | 用途 |
|----------|--------|----------|----------|------|
| 用户ID哈希 | user_id | 16个分片 | 均匀分布 | 用户数据 |
| 时间范围 | timestamp | 12个分片 | 时间分布 | 日志数据 |
| 地理位置 | region | 8个分片 | 地理分布 | 区域数据 |

## 数据一致性分析

### 事务一致性
#### 数据库事务
\`\`\`go
// 分析数据库事务使用
func CreateUser(user *User) error {
    tx := db.Begin()
    defer func() {
        if r := recover(); r != nil {
            tx.Rollback()
        }
    }()
    
    // 创建用户记录
    if err := tx.Create(user).Error; err != nil {
        tx.Rollback()
        return err
    }
    
    // 创建用户配置
    config := &UserConfig{UserID: user.ID}
    if err := tx.Create(config).Error; err != nil {
        tx.Rollback()
        return err
    }
    
    return tx.Commit().Error
}
\`\`\`

#### 事务特性保证
- **原子性**: 事务中的操作要么全部成功，要么全部失败
- **一致性**: 事务执行前后数据保持一致状态
- **隔离性**: 并发事务之间相互隔离
- **持久性**: 事务提交后数据持久化存储

### 最终一致性
#### 事件溯源一致性
\`\`\`mermaid
graph TB
    A[业务操作] --> B[生成事件]
    B --> C[存储事件]
    C --> D[发布事件]
    D --> E[事件处理]
    E --> F[更新状态]
    F --> G[状态同步]
\`\`\`

#### 补偿事务机制
- **正向操作**: 正常的业务操作流程
- **补偿操作**: 失败时的补偿和回滚操作
- **重试策略**: 失败操作的重试机制
- **超时处理**: 操作超时的处理机制

## 数据安全分析

### 数据加密
#### 传输加密
| 加密方式 | 加密算法 | 密钥长度 | 应用场景 |
|----------|----------|----------|----------|
| HTTPS | TLS 1.3 | 256位 | API通信 |
| gRPC | TLS 1.3 | 256位 | 服务间通信 |
| WebSocket | TLS 1.3 | 256位 | 实时通信 |

#### 存储加密
| 数据类型 | 加密方式 | 加密算法 | 密钥管理 |
|----------|----------|----------|----------|
| 密码 | 哈希加密 | bcrypt | 单向哈希 |
| 敏感信息 | 对称加密 | AES-256 | 密钥管理系统 |
| 备份数据 | 对称加密 | AES-256 | 备份密钥管理 |

### 数据脱敏
#### 脱敏策略
| 数据类型 | 脱敏方式 | 脱敏规则 | 应用场景 |
|----------|----------|----------|----------|
| 手机号 | 部分遮蔽 | 138****1234 | 日志、显示 |
| 邮箱 | 部分遮蔽 | user***@domain.com | 日志、显示 |
| 身份证 | 部分遮蔽 | 110****1234 | 日志、显示 |
| 银行卡 | 部分遮蔽 | 6225****1234 | 日志、显示 |

#### 脱敏实现
\`\`\`go
// 数据脱敏函数示例
func MaskPhone(phone string) string {
    if len(phone) != 11 {
        return phone
    }
    return phone[:3] + "****" + phone[7:]
}

func MaskEmail(email string) string {
    parts := strings.Split(email, "@")
    if len(parts) != 2 {
        return email
    }
    username := parts[0]
    domain := parts[1]
    if len(username) <= 2 {
        return username + "***@" + domain
    }
    return username[:2] + "***@" + domain
}
\`\`\`

## 数据监控和分析

### 数据流监控
#### 监控指标
| 指标类型 | 指标名称 | 阈值 | 告警级别 |
|----------|----------|------|----------|
| 流量监控 | API请求量 | >10000 QPS | 警告 |
| 流量监控 | 消息处理量 | >5000 msg/s | 警告 |
| 延迟监控 | API响应时间 | >1000ms | 警告 |
| 延迟监控 | 消息处理延迟 | >5000ms | 严重 |
| 错误监控 | API错误率 | >5% | 警告 |
| 错误监控 | 消息处理失败率 | >10% | 严重 |

#### 监控实现
\`\`\`go
// 数据流监控示例
type DataFlowMonitor struct {
    requestCount   prometheus.Counter
    responseTime   prometheus.Histogram
    errorCount     prometheus.Counter
    messageCount   prometheus.Counter
    processTime    prometheus.Histogram
}

func (m *DataFlowMonitor) RecordRequest(duration time.Duration) {
    m.requestCount.Inc()
    m.responseTime.Observe(duration.Seconds())
}

func (m *DataFlowMonitor) RecordError() {
    m.errorCount.Inc()
}

func (m *DataFlowMonitor) RecordMessage(duration time.Duration) {
    m.messageCount.Inc()
    m.processTime.Observe(duration.Seconds())
}
\`\`\`

### 数据分析
#### 实时分析
- **流式处理**: 实时数据流处理和分析
- **复杂事件处理**: 复杂事件的实时识别和处理
- **实时聚合**: 实时数据聚合和统计
- **实时告警**: 实时异常检测和告警

#### 批量分析
- **历史数据分析**: 历史数据的批量分析
- **趋势分析**: 数据趋势和模式分析
- **预测分析**: 基于历史数据的预测分析
- **报表生成**: 定期报表生成和分发

## 性能优化

### 数据流优化
#### 缓存策略
| 缓存类型 | 缓存数据 | 过期时间 | 缓存策略 |
|----------|----------|----------|----------|
| 用户信息 | 用户基本资料 | 30分钟 | 主动刷新 |
| 配置信息 | 系统配置 | 1小时 | 定时刷新 |
| 统计数据 | 业务统计 | 5分钟 | 定时刷新 |
| 会话信息 | 用户会话 | 24小时 | 惰性过期 |

#### 批量处理
- **批量插入**: 数据批量插入优化
- **批量更新**: 数据批量更新优化
- **批量删除**: 数据批量删除优化
- **批量查询**: 数据批量查询优化

### 网络优化
#### 连接池优化
| 连接类型 | 池大小 | 超时时间 | 重用策略 |
|----------|--------|----------|----------|
| 数据库连接 | 100 | 30秒 | 连接复用 |
| Redis连接 | 50 | 10秒 | 连接复用 |
| HTTP连接 | 200 | 60秒 | 连接复用 |

#### 压缩优化
- **数据压缩**: 传输数据压缩优化
- **协议优化**: 高效协议选择和优化
- **序列化优化**: 高效序列化格式选择

## 故障处理

### 数据流故障
#### 故障类型
| 故障类型 | 故障现象 | 影响范围 | 恢复策略 |
|----------|----------|----------|----------|
| 网络故障 | 数据传输中断 | 部分服务 | 重试机制 |
| 数据库故障 | 数据存储失败 | 所有服务 | 主从切换 |
| 消息队列故障 | 消息传输失败 | 异步服务 | 消息重试 |
| 缓存故障 | 缓存访问失败 | 性能下降 | 降级处理 |

#### 故障恢复
- **自动重试**: 失败操作的自动重试
- **降级处理**: 核心功能降级处理
- **熔断保护**: 服务熔断和快速失败
- **数据恢复**: 数据备份和恢复机制

### 数据一致性故障
#### 一致性检查
- **定期对账**: 数据一致性定期检查
- **差异修复**: 数据差异自动修复
- **监控告警**: 一致性异常监控告警
- **人工干预**: 严重问题人工干预处理

## 总结

### 数据流特点
- {数据流主要特点总结}
- {集成模式应用总结}
- {一致性保证总结}
- {安全措施总结}

### 优化建议
- {数据流优化建议}
- {性能提升建议}
- {安全加强建议}
- {监控改进建议}
\`\`\`

## 特别注意事项
1. 必须基于实际的代码和配置进行分析，不能虚构数据流
2. 重点分析关键数据路径和集成模式
3. 关注数据一致性和安全性保证
4. 识别数据流中的性能瓶颈和优化空间
5. 提供实用的故障处理和恢复策略

## 输出文件命名
\`${WIKI_OUTPUT_DIR}${SUBTASK_OUTPUT_FILENAMES.DATA_FLOW_INTEGRATION_TASK_FILE}\`
注意：如果${WIKI_OUTPUT_DIR} 目录不存在，则创建。

## 示例输出特征
基于项目的数据流分析特征：
- 详细的数据流转路径和时序图
- 完整的集成模式和应用场景分析
- 全面的数据一致性保证机制
- 实用的数据安全和加密策略
- 具体的性能优化和故障处理方案
`

import { WIKI_OUTPUT_DIR, SUBTASK_OUTPUT_FILENAMES } from "./constants"

export const SERVICE_DEPENDENCIES_ANALYSIS_TEMPLATE = (workspace: string) => `# 服务依赖深度分析

## 使用场景
从代码仓库中分析服务间的依赖关系，生成详细的依赖文档，包括服务调用、数据流、接口依赖等。

## 输入要求
- **完整代码仓库**: 项目的完整源代码
- **服务配置**: 各服务的配置文件
- **API定义**: 服务间接口定义
- **部署配置**: 服务部署和编排配置

# 服务依赖深度分析任务

## 任务描述
请深度分析项目中的服务依赖关系，从服务调用、数据流、接口依赖、配置依赖等维度生成完整的服务依赖技术文档。

## 分析维度

### 1. 服务间调用依赖分析
#### HTTP/gRPC服务调用
- 识别HTTP客户端调用模式和gRPC服务间调用关系
- 分析protobuf定义和远程过程调用依赖

#### 消息队列依赖
- 分析消息队列生产者和消费者
- 识别异步服务依赖关系

### 2. 数据依赖分析
#### 数据库依赖
- **主数据库**: 共享的主数据库依赖
- **缓存依赖**: Redis等缓存系统依赖
- **消息存储**: 消息队列数据依赖

#### 数据流依赖
\`\`\`mermaid
graph LR
    A[Service A] --> B[Database]
    A --> C[Cache]
    A --> D[Message Queue]
    E[Service B] --> B
    F[Service C] --> D
\`\`\`

### 3. 配置依赖分析
#### 环境配置依赖
- **共享配置**: 服务间共享的配置项
- **服务特定配置**: 各服务特有的配置
- **动态配置**: 运行时动态配置依赖

### 4. 接口依赖分析
#### API接口依赖
- **REST API**: HTTP接口依赖关系
- **GraphQL**: GraphQL查询依赖
- **WebSocket**: 实时通信接口依赖

### 5. 第三方服务依赖分析
#### 外部API依赖
- **支付服务**: 第三方支付接口
- **通信服务**: 短信/邮件发送服务
- **存储服务**: 云存储服务

### 6. 基础设施依赖分析
#### 容器编排依赖
- **Kubernetes**: K8s服务依赖
- **Docker**: 容器运行时依赖

#### 网络依赖
- **负载均衡**: 负载均衡服务依赖
- **API网关**: 网关服务依赖
- **服务发现**: 服务注册发现依赖

## 输出格式要求

生成完整的服务依赖分析文档：

### 文档结构
\`\`\`\`markdown
# {项目名称} 服务依赖分析

## 依赖概览

### 服务清单
| 服务名称 | 端口 | 技术栈 | 责任人 | 状态 |
|---------|------|-------|--------|------|
| Management | 8080 | Go+Echo | 团队A | ✅ 运行中 |
| Collector | 9164 | Go+Echo | 团队B | ✅ 运行中 |

### 依赖关系总览
\`\`\`mermaid
graph TB
    subgraph "核心服务"
        A[Management] --> B[PostgreSQL]
        A --> C[Redis]
        A --> D[Pulsar]
    end
    
    subgraph "数据服务"
        E[Collector] --> B
        E --> D
        E --> F[Elasticsearch]
    end
    
    subgraph "外部服务"
        A --> I[支付API]
        E --> K[邮件API]
    end
\`\`\`

## 服务间调用依赖

### HTTP服务调用
| 调用服务 | 被调用服务 | 接口路径 | 调用方式 | 依赖级别 |
|---------|-----------|----------|----------|----------|
| Management | IDM | /api/v1/auth/validate | HTTP POST | 强依赖 |
| Management | Collector | /api/v1/data/collect | HTTP GET | 弱依赖 |

### gRPC服务调用
| 调用服务 | 被调用服务 | gRPC方法 | 调用频率 | 超时设置 |
|---------|-----------|----------|----------|----------|
| Management | IDM | GetUser | 高频 | 5s |
| Management | Collector | CollectData | 中频 | 10s |

### 消息队列依赖
#### 消息生产者
| 服务名称 | 主题(Topic) | 消息类型 | 发送频率 | QoS级别 |
|---------|------------|----------|----------|----------|
| Management | user-events | 用户事件 | 高频 | QoS 1 |
| Collector | data-events | 数据事件 | 中频 | QoS 0 |

#### 消息消费者
| 服务名称 | 订阅主题 | 消费方式 | 消费组 | 处理策略 |
|---------|----------|----------|--------|----------|
| IDM | user-events | 订阅 | idm-group | 顺序处理 |
| Management | data-events | 订阅 | mgmt-group | 并行处理 |

## 数据依赖分析

### 数据库依赖
| 服务名称 | 数据库 | 表名 | 操作类型 | 依赖级别 |
|---------|--------|------|----------|----------|
| Management | PostgreSQL | users | CRUD | 强依赖 |
| Collector | PostgreSQL | data_logs | CRUD | 强依赖 |
| IDM | PostgreSQL | auth_tokens | CRUD | 强依赖 |

### 缓存依赖
| 服务名称 | 缓存类型 | 缓存键模式 | 过期时间 | 依赖级别 |
|---------|----------|------------|----------|----------|
| Management | 会话缓存 | session:* | 24h | 强依赖 |
| IDM | 权限缓存 | permission:* | 12h | 强依赖 |

### 消息存储依赖
| 服务名称 | 消息系统 | 主题/队列 | 用途 | 依赖级别 |
|---------|----------|-----------|------|----------|
| Management | Pulsar | user-events | 用户事件通知 | 强依赖 |
| Collector | Pulsar | data-events | 数据事件处理 | 强依赖 |

## 配置依赖分析

### 环境配置依赖
#### 共享配置项
| 配置项 | 默认值 | 使用服务 | 描述 |
|--------|--------|----------|------|
| APP_ENV | development | 所有服务 | 应用环境 |
| LOG_LEVEL | info | 所有服务 | 日志级别 |
| DATABASE_HOST | localhost | 所有服务 | 数据库主机 |

#### 服务特定配置
| 服务名称 | 配置项 | 默认值 | 描述 |
|---------|--------|--------|------|
| Management | MANAGEMENT_PORT | 8080 | 管理服务端口 |
| Collector | COLLECTOR_PORT | 9164 | 收集服务端口 |

### 动态配置依赖
| 服务名称 | 配置中心 | 配置路径 | 刷新策略 |
|---------|----------|----------|----------|
| Management | Consul | config/management | 热刷新 |
| Collector | Consul | config/collector | 热刷新 |

## 接口依赖分析

### API接口依赖
| 调用服务 | 被调用服务 | 接口路径 | HTTP方法 | 依赖级别 |
|---------|-----------|----------|----------|----------|
| Management | IDM | /api/v1/auth/login | POST | 强依赖 |
| Management | Collector | /api/v1/data/status | GET | 弱依赖 |

### 接口版本依赖
| 接口路径 | 版本 | 兼容性 | 升级策略 |
|----------|------|--------|----------|
| /api/v1/auth/* | v1 | 向后兼容 | 渐进式升级 |
| /api/v2/auth/* | v2 | 新版本 | 并行运行 |

### WebSocket依赖
| 服务名称 | 连接端点 | 用途 | 连接数限制 |
|---------|----------|------|-----------|
| Management | /ws/notifications | 实时通知 | 1000 |
| Collector | /ws/data-stream | 数据流传输 | 500 |

## 第三方服务依赖

### 外部API依赖
#### 支付服务依赖
| 服务名称 | 支付服务 | API端点 | 用途 | 依赖级别 |
|---------|----------|----------|------|----------|
| Management | Stripe | /api/v1/charges | 支付处理 | 强依赖 |
| Management | PayPal | /v2/payments | 支付处理 | 备选依赖 |

#### 通信服务依赖
| 服务名称 | 服务类型 | API端点 | 用途 | 依赖级别 |
|---------|----------|----------|------|----------|
| Management | Twilio | /2010-04-01/Accounts | 短信发送 | 强依赖 |
| Collector | SendGrid | /v3/mail/send | 邮件发送 | 强依赖 |

### 云服务依赖
| 服务名称 | 云服务 | 服务类型 | 用途 | 依赖级别 |
|---------|--------|----------|------|----------|
| Management | AWS RDS | PostgreSQL | 主数据库 | 强依赖 |
| Management | AWS ElastiCache | Redis | 缓存服务 | 强依赖 |

## 基础设施依赖

### 容器编排依赖
#### Kubernetes依赖
| 服务名称 | K8s资源 | 命名空间 | 依赖级别 |
|---------|----------|----------|----------|
| Management | Deployment | default | 强依赖 |
| Collector | Deployment | default | 强依赖 |

#### Helm依赖
| 服务名称 | Helm Chart | 版本 | 仓库 | 依赖级别 |
|---------|------------|------|------|----------|
| Management | management-chart | 1.0.0 | local | 强依赖 |
| Collector | collector-chart | 1.0.0 | local | 强依赖 |

### 网络依赖
#### 负载均衡依赖
| 服务名称 | 负载均衡器 | 端口 | 路由规则 | 依赖级别 |
|---------|------------|------|----------|----------|
| Management | Nginx | 80 | /api/management/* | 强依赖 |
| Collector | Nginx | 80 | /api/collector/* | 强依赖 |

#### 服务发现依赖
| 服务名称 | 服务发现 | 注册方式 | 健康检查 | 依赖级别 |
|---------|----------|----------|----------|----------|
| Management | Consul | 自动注册 | HTTP检查 | 强依赖 |
| Collector | Consul | 自动注册 | HTTP检查 | 强依赖 |

## 总结

### 依赖关系总结
- {关键依赖服务总结}
\`\`\`\`

## 特别注意事项
1. 必须基于实际的代码和配置进行分析，不能虚构依赖关系
2. 重点分析关键依赖和单点故障风险
3. 关注依赖的版本兼容性和升级策略

## 输出文件命名
\`${workspace}${WIKI_OUTPUT_DIR}${SUBTASK_OUTPUT_FILENAMES.SERVICE_DEPENDENCIES_TASK_FILE}\`
注意：如果${workspace}${WIKI_OUTPUT_DIR}目录不存在，则创建。

## 示例输出特征
基于项目的依赖分析特征：
- 详细的服务间调用关系表格
- 清晰的数据依赖和配置依赖分析
- 全面的第三方服务依赖评估
- 完整的依赖管理策略和监控方案
`

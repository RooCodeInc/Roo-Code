import { WIKI_OUTPUT_DIR, SUBTASK_OUTPUT_FILENAMES } from "./constants"

export const SERVICE_ANALYSIS_TEMPLATE = (workspace: string) => `# 服务模块深度分析

## 使用场景
从代码仓库中分析各个服务模块的架构、功能、接口、依赖关系等，生成详细的服务模块技术文档。

## 输入要求
- **完整代码仓库**: 项目的完整源代码
- **服务配置**: 各服务的配置文件
- **接口定义**: 服务间接口定义
- **依赖关系**: 服务间依赖关系配置

# 服务模块深度分析任务

## 任务描述
请深度分析项目中的各个服务模块，从服务架构、功能特性、接口设计、依赖关系、性能特性等维度生成完整的服务模块技术文档。

## 分析维度

### 1. 服务架构分析
#### 服务分层架构
\`\`\`mermaid
graph TB
    subgraph "接入层"
        A[API网关]
        B[WebSocket网关]
        C[负载均衡器]
    end
    
    subgraph "业务层"
        D[Management服务]
        E[Collector服务]
        F[IDM服务]
    end
    
    subgraph "数据层"
        G[数据访问层]
        H[缓存层]
        I[消息层]
    end
    
    subgraph "基础设施层"
        J[数据库]
        K[缓存]
        L[消息队列]
        M[监控]
    end
    
    A --> D
    A --> E
    A --> F
    B --> D
    C --> D
    C --> E
    C --> F
    D --> G
    D --> H
    D --> I
    E --> G
    E --> H
    E --> I
    F --> G
    F --> H
    F --> I
    G --> J
    H --> K
    I --> L
    J --> M
    K --> M
    L --> M
\`\`\`

#### 架构模式
- **微服务架构**: 服务独立部署和扩展
- **分层架构**: 清晰的层次结构
- **事件驱动架构**: 基于事件的异步通信
- **API网关模式**: 统一的API入口

### 2. 服务功能分析
#### 核心服务功能
| 服务名称 | 核心功能 | 业务价值 | 技术特点 |
|----------|----------|----------|----------|
| Management | 用户管理、数据管理 | 核心业务支撑 | REST API、事务处理 |
| Collector | 数据收集、处理 | 数据采集分析 | 高并发、流式处理 |
| IDM | 身份认证、授权 | 安全保障 | OAuth2、JWT |

### 3. 服务接口分析
#### REST API接口
| 服务 | 接口路径 | HTTP方法 | 功能描述 | 参数 |
|------|----------|----------|----------|------|
| Management | /api/v1/users | GET | 获取用户列表 | page, size |
| Management | /api/v1/users/{id} | DELETE | 删除用户 | - |
| Collector | /api/v1/data | POST | 提交数据 | data payload |
| Collector | /api/v1/data/batch | POST | 批量提交数据 | data array |
| IDM | /api/v1/auth/login | POST | 用户登录 | credentials |
| IDM | /api/v1/auth/logout | POST | 用户登出 | - |
| IDM | /api/v1/auth/refresh | POST | 刷新令牌 | refresh token |

#### gRPC接口示例
\`\`\`go
service CollectorService {
    rpc CollectData(CollectDataRequest) returns (CollectDataResponse);
    rpc ProcessData(ProcessDataRequest) returns (ProcessDataResponse);
    rpc GetMetrics(GetMetricsRequest) returns (GetMetricsResponse);
}
\`\`\`

#### WebSocket接口
| 服务 | 事件类型 | 数据格式 | 用途 |
|------|----------|----------|------|
| Management | user.created | JSON | 用户创建通知 |
| Management | user.deleted | JSON | 用户删除通知 |
| Collector | data.received | JSON | 数据接收通知 |
| IDM | auth.login | JSON | 用户登录事件 |
| IDM | auth.logout | JSON | 用户登出事件 |

### 4. 服务依赖分析
#### 依赖服务详情
| 服务 | 依赖服务 | 依赖类型 | 依赖方式 | 故障影响 |
|------|----------|----------|----------|----------|
| Management | IDM | 强依赖 | 同步调用 | 无法进行用户操作 |
| Management | Redis | 弱依赖 | 缓存 | 性能下降 |
| Collector | PostgreSQL | 强依赖 | 数据存储 | 无法存储数据 |
| Collector | Pulsar | 强依赖 | 消息队列 | 无法处理消息 |
| IDM | PostgreSQL | 强依赖 | 数据存储 | 无法验证用户 |

### 5. 服务配置分析
#### 配置结构示例
\`\`\`yaml
management:
  server:
    host: "0.0.0.0"
    port: 8080
    read_timeout: "30s"
    write_timeout: "30s"
  database:
    host: "localhost"
    port: 5432
    database: "management"
    max_connections: 100
  cache:
    host: "localhost"
    port: 6379
    pool_size: 10
  auth:
    jwt_secret: "secret"
    jwt_expire: "24h"
\`\`\`

#### 配置管理策略
- **环境配置**: 开发、测试、生产环境配置分离
- **配置中心**: 集中配置管理和动态更新
- **配置加密**: 敏感配置信息加密存储
- **配置验证**: 配置格式和有效性验证

### 6. 服务性能分析
#### 性能指标
| 服务 | 指标类型 | 指标名称 | 目标值 | 当前值 |
|------|----------|----------|--------|--------|
| Management | 响应时间 | API平均响应时间 | <100ms | 85ms |
| Management | 错误率 | API错误率 | <1% | 0.5% |
| Collector | 响应时间 | 数据处理时间 | <50ms | 45ms |
| Collector | 错误率 | 处理错误率 | <0.1% | 0.05% |
| IDM | 响应时间 | 认证响应时间 | <200ms | 180ms |
| IDM | 吞吐量 | 认证请求量 | 500/s | 450/s |


### 7. 服务监控分析
#### 监控指标
| 服务 | 监控类型 | 指标名称 | 阈值 | 告警级别 |
|------|----------|----------|------|----------|
| Management | 系统监控 | CPU使用率 | >80% | 警告 |
| Management | 业务监控 | API请求量 | >10000 QPS | 警告 |
| Management | 业务监控 | API错误率 | >5% | 警告 |
| Collector | 系统监控 | CPU使用率 | >80% | 警告 |
| Collector | 业务监控 | 处理延迟 | >100ms | 警告 |
| IDM | 系统监控 | CPU使用率 | >80% | 警告 |
| IDM | 业务监控 | 认证失败率 | >10% | 警告 |

### 8. 服务安全分析
#### 安全措施
| 服务 | 安全类型 | 安全措施 | 实现方式 |
|------|----------|----------|----------|
| Management | 身份认证 | JWT令牌认证 | 中间件拦截 |
| Management | 权限控制 | RBAC权限控制 | 权限中间件 |
| Management | 数据加密 | 敏感数据加密 | AES加密 |
| Management | 输入验证 | 参数验证 | 验证中间件 |
| Collector | 身份认证 | API密钥认证 | 密钥验证 |
| Collector | 数据验证 | 数据格式验证 | Schema验证 |
| Collector | 限流保护 | 请求限流 | 限流中间件 |
| IDM | 身份认证 | OAuth2认证 | OAuth2流程 |
| IDM | 密码安全 | 密码哈希 | bcrypt哈希 |
| IDM | 会话管理 | 会话令牌 | JWT令牌 |

#### 安全策略
- **认证策略**: 多因素认证、单点登录
- **授权策略**: 基于角色的访问控制
- **加密策略**: 传输加密、存储加密
- **审计策略**: 操作审计、日志记录

## 输出格式要求

生成完整的服务模块分析文档：

### 文档结构
\`\`\`\`markdown
# {项目名称} 服务模块分析

## 服务架构概览

### 服务分层架构
[使用上述Mermaid图表]

### 服务架构特点
- **微服务架构**: 服务独立部署和扩展
- **分层架构**: 清晰的层次结构
- **事件驱动架构**: 基于事件的异步通信
- **API网关模式**: 统一的API入口

## {服务名称}服务分析

### 服务概述
- **服务名称**: {服务名称}
- **服务描述**: {服务功能描述}
- **技术栈**: {技术栈列表}
- **部署方式**: {部署方式}

### 核心功能模块
\`\`\`go
// 功能模块示例
type {ServiceName}Module struct {
    // 模块字段
}
\`\`\`

### REST API接口
| 接口路径 | HTTP方法 | 功能描述 | 参数 | 返回值 |
|----------|----------|----------|------|--------|
| {接口详情} |

### 数据模型
\`\`\`go
// 数据模型示例
type {ModelName} struct {
    // 模型字段
}
\`\`\`

### 服务依赖关系
\`\`\`mermaid
graph TB
    // 依赖关系图
\`\`\`

### 性能特性
| 指标类型 | 指标名称 | 目标值 | 当前值 | 状态 |
|----------|----------|--------|--------|------|
| {性能指标详情} |

### 监控指标
- **系统监控**: CPU使用率、内存使用率、磁盘使用率、网络流量
- **业务监控**: API请求量、响应时间、错误率、并发数
- **数据库监控**: 连接数、查询性能、慢查询、锁等待
- **缓存监控**: 缓存命中率、内存使用率、键数量

## 服务间通信分析

### 通信方式
| 通信方式 | 使用场景 | 协议 | 特点 |
|----------|----------|------|------|
| HTTP REST | 同步API调用 | HTTP/1.1 | 简单易用，广泛支持 |
| gRPC | 高性能服务间通信 | HTTP/2 | 高性能，强类型 |
| WebSocket | 实时双向通信 | WebSocket | 实时性，双向通信 |
| Message Queue | 异步消息传递 | AMQP/MQTT | 异步解耦，可靠性 |

### 通信协议选择
- **HTTP REST**: 简单的CRUD操作，外部API
- **gRPC**: 内部服务间高性能通信
- **WebSocket**: 实时通知和事件推送
- **Message Queue**: 异步事件处理和消息传递

## 服务部署分析

### 部署架构
\`\`\`mermaid
graph TB
    subgraph "负载均衡层"
        LB[负载均衡器]
    end
    
    subgraph "API网关层"
        GW[API网关]
    end
    
    subgraph "服务层"
        M1[Management-1]
        M2[Management-2]
        C1[Collector-1]
        C2[Collector-2]
        I1[IDM-1]
        I2[IDM-2]
    end
    
    subgraph "数据层"
        DB[(PostgreSQL集群)]
        Cache[(Redis集群)]
        MQ[(Pulsar集群)]
        ES[(Elasticsearch集群)]
    end
    
    LB --> GW
    GW --> M1
    GW --> M2
    GW --> C1
    GW --> C2
    GW --> I1
    GW --> I2
    M1 --> DB
    M2 --> DB
    C1 --> DB
    C2 --> DB
    I1 --> DB
    I2 --> DB
    M1 --> Cache
    M2 --> Cache
    C1 --> MQ
    C2 --> MQ
    C1 --> ES
    C2 --> ES
\`\`\`

### 部署策略
- **容器化部署**: Docker容器化，便于管理和扩展
- **负载均衡**: 多实例部署，负载均衡分发
- **自动扩展**: 基于CPU、内存、QPS自动扩展
- **健康检查**: 定期健康检查，自动故障转移

\`\`\`\`

## 特别注意事项
1. 必须基于实际的代码和配置进行分析，不能虚构服务功能
2. 重点分析核心服务的关键功能和接口
3. 关注服务间的依赖关系和通信方式

## 输出文件命名
\`${workspace}${WIKI_OUTPUT_DIR}${SUBTASK_OUTPUT_FILENAMES.SERVICE_ANALYSIS_TASK_FILE}\`
注意：如果${workspace}${WIKI_OUTPUT_DIR}目录不存在，则创建。

## 示例输出特征
基于项目的服务分析特征：
- 详细的服务架构和功能模块分析
- 完整的API接口和数据模型定义
- 全面的服务依赖关系和通信方式分析
- 具体的性能特性和监控指标
`

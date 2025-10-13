import { WIKI_OUTPUT_DIR, SUBTASK_OUTPUT_FILENAMES } from "./constants"

export const SERVICE_ANALYSIS_TEMPLATE = `# 服务模块深度分析

## 使用场景
从代码仓库中分析各个服务模块的架构、功能、接口、依赖关系等，生成详细的服务模块技术文档。

## 输入要求
- **前置任务分析结果**:（如果文件不存在则忽略）
  - \`${WIKI_OUTPUT_DIR}${SUBTASK_OUTPUT_FILENAMES.PROJECT_OVERVIEW_TASK_FILE}\`
  - \`${WIKI_OUTPUT_DIR}${SUBTASK_OUTPUT_FILENAMES.OVERALL_ARCHITECTURE_TASK_FILE}\`
  - \`${WIKI_OUTPUT_DIR}${SUBTASK_OUTPUT_FILENAMES.SERVICE_DEPENDENCIES_TASK_FILE}\`
  - \`${WIKI_OUTPUT_DIR}${SUBTASK_OUTPUT_FILENAMES.DATA_FLOW_INTEGRATION_TASK_FILE}\`
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

#### 服务架构模式
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

#### 服务功能模块
\`\`\`go
// Management服务功能模块
type ManagementService struct {
    userModule     *UserModule
    dataModule     *DataModule
    configModule   *ConfigModule
    auditModule    *AuditModule
}

// Collector服务功能模块
type CollectorService struct {
    collectModule  *CollectModule
    processModule  *ProcessModule
    storageModule  *StorageModule
    monitorModule  *MonitorModule
}

// IDM服务功能模块
type IDMService struct {
    authModule     *AuthModule
    userModule     *UserModule
    roleModule     *RoleModule
    permissionModule *PermissionModule
}
\`\`\`

### 3. 服务接口分析
#### REST API接口
| 服务 | 接口路径 | HTTP方法 | 功能描述 | 参数 |
|------|----------|----------|----------|------|
| Management | /api/v1/users | GET | 获取用户列表 | page, size |
| Management | /api/v1/users | POST | 创建用户 | user data |
| Management | /api/v1/users/{id} | PUT | 更新用户 | user data |
| Management | /api/v1/users/{id} | DELETE | 删除用户 | - |
| Collector | /api/v1/data | POST | 提交数据 | data payload |
| Collector | /api/v1/data/batch | POST | 批量提交数据 | data array |
| IDM | /api/v1/auth/login | POST | 用户登录 | credentials |
| IDM | /api/v1/auth/logout | POST | 用户登出 | - |
| IDM | /api/v1/auth/refresh | POST | 刷新令牌 | refresh token |

#### gRPC接口
\`\`\`go
// Management服务gRPC接口
service ManagementService {
    rpc GetUser(GetUserRequest) returns (GetUserResponse);
    rpc CreateUser(CreateUserRequest) returns (CreateUserResponse);
    rpc UpdateUser(UpdateUserRequest) returns (UpdateUserResponse);
    rpc DeleteUser(DeleteUserRequest) returns (DeleteUserResponse);
}

// Collector服务gRPC接口
service CollectorService {
    rpc CollectData(CollectDataRequest) returns (CollectDataResponse);
    rpc ProcessData(ProcessDataRequest) returns (ProcessDataResponse);
    rpc GetMetrics(GetMetricsRequest) returns (GetMetricsResponse);
}

// IDM服务gRPC接口
service IDMService {
    rpc Authenticate(AuthenticateRequest) returns (AuthenticateResponse);
    rpc Authorize(AuthorizeRequest) returns (AuthorizeResponse);
    rpc RefreshToken(RefreshTokenRequest) returns (RefreshTokenResponse);
}
\`\`\`

#### WebSocket接口
| 服务 | 事件类型 | 数据格式 | 用途 |
|------|----------|----------|------|
| Management | user.created | JSON | 用户创建通知 |
| Management | user.updated | JSON | 用户更新通知 |
| Management | user.deleted | JSON | 用户删除通知 |
| Collector | data.received | JSON | 数据接收通知 |
| Collector | data.processed | JSON | 数据处理完成 |
| IDM | auth.login | JSON | 用户登录事件 |
| IDM | auth.logout | JSON | 用户登出事件 |

### 4. 服务依赖分析
#### 服务间依赖关系
\`\`\`mermaid
graph TB
    subgraph "Management服务"
        M1[用户管理]
        M2[数据管理]
        M3[配置管理]
    end
    
    subgraph "Collector服务"
        C1[数据收集]
        C2[数据处理]
        C3[数据存储]
    end
    
    subgraph "IDM服务"
        I1[身份认证]
        I2[用户管理]
        I3[权限管理]
    end
    
    subgraph "外部依赖"
        D1[(PostgreSQL)]
        D2[(Redis)]
        D3[(Pulsar)]
        D4[(Elasticsearch)]
    end
    
    M1 --> I1
    M1 --> I2
    M2 --> C1
    M2 --> C2
    M3 --> D2
    C1 --> D3
    C2 --> D4
    C3 --> D1
    I1 --> D1
    I2 --> D1
    I3 --> D2
    M1 --> D1
    M2 --> D1
\`\`\`

#### 依赖服务详情
| 服务 | 依赖服务 | 依赖类型 | 依赖方式 | 故障影响 |
|------|----------|----------|----------|----------|
| Management | IDM | 强依赖 | 同步调用 | 无法进行用户操作 |
| Management | PostgreSQL | 强依赖 | 数据存储 | 无法存储数据 |
| Management | Redis | 弱依赖 | 缓存 | 性能下降 |
| Collector | PostgreSQL | 强依赖 | 数据存储 | 无法存储数据 |
| Collector | Pulsar | 强依赖 | 消息队列 | 无法处理消息 |
| Collector | Elasticsearch | 弱依赖 | 搜索 | 搜索功能不可用 |
| IDM | PostgreSQL | 强依赖 | 数据存储 | 无法验证用户 |
| IDM | Redis | 弱依赖 | 缓存 | 性能下降 |

### 5. 服务配置分析
#### 服务配置结构
\`\`\`yaml
# Management服务配置
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
    username: "management"
    password: "password"
    max_connections: 100
    max_idle_connections: 10
  cache:
    host: "localhost"
    port: 6379
    password: ""
    db: 0
    pool_size: 10
  auth:
    jwt_secret: "secret"
    jwt_expire: "24h"
    refresh_expire: "168h"

# Collector服务配置
collector:
  server:
    host: "0.0.0.0"
    port: 8081
    read_timeout: "30s"
    write_timeout: "30s"
  database:
    host: "localhost"
    port: 5432
    database: "collector"
    username: "collector"
    password: "password"
    max_connections: 100
    max_idle_connections: 10
  message_queue:
    host: "localhost"
    port: 6650
    topic: "data-events"
    subscription: "collector-sub"
  elasticsearch:
    hosts: ["localhost:9200"]
    index: "collected-data"
    username: ""
    password: ""

# IDM服务配置
idm:
  server:
    host: "0.0.0.0"
    port: 8082
    read_timeout: "30s"
    write_timeout: "30s"
  database:
    host: "localhost"
    port: 5432
    database: "idm"
    username: "idm"
    password: "password"
    max_connections: 100
    max_idle_connections: 10
  cache:
    host: "localhost"
    port: 6379
    password: ""
    db: 1
    pool_size: 10
  oauth:
    client_id: "client-id"
    client_secret: "client-secret"
    redirect_uri: "http://localhost:8080/callback"
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
| Management | 吞吐量 | QPS | 1000 | 1200 |
| Management | 错误率 | API错误率 | <1% | 0.5% |
| Collector | 响应时间 | 数据处理时间 | <50ms | 45ms |
| Collector | 吞吐量 | 数据处理量 | 5000/s | 4800/s |
| Collector | 错误率 | 处理错误率 | <0.1% | 0.05% |
| IDM | 响应时间 | 认证响应时间 | <200ms | 180ms |
| IDM | 吞吐量 | 认证请求量 | 500/s | 450/s |
| IDM | 错误率 | 认证错误率 | <0.5% | 0.3% |

#### 性能优化策略
- **缓存优化**: 热点数据缓存和缓存策略优化
- **数据库优化**: 索引优化、查询优化、连接池优化
- **并发优化**: 协程池、连接池、资源池优化
- **网络优化**: 协议优化、压缩优化、负载均衡优化

### 7. 服务监控分析
#### 监控指标
| 服务 | 监控类型 | 指标名称 | 阈值 | 告警级别 |
|------|----------|----------|------|----------|
| Management | 系统监控 | CPU使用率 | >80% | 警告 |
| Management | 系统监控 | 内存使用率 | >85% | 警告 |
| Management | 系统监控 | 磁盘使用率 | >90% | 严重 |
| Management | 业务监控 | API请求量 | >10000 QPS | 警告 |
| Management | 业务监控 | API错误率 | >5% | 警告 |
| Collector | 系统监控 | CPU使用率 | >80% | 警告 |
| Collector | 系统监控 | 内存使用率 | >85% | 警告 |
| Collector | 业务监控 | 数据处理量 | >5000/s | 警告 |
| Collector | 业务监控 | 处理延迟 | >100ms | 警告 |
| IDM | 系统监控 | CPU使用率 | >80% | 警告 |
| IDM | 系统监控 | 内存使用率 | >85% | 警告 |
| IDM | 业务监控 | 认证请求量 | >500/s | 警告 |
| IDM | 业务监控 | 认证失败率 | >10% | 警告 |

#### 监控实现
\`\`\`go
// 服务监控实现示例
type ServiceMonitor struct {
    cpuUsage     prometheus.Gauge
    memoryUsage  prometheus.Gauge
    requestCount prometheus.Counter
    errorCount   prometheus.Counter
    responseTime prometheus.Histogram
}

func (m *ServiceMonitor) RecordSystemMetrics() {
    cpuPercent := getCPUUsage()
    memoryPercent := getMemoryUsage()
    
    m.cpuUsage.Set(cpuPercent)
    m.memoryUsage.Set(memoryPercent)
}

func (m *ServiceMonitor) RecordRequest(duration time.Duration) {
    m.requestCount.Inc()
    m.responseTime.Observe(duration.Seconds())
}

func (m *ServiceMonitor) RecordError() {
    m.errorCount.Inc()
}
\`\`\`

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
\`\`\`markdown
# {项目名称} 服务模块分析

## 服务架构概览

### 服务分层架构
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

### 服务架构特点
- **微服务架构**: 服务独立部署和扩展
- **分层架构**: 清晰的层次结构
- **事件驱动架构**: 基于事件的异步通信
- **API网关模式**: 统一的API入口

## Management服务分析

### 服务概述
- **服务名称**: Management
- **服务描述**: 用户管理和数据管理核心服务
- **技术栈**: Go, Gin, GORM, PostgreSQL, Redis
- **部署方式**: Docker容器化部署

### 核心功能模块
\`\`\`go
type ManagementService struct {
    userModule     *UserModule
    dataModule     *DataModule
    configModule   *ConfigModule
    auditModule    *AuditModule
}

// 用户管理模块
type UserModule struct {
    userRepo     *UserRepository
    userCache    *UserCache
    userValidator *UserValidator
}

// 数据管理模块
type DataModule struct {
    dataRepo     *DataRepository
    dataProcessor *DataProcessor
    dataValidator *DataValidator
}

// 配置管理模块
type ConfigModule struct {
    configRepo   *ConfigRepository
    configCache  *ConfigCache
    configSync   *ConfigSync
}

// 审计模块
type AuditModule struct {
    auditRepo    *AuditRepository
    auditLogger  *AuditLogger
}
\`\`\`

### REST API接口
| 接口路径 | HTTP方法 | 功能描述 | 参数 | 返回值 |
|----------|----------|----------|------|--------|
| /api/v1/users | GET | 获取用户列表 | page, size, filter | UserListResponse |
| /api/v1/users | POST | 创建用户 | CreateUserRequest | UserResponse |
| /api/v1/users/{id} | GET | 获取用户详情 | - | UserResponse |
| /api/v1/users/{id} | PUT | 更新用户 | UpdateUserRequest | UserResponse |
| /api/v1/users/{id} | DELETE | 删除用户 | - | DeleteResponse |
| /api/v1/data | POST | 提交数据 | SubmitDataRequest | DataResponse |
| /api/v1/data/{id} | GET | 获取数据详情 | - | DataResponse |
| /api/v1/data/{id} | PUT | 更新数据 | UpdateDataRequest | DataResponse |
| /api/v1/data/{id} | DELETE | 删除数据 | - | DeleteResponse |

### 数据模型
\`\`\`go
// 用户模型
type User struct {
    ID           uuid.UUID \`json:"id" gorm:"primary_key"\`
    Username     string    \`json:"username" gorm:"unique;not null"\`
    Email        string    \`json:"email" gorm:"unique;not null"\`
    Password     string    \`json:"-" gorm:"not null"\`
    FirstName    string    \`json:"first_name"\`
    LastName     string    \`json:"last_name"\`
    Phone        string    \`json:"phone"\`
    Status       string    \`json:"status" gorm:"default:'active'\`
    CreatedAt    time.Time \`json:"created_at"\`
    UpdatedAt    time.Time \`json:"updated_at"\`
    DeletedAt    *time.Time \`json:"deleted_at"\`
}

// 数据模型
type Data struct {
    ID           uuid.UUID \`json:"id" gorm:"primary_key"\`
    UserID       uuid.UUID \`json:"user_id" gorm:"not null"\`
    Type         string    \`json:"type" gorm:"not null"\`
    Title        string    \`json:"title" gorm:"not null"\`
    Content      string    \`json:"content" gorm:"type:text"\`
    Metadata     JSON      \`json:"metadata" gorm:"type:jsonb"\`
    Status       string    \`json:"status" gorm:"default:'active'\`
    CreatedAt    time.Time \`json:"created_at"\`
    UpdatedAt    time.Time \`json:"updated_at"\`
    DeletedAt    *time.Time \`json:"deleted_at"\`
}
\`\`\`

### 服务依赖关系
\`\`\`mermaid
graph TB
    subgraph "Management服务"
        M1[用户管理]
        M2[数据管理]
        M3[配置管理]
        M4[审计模块]
    end
    
    subgraph "外部服务"
        I1[IDM服务]
        D1[(PostgreSQL)]
        D2[(Redis)]
        D3[(Pulsar)]
    end
    
    M1 --> I1
    M1 --> D1
    M1 --> D2
    M2 --> D1
    M2 --> D2
    M2 --> D3
    M3 --> D2
    M4 --> D1
\`\`\`

### 性能特性
| 指标类型 | 指标名称 | 目标值 | 当前值 | 状态 |
|----------|----------|--------|--------|------|
| 响应时间 | API平均响应时间 | <100ms | 85ms | 正常 |
| 吞吐量 | QPS | 1000 | 1200 | 正常 |
| 错误率 | API错误率 | <1% | 0.5% | 正常 |
| 并发数 | 最大并发连接数 | 1000 | 800 | 正常 |
| 内存使用 | 内存使用率 | <80% | 65% | 正常 |
| CPU使用 | CPU使用率 | <70% | 45% | 正常 |

### 监控指标
- **系统监控**: CPU使用率、内存使用率、磁盘使用率、网络流量
- **业务监控**: API请求量、响应时间、错误率、并发数
- **数据库监控**: 连接数、查询性能、慢查询、锁等待
- **缓存监控**: 缓存命中率、内存使用率、键数量

## Collector服务分析

### 服务概述
- **服务名称**: Collector
- **服务描述**: 数据收集和处理服务
- **技术栈**: Go, Gin, GORM, PostgreSQL, Pulsar, Elasticsearch
- **部署方式**: Docker容器化部署

### 核心功能模块
\`\`\`go
type CollectorService struct {
    collectModule  *CollectModule
    processModule  *ProcessModule
    storageModule  *StorageModule
    monitorModule  *MonitorModule
}

// 数据收集模块
type CollectModule struct {
    dataReceiver  *DataReceiver
    dataValidator *DataValidator
    dataBuffer    *DataBuffer
}

// 数据处理模块
type ProcessModule struct {
    dataProcessor *DataProcessor
    dataEnricher  *DataEnricher
    dataNormalizer *DataNormalizer
}

// 数据存储模块
type StorageModule struct {
    dataStorage   *DataStorage
    indexStorage  *IndexStorage
    backupStorage *BackupStorage
}

// 监控模块
type MonitorModule struct {
    metricsCollector *MetricsCollector
    alertManager    *AlertManager
    healthChecker   *HealthChecker
}
\`\`\`

### REST API接口
| 接口路径 | HTTP方法 | 功能描述 | 参数 | 返回值 |
|----------|----------|----------|------|--------|
| /api/v1/data | POST | 提交数据 | SubmitDataRequest | DataResponse |
| /api/v1/data/batch | POST | 批量提交数据 | BatchSubmitRequest | BatchResponse |
| /api/v1/data/{id} | GET | 获取数据详情 | - | DataResponse |
| /api/v1/data/search | POST | 搜索数据 | SearchRequest | SearchResponse |
| /api/v1/metrics | GET | 获取指标 | - | MetricsResponse |
| /api/v1/health | GET | 健康检查 | - | HealthResponse |

### 消息队列接口
| 主题(Topic) | 消息类型 | 数据格式 | 用途 |
|------------|----------|----------|------|
| data-events | data.received | JSON | 数据接收事件 |
| data-events | data.processed | JSON | 数据处理完成 |
| data-events | data.stored | JSON | 数据存储完成 |
| system-events | health.check | JSON | 健康检查事件 |
| system-events | metrics.update | JSON | 指标更新事件 |

### 数据处理流程
\`\`\`mermaid
graph TB
    A[数据接收] --> B[数据验证]
    B --> C[数据标准化]
    C --> D[数据丰富]
    D --> E[数据存储]
    E --> F[索引构建]
    F --> G[事件发布]
    G --> H[监控更新]
    
    subgraph "数据验证"
        B1[格式验证]
        B2[完整性验证]
        B3[业务规则验证]
    end
    
    subgraph "数据标准化"
        C1[格式转换]
        C2[单位统一]
        C3[时间标准化]
    end
    
    subgraph "数据丰富"
        D1[元数据添加]
        D2[地理位置解析]
        D3[标签分类]
    end
    
    subgraph "数据存储"
        E1[PostgreSQL存储]
        E2[Elasticsearch索引]
        E3[备份存储]
    end
    
    B --> B1
    B --> B2
    B --> B3
    C --> C1
    C --> C2
    C --> C3
    D --> D1
    D --> D2
    D --> D3
    E --> E1
    E --> E2
    E --> E3
\`\`\`

### 性能特性
| 指标类型 | 指标名称 | 目标值 | 当前值 | 状态 |
|----------|----------|--------|--------|------|
| 响应时间 | 数据处理时间 | <50ms | 45ms | 正常 |
| 吞吐量 | 数据处理量 | 5000/s | 4800/s | 正常 |
| 错误率 | 处理错误率 | <0.1% | 0.05% | 正常 |
| 并发数 | 最大并发处理数 | 10000 | 8500 | 正常 |
| 内存使用 | 内存使用率 | <80% | 70% | 正常 |
| CPU使用 | CPU使用率 | <70% | 55% | 正常 |

## IDM服务分析

### 服务概述
- **服务名称**: IDM
- **服务描述**: 身份认证和权限管理服务
- **技术栈**: Go, Gin, GORM, PostgreSQL, Redis, OAuth2
- **部署方式**: Docker容器化部署

### 核心功能模块
\`\`\`go
type IDMService struct {
    authModule     *AuthModule
    userModule     *UserModule
    roleModule     *RoleModule
    permissionModule *PermissionModule
}

// 认证模块
type AuthModule struct {
    authProvider  *AuthProvider
    tokenManager  *TokenManager
    passwordHasher *PasswordHasher
}

// 用户模块
type UserModule struct {
    userRepo     *UserRepository
    userCache    *UserCache
    userValidator *UserValidator
}

// 角色模块
type RoleModule struct {
    roleRepo     *RoleRepository
    roleCache    *RoleCache
    roleValidator *RoleValidator
}

// 权限模块
type PermissionModule struct {
    permissionRepo *PermissionRepository
    permissionCache *PermissionCache
    permissionChecker *PermissionChecker
}
\`\`\`

### REST API接口
| 接口路径 | HTTP方法 | 功能描述 | 参数 | 返回值 |
|----------|----------|----------|------|--------|
| /api/v1/auth/login | POST | 用户登录 | LoginRequest | AuthResponse |
| /api/v1/auth/logout | POST | 用户登出 | - | LogoutResponse |
| /api/v1/auth/refresh | POST | 刷新令牌 | RefreshRequest | AuthResponse |
| /api/v1/auth/register | POST | 用户注册 | RegisterRequest | UserResponse |
| /api/v1/users | GET | 获取用户列表 | page, size | UserListResponse |
| /api/v1/users/{id} | GET | 获取用户详情 | - | UserResponse |
| /api/v1/roles | GET | 获取角色列表 | page, size | RoleListResponse |
| /api/v1/permissions | GET | 获取权限列表 | page, size | PermissionListResponse |

### OAuth2流程
\`\`\`mermaid
sequenceDiagram
    participant U as 用户
    participant C as 客户端
    participant A as 授权服务器
    participant R as 资源服务器
    
    U->>C: 访问受保护资源
    C->>A: 请求授权
    A->>U: 重定向到登录页面
    U->>A: 输入用户名密码
    A->>U: 授权确认
    U->>A: 确认授权
    A->>C: 返回授权码
    C->>A: 用授权码换取访问令牌
    A->>C: 返回访问令牌
    C->>R: 用访问令牌请求资源
    R->>A: 验证访问令牌
    A->>R: 令牌验证结果
    R->>C: 返回受保护资源
    C->>U: 显示资源内容
\`\`\`

### 权限控制模型
\`\`\`go
// RBAC权限模型
type User struct {
    ID           uuid.UUID \`json:"id"\`
    Username     string    \`json:"username"\`
    Email        string    \`json:"email"\`
    Roles        []Role    \`json:"roles" gorm:"many2many:user_roles;"\`
}

type Role struct {
    ID           uuid.UUID \`json:"id"\`
    Name         string    \`json:"name"\`
    Description  string    \`json:"description"\`
    Permissions  []Permission \`json:"permissions" gorm:"many2many:role_permissions;"\`
}

type Permission struct {
    ID           uuid.UUID \`json:"id"\`
    Name         string    \`json:"name"\`
    Resource     string    \`json:"resource"\`
    Action       string    \`json:"action"\`
    Description  string    \`json:"description"\`
}

// 权限检查函数
func (u *User) HasPermission(resource, action string) bool {
    for _, role := range u.Roles {
        for _, permission := range role.Permissions {
            if permission.Resource == resource && permission.Action == action {
                return true
            }
        }
    }
    return false
}
\`\`\`

### 性能特性
| 指标类型 | 指标名称 | 目标值 | 当前值 | 状态 |
|----------|----------|--------|--------|------|
| 响应时间 | 认证响应时间 | <200ms | 180ms | 正常 |
| 吞吐量 | 认证请求量 | 500/s | 450/s | 正常 |
| 错误率 | 认证错误率 | <0.5% | 0.3% | 正常 |
| 并发数 | 最大并发认证数 | 1000 | 800 | 正常 |
| 内存使用 | 内存使用率 | <80% | 60% | 正常 |
| CPU使用 | CPU使用率 | <70% | 40% | 正常 |

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

## 总结

### 服务架构特点
- {服务架构主要特点总结}
- {技术栈选择总结}
- {部署方式总结}
- {性能特性总结}

### 优化建议
- {服务性能优化建议}
- {服务可靠性优化建议}
- {服务安全性优化建议}
- {服务可维护性优化建议}
\`\`\`

## 特别注意事项
1. 必须基于实际的代码和配置进行分析，不能虚构服务功能
2. 重点分析核心服务的关键功能和接口
3. 关注服务间的依赖关系和通信方式
4. 识别性能瓶颈和优化空间
5. 提供实用的部署和运维建议

## 输出文件命名
\`${WIKI_OUTPUT_DIR}${SUBTASK_OUTPUT_FILENAMES.SERVICE_ANALYSIS_TASK_FILE}\`
注意：如果${WIKI_OUTPUT_DIR} 目录不存在，则创建。

## 示例输出特征
基于项目的服务分析特征：
- 详细的服务架构和功能模块分析
- 完整的API接口和数据模型定义
- 全面的服务依赖关系和通信方式分析
- 具体的性能特性和监控指标
- 实用的部署策略和优化建议
`

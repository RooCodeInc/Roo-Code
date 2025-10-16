import { WIKI_OUTPUT_DIR, SUBTASK_OUTPUT_FILENAMES } from "./constants"

export const API_INTERFACE_ANALYSIS_TEMPLATE = (workspace: string) => `# API接口深度分析

## 使用场景
从代码仓库中分析API接口设计、接口规范、数据格式、错误处理等，生成详细的API接口技术文档。

## 输入要求
- **完整代码仓库**: 项目的完整源代码
- **API定义文件**: API接口定义和规范文件
- **路由配置**: API路由和控制器配置
- **数据模型**: API请求和响应数据模型

## 分析维度

### 1. API架构分析
#### API架构模式
\`\`\`mermaid
graph TB
    subgraph "API网关层"
        GW[API网关]
        LB[负载均衡器]
    end
    
    subgraph "路由层"
        R1[路由管理器]
        R2[中间件链]
        R3[请求处理器]
    end
    
    subgraph "业务层"
        S1[Management服务]
        S2[Collector服务]
        S3[IDM服务]
    end
    
    subgraph "数据层"
        D1[数据访问层]
        D2[缓存层]
        D3[消息层]
    end
    
    GW --> LB --> R1 --> R2 --> R3
    R3 --> S1 & S2 & S3
    S1 & S2 & S3 --> D1 & D2 & D3
\`\`\`

#### API架构特点
- **RESTful架构**: 遵循REST设计原则
- **分层架构**: 清晰的层次结构
- **中间件模式**: 可插拔的中间件处理
- **统一响应**: 统一的响应格式和错误处理

### 2. API接口分类分析
#### 按功能分类
| 分类 | 接口数量 | 主要功能 | 访问频率 | 安全级别 |
|------|----------|----------|----------|----------|
| 用户管理 | {数量} | 用户注册、登录、管理 | 高 | 高 |
| 数据管理 | {数量} | 数据CRUD操作 | 高 | 中 |
| 系统配置 | {数量} | 配置管理 | 中 | 高 |
| 审计日志 | {数量} | 日志查询 | 低 | 高 |
| 健康检查 | {数量} | 系统状态检查 | 中 | 低 |

#### 按HTTP方法分类
| HTTP方法 | 接口数量 | 主要用途 | 幂等性 | 安全性 |
|----------|----------|----------|--------|--------|
| GET | {数量} | 数据查询 | 是 | 安全 |
| POST | {数量} | 数据创建 | 否 | 不安全 |
| PUT | {数量} | 数据更新 | 是 | 不安全 |
| DELETE | {数量} | 数据删除 | 是 | 不安全 |
| PATCH | {数量} | 部分更新 | 否 | 不安全 |

### 3. 核心API接口详细分析
#### 用户管理API
##### 用户注册
\`\`\`http
POST /api/v1/auth/register
Content-Type: application/json

{
  "username": "string",
  "email": "string",
  "password": "string"
}
\`\`\`

**响应示例**:
\`\`\`json
{
  "code": 201,
  "message": "User registered successfully",
  "data": {
    "id": "uuid",
    "username": "string",
    "status": "active",
    "created_at": "2024-01-01T00:00:00Z"
  }
}
\`\`\`

##### 用户登录
\`\`\`http
POST /api/v1/auth/login
Content-Type: application/json

{
  "username": "string",
  "password": "string"
}
\`\`\`

**响应示例**:
\`\`\`json
{
  "code": 200,
  "message": "Login successful",
  "data": {
    "access_token": "string",
    "refresh_token": "string",
    "expires_in": 3600,
    "user": {
      "id": "uuid",
      "username": "string",
      "roles": ["user"]
    }
  }
}
\`\`\`

#### 数据管理API
##### 提交数据
\`\`\`http
POST /api/v1/data
Authorization: Bearer <token>

{
  "type": "string",
  "title": "string",
  "content": "string",
  "metadata": {"key": "value"},
  "tags": ["tag1", "tag2"]
}
\`\`\`

##### 获取数据详情
\`\`\`http
GET /api/v1/data/{id}
Authorization: Bearer <token>
\`\`\`

### 4. 数据模型分析
#### 请求模型
\`\`\`go
// 用户注册请求
type RegisterRequest struct {
    Username  string \`json:"username" validate:"required,min=3,max=50"\`
    Email     string \`json:"email" validate:"required,email"\`
    Password  string \`json:"password" validate:"required,min=8,max=100"\`
}

// 数据提交请求
type SubmitDataRequest struct {
    Type     string                 \`json:"type" validate:"required,max=50"\`
    Title    string                 \`json:"title" validate:"required,max=200"\`
    Content  string                 \`json:"content" validate:"max=10000"\`
    Metadata map[string]interface{} \`json:"metadata"\`
    Tags     []string               \`json:"tags"\`
}
\`\`\`

#### 响应模型
\`\`\`go
// 统一响应结构
type APIResponse struct {
    Code    int         \`json:"code"\`
    Message string      \`json:"message"\`
    Data    interface{} \`json:"data,omitempty"\`
    Error   string      \`json:"error,omitempty"\`
}

// 用户响应
type UserResponse struct {
    ID        uuid.UUID \`json:"id"\`
    Username  string    \`json:"username"\`
    Email     string    \`json:"email"\`
    Status    string    \`json:"status"\`
    CreatedAt time.Time \`json:"created_at"\`
}
\`\`\`

### 5. 错误处理分析
#### 错误码定义
| 错误码 | HTTP状态码 | 描述 |
|--------|------------|------|
| 200 | 200 | 请求成功 |
| 201 | 201 | 资源创建成功 |
| 400 | 400 | 请求参数错误 |
| 401 | 401 | 未授权访问 |
| 403 | 403 | 禁止访问 |
| 404 | 404 | 资源不存在 |
| 409 | 409 | 资源冲突 |
| 422 | 422 | 数据验证失败 |
| 500 | 500 | 服务器内部错误 |

#### 错误响应格式
\`\`\`json
{
  "code": 400,
  "message": "Bad request",
  "error": "Invalid request parameters",
  "details": {
    "field": "username",
    "message": "Username is required"
  }
}
\`\`\`

### 6. 安全控制分析
#### 认证机制
- **JWT认证**: 基于JWT的无状态认证
- **Token刷新**: 支持访问令牌刷新
- **密码安全**: 密码哈希存储和强度验证
- **会话管理**: 会话超时和失效处理

#### 权限控制
- **RBAC模型**: 基于角色的访问控制
- **资源权限**: 细粒度的资源权限控制
- **权限检查**: 中间件级别的权限验证

#### 输入验证
- **参数验证**: 请求参数格式和类型验证
- **业务验证**: 业务规则和约束验证
- **SQL注入防护**: 参数化查询和输入过滤
- **XSS防护**: 输出编码和输入过滤

### 7. 性能优化分析
#### 缓存策略
| 缓存类型 | 缓存数据 | 过期时间 | 缓存键 |
|----------|----------|----------|--------|
| 用户信息 | 用户基本资料 | 30分钟 | user:{id} |
| 配置信息 | 系统配置 | 1小时 | config:{key} |
| API响应 | 查询结果 | 5分钟 | api:{path}:{hash} |
| 权限信息 | 用户权限 | 15分钟 | permissions:{id} |

#### 限流控制
- **请求限流**: 基于IP和用户的请求限流
- **并发控制**: 最大并发连接数控制
- **熔断保护**: 服务熔断和快速失败
- **降级处理**: 核心功能降级处理


### 8. API文档分析
#### Swagger/OpenAPI文档
- **接口定义**: 完整的API接口定义
- **数据模型**: 请求和响应数据模型
- **错误处理**: 错误码和错误响应定义
- **示例代码**: 接口调用示例代码

#### 版本控制
- **版本管理**: API版本管理和兼容性
- **向后兼容**: 保持向后兼容性
- **废弃通知**: 接口废弃和迁移通知

## 输出格式要求

生成完整的API接口分析文档：

### 文档结构
\`\`\`\`markdown
# {项目名称} API接口分析

## API架构概览
### API架构模式
{基于实际项目的架构图}

### API架构特点
- {实际架构特点分析}

## API接口分类
### 按功能分类
{基于实际接口的分类统计表}

### 按HTTP方法分类
{基于实际接口的方法统计表}

## 核心API接口详细分析
### {实际业务模块1}API
#### {具体接口1}
- **URL**: {实际URL}
- **描述**: {接口功能描述}
- **认证**: {认证要求}
- **权限**: {权限要求}

**请求参数**:
{实际请求参数格式}

**响应示例**:
{实际响应格式}

**错误码**:
{实际错误码定义}

### {实际业务模块2}API
{类似格式的其他核心接口}

## 数据模型分析
### 请求模型
{基于实际代码的请求模型定义}

### 响应模型
{基于实际代码的响应模型定义}

## 错误处理分析
### 错误码定义
{实际项目的错误码体系}

### 错误响应格式
{实际错误响应格式}

### 错误处理策略
{实际错误处理机制}

## 安全控制分析
### 认证机制
{实际认证方式分析}

### 权限控制
{实际权限控制机制}

### 输入验证
{实际输入验证策略}

## 性能优化分析
### 缓存策略
{实际缓存实现分析}

### 限流控制
{实际限流机制分析}

### 压缩优化
{实际优化措施分析}

## API文档分析
### Swagger/OpenAPI文档
{实际API文档分析}

### 版本控制
{实际版本管理分析}
## 总结

### API设计特点
- {基于实际分析的设计特点}
\`\`\`\`

## 特别注意事项
1. 必须基于实际的代码和配置进行分析，不能虚构API接口
2. 重点分析核心业务API和关键接口设计
3. 关注API安全性和性能优化

## 输出文件命名
\`${workspace}${WIKI_OUTPUT_DIR}${SUBTASK_OUTPUT_FILENAMES.API_INTERFACE_TASK_FILE}\`
注意：如果${workspace}${WIKI_OUTPUT_DIR}目录不存在，则创建。

## 示例输出特征
基于项目的API分析特征：
- 详细的API接口定义和参数说明
- 完整的数据模型和响应格式定义
- 全面的错误处理和安全控制机制
- 具体的性能优化和缓存策略
- 实用的API文档和版本管理建议
`

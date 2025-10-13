import { WIKI_OUTPUT_DIR, SUBTASK_OUTPUT_FILENAMES } from "./constants"

export const API_INTERFACE_ANALYSIS_TEMPLATE = `# API接口深度分析

## 使用场景
从代码仓库中分析API接口设计、接口规范、数据格式、错误处理等，生成详细的API接口技术文档。

## 输入要求
- **前置任务分析结果**:（如果文件不存在则忽略）
  - \`${WIKI_OUTPUT_DIR}${SUBTASK_OUTPUT_FILENAMES.PROJECT_OVERVIEW_TASK_FILE}\`
  - \`${WIKI_OUTPUT_DIR}${SUBTASK_OUTPUT_FILENAMES.OVERALL_ARCHITECTURE_TASK_FILE}\`
  - \`${WIKI_OUTPUT_DIR}${SUBTASK_OUTPUT_FILENAMES.SERVICE_DEPENDENCIES_TASK_FILE}\`
  - \`${WIKI_OUTPUT_DIR}${SUBTASK_OUTPUT_FILENAMES.DATA_FLOW_INTEGRATION_TASK_FILE}\`
  - \`${WIKI_OUTPUT_DIR}${SUBTASK_OUTPUT_FILENAMES.SERVICE_ANALYSIS_TASK_FILE}\`
  - \`${WIKI_OUTPUT_DIR}${SUBTASK_OUTPUT_FILENAMES.DATABASE_SCHEMA_TASK_FILE}\`
- **完整代码仓库**: 项目的完整源代码
- **API定义文件**: API接口定义和规范文件
- **路由配置**: API路由和控制器配置
- **数据模型**: API请求和响应数据模型

# API接口深度分析任务

## 任务描述
请深度分析项目中的API接口，从接口设计、数据格式、错误处理、性能优化、安全控制等维度生成完整的API接口技术文档。

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
    
    GW --> LB
    LB --> R1
    R1 --> R2
    R2 --> R3
    R3 --> S1
    R3 --> S2
    R3 --> S3
    S1 --> D1
    S1 --> D2
    S1 --> D3
    S2 --> D1
    S2 --> D2
    S2 --> D3
    S3 --> D1
    S3 --> D2
    S3 --> D3
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
| 用户管理 | 8 | 用户注册、登录、管理 | 高 | 高 |
| 数据管理 | 12 | 数据CRUD操作 | 高 | 中 |
| 系统配置 | 6 | 配置管理 | 中 | 高 |
| 审计日志 | 4 | 日志查询 | 低 | 高 |
| 健康检查 | 2 | 系统状态检查 | 中 | 低 |

#### 按HTTP方法分类
| HTTP方法 | 接口数量 | 主要用途 | 幂等性 | 安全性 |
|----------|----------|----------|--------|--------|
| GET | 15 | 数据查询 | 是 | 安全 |
| POST | 8 | 数据创建 | 否 | 不安全 |
| PUT | 6 | 数据更新 | 是 | 不安全 |
| DELETE | 3 | 数据删除 | 是 | 不安全 |
| PATCH | 2 | 部分更新 | 否 | 不安全 |

### 3. API接口详细分析
#### 用户管理API
##### 用户注册
\`\`\`http
POST /api/v1/auth/register
Content-Type: application/json

{
  "username": "string",
  "email": "string",
  "password": "string",
  "first_name": "string",
  "last_name": "string",
  "phone": "string"
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
    "email": "string",
    "first_name": "string",
    "last_name": "string",
    "phone": "string",
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
    "token_type": "Bearer",
    "user": {
      "id": "uuid",
      "username": "string",
      "email": "string",
      "roles": ["user"]
    }
  }
}
\`\`\`

##### 获取用户列表
\`\`\`http
GET /api/v1/users?page=1&size=10&status=active
Authorization: Bearer <token>
\`\`\`

**响应示例**:
\`\`\`json
{
  "code": 200,
  "message": "Users retrieved successfully",
  "data": {
    "users": [
      {
        "id": "uuid",
        "username": "string",
        "email": "string",
        "first_name": "string",
        "last_name": "string",
        "status": "active",
        "created_at": "2024-01-01T00:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "size": 10,
      "total": 100,
      "pages": 10
    }
  }
}
\`\`\`

#### 数据管理API
##### 提交数据
\`\`\`http
POST /api/v1/data
Content-Type: application/json
Authorization: Bearer <token>

{
  "type": "string",
  "title": "string",
  "content": "string",
  "metadata": {
    "key": "value"
  },
  "tags": ["tag1", "tag2"]
}
\`\`\`

**响应示例**:
\`\`\`json
{
  "code": 201,
  "message": "Data submitted successfully",
  "data": {
    "id": "uuid",
    "type": "string",
    "title": "string",
    "content": "string",
    "metadata": {
      "key": "value"
    },
    "tags": ["tag1", "tag2"],
    "status": "active",
    "created_at": "2024-01-01T00:00:00Z"
  }
}
\`\`\`

##### 获取数据详情
\`\`\`http
GET /api/v1/data/{id}
Authorization: Bearer <token>
\`\`\`

**响应示例**:
\`\`\`json
{
  "code": 200,
  "message": "Data retrieved successfully",
  "data": {
    "id": "uuid",
    "user_id": "uuid",
    "type": "string",
    "title": "string",
    "content": "string",
    "metadata": {
      "key": "value"
    },
    "tags": [
      {
        "id": "uuid",
        "name": "tag1",
        "color": "#007bff"
      }
    ],
    "status": "active",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
}
\`\`\`

##### 搜索数据
\`\`\`http
POST /api/v1/data/search
Content-Type: application/json
Authorization: Bearer <token>

{
  "query": "string",
  "filters": {
    "type": "string",
    "status": "active",
    "tags": ["tag1"],
    "date_range": {
      "start": "2024-01-01T00:00:00Z",
      "end": "2024-12-31T23:59:59Z"
    }
  },
  "sort": {
    "field": "created_at",
    "order": "desc"
  },
  "pagination": {
    "page": 1,
    "size": 10
  }
}
\`\`\`

**响应示例**:
\`\`\`json
{
  "code": 200,
  "message": "Data search completed",
  "data": {
    "results": [
      {
        "id": "uuid",
        "type": "string",
        "title": "string",
        "content": "string",
        "metadata": {
          "key": "value"
        },
        "tags": ["tag1", "tag2"],
        "status": "active",
        "created_at": "2024-01-01T00:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "size": 10,
      "total": 50,
      "pages": 5
    }
  }
}
\`\`\`

#### 系统配置API
##### 获取配置
\`\`\`http
GET /api/v1/configurations
Authorization: Bearer <token>
\`\`\`

**响应示例**:
\`\`\`json
{
  "code": 200,
  "message": "Configurations retrieved successfully",
  "data": {
    "configurations": [
      {
        "id": "uuid",
        "key": "app.name",
        "value": "My Application",
        "description": "Application name",
        "data_type": "string",
        "is_system": false,
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-01-01T00:00:00Z"
      }
    ]
  }
}
\`\`\`

##### 更新配置
\`\`\`http
PUT /api/v1/configurations/{id}
Content-Type: application/json
Authorization: Bearer <token>

{
  "value": "string",
  "description": "string"
}
\`\`\`

**响应示例**:
\`\`\`json
{
  "code": 200,
  "message": "Configuration updated successfully",
  "data": {
    "id": "uuid",
    "key": "app.name",
    "value": "string",
    "description": "string",
    "data_type": "string",
    "is_system": false,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
}
\`\`\`

### 4. 数据模型分析
#### 请求模型
\`\`\`go
// 用户注册请求
type RegisterRequest struct {
    Username  string \`json:"username" validate:"required,min=3,max=50"\`
    Email     string \`json:"email" validate:"required,email"\`
    Password  string \`json:"password" validate:"required,min=8,max=100"\`
    FirstName string \`json:"first_name" validate:"max=50"\`
    LastName  string \`json:"last_name" validate:"max=50"\`
    Phone     string \`json:"phone" validate:"max=20"\`
}

// 用户登录请求
type LoginRequest struct {
    Username string \`json:"username" validate:"required"\`
    Password string \`json:"password" validate:"required"\`
}

// 数据提交请求
type SubmitDataRequest struct {
    Type     string                 \`json:"type" validate:"required,max=50"\`
    Title    string                 \`json:"title" validate:"required,max=200"\`
    Content  string                 \`json:"content" validate:"max=10000"\`
    Metadata map[string]interface{} \`json:"metadata"\`
    Tags     []string               \`json:"tags"\`
}

// 数据搜索请求
type SearchDataRequest struct {
    Query    string                 \`json:"query"\`
    Filters  map[string]interface{} \`json:"filters"\`
    Sort     map[string]string      \`json:"sort"\`
    Pagination PaginationRequest     \`json:"pagination"\`
}

// 分页请求
type PaginationRequest struct {
    Page  int \`json:"page" validate:"min=1"\`
    Size  int \`json:"size" validate:"min=1,max=100"\`
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
    FirstName string    \`json:"first_name"\`
    LastName  string    \`json:"last_name"\`
    Phone     string    \`json:"phone"\`
    Status    string    \`json:"status"\`
    CreatedAt time.Time \`json:"created_at"\`
}

// 数据响应
type DataResponse struct {
    ID        uuid.UUID              \`json:"id"\`
    UserID    uuid.UUID              \`json:"user_id"\`
    Type      string                 \`json:"type"\`
    Title     string                 \`json:"title"\`
    Content   string                 \`json:"content"\`
    Metadata  map[string]interface{} \`json:"metadata"\`
    Tags      []TagResponse          \`json:"tags"\`
    Status    string                 \`json:"status"\`
    CreatedAt time.Time              \`json:"created_at"\`
    UpdatedAt time.Time              \`json:"updated_at"\`
}

// 标签响应
type TagResponse struct {
    ID          uuid.UUID \`json:"id"\`
    Name        string    \`json:"name"\`
    Description string    \`json:"description"\`
    Color       string    \`json:"color"\`
}

// 分页响应
type PaginationResponse struct {
    Page  int \`json:"page"\`
    Size  int \`json:"size"\`
    Total int \`json:"total"\`
    Pages int \`json:"pages"\`
}

// 用户列表响应
type UserListResponse struct {
    Users      []UserResponse      \`json:"users"\`
    Pagination PaginationResponse \`json:"pagination"\`
}

// 数据搜索响应
type DataSearchResponse struct {
    Results    []DataResponse      \`json:"results"\`
    Pagination PaginationResponse \`json:"pagination"\`
}
\`\`\`

### 5. 错误处理分析
#### 错误码定义
| 错误码 | 错误类型 | HTTP状态码 | 描述 |
|--------|----------|------------|------|
| 200 | SUCCESS | 200 | 请求成功 |
| 201 | CREATED | 201 | 资源创建成功 |
| 400 | BAD_REQUEST | 400 | 请求参数错误 |
| 401 | UNAUTHORIZED | 401 | 未授权访问 |
| 403 | FORBIDDEN | 403 | 禁止访问 |
| 404 | NOT_FOUND | 404 | 资源不存在 |
| 409 | CONFLICT | 409 | 资源冲突 |
| 422 | VALIDATION_ERROR | 422 | 数据验证失败 |
| 500 | INTERNAL_ERROR | 500 | 服务器内部错误 |

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

#### 错误处理中间件
\`\`\`go
// 错误处理中间件
func ErrorHandler() gin.HandlerFunc {
    return func(c *gin.Context) {
        c.Next()
        
        // 获取最后一个错误
        err := c.Errors.Last()
        if err == nil {
            return
        }
        
        // 根据错误类型返回相应的响应
        switch e := err.Err.(type) {
        case *ValidationError:
            c.JSON(http.StatusUnprocessableEntity, APIResponse{
                Code:    422,
                Message: "Validation error",
                Error:   e.Error(),
                Details: e.Details,
            })
        case *NotFoundError:
            c.JSON(http.StatusNotFound, APIResponse{
                Code:    404,
                Message: "Resource not found",
                Error:   e.Error(),
            })
        case *UnauthorizedError:
            c.JSON(http.StatusUnauthorized, APIResponse{
                Code:    401,
                Message: "Unauthorized",
                Error:   e.Error(),
            })
        case *ForbiddenError:
            c.JSON(http.StatusForbidden, APIResponse{
                Code:    403,
                Message: "Forbidden",
                Error:   e.Error(),
            })
        default:
            c.JSON(http.StatusInternalServerError, APIResponse{
                Code:    500,
                Message: "Internal server error",
                Error:   e.Error(),
            })
        }
    }
}
\`\`\`

### 6. 安全控制分析
#### 认证机制
\`\`\`go
// JWT认证中间件
func AuthMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        token := c.GetHeader("Authorization")
        if token == "" {
            c.AbortWithStatusJSON(http.StatusUnauthorized, APIResponse{
                Code:    401,
                Message: "Unauthorized",
                Error:   "Missing authorization token",
            })
            return
        }
        
        // 移除Bearer前缀
        token = strings.TrimPrefix(token, "Bearer ")
        
        // 验证token
        claims, err := ValidateToken(token)
        if err != nil {
            c.AbortWithStatusJSON(http.StatusUnauthorized, APIResponse{
                Code:    401,
                Message: "Unauthorized",
                Error:   "Invalid token",
            })
            return
        }
        
        // 将用户信息存储到上下文
        c.Set("user_id", claims.UserID)
        c.Set("username", claims.Username)
        c.Set("roles", claims.Roles)
        
        c.Next()
    }
}
\`\`\`

#### 权限控制
\`\`\`go
// 权限检查中间件
func PermissionCheck(resource, action string) gin.HandlerFunc {
    return func(c *gin.Context) {
        userID, exists := c.Get("user_id")
        if !exists {
            c.AbortWithStatusJSON(http.StatusUnauthorized, APIResponse{
                Code:    401,
                Message: "Unauthorized",
                Error:   "User not authenticated",
            })
            return
        }
        
        // 检查用户权限
        hasPermission, err := CheckUserPermission(userID.(uuid.UUID), resource, action)
        if err != nil {
            c.AbortWithStatusJSON(http.StatusInternalServerError, APIResponse{
                Code:    500,
                Message: "Internal server error",
                Error:   "Failed to check permissions",
            })
            return
        }
        
        if !hasPermission {
            c.AbortWithStatusJSON(http.StatusForbidden, APIResponse{
                Code:    403,
                Message: "Forbidden",
                Error:   "Insufficient permissions",
            })
            return
        }
        
        c.Next()
    }
}
\`\`\`

#### 输入验证
\`\`\`go
// 请求验证中间件
func ValidateRequest(model interface{}) gin.HandlerFunc {
    return func(c *gin.Context) {
        if err := c.ShouldBindJSON(model); err != nil {
            var validationErrors []map[string]string
            
            // 处理验证错误
            if errs, ok := err.(validator.ValidationErrors); ok {
                for _, e := range errs {
                    validationErrors = append(validationErrors, map[string]string{
                        "field":   e.Field(),
                        "message": getValidationErrorMessage(e),
                    })
                }
            }
            
            c.AbortWithStatusJSON(http.StatusUnprocessableEntity, APIResponse{
                Code:    422,
                Message: "Validation error",
                Error:   "Invalid request parameters",
                Details: validationErrors,
            })
            return
        }
        
        c.Set("validated_request", model)
        c.Next()
    }
}
\`\`\`

### 7. 性能优化分析
#### 缓存策略
| 缓存类型 | 缓存数据 | 过期时间 | 缓存键 |
|----------|----------|----------|--------|
| 用户信息 | 用户基本资料 | 30分钟 | user:{id} |
| 配置信息 | 系统配置 | 1小时 | config:{key} |
| API响应 | 查询结果 | 5分钟 | api:{path}:{hash} |
| 权限信息 | 用户权限 | 15分钟 | permissions:{id} |

#### 限流控制
\`\`\`go
// 限流中间件
func RateLimitMiddleware() gin.HandlerFunc {
    limiter := rate.NewLimiter(rate.Limit(100), 200) // 100 requests per second, burst 200
    
    return func(c *gin.Context) {
        if !limiter.Allow() {
            c.AbortWithStatusJSON(http.StatusTooManyRequests, APIResponse{
                Code:    429,
                Message: "Too many requests",
                Error:   "Rate limit exceeded",
            })
            return
        }
        c.Next()
    }
}
\`\`\`

#### 压缩优化
\`\`\`go
// 压缩中间件
func CompressionMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        // 检查客户端是否支持压缩
        if strings.Contains(c.GetHeader("Accept-Encoding"), "gzip") {
            c.Header("Content-Encoding", "gzip")
            gz := gzip.NewWriter(c.Writer)
            defer gz.Close()
            c.Writer = &gzipWriter{Writer: gz, ResponseWriter: c.Writer}
        }
        c.Next()
    }
}
\`\`\`

### 8. API文档分析
#### Swagger/OpenAPI文档
\`\`\`yaml
openapi: 3.0.0
info:
  title: Project API
  version: 1.0.0
  description: Project API documentation

servers:
  - url: https://api.example.com/v1
    description: Production server
  - url: https://staging-api.example.com/v1
    description: Staging server

paths:
  /auth/register:
    post:
      summary: Register a new user
      tags:
        - Authentication
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/RegisterRequest'
      responses:
        '201':
          description: User registered successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/UserResponse'
        '400':
          description: Bad request
        '409':
          description: User already exists

  /auth/login:
    post:
      summary: User login
      tags:
        - Authentication
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/LoginRequest'
      responses:
        '200':
          description: Login successful
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/LoginResponse'
        '401':
          description: Invalid credentials

components:
  schemas:
    RegisterRequest:
      type: object
      required:
        - username
        - email
        - password
      properties:
        username:
          type: string
          minLength: 3
          maxLength: 50
        email:
          type: string
          format: email
        password:
          type: string
          minLength: 8
          maxLength: 100
        first_name:
          type: string
          maxLength: 50
        last_name:
          type: string
          maxLength: 50
        phone:
          type: string
          maxLength: 20

    LoginRequest:
      type: object
      required:
        - username
        - password
      properties:
        username:
          type: string
        password:
          type: string

    UserResponse:
      type: object
      properties:
        id:
          type: string
          format: uuid
        username:
          type: string
        email:
          type: string
          format: email
        first_name:
          type: string
        last_name:
          type: string
        phone:
          type: string
        status:
          type: string
          enum: [active, inactive, suspended]
        created_at:
          type: string
          format: date-time

    LoginResponse:
      type: object
      properties:
        access_token:
          type: string
        refresh_token:
          type: string
        expires_in:
          type: integer
        token_type:
          type: string
        user:
          $ref: '#/components/schemas/UserResponse'
\`\`\`

#### API版本控制
\`\`\`go
// 版本控制中间件
func VersionMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        version := c.GetHeader("API-Version")
        if version == "" {
            version = "v1" // 默认版本
        }
        
        // 验证版本
        if !isValidVersion(version) {
            c.AbortWithStatusJSON(http.StatusBadRequest, APIResponse{
                Code:    400,
                Message: "Bad request",
                Error:   "Invalid API version",
            })
            return
        }
        
        c.Set("api_version", version)
        c.Next()
    }
}
\`\`\`

## 输出格式要求

生成完整的API接口分析文档：

### 文档结构
\`\`\`markdown
# {项目名称} API接口分析

## API架构概览

### API架构模式
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
    
    GW --> LB
    LB --> R1
    R1 --> R2
    R2 --> R3
    R3 --> S1
    R3 --> S2
    R3 --> S3
    S1 --> D1
    S1 --> D2
    S1 --> D3
    S2 --> D1
    S2 --> D2
    S2 --> D3
    S3 --> D1
    S3 --> D2
    S3 --> D3
\`\`\`

### API架构特点
- **RESTful架构**: 遵循REST设计原则
- **分层架构**: 清晰的层次结构
- **中间件模式**: 可插拔的中间件处理
- **统一响应**: 统一的响应格式和错误处理

## API接口分类

### 按功能分类
| 分类 | 接口数量 | 主要功能 | 访问频率 | 安全级别 |
|------|----------|----------|----------|----------|
| 用户管理 | 8 | 用户注册、登录、管理 | 高 | 高 |
| 数据管理 | 12 | 数据CRUD操作 | 高 | 中 |
| 系统配置 | 6 | 配置管理 | 中 | 高 |
| 审计日志 | 4 | 日志查询 | 低 | 高 |
| 健康检查 | 2 | 系统状态检查 | 中 | 低 |

### 按HTTP方法分类
| HTTP方法 | 接口数量 | 主要用途 | 幂等性 | 安全性 |
|----------|----------|----------|--------|--------|
| GET | 15 | 数据查询 | 是 | 安全 |
| POST | 8 | 数据创建 | 否 | 不安全 |
| PUT | 6 | 数据更新 | 是 | 不安全 |
| DELETE | 3 | 数据删除 | 是 | 不安全 |
| PATCH | 2 | 部分更新 | 否 | 不安全 |

## 用户管理API

### 用户注册
#### 接口信息
- **URL**: \`POST /api/v1/auth/register\`
- **描述**: 注册新用户
- **认证**: 不需要
- **权限**: 公开访问

#### 请求参数
\`\`\`json
{
  "username": "string",
  "email": "string", 
  "password": "string",
  "first_name": "string",
  "last_name": "string",
  "phone": "string"
}
\`\`\`

**参数说明**:
| 参数 | 类型 | 必填 | 约束 | 描述 |
|------|------|------|------|------|
| username | string | 是 | 3-50字符 | 用户名 |
| email | string | 是 | 邮箱格式 | 邮箱地址 |
| password | string | 是 | 8-100字符 | 密码 |
| first_name | string | 否 | 最大50字符 | 名 |
| last_name | string | 否 | 最大50字符 | 姓 |
| phone | string | 否 | 最大20字符 | 电话号码 |

#### 响应示例
\`\`\`json
{
  "code": 201,
  "message": "User registered successfully",
  "data": {
    "id": "uuid",
    "username": "string",
    "email": "string",
    "first_name": "string",
    "last_name": "string",
    "phone": "string",
    "status": "active",
    "created_at": "2024-01-01T00:00:00Z"
  }
}
\`\`\`

#### 错误码
| 错误码 | HTTP状态码 | 描述 |
|--------|------------|------|
| 201 | 201 | 注册成功 |
| 400 | 400 | 请求参数错误 |
| 409 | 409 | 用户名或邮箱已存在 |
| 422 | 422 | 数据验证失败 |
| 500 | 500 | 服务器内部错误 |

### 用户登录
#### 接口信息
- **URL**: \`POST /api/v1/auth/login\`
- **描述**: 用户登录
- **认证**: 不需要
- **权限**: 公开访问

#### 请求参数
\`\`\`json
{
  "username": "string",
  "password": "string"
}
\`\`\`

**参数说明**:
| 参数 | 类型 | 必填 | 约束 | 描述 |
|------|------|------|------|------|
| username | string | 是 | - | 用户名 |
| password | string | 是 | - | 密码 |

#### 响应示例
\`\`\`json
{
  "code": 200,
  "message": "Login successful",
  "data": {
    "access_token": "string",
    "refresh_token": "string",
    "expires_in": 3600,
    "token_type": "Bearer",
    "user": {
      "id": "uuid",
      "username": "string",
      "email": "string",
      "roles": ["user"]
    }
  }
}
\`\`\`

#### 错误码
| 错误码 | HTTP状态码 | 描述 |
|--------|------------|------|
| 200 | 200 | 登录成功 |
| 400 | 400 | 请求参数错误 |
| 401 | 401 | 用户名或密码错误 |
| 422 | 422 | 数据验证失败 |
| 500 | 500 | 服务器内部错误 |

### 获取用户列表
#### 接口信息
- **URL**: \`GET /api/v1/users?page=1&size=10&status=active\`
- **描述**: 获取用户列表
- **认证**: 需要Bearer Token
- **权限**: 需要user:read权限

#### 请求参数
| 参数 | 类型 | 必填 | 默认值 | 描述 |
|------|------|------|--------|------|
| page | int | 否 | 1 | 页码 |
| size | int | 否 | 10 | 每页大小 |
| status | string | 否 | - | 用户状态过滤 |
| search | string | 否 | - | 搜索关键词 |

#### 响应示例
\`\`\`json
{
  "code": 200,
  "message": "Users retrieved successfully",
  "data": {
    "users": [
      {
        "id": "uuid",
        "username": "string",
        "email": "string",
        "first_name": "string",
        "last_name": "string",
        "status": "active",
        "created_at": "2024-01-01T00:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "size": 10,
      "total": 100,
      "pages": 10
    }
  }
}
\`\`\`

#### 错误码
| 错误码 | HTTP状态码 | 描述 |
|--------|------------|------|
| 200 | 200 | 获取成功 |
| 400 | 400 | 请求参数错误 |
| 401 | 401 | 未授权访问 |
| 403 | 403 | 权限不足 |
| 500 | 500 | 服务器内部错误 |

## 数据管理API

### 提交数据
#### 接口信息
- **URL**: \`POST /api/v1/data\`
- **描述**: 提交数据
- **认证**: 需要Bearer Token
- **权限**: 需要data:create权限

#### 请求参数
\`\`\`json
{
  "type": "string",
  "title": "string",
  "content": "string",
  "metadata": {
    "key": "value"
  },
  "tags": ["tag1", "tag2"]
}
\`\`\`

**参数说明**:
| 参数 | 类型 | 必填 | 约束 | 描述 |
|------|------|------|------|------|
| type | string | 是 | 最大50字符 | 数据类型 |
| title | string | 是 | 最大200字符 | 数据标题 |
| content | string | 否 | 最大10000字符 | 数据内容 |
| metadata | object | 否 | - | 元数据 |
| tags | array | 否 | - | 标签列表 |

#### 响应示例
\`\`\`json
{
  "code": 201,
  "message": "Data submitted successfully",
  "data": {
    "id": "uuid",
    "type": "string",
    "title": "string",
    "content": "string",
    "metadata": {
      "key": "value"
    },
    "tags": ["tag1", "tag2"],
    "status": "active",
    "created_at": "2024-01-01T00:00:00Z"
  }
}
\`\`\`

#### 错误码
| 错误码 | HTTP状态码 | 描述 |
|--------|------------|------|
| 201 | 201 | 提交成功 |
| 400 | 400 | 请求参数错误 |
| 401 | 401 | 未授权访问 |
| 403 | 403 | 权限不足 |
| 422 | 422 | 数据验证失败 |
| 500 | 500 | 服务器内部错误 |

### 获取数据详情
#### 接口信息
- **URL**: \`GET /api/v1/data/{id}\`
- **描述**: 获取数据详情
- **认证**: 需要Bearer Token
- **权限**: 需要data:read权限

#### 路径参数
| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| id | uuid | 是 | 数据ID |

#### 响应示例
\`\`\`json
{
  "code": 200,
  "message": "Data retrieved successfully",
  "data": {
    "id": "uuid",
    "user_id": "uuid",
    "type": "string",
    "title": "string",
    "content": "string",
    "metadata": {
      "key": "value"
    },
    "tags": [
      {
        "id": "uuid",
        "name": "tag1",
        "color": "#007bff"
      }
    ],
    "status": "active",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
}
\`\`\`

#### 错误码
| 错误码 | HTTP状态码 | 描述 |
|--------|------------|------|
| 200 | 200 | 获取成功 |
| 400 | 400 | 请求参数错误 |
| 401 | 401 | 未授权访问 |
| 403 | 403 | 权限不足 |
| 404 | 404 | 数据不存在 |
| 500 | 500 | 服务器内部错误 |

### 搜索数据
#### 接口信息
- **URL**: \`POST /api/v1/data/search\`
- **描述**: 搜索数据
- **认证**: 需要Bearer Token
- **权限**: 需要data:read权限

#### 请求参数
\`\`\`json
{
  "query": "string",
  "filters": {
    "type": "string",
    "status": "active",
    "tags": ["tag1"],
    "date_range": {
      "start": "2024-01-01T00:00:00Z",
      "end": "2024-12-31T23:59:59Z"
    }
  },
  "sort": {
    "field": "created_at",
    "order": "desc"
  },
  "pagination": {
    "page": 1,
    "size": 10
  }
}
\`\`\`

**参数说明**:
| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| query | string | 否 | 搜索关键词 |
| filters | object | 否 | 过滤条件 |
| sort | object | 否 | 排序条件 |
| pagination | object | 否 | 分页参数 |

#### 响应示例
\`\`\`json
{
  "code": 200,
  "message": "Data search completed",
  "data": {
    "results": [
      {
        "id": "uuid",
        "type": "string",
        "title": "string",
        "content": "string",
        "metadata": {
          "key": "value"
        },
        "tags": ["tag1", "tag2"],
        "status": "active",
        "created_at": "2024-01-01T00:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "size": 10,
      "total": 50,
      "pages": 5
    }
  }
}
\`\`\`

#### 错误码
| 错误码 | HTTP状态码 | 描述 |
|--------|------------|------|
| 200 | 200 | 搜索成功 |
| 400 | 400 | 请求参数错误 |
| 401 | 401 | 未授权访问 |
| 403 | 403 | 权限不足 |
| 422 | 422 | 数据验证失败 |
| 500 | 500 | 服务器内部错误 |

## 系统配置API

### 获取配置
#### 接口信息
- **URL**: \`GET /api/v1/configurations\`
- **描述**: 获取系统配置
- **认证**: 需要Bearer Token
- **权限**: 需要config:read权限

#### 响应示例
\`\`\`json
{
  "code": 200,
  "message": "Configurations retrieved successfully",
  "data": {
    "configurations": [
      {
        "id": "uuid",
        "key": "app.name",
        "value": "My Application",
        "description": "Application name",
        "data_type": "string",
        "is_system": false,
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-01-01T00:00:00Z"
      }
    ]
  }
}
\`\`\`

#### 错误码
| 错误码 | HTTP状态码 | 描述 |
|--------|------------|------|
| 200 | 200 | 获取成功 |
| 401 | 401 | 未授权访问 |
| 403 | 403 | 权限不足 |
| 500 | 500 | 服务器内部错误 |

### 更新配置
#### 接口信息
- **URL**: \`PUT /api/v1/configurations/{id}\`
- **描述**: 更新系统配置
- **认证**: 需要Bearer Token
- **权限**: 需要config:update权限

#### 请求参数
\`\`\`json
{
  "value": "string",
  "description": "string"
}
\`\`\`

**参数说明**:
| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| value | string | 是 | 配置值 |
| description | string | 否 | 配置描述 |

#### 响应示例
\`\`\`json
{
  "code": 200,
  "message": "Configuration updated successfully",
  "data": {
    "id": "uuid",
    "key": "app.name",
    "value": "string",
    "description": "string",
    "data_type": "string",
    "is_system": false,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
}
\`\`\`

#### 错误码
| 错误码 | HTTP状态码 | 描述 |
|--------|------------|------|
| 200 | 200 | 更新成功 |
| 400 | 400 | 请求参数错误 |
| 401 | 401 | 未授权访问 |
| 403 | 403 | 权限不足 |
| 404 | 404 | 配置不存在 |
| 422 | 422 | 数据验证失败 |
| 500 | 500 | 服务器内部错误 |

## 数据模型分析

### 请求模型
\`\`\`go
// 用户注册请求
type RegisterRequest struct {
    Username  string \`json:"username" validate:"required,min=3,max=50"\`
    Email     string \`json:"email" validate:"required,email"\`
    Password  string \`json:"password" validate:"required,min=8,max=100"\`
    FirstName string \`json:"first_name" validate:"max=50"\`
    LastName  string \`json:"last_name" validate:"max=50"\`
    Phone     string \`json:"phone" validate:"max=20"\`
}

// 用户登录请求
type LoginRequest struct {
    Username string \`json:"username" validate:"required"\`
    Password string \`json:"password" validate:"required"\`
}

// 数据提交请求
type SubmitDataRequest struct {
    Type     string                 \`json:"type" validate:"required,max=50"\`
    Title    string                 \`json:"title" validate:"required,max=200"\`
    Content  string                 \`json:"content" validate:"max=10000"\`
    Metadata map[string]interface{} \`json:"metadata"\`
    Tags     []string               \`json:"tags"\`
}

// 数据搜索请求
type SearchDataRequest struct {
    Query    string                 \`json:"query"\`
    Filters  map[string]interface{} \`json:"filters"\`
    Sort     map[string]string      \`json:"sort"\`
    Pagination PaginationRequest     \`json:"pagination"\`
}

// 分页请求
type PaginationRequest struct {
    Page  int \`json:"page" validate:"min=1"\`
    Size  int \`json:"size" validate:"min=1,max=100"\`
}
\`\`\`

### 响应模型
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
    FirstName string    \`json:"first_name"\`
    LastName  string    \`json:"last_name"\`
    Phone     string    \`json:"phone"\`
    Status    string    \`json:"status"\`
    CreatedAt time.Time \`json:"created_at"\`
}

// 数据响应
type DataResponse struct {
    ID        uuid.UUID              \`json:"id"\`
    UserID    uuid.UUID              \`json:"user_id"\`
    Type      string                 \`json:"type"\`
    Title     string                 \`json:"title"\`
    Content   string                 \`json:"content"\`
    Metadata  map[string]interface{} \`json:"metadata"\`
    Tags      []TagResponse          \`json:"tags"\`
    Status    string                 \`json:"status"\`
    CreatedAt time.Time              \`json:"created_at"\`
    UpdatedAt time.Time              \`json:"updated_at"\`
}

// 标签响应
type TagResponse struct {
    ID          uuid.UUID \`json:"id"\`
    Name        string    \`json:"name"\`
    Description string    \`json:"description"\`
    Color       string    \`json:"color"\`
}

// 分页响应
type PaginationResponse struct {
    Page  int \`json:"page"\`
    Size  int \`json:"size"\`
    Total int \`json:"total"\`
    Pages int \`json:"pages"\`
}

// 用户列表响应
type UserListResponse struct {
    Users      []UserResponse      \`json:"users"\`
    Pagination PaginationResponse \`json:"pagination"\`
}

// 数据搜索响应
type DataSearchResponse struct {
    Results    []DataResponse      \`json:"results"\`
    Pagination PaginationResponse \`json:"pagination"\`
}
\`\`\`

## 错误处理分析

### 错误码定义
| 错误码 | 错误类型 | HTTP状态码 | 描述 |
|--------|----------|------------|------|
| 200 | SUCCESS | 200 | 请求成功 |
| 201 | CREATED | 201 | 资源创建成功 |
| 400 | BAD_REQUEST | 400 | 请求参数错误 |
| 401 | UNAUTHORIZED | 401 | 未授权访问 |
| 403 | FORBIDDEN | 403 | 禁止访问 |
| 404 | NOT_FOUND | 404 | 资源不存在 |
| 409 | CONFLICT | 409 | 资源冲突 |
| 422 | VALIDATION_ERROR | 422 | 数据验证失败 |
| 500 | INTERNAL_ERROR | 500 | 服务器内部错误 |

### 错误响应格式
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

### 错误处理策略
- **参数验证**: 请求参数格式和有效性验证
- **业务验证**: 业务规则和约束验证
- **权限验证**: 用户权限和访问控制验证
- **异常处理**: 系统异常和错误处理
- **日志记录**: 错误日志记录和监控

## 安全控制分析

### 认证机制
- **JWT认证**: 基于JWT的无状态认证
- **Token刷新**: 支持访问令牌刷新
- **密码安全**: 密码哈希存储和强度验证
- **会话管理**: 会话超时和失效处理

### 权限控制
- **RBAC模型**: 基于角色的访问控制
- **资源权限**: 细粒度的资源权限控制
- **权限检查**: 中间件级别的权限验证
- **权限缓存**: 权限信息缓存优化

### 输入验证
- **参数验证**: 请求参数格式和类型验证
- **业务验证**: 业务规则和约束验证
- **SQL注入防护**: 参数化查询和输入过滤
- **XSS防护**: 输出编码和输入过滤

## 性能优化分析

### 缓存策略
| 缓存类型 | 缓存数据 | 过期时间 | 缓存键 |
|----------|----------|----------|--------|
| 用户信息 | 用户基本资料 | 30分钟 | user:{id} |
| 配置信息 | 系统配置 | 1小时 | config:{key} |
| API响应 | 查询结果 | 5分钟 | api:{path}:{hash} |
| 权限信息 | 用户权限 | 15分钟 | permissions:{id} |

### 限流控制
- **请求限流**: 基于IP和用户的请求限流
- **并发控制**: 最大并发连接数控制
- **熔断保护**: 服务熔断和快速失败
- **降级处理**: 核心功能降级处理

### 压缩优化
- **响应压缩**: Gzip压缩响应数据
- **传输优化**: 减少数据传输量
- **缓存优化**: 客户端缓存策略
- **CDN加速**: 静态资源CDN分发

## API文档分析

### Swagger/OpenAPI文档
- **接口定义**: 完整的API接口定义
- **数据模型**: 请求和响应数据模型
- **错误处理**: 错误码和错误响应定义
- **示例代码**: 接口调用示例代码

### 版本控制
- **版本管理**: API版本管理和兼容性
- **向后兼容**: 保持向后兼容性
- **废弃通知**: 接口废弃和迁移通知
- **文档更新**: 文档版本同步更新

## 总结

### API设计特点
- {API设计主要特点总结}
- {接口分类和组织总结}
- {数据模型设计总结}
- {错误处理机制总结}

### 优化建议
- {API性能优化建议}
- {安全控制加强建议}
- {文档完善建议}
- {版本管理建议}
\`\`\`

## 特别注意事项
1. 必须基于实际的代码和配置进行分析，不能虚构API接口
2. 重点分析核心业务API和关键接口设计
3. 关注API安全性和性能优化
4. 识别API设计中的问题和改进空间
5. 提供实用的API使用和集成建议

## 输出文件命名
\`${WIKI_OUTPUT_DIR}${SUBTASK_OUTPUT_FILENAMES.API_INTERFACE_TASK_FILE}\`
注意：如果${WIKI_OUTPUT_DIR} 目录不存在，则创建。

## 示例输出特征
基于项目的API分析特征：
- 详细的API接口定义和参数说明
- 完整的数据模型和响应格式定义
- 全面的错误处理和安全控制机制
- 具体的性能优化和缓存策略
- 实用的API文档和版本管理建议
`

import { WIKI_OUTPUT_DIR, SUBTASK_OUTPUT_FILENAMES } from "./constants"

export const DATABASE_SCHEMA_ANALYSIS_TEMPLATE = `# 数据库架构深度分析

## 使用场景
从代码仓库中分析数据库架构、表结构、索引设计、关系模型等，生成详细的数据库技术文档。

## 输入要求
- **前置任务分析结果**:（如果文件不存在则忽略）
  - \`${WIKI_OUTPUT_DIR}${SUBTASK_OUTPUT_FILENAMES.PROJECT_OVERVIEW_TASK_FILE}\`
  - \`${WIKI_OUTPUT_DIR}${SUBTASK_OUTPUT_FILENAMES.OVERALL_ARCHITECTURE_TASK_FILE}\`
  - \`${WIKI_OUTPUT_DIR}${SUBTASK_OUTPUT_FILENAMES.SERVICE_DEPENDENCIES_TASK_FILE}\`
  - \`${WIKI_OUTPUT_DIR}${SUBTASK_OUTPUT_FILENAMES.DATA_FLOW_INTEGRATION_TASK_FILE}\`
  - \`${WIKI_OUTPUT_DIR}${SUBTASK_OUTPUT_FILENAMES.SERVICE_ANALYSIS_TASK_FILE}\`
- **完整代码仓库**: 项目的完整源代码
- **数据库迁移文件**: 数据库迁移和初始化脚本
- **ORM模型定义**: 数据库模型和关系定义
- **数据库配置**: 数据库连接和配置文件

# 数据库架构深度分析任务

## 任务描述
请深度分析项目中的数据库架构，从表结构设计、关系模型、索引优化、性能特性、数据安全等维度生成完整的数据库技术文档。

## 分析维度

### 1. 数据库架构分析
#### 数据库类型和版本
| 数据库 | 类型 | 版本 | 用途 | 部署方式 |
|--------|------|------|------|----------|
| PostgreSQL | 关系型数据库 | 13.4 | 主数据存储 | 主从复制 |
| Redis | 内存数据库 | 6.2 | 缓存存储 | 主从复制 |
| Pulsar | 消息队列 | 2.8 | 消息存储 | 集群部署 |
| Elasticsearch | 搜索引擎 | 7.14 | 搜索索引 | 集群部署 |

#### 数据库架构图
\`\`\`mermaid
graph TB
    subgraph "主数据库集群"
        PG1[(PostgreSQL主库)]
        PG2[(PostgreSQL从库1)]
        PG3[(PostgreSQL从库2)]
    end
    
    subgraph "缓存集群"
        Redis1[(Redis主库)]
        Redis2[(Redis从库1)]
        Redis3[(Redis从库2)]
    end
    
    subgraph "消息队列集群"
        Pulsar1[(Pulsar Broker1)]
        Pulsar2[(Pulsar Broker2)]
        Pulsar3[(Pulsar Broker3)]
    end
    
    subgraph "搜索集群"
        ES1[(Elasticsearch1)]
        ES2[(Elasticsearch2)]
        ES3[(Elasticsearch3)]
    end
    
    PG1 -.-> PG2
    PG1 -.-> PG3
    Redis1 -.-> Redis2
    Redis1 -.-> Redis3
    Pulsar1 --> Pulsar2
    Pulsar2 --> Pulsar3
    ES1 --> ES2
    ES2 --> ES3
\`\`\`

### 2. 表结构分析
#### 核心业务表
\`\`\`sql
-- 用户表
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    phone VARCHAR(20),
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- 角色表
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 权限表
CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    resource VARCHAR(100) NOT NULL,
    action VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 用户角色关联表
CREATE TABLE user_roles (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, role_id)
);

-- 角色权限关联表
CREATE TABLE role_permissions (
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (role_id, permission_id)
);
\`\`\`

#### 数据收集表
\`\`\`sql
-- 数据表
CREATE TABLE data_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    content TEXT,
    metadata JSONB,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- 数据标签表
CREATE TABLE data_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    color VARCHAR(7) DEFAULT '#007bff',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 数据标签关联表
CREATE TABLE data_entry_tags (
    data_entry_id UUID REFERENCES data_entries(id) ON DELETE CASCADE,
    tag_id UUID REFERENCES data_tags(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (data_entry_id, tag_id)
);

-- 数据处理历史表
CREATE TABLE data_processing_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data_entry_id UUID REFERENCES data_entries(id) ON DELETE CASCADE,
    processing_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL,
    error_message TEXT,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
\`\`\`

#### 系统配置表
\`\`\`sql
-- 配置表
CREATE TABLE configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    data_type VARCHAR(20) DEFAULT 'string',
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id)
);

-- 审计日志表
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(50) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 系统事件表
CREATE TABLE system_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(50) NOT NULL,
    event_data JSONB,
    severity VARCHAR(20) DEFAULT 'info',
    source VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
\`\`\`

### 3. 索引设计分析
#### 主键索引
| 表名 | 主键字段 | 索引类型 | 索引名称 |
|------|----------|----------|----------|
| users | id | B-tree | users_pkey |
| roles | id | B-tree | roles_pkey |
| permissions | id | B-tree | permissions_pkey |
| data_entries | id | B-tree | data_entries_pkey |
| configurations | id | B-tree | configurations_pkey |

#### 唯一索引
| 表名 | 字段 | 索引类型 | 索引名称 | 用途 |
|------|------|----------|----------|------|
| users | username | B-tree | users_username_key | 用户名唯一性 |
| users | email | B-tree | users_email_key | 邮箱唯一性 |
| roles | name | B-tree | roles_name_key | 角色名唯一性 |
| permissions | name | B-tree | permissions_name_key | 权限名唯一性 |
| configurations | key | B-tree | configurations_key_key | 配置键唯一性 |
| data_tags | name | B-tree | data_tags_name_key | 标签名唯一性 |

#### 普通索引
| 表名 | 字段 | 索引类型 | 索引名称 | 用途 |
|------|------|----------|----------|------|
| users | status | B-tree | idx_users_status | 按状态查询 |
| users | created_at | B-tree | idx_users_created_at | 按创建时间查询 |
| data_entries | user_id | B-tree | idx_data_entries_user_id | 按用户查询 |
| data_entries | type | B-tree | idx_data_entries_type | 按类型查询 |
| data_entries | status | B-tree | idx_data_entries_status | 按状态查询 |
| data_entries | created_at | B-tree | idx_data_entries_created_at | 按创建时间查询 |
| audit_logs | user_id | B-tree | idx_audit_logs_user_id | 按用户查询 |
| audit_logs | action | B-tree | idx_audit_logs_action | 按操作查询 |
| audit_logs | created_at | B-tree | idx_audit_logs_created_at | 按时间查询 |
| system_events | event_type | B-tree | idx_system_events_event_type | 按事件类型查询 |
| system_events | severity | B-tree | idx_system_events_severity | 按严重程度查询 |
| system_events | created_at | B-tree | idx_system_events_created_at | 按时间查询 |

#### 复合索引
| 表名 | 字段组合 | 索引类型 | 索引名称 | 用途 |
|------|----------|----------|----------|------|
| data_entries | user_id, status | B-tree | idx_data_entries_user_status | 按用户和状态查询 |
| data_entries | type, status | B-tree | idx_data_entries_type_status | 按类型和状态查询 |
| data_entries | user_id, created_at | B-tree | idx_data_entries_user_created | 按用户和时间查询 |
| audit_logs | user_id, action | B-tree | idx_audit_logs_user_action | 按用户和操作查询 |
| audit_logs | action, created_at | B-tree | idx_audit_logs_action_created | 按操作和时间查询 |
| system_events | event_type, severity | B-tree | idx_system_events_type_severity | 按类型和严重程度查询 |

#### JSONB索引
| 表名 | 字段 | 索引类型 | 索引名称 | 用途 |
|------|------|----------|----------|------|
| data_entries | metadata | GIN | idx_data_entries_metadata_gin | JSONB全文搜索 |
| data_entries | metadata | B-tree | idx_data_entries_metadata_path | JSONB路径查询 |
| audit_logs | old_values | GIN | idx_audit_logs_old_values_gin | JSONB全文搜索 |
| audit_logs | new_values | GIN | idx_audit_logs_new_values_gin | JSONB全文搜索 |
| system_events | event_data | GIN | idx_system_events_event_data_gin | JSONB全文搜索 |

### 4. 关系模型分析
#### 实体关系图
\`\`\`mermaid
erDiagram
    users ||--o{ user_roles : "has"
    users ||--o{ data_entries : "creates"
    users ||--o{ audit_logs : "performs"
    users ||--o{ configurations : "manages"
    
    roles ||--o{ user_roles : "assigned to"
    roles ||--o{ role_permissions : "has"
    
    permissions ||--o{ role_permissions : "assigned to"
    
    data_entries ||--o{ data_entry_tags : "has"
    data_entries ||--o{ data_processing_history : "processed"
    
    data_tags ||--o{ data_entry_tags : "assigned to"
    
    users {
        UUID id PK
        VARCHAR username UK
        VARCHAR email UK
        VARCHAR password_hash
        VARCHAR first_name
        VARCHAR last_name
        VARCHAR phone
        VARCHAR status
        TIMESTAMP created_at
        TIMESTAMP updated_at
        TIMESTAMP deleted_at
    }
    
    roles {
        UUID id PK
        VARCHAR name UK
        TEXT description
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }
    
    permissions {
        UUID id PK
        VARCHAR name UK
        VARCHAR resource
        VARCHAR action
        TEXT description
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }
    
    user_roles {
        UUID user_id PK, FK
        UUID role_id PK, FK
        TIMESTAMP created_at
    }
    
    role_permissions {
        UUID role_id PK, FK
        UUID permission_id PK, FK
        TIMESTAMP created_at
    }
    
    data_entries {
        UUID id PK
        UUID user_id FK
        VARCHAR type
        VARCHAR title
        TEXT content
        JSONB metadata
        VARCHAR status
        TIMESTAMP created_at
        TIMESTAMP updated_at
        TIMESTAMP deleted_at
    }
    
    data_tags {
        UUID id PK
        VARCHAR name UK
        TEXT description
        VARCHAR color
        TIMESTAMP created_at
    }
    
    data_entry_tags {
        UUID data_entry_id PK, FK
        UUID tag_id PK, FK
        TIMESTAMP created_at
    }
    
    data_processing_history {
        UUID id PK
        UUID data_entry_id FK
        VARCHAR processing_type
        VARCHAR status
        TEXT error_message
        TIMESTAMP processed_at
    }
    
    configurations {
        UUID id PK
        VARCHAR key UK
        TEXT value
        TEXT description
        VARCHAR data_type
        BOOLEAN is_system
        TIMESTAMP created_at
        TIMESTAMP updated_at
        UUID created_by FK
    }
    
    audit_logs {
        UUID id PK
        UUID user_id FK
        VARCHAR action
        VARCHAR resource_type
        UUID resource_id
        JSONB old_values
        JSONB new_values
        INET ip_address
        TEXT user_agent
        TIMESTAMP created_at
    }
    
    system_events {
        UUID id PK
        VARCHAR event_type
        JSONB event_data
        VARCHAR severity
        VARCHAR source
        TIMESTAMP created_at
    }
\`\`\`

#### 关系类型说明
- **一对一关系**: 用户和用户配置（通过配置表中的created_by关联）
- **一对多关系**: 用户和数据条目、用户和审计日志、角色和用户角色关联
- **多对多关系**: 用户和角色（通过user_roles表）、角色和权限（通过role_permissions表）、数据条目和标签（通过data_entry_tags表）

### 5. 数据完整性分析
#### 约束设计
| 约束类型 | 表名 | 约束名称 | 约束字段 | 约束条件 |
|----------|------|----------|----------|----------|
| PRIMARY KEY | users | users_pkey | id | NOT NULL |
| PRIMARY KEY | roles | roles_pkey | id | NOT NULL |
| PRIMARY KEY | permissions | permissions_pkey | id | NOT NULL |
| PRIMARY KEY | data_entries | data_entries_pkey | id | NOT NULL |
| FOREIGN KEY | user_roles | user_roles_user_id_fkey | user_id | REFERENCES users(id) |
| FOREIGN KEY | user_roles | user_roles_role_id_fkey | role_id | REFERENCES roles(id) |
| FOREIGN KEY | role_permissions | role_permissions_role_id_fkey | role_id | REFERENCES roles(id) |
| FOREIGN KEY | role_permissions | role_permissions_permission_id_fkey | permission_id | REFERENCES permissions(id) |
| FOREIGN KEY | data_entries | data_entries_user_id_fkey | user_id | REFERENCES users(id) |
| FOREIGN KEY | data_entry_tags | data_entry_tags_data_entry_id_fkey | data_entry_id | REFERENCES data_entries(id) |
| FOREIGN KEY | data_entry_tags | data_entry_tags_tag_id_fkey | tag_id | REFERENCES data_tags(id) |
| FOREIGN KEY | data_processing_history | data_processing_history_data_entry_id_fkey | data_entry_id | REFERENCES data_entries(id) |
| FOREIGN KEY | configurations | configurations_created_by_fkey | created_by | REFERENCES users(id) |
| FOREIGN KEY | audit_logs | audit_logs_user_id_fkey | user_id | REFERENCES users(id) |
| UNIQUE | users | users_username_key | username | UNIQUE |
| UNIQUE | users | users_email_key | email | UNIQUE |
| UNIQUE | roles | roles_name_key | name | UNIQUE |
| UNIQUE | permissions | permissions_name_key | name | UNIQUE |
| UNIQUE | configurations | configurations_key_key | key | UNIQUE |
| UNIQUE | data_tags | data_tags_name_key | name | UNIQUE |
| CHECK | users | users_status_check | status | IN ('active', 'inactive', 'suspended') |
| CHECK | data_entries | data_entries_status_check | status | IN ('active', 'inactive', 'processing', 'failed') |
| CHECK | data_processing_history | data_processing_history_status_check | status | IN ('pending', 'processing', 'completed', 'failed') |
| CHECK | configurations | configurations_data_type_check | data_type | IN ('string', 'number', 'boolean', 'json') |
| CHECK | system_events | system_events_severity_check | severity | IN ('debug', 'info', 'warning', 'error', 'critical') |

#### 触发器设计
\`\`\`sql
-- 用户表更新时间触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为需要更新时间的表创建触发器
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_roles_updated_at BEFORE UPDATE ON roles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_permissions_updated_at BEFORE UPDATE ON permissions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_data_entries_updated_at BEFORE UPDATE ON data_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_configurations_updated_at BEFORE UPDATE ON configurations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 审计日志触发器
CREATE OR REPLACE FUNCTION audit_log_trigger()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_logs (user_id, action, resource_type, resource_id, old_values, new_values, ip_address, user_agent)
        VALUES (
            CURRENT_USER,
            'UPDATE',
            TG_TABLE_NAME,
            NEW.id,
            to_jsonb(OLD),
            to_jsonb(NEW),
            inet_client_addr(),
            current_setting('application.user_agent', true)
        );
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_logs (user_id, action, resource_type, resource_id, old_values, ip_address, user_agent)
        VALUES (
            CURRENT_USER,
            'DELETE',
            TG_TABLE_NAME,
            OLD.id,
            to_jsonb(OLD),
            NULL,
            inet_client_addr(),
            current_setting('application.user_agent', true)
        );
        RETURN OLD;
    ELSIF TG_OP = 'INSERT' THEN
        INSERT INTO audit_logs (user_id, action, resource_type, resource_id, new_values, ip_address, user_agent)
        VALUES (
            CURRENT_USER,
            'INSERT',
            TG_TABLE_NAME,
            NEW.id,
            to_jsonb(NEW),
            inet_client_addr(),
            current_setting('application.user_agent', true)
        );
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

-- 为需要审计的表创建触发器
CREATE TRIGGER users_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON users
    FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

CREATE TRIGGER roles_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON roles
    FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

CREATE TRIGGER permissions_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON permissions
    FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

CREATE TRIGGER data_entries_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON data_entries
    FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

CREATE TRIGGER configurations_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON configurations
    FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();
\`\`\`

### 6. 性能优化分析
#### 查询优化策略
| 优化类型 | 优化策略 | 实现方式 | 预期效果 |
|----------|----------|----------|----------|
| 索引优化 | 合理创建索引 | B-tree、GIN、复合索引 | 查询性能提升50-80% |
| 查询优化 | 优化SQL查询 | 避免全表扫描、使用索引 | 查询时间减少60-90% |
| 连接池优化 | 数据库连接池 | 合理配置连接池大小 | 并发性能提升30-50% |
| 分区优化 | 大表分区 | 按时间或ID分区 | 查询性能提升40-70% |
| 缓存优化 | 热点数据缓存 | Redis缓存热点数据 | 响应时间减少80-95% |

#### 分区策略
| 表名 | 分区类型 | 分区键 | 分区数量 | 分区策略 |
|------|----------|--------|----------|----------|
| audit_logs | 范围分区 | created_at | 按月分区 | 每月一个分区 |
| system_events | 范围分区 | created_at | 按月分区 | 每月一个分区 |
| data_entries | 哈希分区 | id | 16个分区 | 均匀分布 |
| data_processing_history | 范围分区 | processed_at | 按月分区 | 每月一个分区 |

#### 缓存策略
| 缓存类型 | 缓存数据 | 过期时间 | 缓存策略 |
|----------|----------|----------|----------|
| 用户信息 | 用户基本资料 | 30分钟 | 主动刷新 |
| 配置信息 | 系统配置 | 1小时 | 定时刷新 |
| 权限信息 | 用户权限 | 15分钟 | 主动刷新 |
| 统计数据 | 业务统计 | 5分钟 | 定时刷新 |
| 会话信息 | 用户会话 | 24小时 | 惰性过期 |

### 7. 数据安全分析
#### 数据加密
| 数据类型 | 加密方式 | 加密算法 | 密钥管理 |
|----------|----------|----------|----------|
| 密码 | 哈希加密 | bcrypt | 单向哈希 |
| 敏感信息 | 对称加密 | AES-256 | 密钥管理系统 |
| 备份数据 | 对称加密 | AES-256 | 备份密钥管理 |
| 传输数据 | 传输加密 | TLS 1.3 | 证书管理 |

#### 访问控制
| 控制类型 | 控制策略 | 实现方式 | 控制粒度 |
|----------|----------|----------|----------|
| 数据库用户 | 最小权限原则 | 角色基础访问控制 | 表级别 |
| 应用连接 | 连接池管理 | 连接字符串加密 | 应用级别 |
| 数据访问 | 行级安全 | RLS策略 | 行级别 |
| 敏感数据 | 数据脱敏 | 视图和函数 | 字段级别 |

#### 备份策略
| 备份类型 | 备份频率 | 保留时间 | 备份方式 |
|----------|----------|----------|----------|
| 全量备份 | 每日 | 30天 | pg_dump |
| 增量备份 | 每小时 | 7天 | WAL归档 |
| 逻辑备份 | 每周 | 90天 | pg_dumpall |
| 灾备备份 | 每日 | 365天 | 异地备份 |

### 8. 监控和维护分析
#### 监控指标
| 指标类型 | 指标名称 | 阈值 | 告警级别 |
|----------|----------|------|----------|
| 连接监控 | 活跃连接数 | >80% | 警告 |
| 连接监控 | 空闲连接数 | >50% | 信息 |
| 性能监控 | 查询响应时间 | >1000ms | 警告 |
| 性能监控 | 慢查询数量 | >10/分钟 | 警告 |
| 存储监控 | 磁盘使用率 | >85% | 警告 |
| 存储监控 | 磁盘使用率 | >95% | 严重 |
| 内存监控 | 缓存命中率 | <90% | 警告 |
| 内存监控 | 共享缓冲区使用率 | >80% | 警告 |

#### 维护策略
- **定期维护**: 每周进行数据库维护和优化
- **索引重建**: 定期重建碎片化严重的索引
- **统计信息更新**: 定期更新表统计信息
- **日志清理**: 定期清理过期日志和临时文件
- **性能调优**: 根据监控数据进行性能调优

## 输出格式要求

生成完整的数据库架构分析文档：

### 文档结构
\`\`\`markdown
# {项目名称} 数据库架构分析

## 数据库架构概览

### 数据库类型和版本
| 数据库 | 类型 | 版本 | 用途 | 部署方式 |
|--------|------|------|------|----------|
| PostgreSQL | 关系型数据库 | 13.4 | 主数据存储 | 主从复制 |
| Redis | 内存数据库 | 6.2 | 缓存存储 | 主从复制 |
| Pulsar | 消息队列 | 2.8 | 消息存储 | 集群部署 |
| Elasticsearch | 搜索引擎 | 7.14 | 搜索索引 | 集群部署 |

### 数据库架构图
\`\`\`mermaid
graph TB
    subgraph "主数据库集群"
        PG1[(PostgreSQL主库)]
        PG2[(PostgreSQL从库1)]
        PG3[(PostgreSQL从库2)]
    end
    
    subgraph "缓存集群"
        Redis1[(Redis主库)]
        Redis2[(Redis从库1)]
        Redis3[(Redis从库2)]
    end
    
    subgraph "消息队列集群"
        Pulsar1[(Pulsar Broker1)]
        Pulsar2[(Pulsar Broker2)]
        Pulsar3[(Pulsar Broker3)]
    end
    
    subgraph "搜索集群"
        ES1[(Elasticsearch1)]
        ES2[(Elasticsearch2)]
        ES3[(Elasticsearch3)]
    end
    
    PG1 -.-> PG2
    PG1 -.-> PG3
    Redis1 -.-> Redis2
    Redis1 -.-> Redis3
    Pulsar1 --> Pulsar2
    Pulsar2 --> Pulsar3
    ES1 --> ES2
    ES2 --> ES3
\`\`\`

## 表结构分析

### 用户管理表
#### users表
\`\`\`sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    phone VARCHAR(20),
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);
\`\`\`

**字段说明**:
- \`id\`: 用户唯一标识符，UUID类型
- \`username\`: 用户名，唯一约束
- \`email\`: 邮箱地址，唯一约束
- \`password_hash\`: 密码哈希值，使用bcrypt加密
- \`first_name\`: 名
- \`last_name\`: 姓
- \`phone\`: 电话号码
- \`status\`: 用户状态（active, inactive, suspended）
- \`created_at\`: 创建时间
- \`updated_at\`: 更新时间
- \`deleted_at\`: 删除时间（软删除）

#### roles表
\`\`\`sql
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
\`\`\`

**字段说明**:
- \`id\`: 角色唯一标识符，UUID类型
- \`name\`: 角色名称，唯一约束
- \`description\`: 角色描述
- \`created_at\`: 创建时间
- \`updated_at\`: 更新时间

#### permissions表
\`\`\`sql
CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    resource VARCHAR(100) NOT NULL,
    action VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
\`\`\`

**字段说明**:
- \`id\`: 权限唯一标识符，UUID类型
- \`name\`: 权限名称，唯一约束
- \`resource\`: 资源类型
- \`action\`: 操作类型
- \`description\`: 权限描述
- \`created_at\`: 创建时间
- \`updated_at\`: 更新时间

### 数据管理表
#### data_entries表
\`\`\`sql
CREATE TABLE data_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    content TEXT,
    metadata JSONB,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);
\`\`\`

**字段说明**:
- \`id\`: 数据条目唯一标识符，UUID类型
- \`user_id\`: 创建用户ID，外键关联users表
- \`type\`: 数据类型
- \`title\`: 数据标题
- \`content\`: 数据内容
- \`metadata\`: 元数据，JSONB格式
- \`status\`: 状态（active, inactive, processing, failed）
- \`created_at\`: 创建时间
- \`updated_at\`: 更新时间
- \`deleted_at\`: 删除时间（软删除）

#### data_tags表
\`\`\`sql
CREATE TABLE data_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    color VARCHAR(7) DEFAULT '#007bff',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
\`\`\`

**字段说明**:
- \`id\`: 标签唯一标识符，UUID类型
- \`name\`: 标签名称，唯一约束
- \`description\`: 标签描述
- \`color\`: 标签颜色，十六进制格式
- \`created_at\`: 创建时间

### 系统表
#### configurations表
\`\`\`sql
CREATE TABLE configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    data_type VARCHAR(20) DEFAULT 'string',
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id)
);
\`\`\`

**字段说明**:
- \`id\`: 配置唯一标识符，UUID类型
- \`key\`: 配置键，唯一约束
- \`value\`: 配置值
- \`description\`: 配置描述
- \`data_type\`: 数据类型（string, number, boolean, json）
- \`is_system\`: 是否为系统配置
- \`created_at\`: 创建时间
- \`updated_at\`: 更新时间
- \`created_by\`: 创建者ID，外键关联users表

#### audit_logs表
\`\`\`sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(50) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
\`\`\`

**字段说明**:
- \`id\`: 审计日志唯一标识符，UUID类型
- \`user_id\`: 操作用户ID，外键关联users表
- \`action\`: 操作类型
- \`resource_type\`: 资源类型
- \`resource_id\`: 资源ID
- \`old_values\`: 旧值，JSONB格式
- \`new_values\`: 新值，JSONB格式
- \`ip_address\`: IP地址
- \`user_agent\`: 用户代理
- \`created_at\`: 创建时间

## 索引设计分析

### 主键索引
| 表名 | 主键字段 | 索引类型 | 索引名称 |
|------|----------|----------|----------|
| users | id | B-tree | users_pkey |
| roles | id | B-tree | roles_pkey |
| permissions | id | B-tree | permissions_pkey |
| data_entries | id | B-tree | data_entries_pkey |
| configurations | id | B-tree | configurations_pkey |

### 唯一索引
| 表名 | 字段 | 索引类型 | 索引名称 | 用途 |
|------|------|----------|----------|------|
| users | username | B-tree | users_username_key | 用户名唯一性 |
| users | email | B-tree | users_email_key | 邮箱唯一性 |
| roles | name | B-tree | roles_name_key | 角色名唯一性 |
| permissions | name | B-tree | permissions_name_key | 权限名唯一性 |
| configurations | key | B-tree | configurations_key_key | 配置键唯一性 |
| data_tags | name | B-tree | data_tags_name_key | 标签名唯一性 |

### 普通索引
| 表名 | 字段 | 索引类型 | 索引名称 | 用途 |
|------|------|----------|----------|------|
| users | status | B-tree | idx_users_status | 按状态查询 |
| users | created_at | B-tree | idx_users_created_at | 按创建时间查询 |
| data_entries | user_id | B-tree | idx_data_entries_user_id | 按用户查询 |
| data_entries | type | B-tree | idx_data_entries_type | 按类型查询 |
| data_entries | status | B-tree | idx_data_entries_status | 按状态查询 |
| data_entries | created_at | B-tree | idx_data_entries_created_at | 按创建时间查询 |
| audit_logs | user_id | B-tree | idx_audit_logs_user_id | 按用户查询 |
| audit_logs | action | B-tree | idx_audit_logs_action | 按操作查询 |
| audit_logs | created_at | B-tree | idx_audit_logs_created_at | 按时间查询 |
| system_events | event_type | B-tree | idx_system_events_event_type | 按事件类型查询 |
| system_events | severity | B-tree | idx_system_events_severity | 按严重程度查询 |
| system_events | created_at | B-tree | idx_system_events_created_at | 按时间查询 |

### 复合索引
| 表名 | 字段组合 | 索引类型 | 索引名称 | 用途 |
|------|----------|----------|----------|------|
| data_entries | user_id, status | B-tree | idx_data_entries_user_status | 按用户和状态查询 |
| data_entries | type, status | B-tree | idx_data_entries_type_status | 按类型和状态查询 |
| data_entries | user_id, created_at | B-tree | idx_data_entries_user_created | 按用户和时间查询 |
| audit_logs | user_id, action | B-tree | idx_audit_logs_user_action | 按用户和操作查询 |
| audit_logs | action, created_at | B-tree | idx_audit_logs_action_created | 按操作和时间查询 |
| system_events | event_type, severity | B-tree | idx_system_events_type_severity | 按类型和严重程度查询 |

### JSONB索引
| 表名 | 字段 | 索引类型 | 索引名称 | 用途 |
|------|------|----------|----------|------|
| data_entries | metadata | GIN | idx_data_entries_metadata_gin | JSONB全文搜索 |
| data_entries | metadata | B-tree | idx_data_entries_metadata_path | JSONB路径查询 |
| audit_logs | old_values | GIN | idx_audit_logs_old_values_gin | JSONB全文搜索 |
| audit_logs | new_values | GIN | idx_audit_logs_new_values_gin | JSONB全文搜索 |
| system_events | event_data | GIN | idx_system_events_event_data_gin | JSONB全文搜索 |

## 关系模型分析

### 实体关系图
\`\`\`mermaid
erDiagram
    users ||--o{ user_roles : "has"
    users ||--o{ data_entries : "creates"
    users ||--o{ audit_logs : "performs"
    users ||--o{ configurations : "manages"
    
    roles ||--o{ user_roles : "assigned to"
    roles ||--o{ role_permissions : "has"
    
    permissions ||--o{ role_permissions : "assigned to"
    
    data_entries ||--o{ data_entry_tags : "has"
    data_entries ||--o{ data_processing_history : "processed"
    
    data_tags ||--o{ data_entry_tags : "assigned to"
    
    users {
        UUID id PK
        VARCHAR username UK
        VARCHAR email UK
        VARCHAR password_hash
        VARCHAR first_name
        VARCHAR last_name
        VARCHAR phone
        VARCHAR status
        TIMESTAMP created_at
        TIMESTAMP updated_at
        TIMESTAMP deleted_at
    }
    
    roles {
        UUID id PK
        VARCHAR name UK
        TEXT description
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }
    
    permissions {
        UUID id PK
        VARCHAR name UK
        VARCHAR resource
        VARCHAR action
        TEXT description
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }
    
    user_roles {
        UUID user_id PK, FK
        UUID role_id PK, FK
        TIMESTAMP created_at
    }
    
    role_permissions {
        UUID role_id PK, FK
        UUID permission_id PK, FK
        TIMESTAMP created_at
    }
    
    data_entries {
        UUID id PK
        UUID user_id FK
        VARCHAR type
        VARCHAR title
        TEXT content
        JSONB metadata
        VARCHAR status
        TIMESTAMP created_at
        TIMESTAMP updated_at
        TIMESTAMP deleted_at
    }
    
    data_tags {
        UUID id PK
        VARCHAR name UK
        TEXT description
        VARCHAR color
        TIMESTAMP created_at
    }
    
    data_entry_tags {
        UUID data_entry_id PK, FK
        UUID tag_id PK, FK
        TIMESTAMP created_at
    }
    
    data_processing_history {
        UUID id PK
        UUID data_entry_id FK
        VARCHAR processing_type
        VARCHAR status
        TEXT error_message
        TIMESTAMP processed_at
    }
    
    configurations {
        UUID id PK
        VARCHAR key UK
        TEXT value
        TEXT description
        VARCHAR data_type
        BOOLEAN is_system
        TIMESTAMP created_at
        TIMESTAMP updated_at
        UUID created_by FK
    }
    
    audit_logs {
        UUID id PK
        UUID user_id FK
        VARCHAR action
        VARCHAR resource_type
        UUID resource_id
        JSONB old_values
        JSONB new_values
        INET ip_address
        TEXT user_agent
        TIMESTAMP created_at
    }
    
    system_events {
        UUID id PK
        VARCHAR event_type
        JSONB event_data
        VARCHAR severity
        VARCHAR source
        TIMESTAMP created_at
    }
\`\`\`

### 关系说明
- **用户-角色**: 多对多关系，通过user_roles表关联
- **角色-权限**: 多对多关系，通过role_permissions表关联
- **用户-数据条目**: 一对多关系，一个用户可以创建多个数据条目
- **数据条目-标签**: 多对多关系，通过data_entry_tags表关联
- **用户-审计日志**: 一对多关系，记录用户的操作历史
- **用户-配置**: 一对多关系，用户可以管理系统配置

## 数据完整性分析

### 约束设计
| 约束类型 | 表名 | 约束名称 | 约束字段 | 约束条件 |
|----------|------|----------|----------|----------|
| PRIMARY KEY | users | users_pkey | id | NOT NULL |
| PRIMARY KEY | roles | roles_pkey | id | NOT NULL |
| PRIMARY KEY | permissions | permissions_pkey | id | NOT NULL |
| PRIMARY KEY | data_entries | data_entries_pkey | id | NOT NULL |
| FOREIGN KEY | user_roles | user_roles_user_id_fkey | user_id | REFERENCES users(id) |
| FOREIGN KEY | user_roles | user_roles_role_id_fkey | role_id | REFERENCES roles(id) |
| FOREIGN KEY | role_permissions | role_permissions_role_id_fkey | role_id | REFERENCES roles(id) |
| FOREIGN KEY | role_permissions | role_permissions_permission_id_fkey | permission_id | REFERENCES permissions(id) |
| FOREIGN KEY | data_entries | data_entries_user_id_fkey | user_id | REFERENCES users(id) |
| FOREIGN KEY | data_entry_tags | data_entry_tags_data_entry_id_fkey | data_entry_id | REFERENCES data_entries(id) |
| FOREIGN KEY | data_entry_tags | data_entry_tags_tag_id_fkey | tag_id | REFERENCES data_tags(id) |
| FOREIGN KEY | data_processing_history | data_processing_history_data_entry_id_fkey | data_entry_id | REFERENCES data_entries(id) |
| FOREIGN KEY | configurations | configurations_created_by_fkey | created_by | REFERENCES users(id) |
| FOREIGN KEY | audit_logs | audit_logs_user_id_fkey | user_id | REFERENCES users(id) |
| UNIQUE | users | users_username_key | username | UNIQUE |
| UNIQUE | users | users_email_key | email | UNIQUE |
| UNIQUE | roles | roles_name_key | name | UNIQUE |
| UNIQUE | permissions | permissions_name_key | name | UNIQUE |
| UNIQUE | configurations | configurations_key_key | key | UNIQUE |
| UNIQUE | data_tags | data_tags_name_key | name | UNIQUE |
| CHECK | users | users_status_check | status | IN ('active', 'inactive', 'suspended') |
| CHECK | data_entries | data_entries_status_check | status | IN ('active', 'inactive', 'processing', 'failed') |
| CHECK | data_processing_history | data_processing_history_status_check | status | IN ('pending', 'processing', 'completed', 'failed') |
| CHECK | configurations | configurations_data_type_check | data_type | IN ('string', 'number', 'boolean', 'json') |
| CHECK | system_events | system_events_severity_check | severity | IN ('debug', 'info', 'warning', 'error', 'critical') |

### 触发器设计
#### 更新时间触发器
\`\`\`sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_roles_updated_at BEFORE UPDATE ON roles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_permissions_updated_at BEFORE UPDATE ON permissions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_data_entries_updated_at BEFORE UPDATE ON data_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_configurations_updated_at BEFORE UPDATE ON configurations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
\`\`\`

#### 审计日志触发器
\`\`\`sql
CREATE OR REPLACE FUNCTION audit_log_trigger()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_logs (user_id, action, resource_type, resource_id, old_values, new_values, ip_address, user_agent)
        VALUES (
            CURRENT_USER,
            'UPDATE',
            TG_TABLE_NAME,
            NEW.id,
            to_jsonb(OLD),
            to_jsonb(NEW),
            inet_client_addr(),
            current_setting('application.user_agent', true)
        );
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_logs (user_id, action, resource_type, resource_id, old_values, ip_address, user_agent)
        VALUES (
            CURRENT_USER,
            'DELETE',
            TG_TABLE_NAME,
            OLD.id,
            to_jsonb(OLD),
            NULL,
            inet_client_addr(),
            current_setting('application.user_agent', true)
        );
        RETURN OLD;
    ELSIF TG_OP = 'INSERT' THEN
        INSERT INTO audit_logs (user_id, action, resource_type, resource_id, new_values, ip_address, user_agent)
        VALUES (
            CURRENT_USER,
            'INSERT',
            TG_TABLE_NAME,
            NEW.id,
            to_jsonb(NEW),
            inet_client_addr(),
            current_setting('application.user_agent', true)
        );
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

CREATE TRIGGER users_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON users
    FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

CREATE TRIGGER roles_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON roles
    FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

CREATE TRIGGER permissions_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON permissions
    FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

CREATE TRIGGER data_entries_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON data_entries
    FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

CREATE TRIGGER configurations_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON configurations
    FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();
\`\`\`

## 性能优化分析

### 查询优化策略
| 优化类型 | 优化策略 | 实现方式 | 预期效果 |
|----------|----------|----------|----------|
| 索引优化 | 合理创建索引 | B-tree、GIN、复合索引 | 查询性能提升50-80% |
| 查询优化 | 优化SQL查询 | 避免全表扫描、使用索引 | 查询时间减少60-90% |
| 连接池优化 | 数据库连接池 | 合理配置连接池大小 | 并发性能提升30-50% |
| 分区优化 | 大表分区 | 按时间或ID分区 | 查询性能提升40-70% |
| 缓存优化 | 热点数据缓存 | Redis缓存热点数据 | 响应时间减少80-95% |

### 分区策略
| 表名 | 分区类型 | 分区键 | 分区数量 | 分区策略 |
|------|----------|--------|----------|----------|
| audit_logs | 范围分区 | created_at | 按月分区 | 每月一个分区 |
| system_events | 范围分区 | created_at | 按月分区 | 每月一个分区 |
| data_entries | 哈希分区 | id | 16个分区 | 均匀分布 |
| data_processing_history | 范围分区 | processed_at | 按月分区 | 每月一个分区 |

### 缓存策略
| 缓存类型 | 缓存数据 | 过期时间 | 缓存策略 |
|----------|----------|----------|----------|
| 用户信息 | 用户基本资料 | 30分钟 | 主动刷新 |
| 配置信息 | 系统配置 | 1小时 | 定时刷新 |
| 权限信息 | 用户权限 | 15分钟 | 主动刷新 |
| 统计数据 | 业务统计 | 5分钟 | 定时刷新 |
| 会话信息 | 用户会话 | 24小时 | 惰性过期 |

## 数据安全分析

### 数据加密
| 数据类型 | 加密方式 | 加密算法 | 密钥管理 |
|----------|----------|----------|----------|
| 密码 | 哈希加密 | bcrypt | 单向哈希 |
| 敏感信息 | 对称加密 | AES-256 | 密钥管理系统 |
| 备份数据 | 对称加密 | AES-256 | 备份密钥管理 |
| 传输数据 | 传输加密 | TLS 1.3 | 证书管理 |

### 访问控制
| 控制类型 | 控制策略 | 实现方式 | 控制粒度 |
|----------|----------|----------|----------|
| 数据库用户 | 最小权限原则 | 角色基础访问控制 | 表级别 |
| 应用连接 | 连接池管理 | 连接字符串加密 | 应用级别 |
| 数据访问 | 行级安全 | RLS策略 | 行级别 |
| 敏感数据 | 数据脱敏 | 视图和函数 | 字段级别 |

### 备份策略
| 备份类型 | 备份频率 | 保留时间 | 备份方式 |
|----------|----------|----------|----------|
| 全量备份 | 每日 | 30天 | pg_dump |
| 增量备份 | 每小时 | 7天 | WAL归档 |
| 逻辑备份 | 每周 | 90天 | pg_dumpall |
| 灾备备份 | 每日 | 365天 | 异地备份 |

## 监控和维护分析

### 监控指标
| 指标类型 | 指标名称 | 阈值 | 告警级别 |
|----------|----------|------|----------|
| 连接监控 | 活跃连接数 | >80% | 警告 |
| 连接监控 | 空闲连接数 | >50% | 信息 |
| 性能监控 | 查询响应时间 | >1000ms | 警告 |
| 性能监控 | 慢查询数量 | >10/分钟 | 警告 |
| 存储监控 | 磁盘使用率 | >85% | 警告 |
| 存储监控 | 磁盘使用率 | >95% | 严重 |
| 内存监控 | 缓存命中率 | <90% | 警告 |
| 内存监控 | 共享缓冲区使用率 | >80% | 警告 |

### 维护策略
- **定期维护**: 每周进行数据库维护和优化
- **索引重建**: 定期重建碎片化严重的索引
- **统计信息更新**: 定期更新表统计信息
- **日志清理**: 定期清理过期日志和临时文件
- **性能调优**: 根据监控数据进行性能调优

## 总结

### 数据库架构特点
- {数据库架构主要特点总结}
- {表结构设计总结}
- {索引优化总结}
- {数据完整性保证总结}

### 优化建议
- {数据库性能优化建议}
- {数据安全加强建议}
- {监控维护改进建议}
- {扩展性优化建议}
\`\`\`

## 特别注意事项
1. 必须基于实际的代码和配置进行分析，不能虚构数据库结构
2. 重点分析核心业务表和关键索引设计
3. 关注数据完整性和安全性保证
4. 识别性能瓶颈和优化空间
5. 提供实用的监控和维护策略

## 输出文件命名
\`${WIKI_OUTPUT_DIR}${SUBTASK_OUTPUT_FILENAMES.DATABASE_SCHEMA_TASK_FILE}\`
注意：如果${WIKI_OUTPUT_DIR} 目录不存在，则创建。

## 示例输出特征
基于项目的数据库分析特征：
- 详细的表结构和字段定义
- 完整的索引设计和优化策略
- 全面的关系模型和约束设计
- 具体的性能优化和安全措施
- 实用的监控和维护建议
`

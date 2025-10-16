import { WIKI_OUTPUT_DIR, SUBTASK_OUTPUT_FILENAMES } from "./constants"

export const DATABASE_SCHEMA_ANALYSIS_TEMPLATE = (workspace: string) => `# 数据库架构深度分析

## 使用场景
从代码仓库中分析数据库架构、表结构、索引设计、关系模型等，生成详细的数据库技术文档。

## 输入要求
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

#### 数据库架构图
\`\`\`mermaid
graph TB
    subgraph "主数据库集群"
        PG1[(PostgreSQL主库)]
        PG2[(PostgreSQL从库)]
    end
    
    subgraph "缓存集群"
        Redis1[(Redis主库)]
        Redis2[(Redis从库)]
    end
    
    PG1 -.-> PG2
    Redis1 -.-> Redis2
\`\`\`

### 2. 表结构分析
#### 核心业务表示例
\`\`\`sql
-- 用户表
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 数据表
CREATE TABLE data_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    content TEXT,
    metadata JSONB,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
\`\`\`

### 3. 索引设计分析
#### 索引类型总览
| 索引类型 | 用途 | 示例表 | 示例字段 |
|----------|------|--------|----------|
| 主键索引 | 唯一标识 | users | id |
| 唯一索引 | 唯一性约束 | users | username, email |
| 普通索引 | 查询优化 | users | status, created_at |
| 复合索引 | 多字段查询 | data_entries | user_id, status |
| JSONB索引 | JSON搜索 | data_entries | metadata |

### 4. 关系模型分析
#### 实体关系图
\`\`\`mermaid
erDiagram
    users ||--o{ data_entries : "creates"
    users ||--o{ audit_logs : "performs"
    users ||--o{ user_roles : "has"
    
    roles ||--o{ user_roles : "assigned to"
    roles ||--o{ role_permissions : "has"
    
    permissions ||--o{ role_permissions : "assigned to"
    
    data_entries ||--o{ data_entry_tags : "has"
    data_tags ||--o{ data_entry_tags : "assigned to"
    
    users {
        UUID id PK
        VARCHAR username UK
        VARCHAR email UK
        VARCHAR status
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }
    
    data_entries {
        UUID id PK
        UUID user_id FK
        VARCHAR title
        TEXT content
        JSONB metadata
        VARCHAR status
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }
\`\`\`

#### 关系类型说明
- **一对多关系**: 用户和数据条目、用户和审计日志
- **多对多关系**: 用户和角色、角色和权限、数据条目和标签

### 5. 数据完整性分析
#### 约束设计
| 约束类型 | 表名 | 约束字段 | 约束条件 |
|----------|------|----------|----------|
| PRIMARY KEY | users | id | NOT NULL |
| FOREIGN KEY | data_entries | user_id | REFERENCES users(id) |
| UNIQUE | users | username, email | UNIQUE |
| CHECK | users | status | IN ('active', 'inactive', 'suspended') |

#### 触发器设计
\`\`\`sql
-- 更新时间触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';
\`\`\`

### 6. 性能优化分析
#### 查询优化策略
| 优化类型 | 优化策略 | 实现方式 |
|----------|----------|----------|
| 索引优化 | 合理创建索引 | B-tree、GIN、复合索引 |
| 查询优化 | 优化SQL查询 | 避免全表扫描、使用索引 |
| 连接池优化 | 数据库连接池 | 合理配置连接池大小 |
| 缓存优化 | 热点数据缓存 | Redis缓存热点数据 |

#### 分区策略
| 表名 | 分区类型 | 分区键 | 分区策略 |
|------|----------|--------|----------|
| audit_logs | 范围分区 | created_at | 按月分区 |
| system_events | 范围分区 | created_at | 按月分区 |
| data_entries | 哈希分区 | id | 均匀分布 |

#### 缓存策略
| 缓存类型 | 缓存数据 | 过期时间 | 缓存策略 |
|----------|----------|----------|----------|
| 用户信息 | 用户基本资料 | 30分钟 | 主动刷新 |
| 配置信息 | 系统配置 | 1小时 | 定时刷新 |
| 权限信息 | 用户权限 | 15分钟 | 主动刷新 |

### 7. 数据安全分析
#### 数据加密
| 数据类型 | 加密方式 | 加密算法 | 密钥管理 |
|----------|----------|----------|----------|
| 密码 | 哈希加密 | bcrypt | 单向哈希 |
| 敏感信息 | 对称加密 | AES-256 | 密钥管理系统 |
| 传输数据 | 传输加密 | TLS 1.3 | 证书管理 |

#### 访问控制
| 控制类型 | 控制策略 | 实现方式 | 控制粒度 |
|----------|----------|----------|----------|
| 数据库用户 | 最小权限原则 | 角色基础访问控制 | 表级别 |
| 应用连接 | 连接池管理 | 连接字符串加密 | 应用级别 |
| 数据访问 | 行级安全 | RLS策略 | 行级别 |

#### 备份策略
| 备份类型 | 备份频率 | 保留时间 | 备份方式 |
|----------|----------|----------|----------|
| 全量备份 | 每日 | 30天 | pg_dump |
| 增量备份 | 每小时 | 7天 | WAL归档 |
| 逻辑备份 | 每周 | 90天 | pg_dumpall |

### 8. 监控和维护分析
#### 监控指标
| 指标类型 | 指标名称 | 阈值 | 告警级别 |
|----------|----------|------|----------|
| 连接监控 | 活跃连接数 | >80% | 警告 |
| 性能监控 | 查询响应时间 | >1000ms | 警告 |
| 存储监控 | 磁盘使用率 | >85% | 警告 |
| 内存监控 | 缓存命中率 | <90% | 警告 |

#### 维护策略
- **定期维护**: 每周进行数据库维护和优化
- **索引重建**: 定期重建碎片化严重的索引
- **统计信息更新**: 定期更新表统计信息
- **日志清理**: 定期清理过期日志和临时文件
- **性能调优**: 根据监控数据进行性能调优

## 输出格式要求

生成完整的数据库架构分析文档：

### 文档结构
\`\`\`\`markdown
# {项目名称} 数据库架构分析

## 数据库架构概览
### 数据库类型和版本
[根据实际项目填写数据库信息表格]

### 数据库架构图
[使用mermaid图表展示数据库架构]

## 表结构分析
### 核心业务表
[列出主要业务表的CREATE语句和字段说明]

### 系统支撑表
[列出权限、配置、日志等系统表]

## 索引设计分析
### 索引类型总览
[按索引类型分类展示所有索引]

## 关系模型分析
### 实体关系图
[使用mermaid ER图展示表关系]

### 关系说明
[详细说明各表之间的关系类型]

## 数据完整性分析
### 约束设计
[列出所有约束条件]

### 触发器设计
[展示关键触发器代码]

## 性能优化分析
### 查询优化策略
[性能优化方案和预期效果]

### 分区策略
[大表分区方案]

### 缓存策略
[缓存设计和过期策略]

## 数据安全分析
### 数据加密
[加密方案和算法选择]

### 访问控制
[权限控制和安全策略]

### 备份策略
[备份方案和恢复策略]

## 监控和维护分析
### 监控指标
[关键监控指标和告警阈值]

### 维护策略
[日常维护和优化策略]
## 总结

### 数据库架构特点
[总结数据库架构的主要特点]
\`\`\`\`

## 特别注意事项
1. 必须基于实际的代码和配置进行分析，不能虚构数据库结构
2. 重点分析核心业务表和关键索引设计
3. 关注数据完整性和安全性保证

## 输出文件命名
\`${workspace}${WIKI_OUTPUT_DIR}${SUBTASK_OUTPUT_FILENAMES.DATABASE_SCHEMA_TASK_FILE}\`
注意：如果${workspace}${WIKI_OUTPUT_DIR}目录不存在，则创建。

## 示例输出特征
基于项目的数据库分析特征：
- 详细的表结构和字段定义
- 完整的索引设计和优化策略
- 全面的关系模型和约束设计
- 具体的性能优化和安全措施
- 实用的监控和维护建议
`

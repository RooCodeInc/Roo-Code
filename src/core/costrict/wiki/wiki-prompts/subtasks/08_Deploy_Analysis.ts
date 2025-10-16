import { WIKI_OUTPUT_DIR, SUBTASK_OUTPUT_FILENAMES } from "./constants"

export const DEPLOY_ANALYSIS_TEMPLATE = (workspace: string) => `# 部署分析

## 使用场景
从代码仓库中分析项目的部署架构、流程、配置等，生成详细的部署技术文档。

## 输入要求
- **完整代码仓库**: 项目的完整源代码
- **部署配置**: Dockerfile、docker-compose.yml、Kubernetes配置等
- **CI/CD配置**: GitHub Actions、Jenkins、GitLab CI等配置文件
- **基础设施配置**: 云服务配置、基础设施即代码等

# 部署分析任务

## 任务描述
请深度分析项目的部署架构、流程、配置等，从部署架构、容器化、CI/CD、基础设施、监控等维度生成完整的部署技术文档。

## 分析维度

### 1. 部署架构分析
分析项目的整体部署架构，包括：
- **架构类型**: 单体/微服务/无服务器架构
- **部署环境**: 开发/测试/生产环境配置
- **服务依赖**: 数据库、缓存、消息队列等依赖关系
- **网络架构**: 负载均衡、服务发现、网络策略

### 2. 容器化分析
分析容器化部署配置：
- **Dockerfile配置**: 基础镜像、构建步骤、优化策略
- **Docker Compose**: 服务编排、网络配置、数据卷
- **镜像管理**: 镜像仓库、版本管理、安全扫描

### 3. Kubernetes部署分析
分析K8s部署配置：
- **工作负载**: Deployment、StatefulSet、DaemonSet配置
- **服务发现**: Service、Ingress配置
- **配置管理**: ConfigMap、Secret管理
- **存储配置**: PV、PVC、StorageClass
- **资源管理**: 资源限制、HPA、VPA配置

### 4. CI/CD流水线分析
分析自动化部署流程：
- **构建流程**: 代码检查、测试、构建步骤
- **部署策略**: 滚动更新、蓝绿部署、金丝雀发布
- **环境管理**: 多环境部署配置
- **回滚机制**: 版本回滚策略和流程

### 5. 基础设施分析
分析基础设施配置：
- **云服务**: 计算、存储、网络资源配置
- **基础设施即代码**: Terraform、CloudFormation等
- **网络配置**: VPC、子网、安全组配置
- **数据库服务**: RDS、缓存服务配置

### 6. 监控与日志分析
分析监控和日志配置：
- **监控系统**: Prometheus、Grafana配置
- **日志收集**: ELK、Fluentd配置
- **告警配置**: 告警规则、通知渠道
- **性能监控**: APM工具配置

### 7. 安全配置分析
分析安全相关配置：
- **网络安全**: 网络策略、防火墙规则
- **访问控制**: RBAC、服务账户配置
- **密钥管理**: Secret管理、证书配置
- **镜像安全**: 镜像扫描、安全策略

### 8. 备份与恢复分析
分析数据备份和恢复策略：
- **备份策略**: 定期备份、增量备份配置
- **恢复流程**: 数据恢复、灾难恢复计划
- **存储配置**: 备份存储、保留策略

## 输出格式要求

生成完整的部署分析文档，包含以下结构：

### 文档结构
\`\`\`\`markdown
# {项目名称} 部署分析

## 部署架构概览
### 架构图
[使用mermaid图表展示部署架构]

### 架构特点
- 架构类型和特点说明
- 关键技术栈
- 部署环境配置

## 容器化部署
### Docker配置
[关键Dockerfile配置示例]

### 容器编排
[Docker Compose或K8s配置要点]

## CI/CD流水线
### 构建流程
[构建步骤和配置]

### 部署策略
[部署策略和流程图]

## 基础设施配置
### 云服务架构
[基础设施配置要点]

### 网络配置
[网络架构和安全配置]

## 监控与运维
### 监控配置
[监控系统配置]

### 日志管理
[日志收集和分析配置]

## 安全配置
### 访问控制
[RBAC和权限配置]

### 网络安全
[网络策略和安全配置]

## 备份与恢复
### 备份策略
[数据备份配置]

### 恢复流程
[灾难恢复计划]

## 部署检查清单
### 部署前检查
- [ ] 代码质量检查
- [ ] 镜像构建验证
- [ ] 配置文件检查
- [ ] 环境变量配置
- [ ] 数据库迁移准备

### 部署后验证
- [ ] 服务健康检查
- [ ] 功能验证测试
- [ ] 性能指标检查
- [ ] 监控告警验证
- [ ] 日志输出检查

### 回滚准备
- [ ] 回滚脚本准备
- [ ] 数据备份确认
- [ ] 回滚流程测试
- [ ] 团队通知机制
\`\`\`

## 配置示例模板

### Dockerfile示例
\`\`\`dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
\`\`\`

### Kubernetes Deployment示例
\`\`\`yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: app-deployment
spec:
  replicas: 3
  selector:
    matchLabels:
      app: myapp
  template:
    metadata:
      labels:
        app: myapp
    spec:
      containers:
      - name: app
        image: myapp:latest
        ports:
        - containerPort: 3000
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
\`\`\`

### CI/CD Pipeline示例
\`\`\`yaml
name: Deploy Pipeline
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    - name: Build and Deploy
      run: |
        docker build -t myapp:latest .
        kubectl apply -f k8s/
\`\`\`\`

## 输出文件命名
\`${workspace}${WIKI_OUTPUT_DIR}${SUBTASK_OUTPUT_FILENAMES.DEPLOY_ANALYSIS_TASK_FILE}\`
注意：如果${workspace}${WIKI_OUTPUT_DIR}目录不存在，则创建。

## 注意事项
1. 必须基于实际的代码和配置进行分析，不能虚构部署架构
2. 重点分析部署架构和配置管理
3. 关注部署流程和环境配置
`

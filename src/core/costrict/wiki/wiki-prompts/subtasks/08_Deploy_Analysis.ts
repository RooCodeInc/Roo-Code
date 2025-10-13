import { WIKI_OUTPUT_DIR, SUBTASK_OUTPUT_FILENAMES } from "./constants"

export const DEPLOY_ANALYSIS_TEMPLATE = `# 部署分析

## 使用场景
从代码仓库中分析项目的部署架构、流程、配置等，生成详细的部署技术文档。

## 输入要求
- **前置任务分析结果**:（如果文件不存在则忽略）
  - \`${WIKI_OUTPUT_DIR}${SUBTASK_OUTPUT_FILENAMES.PROJECT_OVERVIEW_TASK_FILE}\`
  - \`${WIKI_OUTPUT_DIR}${SUBTASK_OUTPUT_FILENAMES.OVERALL_ARCHITECTURE_TASK_FILE}\`
  - \`${WIKI_OUTPUT_DIR}${SUBTASK_OUTPUT_FILENAMES.SERVICE_DEPENDENCIES_TASK_FILE}\`
  - \`${WIKI_OUTPUT_DIR}${SUBTASK_OUTPUT_FILENAMES.DATA_FLOW_INTEGRATION_TASK_FILE}\`
  - \`${WIKI_OUTPUT_DIR}${SUBTASK_OUTPUT_FILENAMES.SERVICE_ANALYSIS_TASK_FILE}\`
  - \`${WIKI_OUTPUT_DIR}${SUBTASK_OUTPUT_FILENAMES.DATABASE_SCHEMA_TASK_FILE}\`
  - \`${WIKI_OUTPUT_DIR}${SUBTASK_OUTPUT_FILENAMES.API_INTERFACE_TASK_FILE}\`
- **完整代码仓库**: 项目的完整源代码
- **部署配置**: Dockerfile、docker-compose.yml、Kubernetes配置等
- **CI/CD配置**: GitHub Actions、Jenkins、GitLab CI等配置文件
- **基础设施配置**: 云服务配置、基础设施即代码等

# 部署分析任务

## 任务描述
请深度分析项目的部署架构、流程、配置等，从部署架构、容器化、CI/CD、基础设施、监控等维度生成完整的部署技术文档。

## 分析维度

### 1. 部署架构分析
#### 部署架构图
\`\`\`mermaid
graph TB
    subgraph "开发环境"
        A[开发机]
        B[本地测试]
    end
    
    subgraph "CI/CD流水线"
        C[代码仓库]
        D[构建服务器]
        E[测试服务器]
        F[制品仓库]
    end
    
    subgraph "生产环境"
        G[负载均衡器]
        H[应用服务器]
        I[数据库服务器]
        J[缓存服务器]
        K[监控服务器]
    end
    
    subgraph "云服务"
        L[对象存储]
        M[CDN]
        N[日志服务]
        O[监控服务]
    end
    
    A --> C
    B --> C
    C --> D
    D --> E
    E --> F
    F --> G
    G --> H
    H --> I
    H --> J
    H --> K
    I --> L
    J --> M
    K --> N
    K --> O
\`\`\`

#### 部署架构特点
- **微服务架构**: 服务独立部署和扩展
- **容器化部署**: Docker容器化部署
- **云原生架构**: 基于云服务的部署架构
- **自动化部署**: CI/CD自动化部署流程

### 2. 容器化分析
#### Docker配置
\`\`\`dockerfile
# Management服务Dockerfile
FROM golang:1.21-alpine AS builder

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o management ./cmd/management

FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /root/
COPY --from=builder /app/management .
EXPOSE 8080
CMD ["./management"]
\`\`\`

#### Docker Compose配置
\`\`\`yaml
version: '3.8'

services:
  management:
    build: ./cmd/management
    ports:
      - "8080:8080"
    environment:
      - DB_HOST=postgres
      - DB_PORT=5432
      - DB_NAME=management
      - DB_USER=management
      - DB_PASSWORD=password
      - REDIS_HOST=redis
      - REDIS_PORT=6379
    depends_on:
      - postgres
      - redis
    networks:
      - app-network

  collector:
    build: ./cmd/collector
    ports:
      - "8081:8081"
    environment:
      - DB_HOST=postgres
      - DB_PORT=5432
      - DB_NAME=collector
      - DB_USER=collector
      - DB_PASSWORD=password
      - PULSAR_HOST=pulsar
      - PULSAR_PORT=6650
    depends_on:
      - postgres
      - pulsar
    networks:
      - app-network

  idm:
    build: ./cmd/idm
    ports:
      - "8082:8082"
    environment:
      - DB_HOST=postgres
      - DB_PORT=5432
      - DB_NAME=idm
      - DB_USER=idm
      - DB_PASSWORD=password
      - REDIS_HOST=redis
      - REDIS_PORT=6379
    depends_on:
      - postgres
      - redis
    networks:
      - app-network

  postgres:
    image: postgres:15
    environment:
      - POSTGRES_DB=app
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    networks:
      - app-network

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    networks:
      - app-network

  pulsar:
    image: apachepulsar/pulsar:3.0
    ports:
      - "6650:6650"
      - "8080:8080"
    command: bin/pulsar standalone
    networks:
      - app-network

volumes:
  postgres_data:

networks:
  app-network:
    driver: bridge
\`\`\`

#### Kubernetes配置
\`\`\`yaml
# Management服务部署配置
apiVersion: apps/v1
kind: Deployment
metadata:
  name: management
  labels:
    app: management
spec:
  replicas: 3
  selector:
    matchLabels:
      app: management
  template:
    metadata:
      labels:
        app: management
    spec:
      containers:
      - name: management
        image: management:latest
        ports:
        - containerPort: 8080
        env:
        - name: DB_HOST
          value: "postgres-service"
        - name: DB_PORT
          value: "5432"
        - name: DB_NAME
          value: "management"
        - name: DB_USER
          value: "management"
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: postgres-secret
              key: password
        - name: REDIS_HOST
          value: "redis-service"
        - name: REDIS_PORT
          value: "6379"
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: management-service
spec:
  selector:
    app: management
  ports:
  - protocol: TCP
    port: 80
    targetPort: 8080
  type: ClusterIP
\`\`\`

### 3. CI/CD分析
#### GitHub Actions配置
\`\`\`yaml
name: CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: \${{ github.repository }}

jobs:
  # 代码检查
  lint:
    name: Lint Code
    runs-on: ubuntu-latest
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
    
    - name: Set up Go
      uses: actions/setup-go@v4
      with:
        go-version: '1.21'
    
    - name: Lint
      run: |
        go fmt ./...
        go vet ./...
        golangci-lint run

  # 单元测试
  test:
    name: Run Tests
    runs-on: ubuntu-latest
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
    
    - name: Set up Go
      uses: actions/setup-go@v4
      with:
        go-version: '1.21'
    
    - name: Run tests
      run: |
        go test -v ./... -coverprofile=coverage.out
        go tool cover -html=coverage.out -o coverage.html
    
    - name: Upload coverage
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage.out

  # 构建镜像
  build:
    name: Build Images
    runs-on: ubuntu-latest
    needs: [lint, test]
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
    
    - name: Set up Docker Buildx
      uses: docker/setup-buildx-action@v3
    
    - name: Log in to Container Registry
      uses: docker/login-action@v3
      with:
        registry: \${{ env.REGISTRY }}
        username: \${{ github.actor }}
        password: \${{ secrets.GITHUB_TOKEN }}
    
    - name: Extract metadata
      id: meta
      uses: docker/metadata-action@v5
      with:
        images: \${{ env.REGISTRY }}/\${{ env.IMAGE_NAME }}
    
    - name: Build and push Management image
      uses: docker/build-push-action@v5
      with:
        context: .
        file: ./cmd/management/Dockerfile
        push: true
        tags: \${{ env.REGISTRY }}/\${{ env.IMAGE_NAME }}-management:latest
        labels: \${{ steps.meta.outputs.labels }}
    
    - name: Build and push Collector image
      uses: docker/build-push-action@v5
      with:
        context: .
        file: ./cmd/collector/Dockerfile
        push: true
        tags: \${{ env.REGISTRY }}/\${{ env.IMAGE_NAME }}-collector:latest
        labels: \${{ steps.meta.outputs.labels }}
    
    - name: Build and push IDM image
      uses: docker/build-push-action@v5
      with:
        context: .
        file: ./cmd/idm/Dockerfile
        push: true
        tags: \${{ env.REGISTRY }}/\${{ env.IMAGE_NAME }}-idm:latest
        labels: \${{ steps.meta.outputs.labels }}

  # 部署到测试环境
  deploy-test:
    name: Deploy to Test
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/develop'
    environment: test
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
    
    - name: Set up kubectl
      uses: azure/setup-kubectl@v3
      with:
        version: '1.28.0'
    
    - name: Configure kubeconfig
      run: |
        mkdir -p \$HOME/.kube
        echo "\${{ secrets.KUBE_CONFIG_TEST }}" | base64 -d > \$HOME/.kube/config
    
    - name: Deploy to test environment
      run: |
        kubectl apply -f k8s/test/
        kubectl rollout status deployment/management
        kubectl rollout status deployment/collector
        kubectl rollout status deployment/idm

  # 部署到生产环境
  deploy-prod:
    name: Deploy to Production
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/main'
    environment: production
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
    
    - name: Set up kubectl
      uses: azure/setup-kubectl@v3
      with:
        version: '1.28.0'
    
    - name: Configure kubeconfig
      run: |
        mkdir -p \$HOME/.kube
        echo "\${{ secrets.KUBE_CONFIG_PROD }}" | base64 -d > \$HOME/.kube/config
    
    - name: Deploy to production environment
      run: |
        kubectl apply -f k8s/prod/
        kubectl rollout status deployment/management
        kubectl rollout status deployment/collector
        kubectl rollout status deployment/idm
\`\`\`

#### 部署流程
\`\`\`mermaid
graph LR
    A[代码提交] --> B[代码检查]
    B --> C[单元测试]
    C --> D[构建镜像]
    D --> E{分支判断}
    E -->|develop分支| F[部署到测试环境]
    E -->|main分支| G[部署到生产环境]
    F --> H[测试验证]
    G --> I[生产验证]
    H --> J[通知开发人员]
    I --> J
\`\`\`

### 4. 基础设施分析
#### 云服务配置
\`\`\`terraform
# AWS基础设施配置
provider "aws" {
  region = "us-west-2"
}

# VPC配置
resource "aws_vpc" "main" {
  cidr_block = "10.0.0.0/16"
  enable_dns_support = true
  enable_dns_hostnames = true
  
  tags = {
    Name = "main-vpc"
    Environment = "production"
  }
}

# 公共子网
resource "aws_subnet" "public" {
  count = 2
  vpc_id = aws_vpc.main.id
  cidr_block = "10.0.\${count.index + 1}.0/24"
  availability_zone = "us-west-2\${count.index == 0 ? "a" : "b"}"
  map_public_ip_on_launch = true
  
  tags = {
    Name = "public-subnet-\${count.index + 1}"
    Type = "public"
  }
}

# 私有子网
resource "aws_subnet" "private" {
  count = 2
  vpc_id = aws_vpc.main.id
  cidr_block = "10.0.\${count.index + 3}.0/24"
  availability_zone = "us-west-2\${count.index == 0 ? "a" : "b"}"
  
  tags = {
    Name = "private-subnet-\${count.index + 1}"
    Type = "private"
  }
}

# EKS集群
resource "aws_eks_cluster" "main" {
  name = "main-cluster"
  role_arn = aws_iam_role.eks_cluster.arn
  
  vpc_config {
    subnet_ids = concat(
      aws_subnet.public[*].id,
      aws_subnet.private[*].id
    )
  }
  
  depends_on = [
    aws_iam_role_policy_attachment.eks_cluster_policy,
  ]
}

# EKS节点组
resource "aws_eks_node_group" "main" {
  cluster_name = aws_eks_cluster.main.name
  node_group_name = "main-node-group"
  node_role_arn = aws_iam_role.eks_node.arn
  subnet_ids = aws_subnet.private[*].id
  
  scaling_config {
    desired_size = 3
    max_size = 5
    min_size = 1
  }
  
  instance_types = ["t3.medium"]
  
  depends_on = [
    aws_iam_role_policy_attachment.eks_worker_node_policy,
  ]
}

# RDS数据库
resource "aws_db_instance" "main" {
  identifier = "main-db"
  engine = "postgres"
  engine_version = "15.4"
  instance_class = "db.t3.medium"
  allocated_storage = 20
  storage_type = "gp2"
  
  db_name = "app"
  username = "app"
  password = var.db_password
  
  vpc_security_group_ids = [aws_security_group.db.id]
  db_subnet_group_name = aws_db_subnet_group.main.name
  
  backup_retention_period = 7
  backup_window = "04:00-05:00"
  maintenance_window = "sun:05:00-sun:06:00"
  
  tags = {
    Name = "main-db"
    Environment = "production"
  }
}

# ElastiCache Redis
resource "aws_elasticache_cluster" "main" {
  cluster_id = "main-cache"
  engine = "redis"
  engine_version = "7.0"
  node_type = "cache.t3.medium"
  port = 6379
  num_cache_nodes = 1
  
  parameter_group_name = "default.redis7"
  subnet_group_name = aws_elasticache_subnet_group.main.name
  security_group_ids = [aws_security_group.redis.id]
  
  tags = {
    Name = "main-cache"
    Environment = "production"
  }
}
\`\`\`

#### 监控配置
\`\`\`yaml
# Prometheus配置
apiVersion: v1
kind: ConfigMap
metadata:
  name: prometheus-config
data:
  prometheus.yml: |
    global:
      scrape_interval: 15s
      evaluation_interval: 15s
    
    scrape_configs:
    - job_name: 'kubernetes-pods'
      kubernetes_sd_configs:
      - role: pod
      relabel_configs:
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
        action: keep
        regex: true
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_path]
        action: replace
        target_label: __metrics_path__
        regex: (.+)
      - source_labels: [__address__, __meta_kubernetes_pod_annotation_prometheus_io_port]
        action: replace
        regex: ([^:]+)(?::\d+)?;(\d+)
        replacement: \$1:\$2
        target_label: __address__
    
    - job_name: 'kubernetes-services'
      kubernetes_sd_configs:
      - role: service
      relabel_configs:
      - source_labels: [__meta_kubernetes_service_annotation_prometheus_io_scrape]
        action: keep
        regex: true
\`\`\`

### 5. 部署策略分析
#### 部署策略
| 策略类型 | 策略名称 | 适用场景 | 优点 | 缺点 |
|----------|----------|----------|------|------|
| 滚动部署 | Rolling Update | 无状态服务 | 零停机时间 | 回滚复杂 |
| 蓝绿部署 | Blue-Green | 关键业务 | 快速回滚 | 资源占用多 |
| 金丝雀部署 | Canary | 新功能验证 | 风险控制 | 部署复杂 |
| 重建部署 | Recreate | 简单应用 | 部署简单 | 有停机时间 |

#### 部署配置
\`\`\`yaml
# 滚动部署策略
apiVersion: apps/v1
kind: Deployment
metadata:
  name: management
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 1
  template:
    # ... pod模板配置
\`\`\`

### 6. 安全配置分析
#### 安全配置
\`\`\`yaml
# 网络策略
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: app-network-policy
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: default
    ports:
    - protocol: TCP
      port: 8080
  egress:
  - to: []
    ports:
    - protocol: TCP
      port: 5432
    - protocol: TCP
      port: 6379

# RBAC配置
apiVersion: v1
kind: ServiceAccount
metadata:
  name: app-service-account
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: app-role
rules:
- apiGroups: [""]
  resources: ["pods", "services", "configmaps"]
  verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: app-role-binding
subjects:
- kind: ServiceAccount
  name: app-service-account
roleRef:
  kind: Role
  name: app-role
  apiGroup: rbac.authorization.k8s.io
\`\`\`

### 7. 备份与恢复分析
#### 备份策略
\`\`\`yaml
# 数据库备份CronJob
apiVersion: batch/v1
kind: CronJob
metadata:
  name: postgres-backup
spec:
  schedule: "0 2 * * *"  # 每天凌晨2点
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: postgres:15
            command:
            - /bin/sh
            - -c
            - |
              pg_dump -h postgres-service -U postgres -d app > /backup/backup-\$(date +%Y%m%d-%H%M%S).sql
            volumeMounts:
            - name: backup-volume
              mountPath: /backup
            env:
            - name: PGPASSWORD
              valueFrom:
                secretKeyRef:
                  name: postgres-secret
                  key: password
          volumes:
          - name: backup-volume
            persistentVolumeClaim:
              claimName: backup-pvc
          restartPolicy: OnFailure
\`\`\`

#### 恢复策略
\`\`\`yaml
# 数据库恢复Job
apiVersion: batch/v1
kind: Job
metadata:
  name: postgres-restore
spec:
  template:
    spec:
      containers:
      - name: restore
        image: postgres:15
        command:
        - /bin/sh
        - -c
        - |
          psql -h postgres-service -U postgres -d app < /backup/backup-20231201-020000.sql
        volumeMounts:
        - name: backup-volume
          mountPath: /backup
        env:
        - name: PGPASSWORD
          valueFrom:
            secretKeyRef:
              name: postgres-secret
              key: password
      volumes:
      - name: backup-volume
        persistentVolumeClaim:
          claimName: backup-pvc
      restartPolicy: OnFailure
\`\`\`

### 8. 性能优化分析
#### 性能优化配置
\`\`\`yaml
# HPA配置
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: management-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: management
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
\`\`\`

#### 资源限制配置
\`\`\`yaml
# 资源限制
apiVersion: v1
kind: LimitRange
metadata:
  name: resource-limits
spec:
  limits:
  - default:
      cpu: "500m"
      memory: "512Mi"
    defaultRequest:
      cpu: "250m"
      memory: "256Mi"
    type: Container
\`\`\`

## 输出格式要求

生成完整的部署分析文档：

### 文档结构
\`\`\`markdown
# {项目名称} 部署分析

## 部署架构概览

### 部署架构图
\`\`\`mermaid
graph TB
    subgraph "开发环境"
        A[开发机]
        B[本地测试]
    end
    
    subgraph "CI/CD流水线"
        C[代码仓库]
        D[构建服务器]
        E[测试服务器]
        F[制品仓库]
    end
    
    subgraph "生产环境"
        G[负载均衡器]
        H[应用服务器]
        I[数据库服务器]
        J[缓存服务器]
        K[监控服务器]
    end
    
    subgraph "云服务"
        L[对象存储]
        M[CDN]
        N[日志服务]
        O[监控服务]
    end
    
    A --> C
    B --> C
    C --> D
    D --> E
    E --> F
    F --> G
    G --> H
    H --> I
    H --> J
    H --> K
    I --> L
    J --> M
    K --> N
    K --> O
\`\`\`

### 部署架构特点
- **微服务架构**: 服务独立部署和扩展
- **容器化部署**: Docker容器化部署
- **云原生架构**: 基于云服务的部署架构
- **自动化部署**: CI/CD自动化部署流程

## 容器化部署

### Docker配置
\`\`\`dockerfile
# Management服务Dockerfile
FROM golang:1.21-alpine AS builder

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o management ./cmd/management

FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /root/
COPY --from=builder /app/management .
EXPOSE 8080
CMD ["./management"]
\`\`\`

### Docker Compose配置
\`\`\`yaml
version: '3.8'

services:
  management:
    build: ./cmd/management
    ports:
      - "8080:8080"
    environment:
      - DB_HOST=postgres
      - DB_PORT=5432
      - DB_NAME=management
      - DB_USER=management
      - DB_PASSWORD=password
      - REDIS_HOST=redis
      - REDIS_PORT=6379
    depends_on:
      - postgres
      - redis
    networks:
      - app-network

  postgres:
    image: postgres:15
    environment:
      - POSTGRES_DB=app
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    networks:
      - app-network

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    networks:
      - app-network

volumes:
  postgres_data:

networks:
  app-network:
    driver: bridge
\`\`\`

## Kubernetes部署

### 部署配置
\`\`\`yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: management
  labels:
    app: management
spec:
  replicas: 3
  selector:
    matchLabels:
      app: management
  template:
    metadata:
      labels:
        app: management
    spec:
      containers:
      - name: management
        image: management:latest
        ports:
        - containerPort: 8080
        env:
        - name: DB_HOST
          value: "postgres-service"
        - name: DB_PORT
          value: "5432"
        - name: DB_NAME
          value: "management"
        - name: DB_USER
          value: "management"
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: postgres-secret
              key: password
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 5
\`\`\`

### 服务配置
\`\`\`yaml
apiVersion: v1
kind: Service
metadata:
  name: management-service
spec:
  selector:
    app: management
  ports:
  - protocol: TCP
    port: 80
    targetPort: 8080
  type: ClusterIP
\`\`\`

## CI/CD流水线

### GitHub Actions配置
\`\`\`yaml
name: CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  lint:
    name: Lint Code
    runs-on: ubuntu-latest
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
    
    - name: Set up Go
      uses: actions/setup-go@v4
      with:
        go-version: '1.21'
    
    - name: Lint
      run: |
        go fmt ./...
        go vet ./...
        golangci-lint run

  test:
    name: Run Tests
    runs-on: ubuntu-latest
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
    
    - name: Set up Go
      uses: actions/setup-go@v4
      with:
        go-version: '1.21'
    
    - name: Run tests
      run: |
        go test -v ./... -coverprofile=coverage.out
        go tool cover -html=coverage.out -o coverage.html

  build:
    name: Build Images
    runs-on: ubuntu-latest
    needs: [lint, test]
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
    
    - name: Set up Docker Buildx
      uses: docker/setup-buildx-action@v3
    
    - name: Build and push images
      run: |
        docker build -t management:latest ./cmd/management
        docker build -t collector:latest ./cmd/collector
        docker build -t idm:latest ./cmd/idm
\`\`\`

### 部署流程
\`\`\`mermaid
graph LR
    A[代码提交] --> B[代码检查]
    B --> C[单元测试]
    C --> D[构建镜像]
    D --> E{分支判断}
    E -->|develop分支| F[部署到测试环境]
    E -->|main分支| G[部署到生产环境]
    F --> H[测试验证]
    G --> I[生产验证]
    H --> J[通知开发人员]
    I --> J
\`\`\`

## 基础设施配置

### 云服务配置
\`\`\`terraform
provider "aws" {
  region = "us-west-2"
}

resource "aws_vpc" "main" {
  cidr_block = "10.0.0.0/16"
  enable_dns_support = true
  enable_dns_hostnames = true
  
  tags = {
    Name = "main-vpc"
    Environment = "production"
  }
}

resource "aws_eks_cluster" "main" {
  name = "main-cluster"
  role_arn = aws_iam_role.eks_cluster.arn
  
  vpc_config {
    subnet_ids = concat(
      aws_subnet.public[*].id,
      aws_subnet.private[*].id
    )
  }
}
\`\`\`

### 监控配置
\`\`\`yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: prometheus-config
data:
  prometheus.yml: |
    global:
      scrape_interval: 15s
      evaluation_interval: 15s
    
    scrape_configs:
    - job_name: 'kubernetes-pods'
      kubernetes_sd_configs:
      - role: pod
\`\`\`

## 部署策略

### 滚动部署
\`\`\`yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: management
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 1
\`\`\`

### 自动扩缩容
\`\`\`yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: management-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: management
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
\`\`\`

## 安全配置

### 网络策略
\`\`\`yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: app-network-policy
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: default
    ports:
    - protocol: TCP
      port: 8080
\`\`\`

### RBAC配置
\`\`\`yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: app-service-account
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: app-role
rules:
- apiGroups: [""]
  resources: ["pods", "services", "configmaps"]
  verbs: ["get", "list", "watch"]
\`\`\`

## 备份与恢复

### 备份策略
\`\`\`yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: postgres-backup
spec:
  schedule: "0 2 * * *"
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: postgres:15
            command:
            - /bin/sh
            - -c
            - |
              pg_dump -h postgres-service -U postgres -d app > /backup/backup-\$(date +%Y%m%d-%H%M%S).sql
\`\`\`

## 性能优化

### 资源限制
\`\`\`yaml
apiVersion: v1
kind: LimitRange
metadata:
  name: resource-limits
spec:
  limits:
  - default:
      cpu: "500m"
      memory: "512Mi"
    defaultRequest:
      cpu: "250m"
      memory: "256Mi"
    type: Container
\`\`\`

## 部署检查清单

### 部署前检查
- [ ] 代码已通过所有测试
- [ ] Docker镜像已构建并推送到仓库
- [ ] Kubernetes配置文件已更新
- [ ] 环境变量已配置
- [ ] 数据库迁移脚本已准备

### 部署后检查
- [ ] 所有Pod正常运行
- [ ] 服务可正常访问
- [ ] 数据库连接正常
- [ ] 缓存服务正常
- [ ] 监控指标正常
- [ ] 日志输出正常

### 回滚计划
- [ ] 备份当前版本配置
- [ ] 准备回滚脚本
- [ ] 测试回滚流程
- [ ] 通知相关人员
\`\`\`

## 输出文件命名
\`${WIKI_OUTPUT_DIR}${SUBTASK_OUTPUT_FILENAMES.DEPLOY_ANALYSIS_TASK_FILE}\`
注意：如果${WIKI_OUTPUT_DIR} 目录不存在，则创建。

## 注意事项
1. **安全第一**: 所有敏感信息必须使用Kubernetes Secret管理
2. **监控完备**: 确保所有服务都有完善的监控和告警
3. **备份策略**: 定期备份重要数据，测试恢复流程
4. **性能优化**: 根据实际负载调整资源配置
5. **文档更新**: 及时更新部署文档和操作手册
`

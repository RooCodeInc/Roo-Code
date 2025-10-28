# 项目简介

# CoStrict 后端部署工具

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Docker](https://img.shields.io/badge/docker-required-blue.svg)](https://docs.docker.com/get-docker/)
[![Docker Compose](https://img.shields.io/badge/docker--compose-required-blue.svg)](https://docs.docker.com/compose/install/)

## 项目概述

CoStrict 后端部署工具是基于 Docker Compose 的企业级 AI 代码助手后端服务部署解决方案。该项目提供了完整的微服务架构，包含 AI 网关、身份认证、代码分析、聊天服务等核心组件，支持私有化部署和云端服务两种模式。

### 核心特性

- **微服务架构**: 基于容器化的分布式服务架构
- **AI 网关集成**: 支持多种大语言模型接入
- **身份认证系统**: 集成 Casdoor 提供企业级身份管理
- **代码智能分析**: 提供代码审查、补全、优化等功能
- **可扩展设计**: 支持横向扩展和自定义插件

### 系统架构

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   VSCode 插件    │────│   API Gateway   │────│   后端服务群     │
│   (CoStrict)    │    │  (Apache APISIX) │    │  (Microservices) │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │                        │
                       ┌─────────────────┐    ┌─────────────────┐
                       │   AI 网关       │    │   数据库集群     │
                       │   (Higress)     │    │   (PostgreSQL)  │
                       └─────────────────┘    └─────────────────┘
```

## 系统要求

### 自部署模型实例环境

**硬件要求**:

- CPU: Intel x64 架构，最低 16 核心
- 内存: 最低 32GB RAM
- 存储: 最低 512GB 可用存储空间
- GPU: 支持 CUDA 的显卡（代码补全/分析推荐配置: 2×RTX 4090 或 1×A800，对话模型推荐配置: 8\*H20）

**软件要求**:

- 操作系统: CentOS 7+ 或 Ubuntu 18.04+ (支持 WSL)
- Container Runtime: Docker 20.10+
- 编排工具: Docker Compose 2.0+
- NVIDIA 驱动: nvidia-docker 支持

### 第三方 API 服务环境

**硬件要求**:

- CPU: Intel x64 架构，最低 16 核心
- 内存: 最低 32GB RAM
- 存储: 最低 512GB 可用存储空间

**软件要求**:

- 操作系统: CentOS 7+ 或 Ubuntu 18.04+
- Container Runtime: Docker 20.10+
- 编排工具: Docker Compose 2.0+

## 快速开始

### 1. 获取部署代码

```bash
git clone https://github.com/zgsm-ai/zgsm-backend-deploy.git
cd zgsm-backend-deploy
```

### 2. 环境配置

编辑配置文件:

```bash
vim configure.sh
```

**关键配置参数**:

| 参数名称                   | 描述                 | 默认值 | 是否必需 |
| -------------------------- | -------------------- | ------ | -------- |
| `COSTRICT_BACKEND_BASEURL` | 后端服务基础 URL     | -      | ✅       |
| `COSTRICT_BACKEND`         | 后端服务主机地址     | -      | ✅       |
| `PORT_APISIX_ENTRY`        | API 网关入口端口     | 9080   | ❌       |
| `PORT_HIGRESS_CONTROL`     | Higress 控制台端口   | 8001   | ❌       |
| `PORT_CASDOOR`             | Casdoor 认证系统端口 | 9009   | ❌       |

### 3. 服务部署

执行自动化部署脚本:

```bash
bash deploy.sh
```

部署过程包含以下步骤:

1. 环境检查与依赖验证
2. Docker 镜像拉取与构建
3. 数据库初始化
4. 服务容器启动
5. 健康检查与状态验证

## 服务配置

### AI 网关配置 (Higress)

部署完成后，通过以下地址访问 Higress 控制台:

```
http://{COSTRICT_BACKEND}:{PORT_HIGRESS_CONTROL}
```

配置步骤:

1. 访问 Higress 管理界面
2. 配置上游 LLM 服务提供商
3. 设置路由规则和负载均衡策略
4. 配置限流和安全策略

详细配置指南: [Higress 配置文档](./docs/higress.zh-CN.md)

### 身份认证系统配置 (Casdoor)

通过以下地址访问 Casdoor 管理界面:

```
http://{COSTRICT_BACKEND}:{PORT_CASDOOR}
```

**测试账户** (仅用于开发和测试环境):

```
用户名: demo
密码: test123
```

配置功能:

- 用户管理和权限控制
- 第三方身份提供商集成 (OIDC/SAML)
- 多因子身份验证 (MFA)
- 会话管理和安全策略

## 客户端集成

### VSCode 插件配置

1. 安装 CoStrict VSCode 扩展
2. 打开扩展设置中的"提供商"页面
3. 选择 API 提供商为"CoStrict"
4. 配置后端服务地址:
    ```
    CoStrict Base URL: {COSTRICT_BACKEND_BASEURL}
    ```
5. 点击"登录 CoStrict"完成身份验证

**服务访问地址**:

```
默认后端入口: http://{COSTRICT_BACKEND}:{PORT_APISIX_ENTRY}
```

### 域名绑定与负载均衡

对于生产环境，建议通过反向代理或负载均衡器访问服务:

```bash
# Nginx 配置示例
upstream costrict_backend {
    server {COSTRICT_BACKEND}:{PORT_APISIX_ENTRY};
}

server {
    listen 443 ssl;
    server_name your-domain.com;

    location / {
        proxy_pass http://costrict_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 运维管理

### 服务状态监控

检查服务运行状态:

```bash
# 查看所有服务状态
docker-compose ps

# 查看服务日志
docker-compose logs -f [service_name]

# 查看资源使用情况
docker stats
```

### 数据备份与恢复

```bash
# 数据库备份
bash ./scripts/backup.sh

# 数据库恢复
bash ./scripts/restore.sh [backup_file]
```

### 服务扩缩容

```bash
# 扩容服务实例
docker-compose up -d --scale chatgpt=3

# 更新服务配置
docker-compose up -d --force-recreate [service_name]
```

## 故障排除

### 常见问题

**1. 容器启动失败**

```bash
# 检查端口占用
netstat -tlnp | grep {port}

# 检查磁盘空间
df -h

# 查看详细错误日志
docker-compose logs [service_name]
```

**2. 网络连接问题**

```bash
# 测试服务连通性
curl -v http://{COSTRICT_BACKEND}:{PORT_APISIX_ENTRY}/health

# 检查 Docker 网络
docker network ls
docker network inspect {network_name}
```

**3. 数据库连接问题**

```bash
# 检查数据库服务状态
docker-compose exec postgres pg_isready

# 查看数据库日志
docker-compose logs postgres
```

### 日志收集

系统日志位置:

- 应用日志: `./logs/`
- 数据库日志: 容器内 `/var/log/postgresql/`
- 网关日志: 容器内 `/var/log/apisix/`

## 安全注意事项

1. **生产环境部署**:

    - 修改所有默认密码
    - 配置 HTTPS 证书
    - 启用防火墙和访问控制
    - 定期更新系统和依赖包

2. **网络安全**:

    - 仅开放必要端口
    - 配置 VPN 或内网访问
    - 启用 API 限流和防护

3. **数据保护**:
    - 定期备份重要数据
    - 启用数据库加密
    - 配置访问审计日志

## 许可证

本项目基于 Apache 2.0 许可证开源。详见 [LICENSE](LICENSE) 文件。

## 支持与贡献

- **问题报告**: [GitHub Issues](https://github.com/zgsm-ai/zgsm-backend-deploy/issues)

---

**CoStrict** - 让 AI 助力您的代码开发之旅

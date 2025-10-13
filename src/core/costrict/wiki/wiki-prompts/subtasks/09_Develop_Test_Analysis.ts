import { WIKI_OUTPUT_DIR, SUBTASK_OUTPUT_FILENAMES } from "./constants"

export const DEVELOP_TEST_ANALYSIS_TEMPLATE = `# 开发测试深度分析

## 使用场景
从代码仓库中分析项目的开发环境和测试环境，生成详细的开发测试技术文档，包括项目启动机制、环境搭建、配置管理、调试机制、测试框架、测试运行等，为AI编程提供精准的开发测试上下文信息。

## 输入要求
- **前置任务分析结果**:（如果文件不存在则忽略）
  - \`${WIKI_OUTPUT_DIR}${SUBTASK_OUTPUT_FILENAMES.PROJECT_OVERVIEW_TASK_FILE}\`
  - \`${WIKI_OUTPUT_DIR}${SUBTASK_OUTPUT_FILENAMES.OVERALL_ARCHITECTURE_TASK_FILE}\`
  - \`${WIKI_OUTPUT_DIR}${SUBTASK_OUTPUT_FILENAMES.SERVICE_DEPENDENCIES_TASK_FILE}\`
  ...
  - \`${WIKI_OUTPUT_DIR}${SUBTASK_OUTPUT_FILENAMES.DEPLOY_ANALYSIS_TASK_FILE}\`
- **完整代码仓库**: 项目的完整源代码
- **配置文件**: 所有开发和测试相关的配置文件
- **脚本文件**: 启动脚本、构建脚本、测试脚本等
- **文档文件**: 开发环境搭建、测试环境配置等相关文档

# 开发测试深度分析任务

## 任务描述
请深度分析项目中的开发环境和测试环境，从项目启动机制、环境搭建、配置管理、调试机制、测试框架、测试运行等维度生成完整的开发测试技术文档，重点分析开发机制（60%）和测试机制（40%）。

## 分析维度

### 1. 开发环境分析 (60%)

#### 1.1 项目启动机制分析
**目标**: 分析项目启动流程，提供可执行的启动指导

**执行步骤**:
1. **启动脚本扫描**:
   \`\`\`bash
   # 查找包管理文件
   find . -name "package.json" -o -name "pom.xml" -o -name "go.mod" -o -name "requirements.txt"
   
   # 分析启动脚本
   grep -r "start\\|dev\\|run" package.json 2>/dev/null || echo "未找到启动脚本"
   \`\`\`

2. **启动流程解析**:
   - 主应用启动机制分析
   - 子模块或微服务启动机制分析
   - 依赖关系和启动顺序分析

3. **启动机制输出**:
   \`\`\`markdown
   ## 项目启动机制
   ### 启动命令清单
   | 应用类型 | 启动命令 | 配置文件 | 端口 | 依赖关系 | 启动顺序 |
   |---------|---------|---------|------|---------|---------|
   | 主应用 | npm run dev | package.json | 3000 | 无 | 1 |
   | API服务 | npm run start:api | package.json | 3001 | 主应用 | 2 |
   | 前端界面 | npm run dev:ui | package.json | 3002 | API服务 | 3 |
   
   ### 启动流程图
   \`\`\`mermaid
   graph TD
       A[环境检查] --> B[依赖安装]
       B --> C[配置加载]
       C --> D[主应用启动]
       D --> E[API服务启动]
       E --> F[前端界面启动]
       F --> G[启动完成]
   \`\`\`
   \`\`\`

#### 1.2 环境搭建分析
**目标**: 分析环境搭建流程，提供环境配置指导

**执行步骤**:
1. **环境依赖扫描**:
   - 数据库依赖分析
   - 中间件依赖分析
   - 系统依赖分析

2. **环境配置分析**:
   - 环境变量配置
   - 配置文件管理
   - 多环境支持

3. **环境搭建输出**:
   \`\`\`markdown
   ## 环境搭建指南
   ### 环境依赖清单
   | 依赖类型 | 依赖名称 | 版本要求 | 安装方式 | 配置文件 |
   |---------|----------|----------|----------|----------|
   | 数据库 | PostgreSQL | 14+ | Docker | docker-compose.yml |
   | 缓存 | Redis | 6+ | Docker | docker-compose.yml |
   | 消息队列 | RabbitMQ | 3.8+ | Docker | docker-compose.yml |
   
   ### 环境变量配置
   \`\`\`bash
   # 必需环境变量
   export DATABASE_URL="postgresql://user:pass@localhost:5432/db"
   export REDIS_URL="redis://localhost:6379"
   export NODE_ENV="development"
   
   # 可选环境变量
   export LOG_LEVEL="debug"
   export API_PORT="3000"
   \`\`\`
   
   ### 环境搭建流程
   \`\`\`mermaid
   graph LR
       A[系统要求检查] --> B[安装依赖工具]
       B --> C[启动基础服务]
       C --> D[配置环境变量]
       D --> E[安装项目依赖]
       E --> F[验证环境配置]
       F --> G[环境搭建完成]
   \`\`\`
   \`\`\`

#### 1.3 配置管理分析
**目标**: 分析配置管理机制，提供配置优化建议

**执行步骤**:
1. **配置文件扫描**:
   - 开发环境配置文件
   - 测试环境配置文件
   - 生产环境配置文件

2. **配置机制分析**:
   - 配置加载机制
   - 配置验证机制
   - 配置热更新机制

3. **配置管理输出**:
   \`\`\`markdown
   ## 配置管理机制
   ### 配置文件清单
   | 配置文件 | 环境类型 | 主要配置项 | 配置格式 | 加载优先级 |
   |---------|----------|-----------|----------|-----------|
   | config.dev.json | 开发环境 | 数据库、API端口 | JSON | 1 |
   | config.test.json | 测试环境 | 测试数据库、Mock | JSON | 2 |
   | config.prod.json | 生产环境 | 生产数据库、安全 | JSON | 3 |
   
   ### 配置加载机制
   \`\`\`mermaid
   graph TD
       A[应用启动] --> B[基础配置加载]
       B --> C[环境变量覆盖]
       C --> D[配置文件加载]
       D --> E[配置验证]
       E --> F[配置生效]
   \`\`\`
   
   ### 配置优化建议
   | 配置项 | 当前配置 | 推荐配置 | 优化理由 | 实施难度 |
   |--------|----------|----------|----------|----------|
   | 数据库连接池 | 10 | 20 | 提升并发性能 | 低 |
   | 缓存过期时间 | 1h | 30min | 提高数据新鲜度 | 中 |
   | 日志级别 | info | debug | 便于开发调试 | 低 |
   \`\`\`

#### 1.4 调试机制分析
**目标**: 分析调试配置，提供调试指导

**执行步骤**:
1. **调试配置扫描**:
   - IDE调试配置文件
   - 浏览器调试配置
   - 远程调试配置

2. **调试环境分析**:
   - 调试器配置
   - 源码映射配置
   - 断点设置机制

3. **调试机制输出**:
   \`\`\`markdown
   ## 调试机制配置
   ### 调试配置清单
   | 调试类型 | 配置文件 | 调试端口 | 源码映射 | 支持功能 |
   |---------|----------|----------|----------|----------|
   | VSCode调试 | .vscode/launch.json | 9229 | 启用 | 断点、变量查看 |
   | Chrome调试 | devtools | 9229 | 启用 | 元素检查、网络分析 |
   | 远程调试 | debug-config.json | 9229 | 启用 | 远程断点、日志查看 |
   
   ### 调试操作指南
   #### VSCode调试
   1. 在目标代码行设置断点（F9）
   2. 启动调试会话（F5）
   3. 使用调试控制台查看变量
   4. 单步执行（F10/F11）
   5. 查看调用栈和变量值
   
   #### 浏览器调试
   1. 启动开发服务器
   2. 打开浏览器开发者工具（F12）
   3. 使用Sources面板调试
   4. 设置断点和监控变量
   5. 使用Console执行调试代码
   
   ### 调试技巧
   - **条件断点**: 设置条件断点，只在特定条件下触发
   - **日志断点**: 在断点处输出日志，不暂停执行
   - **异常断点**: 在异常发生时自动暂停
   - **远程调试**: 支持远程调试容器化应用
   \`\`\`

#### 1.5 代码组织结构分析
**目标**: 分析项目结构，提供开发指导

**执行步骤**:
1. **项目结构扫描**:
   - 目录结构分析
   - 模块划分分析
   - 文件组织分析

2. **设计模式分析**:
   - 架构模式识别
   - 设计模式应用
   - 最佳实践总结

3. **代码组织输出**:
   \`\`\`markdown
   ## 代码组织结构
   ### 目录结构分析
   | 目录路径 | 主要职责 | 文件类型 | 设计模式 | 开发建议 |
   |----------|----------|----------|----------|----------|
   | src/ | 源代码目录 | .ts, .js, .vue | 分层架构 | 按功能模块组织 |
   | src/components/ | UI组件 | .vue, .tsx | 组件模式 | 可复用组件设计 |
   | src/services/ | 业务服务 | .ts, .js | 服务模式 | 单一职责原则 |
   | src/utils/ | 工具函数 | .ts, .js | 工具模式 | 纯函数设计 |
   | src/types/ | 类型定义 | .ts, .d.ts | 类型模式 | 严格类型定义 |
   | tests/ | 测试文件 | .test.ts, .spec.ts | 测试模式 | 测试驱动开发 |
   
   ### 设计模式应用
   | 设计模式 | 应用位置 | 使用场景 | 优势 | 注意事项 |
   |----------|----------|----------|------|----------|
   | 单例模式 | 配置管理 | 全局配置访问 | 内存效率 | 线程安全 |
   | 工厂模式 | 服务创建 | 对象实例化 | 解耦创建逻辑 | 复杂性管理 |
   | 观察者模式 | 事件系统 | 事件通知 | 松耦合 | 内存泄漏 |
   | 策略模式 | 算法选择 | 多算法切换 | 灵活性 | 接口一致性 |
   
   ### 开发最佳实践
   #### 代码组织原则
   - **单一职责**: 每个模块只负责一个功能
   - **依赖倒置**: 高层模块不依赖低层模块
   - **开闭原则**: 对扩展开放，对修改关闭
   - **接口隔离**: 使用最小接口
   
   #### 开发流程建议
   \`\`\`mermaid
   graph TD
       A[需求分析] --> B[接口设计]
       B --> C[编码实现]
       C --> D[单元测试]
       D --> E[集成测试]
       E --> F[代码审查]
       F --> G[部署上线]
   \`\`\`
   \`\`\`

### 2. 测试环境分析 (40%)

#### 2.1 测试框架分析
**目标**: 分析测试框架配置，提供测试指导

**执行步骤**:
1. **测试配置扫描**:
   - 测试框架配置文件
   - 测试运行器配置
   - 测试覆盖率配置

2. **测试环境分析**:
   - 测试环境设置
   - 测试数据管理
   - 测试隔离机制

3. **测试框架输出**:
   \`\`\`markdown
   ## 测试框架配置
   ### 测试框架清单
   | 测试类型 | 框架名称 | 配置文件 | 测试环境 | 覆盖率要求 | 主要特性 |
   |----------|----------|----------|----------|------------|----------|
   | 单元测试 | Jest | jest.config.js | Node.js | 80% | 快照测试、Mock |
   | 集成测试 | Vitest | vitest.config.ts | Node.js | 70% | 并行执行、HMR |
   | E2E测试 | Cypress | cypress.config.js | Browser | 60% | 端到端测试、录制 |
   
   ### 测试配置详情
   \`\`\`javascript
   // Jest配置示例
   module.exports = {
     testEnvironment: 'node',
     collectCoverage: true,
     coverageDirectory: 'coverage',
     coverageReporters: ['text', 'lcov', 'html'],
     testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
     setupFilesAfterEnv: ['<rootDir>/tests/setup.ts']
   }
   
   // Vitest配置示例
   import { defineConfig } from 'vitest/config'
   
   export default defineConfig({
     test: {
       environment: 'node',
       coverage: {
         reporter: ['text', 'json', 'html'],
         exclude: ['node_modules/', 'tests/']
       }
     }
   })
   \`\`\`
   
   ### 测试环境设置
   | 环境类型 | 数据库配置 | Mock配置 | 环境变量 | 清理策略 |
   |----------|-----------|----------|----------|----------|
   | 单元测试 | 内存数据库 | 全量Mock | TEST=true | 自动清理 |
   | 集成测试 | 测试数据库 | 部分Mock | TEST_ENV=integration | 事务回滚 |
   | E2E测试 | 专用数据库 | 最小Mock | TEST_ENV=e2e | 数据重置 |
   \`\`\`

#### 2.2 测试运行机制分析
**目标**: 分析测试运行机制，提供执行指导

**执行步骤**:
1. **测试脚本分析**:
   - 测试命令提取
   - 测试运行参数
   - 测试过滤机制

2. **测试执行分析**:
   - 测试执行顺序
   - 测试并行执行
   - 测试超时处理

3. **测试运行输出**:
   \`\`\`markdown
   ## 测试运行机制
   ### 测试命令清单
   | 测试类型 | 执行命令 | 执行目录 | 监听模式 | 并行执行 | 超时设置 |
   |----------|----------|----------|----------|----------|----------|
   | 单元测试 | npm run test:unit | src/ | --watch | 是 | 5000ms |
   | 集成测试 | npm run test:integration | tests/ | 否 | 是 | 10000ms |
   | E2E测试 | npm run test:e2e | tests/e2e/ | 否 | 否 | 30000ms |
   
   ### 测试执行流程
   \`\`\`mermaid
   graph TD
       A[测试启动] --> B[环境初始化]
       B --> C[测试文件发现]
       C --> D[测试用例执行]
       D --> E[结果收集]
       E --> F[报告生成]
       F --> G[清理环境]
   \`\`\`
   
   ### 测试运行示例
   \`\`\`bash
   # 运行所有测试
   npm test
   
   # 运行特定类型测试
   npm run test:unit
   npm run test:integration
   npm run test:e2e
   
   # 运行带覆盖率的测试
   npm run test:coverage
   
   # 监听模式运行测试
   npm run test:watch
   
   # 运行特定文件测试
   npm test -- --testPathPattern=UserService
   
   # 并行运行测试
   npm test -- --maxWorkers=4
   
   # 调试测试
   npm test -- --runInBand --inspect-brk
   \`\`\`
   \`\`\`

#### 2.3 测试组织结构分析
**目标**: 分析测试组织结构，提供测试编写指导

**执行步骤**:
1. **测试结构扫描**:
   - 测试目录结构
   - 测试文件命名
   - 测试用例组织

2. **测试分类分析**:
   - 单元测试结构
   - 集成测试结构
   - 组件测试结构
   - 端到端测试结构

3. **测试组织输出**:
   \`\`\`markdown
   ## 测试组织结构
   ### 测试目录结构
   | 测试类型 | 目录路径 | 文件命名规范 | 测试重点 | 测试数据管理 |
   |----------|----------|-------------|----------|--------------|
   | 单元测试 | tests/unit/ | *.unit.test.ts | 核心逻辑 | Mock数据 |
   | 集成测试 | tests/integration/ | *.integration.test.ts | 模块交互 | 测试数据库 |
   | 组件测试 | tests/components/ | *.component.test.ts | UI组件 | 测试工厂 |
   | E2E测试 | tests/e2e/ | *.e2e.test.ts | 完整流程 | 真实数据 |
   
   ### 测试编写模板
   #### 单元测试模板
   \`\`\`typescript
   import { UserService } from '../services/UserService'
   import { UserRepository } from '../repositories/UserRepository'
   
   describe('UserService', () => {
     let userService: UserService
     let mockUserRepository: jest.Mocked<UserRepository>
     
     beforeEach(() => {
       // 初始化Mock
       mockUserRepository = {
         findById: jest.fn(),
         create: jest.fn(),
         update: jest.fn()
       } as any
       
       // 创建服务实例
       userService = new UserService(mockUserRepository)
     })
     
     afterEach(() => {
       // 清理Mock
       jest.clearAllMocks()
     })
     
     describe('findById', () => {
       it('应该返回找到的用户', async () => {
         // Arrange - 准备测试数据
         const userId = '123'
         const expectedUser = { id: userId, name: 'Test User' }
         mockUserRepository.findById.mockResolvedValue(expectedUser)
         
         // Act - 执行测试操作
         const result = await userService.findById(userId)
         
         // Assert - 验证结果
         expect(result).toEqual(expectedUser)
         expect(mockUserRepository.findById).toHaveBeenCalledWith(userId)
       })
       
       it('当用户不存在时应该抛出错误', async () => {
         // Arrange
         const userId = 'nonexistent'
         mockUserRepository.findById.mockResolvedValue(null)
         
         // Act & Assert
         await expect(userService.findById(userId)).rejects.toThrow('User not found')
       })
     })
   })
   \`\`\`
   
   #### 集成测试模板
   \`\`\`typescript
   import request from 'supertest'
   import { app } from '../app'
   import { DatabaseConnection } from '../config/database'
   
   describe('User API Integration', () => {
     let dbConnection: DatabaseConnection
     
     beforeAll(async () => {
       // 设置测试数据库
       dbConnection = new DatabaseConnection()
       await dbConnection.connect()
     })
     
     afterAll(async () => {
       // 清理测试数据库
       await dbConnection.disconnect()
     })
     
     beforeEach(async () => {
       // 清理测试数据
       await dbConnection.clear()
     })
     
     describe('POST /api/users', () => {
       it('应该创建新用户', async () => {
         const userData = {
           name: 'Test User',
           email: 'test@example.com'
         }
         
         const response = await request(app)
           .post('/api/users')
           .send(userData)
           .expect(201)
         
         expect(response.body).toHaveProperty('id')
         expect(response.body.name).toBe(userData.name)
         expect(response.body.email).toBe(userData.email)
       })
     })
   })
   \`\`\`
   
   ### 测试命名规范
   | 测试类型 | 文件命名 | 测试套件命名 | 测试用例命名 | 示例 |
   |----------|----------|-------------|-------------|------|
   | 单元测试 | *.unit.test.ts | describe('ClassName') | it('should do something') | UserService.unit.test.ts |
   | 集成测试 | *.integration.test.ts | describe('FeatureName') | it('should integrate with') | UserAPI.integration.test.ts |
   | E2E测试 | *.e2e.test.ts | describe('UserFlow') | it('should complete flow') | UserLogin.e2e.test.ts |
   \`\`\`

#### 2.4 测试自动化与CI/CD集成
**目标**: 分析测试自动化流程，提供CI/CD指导

**执行步骤**:
1. **CI配置扫描**:
   - CI配置文件分析
   - CI/CD平台识别
   - 自动化流程分析

2. **质量门禁分析**:
   - 测试覆盖率要求
   - 测试通过率要求
   - 代码质量要求

3. **测试自动化输出**:
   \`\`\`markdown
   ## 测试自动化与CI/CD集成
   ### CI/CD配置清单
   | CI平台 | 配置文件 | 测试阶段 | 质量门禁 | 通知机制 |
   |--------|----------|----------|----------|----------|
   | GitHub Actions | .github/workflows/test.yml | test | 覆盖率>80% | Email/Slack |
   | GitLab CI | .gitlab-ci.yml | test | 覆盖率>80% | GitLab通知 |
   | Jenkins | Jenkinsfile | test | 覆盖率>80% | 邮件通知 |
   
   ### GitHub Actions配置示例
   \`\`\`yaml
   name: Test and Coverage
   
   on:
     push:
       branches: [ main, develop ]
     pull_request:
       branches: [ main ]
   
   jobs:
     test:
       runs-on: ubuntu-latest
       strategy:
         matrix:
           node-version: [16.x, 18.x]
       
       steps:
       - name: Checkout code
         uses: actions/checkout@v3
       
       - name: Setup Node.js
         uses: actions/setup-node@v3
         with:
           node-version: \${{ matrix.node-version }}
           cache: 'npm'
       
       - name: Install dependencies
         run: npm ci
       
       - name: Run unit tests
         run: npm run test:unit
       
       - name: Run integration tests
         run: npm run test:integration
       
       - name: Run E2E tests
         run: npm run test:e2e
       
       - name: Generate coverage report
         run: npm run test:coverage
       
       - name: Upload coverage to Codecov
         uses: codecov/codecov-action@v3
         with:
           file: ./coverage/lcov.info
           flags: unittests
           name: codecov-umbrella
       
       - name: Upload test results
         uses: actions/upload-artifact@v3
         if: always()
         with:
           name: test-results
           path: |
             coverage/
             test-results/
   \`\`\`
   
   ### 质量门禁配置
   | 质量指标 | 要求值 | 检查方式 | 失败处理 | 优化建议 |
   |----------|--------|----------|----------|----------|
   | 测试覆盖率 | ≥80% | Istanbul报告 | 阻止合并 | 增加测试用例 |
   | 测试通过率 | 100% | Jest/Vitest报告 | 阻止合并 | 修复失败测试 |
   | 代码质量 | A级 | ESLint报告 | 警告提示 | 修复代码问题 |
   | 性能测试 | <2s | 性能测试报告 | 警告提示 | 优化性能瓶颈 |
   
   ### 自动化测试策略
   \`\`\`mermaid
   graph TD
       A[代码提交] --> B[触发CI]
       B --> C[环境准备]
       C --> D[依赖安装]
       D --> E[单元测试]
       E --> F[集成测试]
       F --> G[E2E测试]
       G --> H[覆盖率分析]
       H --> I[质量检查]
       I --> J{通过检查}
       J -->|是| K[部署]
       J -->|否| L[通知失败]
       L --> M[修复问题]
   \`\`\`
   \`\`\`

#### 2.5 测试调试与优化
**目标**: 提供测试调试和优化指导

**执行步骤**:
1. **调试技术分析**:
   - 测试调试配置
   - 测试调试技巧
   - 常见问题解决

2. **性能优化分析**:
   - 测试执行性能
   - 测试数据管理
   - Mock策略优化

3. **测试调试优化输出**:
   \`\`\`markdown
   ## 测试调试与优化
   ### 测试调试技术
   #### 调试配置
   | 调试方式 | 配置参数 | 使用场景 | 优势 | 注意事项 |
   |----------|----------|----------|------|----------|
   | Node.js调试 | --inspect-brk | 单元测试 | 完整调试体验 | 需要IDE支持 |
   | Chrome调试 | --debug | E2E测试 | 可视化调试 | 性能开销 |
   | VSCode调试 | launch.json | 所有测试 | 集成调试 | 需要配置 |
   
   #### 调试技巧
   ##### 1. 断点调试
   \`\`\`typescript
   // 在测试中设置断点
   test('should debug this test', () => {
     debugger // 在这里设置断点
     const result = someFunction()
     expect(result).toBe('expected')
   })
   \`\`\`
   
   ##### 2. 条件断点
   \`\`\`typescript
   test('should handle conditional logic', () => {
     const data = { id: 123, status: 'active' }
     
     // 只在特定条件下调试
     if (data.id === 123) {
       debugger
     }
     
     expect(data.status).toBe('active')
   })
   \`\`\`
   
   ##### 3. 控制台调试
   \`\`\`typescript
   test('should log debug information', () => {
     console.log('Debug: Starting test')
     const result = complexFunction()
     console.log('Debug: Result:', result)
     expect(result).toBeDefined()
   })
   \`\`\`
   
   ### 常见问题解决
   | 问题类型 | 症状 | 原因 | 解决方案 | 预防措施 |
   |----------|------|------|----------|----------|
   | 测试超时 | TimeoutError | 异步操作未完成 | 增加超时时间 | 合理设置超时 |
   | Mock失败 | Mock not called | Mock配置错误 | 检查Mock设置 | 使用类型检查 |
   | 异步问题 | Test hangs | Promise未处理 | 使用async/await | 正确处理异步 |
   | 环境问题 | Environment error | 环境变量缺失 | 检查环境配置 | 使用默认值 |
   
   ### 性能优化策略
   #### 测试执行优化
   | 优化策略 | 实施方法 | 效果 | 实施难度 | 适用场景 |
   |----------|----------|------|----------|----------|
   | 并行执行 | --maxWorkers=N | 2-3x提升 | 低 | CPU密集型测试 |
   | 测试隔离 | 独立测试环境 | 稳定性提升 | 中 | 集成测试 |
   | 缓存机制 | 缓存测试结果 | 重复测试加速 | 低 | 单元测试 |
   | 懒加载 | 按需加载测试 | 内存优化 | 中 | 大型测试套件 |
   
   #### Mock策略优化
   \`\`\`typescript
   // 优化前：过度Mock
   const mockService = {
     method1: jest.fn(),
     method2: jest.fn(),
     method3: jest.fn(),
     // ... 很多Mock方法
   }
   
   // 优化后：按需Mock
   const mockService = {
     method1: jest.fn()
     // 只Mock需要的方法
   }
   
   // 使用工厂函数创建测试数据
   const createTestData = (overrides = {}) => ({
     id: '123',
     name: 'Test User',
     email: 'test@example.com',
     ...overrides
   })
   \`\`\`
   
   #### 测试数据管理
   \`\`\`typescript
   // 使用测试数据工厂
   class UserFactory {
     static create(overrides = {}) {
       return {
         id: Math.random().toString(36).substr(2, 9),
         name: 'Test User',
         email: 'test@example.com',
         createdAt: new Date(),
         ...overrides
       }
     }
     
     static createMany(count = 5, overrides = {}) {
       return Array.from({ length: count }, () => this.create(overrides))
     }
   }
   
   // 在测试中使用
   test('should handle multiple users', () => {
     const users = UserFactory.createMany(3, { status: 'active' })
     expect(users.length).toBe(3)
     expect(users.every(u => u.status === 'active')).toBe(true)
   })
   \`\`\`
   \`\`\`

### 3. 配置分析与最佳实践

#### 3.1 关键配置文件识别
**目标**: 识别和分析关键配置文件

**执行步骤**:
1. **配置文件扫描**:
   - 开发环境配置文件
   - 测试环境配置文件
   - 构建工具配置文件

2. **配置分类分析**:
   - 按功能分类
   - 按环境分类
   - 按重要性分类

3. **配置文件输出**:
   \`\`\`markdown
   ## 关键配置文件分析
   ### 开发环境配置文件
   | 配置文件 | 文件路径 | 主要功能 | 关键配置项 | 环境支持 | 优先级 |
   |----------|----------|----------|-----------|----------|--------|
   | package.json | 根目录 | 项目依赖和脚本 | scripts, dependencies | 所有 | 高 |
   | tsconfig.json | 根目录 | TypeScript配置 | compilerOptions, paths | 所有 | 高 |
   | vite.config.ts | 根目录 | 构建工具配置 | server, build, plugins | 开发 | 高 |
   | .env.development | 根目录 | 开发环境变量 | API_URL, DATABASE_URL | 开发 | 中 |
   | .env.test | 根目录 | 测试环境变量 | TEST_DATABASE_URL, TEST_MODE | 测试 | 中 |
   
   ### 测试环境配置文件
   | 配置文件 | 文件路径 | 主要功能 | 关键配置项 | 测试类型 | 优先级 |
   |----------|----------|----------|-----------|----------|--------|
   | jest.config.js | 根目录 | Jest测试配置 | testEnvironment, coverage | 单元测试 | 高 |
   | vitest.config.ts | 根目录 | Vitest配置 | test, environment, coverage | 集成测试 | 高 |
   | cypress.config.js | 根目录 | E2E测试配置 | e2e, baseUrl, viewport | E2E测试 | 高 |
   | setupTests.ts | tests/ | 测试环境设置 | beforeEach, afterEach | 所有测试 | 中 |
   
   ### 构建工具配置文件
   | 配置文件 | 构建工具 | 主要功能 | 关键配置项 | 构建阶段 | 优先级 |
   |----------|----------|----------|-----------|----------|--------|
   | webpack.config.js | Webpack | 模块打包 | entry, output, loaders | 生产构建 | 高 |
   | vite.config.ts | Vite | 开发服务器 | server, build, plugins | 开发构建 | 高 |
   | .eslintrc.js | ESLint | 代码检查 | rules, extends, parser | 开发阶段 | 中 |
   | .prettierrc | Prettier | 代码格式化 | printWidth, semi, tabWidth | 开发阶段 | 中 |
   \`\`\`

#### 3.2 配置优化建议
**目标**: 提供配置优化建议

**执行步骤**:
1. **配置问题分析**:
   - 配置冲突检测
   - 性能问题识别
   - 最佳实践对比

2. **优化建议生成**:
   - 开发环境优化
   - 测试环境优化
   - 构建流程优化

3. **配置优化输出**:
   \`\`\`markdown
   ## 配置优化建议
   ### 开发环境优化
   #### TypeScript配置优化
   | 配置项 | 当前配置 | 推荐配置 | 优化理由 | 实施难度 |
   |--------|----------|----------|----------|----------|
   | strict | false | true | 提升类型安全 | 低 |
   | noUnusedLocals | false | true | 清理无用代码 | 低 |
   | skipLibCheck | true | false | 更严格的类型检查 | 中 |
   | incremental | false | true | 提升编译速度 | 低 |
   
   \`\`\`typescript
   // 优化后的tsconfig.json
   {
     "compilerOptions": {
       "target": "ES2020",
       "module": "ESNext",
       "lib": ["ES2020", "DOM", "DOM.Iterable"],
       "allowJs": true,
       "skipLibCheck": false,
       "strict": true,
       "noUnusedLocals": true,
       "noUnusedParameters": true,
       "noFallthroughCasesInSwitch": true,
       "incremental": true,
       "moduleResolution": "node",
       "allowSyntheticDefaultImports": true,
       "esModuleInterop": true,
       "resolveJsonModule": true,
       "isolatedModules": true,
       "noEmit": true,
       "jsx": "react-jsx"
     },
     "include": ["src"],
     "exclude": ["node_modules", "dist", "tests"]
   }
   \`\`\`
   
   #### 构建工具配置优化
   | 配置项 | 当前配置 | 推荐配置 | 优化理由 | 实施难度 |
   |--------|----------|----------|----------|----------|
   | 端口配置 | 硬编码3000 | 环境变量 | 环境适应性 | 低 |
   | 热重载 | 默认配置 | 优化监听范围 | 性能提升 | 中 |
   | 代理设置 | 基础代理 | 添加错误处理 | 健壮性 | 中 |
   | 构建优化 | 默认配置 | 启用压缩和TreeShaking | 构建优化 | 中 |
   
   \`\`\`typescript
   // 优化后的vite.config.ts
   import { defineConfig } from 'vite'
   import react from '@vitejs/plugin-react'
   import path from 'path'
   
   export default defineConfig({
     plugins: [react()],
     server: {
       port: parseInt(process.env.PORT || '3000'),
       host: true,
       proxy: {
         '/api': {
           target: process.env.VITE_API_URL || 'http://localhost:8080',
           changeOrigin: true,
           secure: false,
           rewrite: (path) => path.replace(/^\/api/, ''),
           onError: (err, req, res) => {
             console.log('Proxy error:', err)
           }
         }
       }
     },
     build: {
       outDir: 'dist',
       sourcemap: true,
       minify: 'terser',
       terserOptions: {
         compress: {
           drop_console: true,
           drop_debugger: true
         }
       },
       rollupOptions: {
         output: {
           manualChunks: {
             vendor: ['react', 'react-dom'],
             utils: ['lodash', 'axios']
           }
         }
       }
     },
     resolve: {
       alias: {
         '@': path.resolve(__dirname, './src'),
         '@components': path.resolve(__dirname, './src/components'),
         '@utils': path.resolve(__dirname, './src/utils')
       }
     }
   })
   \`\`\`
   
   ### 测试环境优化
   #### 测试框架配置优化
   | 配置项 | 当前配置 | 推荐配置 | 优化理由 | 实施难度 |
   |--------|----------|----------|----------|----------|
   | 测试环境 | jsdom | node | 性能提升 | 低 |
   | 并行执行 | 默认 | 启用并行 | 执行速度提升 | 低 |
   | 覆盖率 | 基础配置 | 详细配置 | 更好的覆盖率分析 | 中 |
   | Mock设置 | 手动Mock | 自动Mock | 减少Mock代码 | 中 |
   
   \`\`\`typescript
   // 优化后的vitest.config.ts
   import { defineConfig } from 'vitest/config'
   import path from 'path'
   
   export default defineConfig({
     test: {
       environment: 'node',
       globals: true,
       setupFiles: ['./tests/setup.ts'],
       coverage: {
         reporter: ['text', 'json', 'html', 'lcov'],
         exclude: [
           'node_modules/',
           'dist/',
           'tests/',
           '**/*.d.ts',
           '**/*.config.*',
           '**/coverage/**'
         ],
         thresholds: {
           global: {
             branches: 80,
             functions: 80,
             lines: 80,
             statements: 80
           }
         }
       },
       pool: 'threads',
       poolOptions: {
         threads: {
           maxWorkers: 4,
           minWorkers: 2
         }
       },
       alias: {
         '@': path.resolve(__dirname, './src'),
         '@components': path.resolve(__dirname, './src/components'),
         '@utils': path.resolve(__dirname, './src/utils')
       }
     }
   })
   \`\`\`
   
   ### 最佳实践总结
   #### 开发环境最佳实践
   - **环境变量管理**: 使用.env文件管理环境变量，避免硬编码
   - **路径别名**: 配置路径别名，简化导入路径
   - **热重载优化**: 优化热重载配置，提升开发体验
   - **代码检查**: 集成ESLint和Prettier，保持代码质量
   - **类型安全**: 启用严格TypeScript配置，提升类型安全
   
   #### 测试环境最佳实践
   - **测试隔离**: 确保测试之间相互独立，避免相互影响
   - **Mock策略**: 合理使用Mock，避免过度Mock
   - **测试数据**: 使用测试数据工厂，统一管理测试数据
   - **并行执行**: 启用并行测试执行，提升测试速度
   - **覆盖率监控**: 设置合理的覆盖率阈值，监控测试质量
   
   #### 构建优化最佳实践
   - **代码分割**: 使用代码分割，减少初始加载体积
   - **资源压缩**: 启用资源压缩，减少传输体积
   - **缓存策略**: 配置合理的缓存策略，提升加载速度
   - **TreeShaking**: 启用TreeShaking，移除无用代码
   - **源码映射**: 生成源码映射，便于调试
   \`\`\`

## 输出格式要求

### 文档结构模板
\`\`\`markdown
# {项目名称} 开发测试分析

## 📋 执行摘要
{简要概述开发测试环境的主要特征、关键发现和建议}

## 🔧 1. 开发环境分析 (60%)

### 1.1 项目启动机制
#### 启动命令清单
| 应用类型 | 启动命令 | 配置文件 | 端口 | 依赖关系 | 启动顺序 |
|---------|---------|---------|------|---------|---------|
| [应用1] | [命令1] | [配置1] | [端口1] | [依赖1] | [顺序1] |
| [应用2] | [命令2] | [配置2] | [端口2] | [依赖2] | [顺序2] |

#### 启动流程图
\`\`\`mermaid
graph TD
    A[环境检查] --> B[依赖安装]
    B --> C[配置加载]
    C --> D[主应用启动]
    D --> E[启动完成]
\`\`\`

### 1.2 环境搭建指南
#### 环境依赖清单
| 依赖类型 | 依赖名称 | 版本要求 | 安装方式 | 配置文件 |
|---------|----------|----------|----------|----------|
| [依赖1] | [名称1] | [版本1] | [方式1] | [配置1] |
| [依赖2] | [名称2] | [版本2] | [方式2] | [配置2] |

#### 环境变量配置
\`\`\`bash
# 必需环境变量
export [变量名1]="[值1]"
export [变量名2]="[值2]"
\`\`\`

### 1.3 配置管理机制
#### 配置文件清单
| 配置文件 | 环境类型 | 主要配置项 | 配置格式 | 加载优先级 |
|---------|----------|-----------|----------|-----------|
| [文件1] | [环境1] | [配置1] | [格式1] | [优先级1] |
| [文件2] | [环境2] | [配置2] | [格式2] | [优先级2] |

#### 配置优化建议
| 配置项 | 当前配置 | 推荐配置 | 优化理由 | 实施难度 |
|--------|----------|----------|----------|----------|
| [配置1] | [当前1] | [推荐1] | [理由1] | [难度1] |
| [配置2] | [当前2] | [推荐2] | [理由2] | [难度2] |

### 1.4 调试机制配置
#### 调试配置清单
| 调试类型 | 配置文件 | 调试端口 | 源码映射 | 支持功能 |
|---------|----------|----------|----------|----------|
| [调试1] | [配置1] | [端口1] | [映射1] | [功能1] |
| [调试2] | [配置2] | [端口2] | [映射2] | [功能2] |

#### 调试操作指南
- **VSCode调试**: [具体步骤]
- **浏览器调试**: [具体步骤]
- **远程调试**: [具体步骤]

### 1.5 代码组织结构
#### 目录结构分析
| 目录路径 | 主要职责 | 文件类型 | 设计模式 | 开发建议 |
|----------|----------|----------|----------|----------|
| [目录1] | [职责1] | [类型1] | [模式1] | [建议1] |
| [目录2] | [职责2] | [类型2] | [模式2] | [建议2] |

#### 设计模式应用
| 设计模式 | 应用位置 | 使用场景 | 优势 | 注意事项 |
|----------|----------|----------|------|----------|
| [模式1] | [位置1] | [场景1] | [优势1] | [注意1] |
| [模式2] | [位置2] | [场景2] | [优势2] | [注意2] |

## 🧪 2. 测试环境分析 (40%)

### 2.1 测试框架配置
#### 测试框架清单
| 测试类型 | 框架名称 | 配置文件 | 测试环境 | 覆盖率要求 | 主要特性 |
|----------|----------|----------|----------|------------|----------|
| [类型1] | [框架1] | [配置1] | [环境1] | [覆盖率1] | [特性1] |
| [类型2] | [框架2] | [配置2] | [环境2] | [覆盖率2] | [特性2] |

#### 测试配置详情
\`\`\`[配置语言]
// [配置文件内容示例]
\`\`\`

### 2.2 测试运行机制
#### 测试命令清单
| 测试类型 | 执行命令 | 执行目录 | 监听模式 | 并行执行 | 超时设置 |
|----------|----------|----------|----------|----------|----------|
| [类型1] | [命令1] | [目录1] | [监听1] | [并行1] | [超时1] |
| [类型2] | [命令2] | [目录2] | [监听2] | [并行2] | [超时2] |

#### 测试执行流程
\`\`\`mermaid
graph TD
    A[测试启动] --> B[环境初始化]
    B --> C[测试执行]
    C --> D[结果收集]
    D --> E[报告生成]
\`\`\`

### 2.3 测试组织结构
#### 测试目录结构
| 测试类型 | 目录路径 | 文件命名规范 | 测试重点 | 测试数据管理 |
|----------|----------|-------------|----------|--------------|
| [类型1] | [路径1] | [规范1] | [重点1] | [管理1] |
| [类型2] | [路径2] | [规范2] | [重点2] | [管理2] |

#### 测试编写模板
\`\`\`[编程语言]
// [测试代码模板示例]
\`\`\`

### 2.4 测试自动化与CI/CD集成
#### CI/CD配置清单
| CI平台 | 配置文件 | 测试阶段 | 质量门禁 | 通知机制 |
|--------|----------|----------|----------|----------|
| [平台1] | [配置1] | [阶段1] | [门禁1] | [通知1] |
| [平台2] | [配置2] | [阶段2] | [门禁2] | [通知2] |

#### 质量门禁配置
| 质量指标 | 要求值 | 检查方式 | 失败处理 | 优化建议 |
|----------|--------|----------|----------|----------|
| [指标1] | [要求1] | [检查1] | [处理1] | [建议1] |
| [指标2] | [要求2] | [检查2] | [处理2] | [建议2] |

### 2.5 测试调试与优化
#### 测试调试技术
| 调试方式 | 配置参数 | 使用场景 | 优势 | 注意事项 |
|----------|----------|----------|------|----------|
| [方式1] | [参数1] | [场景1] | [优势1] | [注意1] |
| [方式2] | [参数2] | [场景2] | [优势2] | [注意2] |

#### 性能优化策略
| 优化策略 | 实施方法 | 效果 | 实施难度 | 适用场景 |
|----------|----------|------|----------|----------|
| [策略1] | [方法1] | [效果1] | [难度1] | [场景1] |
| [策略2] | [方法2] | [效果2] | [难度2] | [场景2] |

## ⚙️ 3. 配置分析与最佳实践

### 3.1 关键配置文件分析
#### 开发环境配置文件
| 配置文件 | 文件路径 | 主要功能 | 关键配置项 | 环境支持 | 优先级 |
|----------|----------|----------|-----------|----------|--------|
| [文件1] | [路径1] | [功能1] | [配置1] | [支持1] | [优先级1] |
| [文件2] | [路径2] | [功能2] | [配置2] | [支持2] | [优先级2] |

#### 测试环境配置文件
| 配置文件 | 文件路径 | 主要功能 | 关键配置项 | 测试类型 | 优先级 |
|----------|----------|----------|-----------|----------|--------|
| [文件1] | [路径1] | [功能1] | [配置1] | [类型1] | [优先级1] |
| [文件2] | [路径2] | [功能2] | [配置2] | [类型2] | [优先级2] |

### 3.2 配置优化建议
#### 开发环境优化
| 配置项 | 当前配置 | 推荐配置 | 优化理由 | 实施难度 |
|--------|----------|----------|----------|----------|
| [配置1] | [当前1] | [推荐1] | [理由1] | [难度1] |
| [配置2] | [当前2] | [推荐2] | [理由2] | [难度2] |

#### 测试环境优化
| 配置项 | 当前配置 | 推荐配置 | 优化理由 | 实施难度 |
|--------|----------|----------|----------|----------|
| [配置1] | [当前1] | [推荐1] | [理由1] | [难度1] |
| [配置2] | [当前2] | [推荐2] | [理由2] | [难度2] |

## 🎯 总结与建议

### 关键发现
- [发现1]
- [发现2]
- [发现3]

### 优化建议
- [建议1]
- [建议2]
- [建议3]

### 实施优先级
1. **高优先级**: [高优先级项目]
2. **中优先级**: [中优先级项目]
3. **低优先级**: [低优先级项目]
\`\`\`

## 执行要求

### 分析原则
1. **基于实际文件**: 所有分析必须基于项目中实际存在的配置文件和代码，禁止编造不存在的配置
2. **避免猜测**: 禁止进行假设性分析，所有结论必须有文件依据
3. **精准提取**: 从配置文件中准确提取参数和设置，确保信息准确性
4. **机制导向**: 重点分析开发机制和测试机制，而非仅罗列配置文件
5. **可执行性**: 提供具体的操作步骤和命令，确保指导可执行

### 输出要求
1. **结构化输出**: 使用表格、列表、流程图等结构化形式提升可读性
2. **可执行性**: 提供具体的操作步骤和命令，确保指导可执行
3. **AI友好**: 使用简洁明确的语言和结构，符合AI阅读习惯
4. **实用性**: 提供可直接使用的配置建议和最佳实践
5. **完整性**: 覆盖所有关键的开发测试环境方面，确保内容全面

### 质量要求
1. **开发内容占比**: 确保开发相关内容占60%，测试相关内容占40%
2. **通用性**: 保持模板的通用性和普适性，不局限于特定语言或框架
3. **准确性**: 所有信息必须基于实际项目文件，确保准确性
4. **可读性**: 使用清晰的结构和格式，提升文档可读性
5. **实用性**: 提供实用的建议和指导，确保文档有实际价值

## 错误处理

### 常见问题及解决方案
| 问题类型 | 症状描述 | 可能原因 | 解决方案 | 预防措施 |
|----------|----------|----------|----------|----------|
| 配置文件缺失 | 找不到配置文件 | 文件路径错误 | 检查文件路径 | 使用标准路径 |
| 配置解析错误 | 配置无法解析 | 语法错误 | 验证配置语法 | 使用配置验证工具 |
| 依赖冲突 | 依赖版本冲突 | 版本不兼容 | 更新依赖版本 | 使用版本锁定 |
| 环境问题 | 环境配置错误 | 环境变量缺失 | 检查环境变量 | 使用环境变量验证 |

### 应急处理流程
1. **问题识别**: 快速识别问题类型和影响范围
2. **临时解决**: 提供临时解决方案，确保开发测试继续
3. **根本解决**: 分析问题根本原因，提供长期解决方案
4. **预防措施**: 制定预防措施，避免问题再次发生

## 质量检查

### 检查清单
- [ ] 开发环境分析完整（启动机制、环境搭建、配置管理、调试机制、代码组织）
- [ ] 测试环境分析完整（测试框架、测试运行、测试组织、CI/CD集成、测试调试）
- [ ] 配置分析准确（关键文件识别、配置优化建议）
- [ ] 输出格式规范（表格结构、流程图、代码示例）
- [ ] 内容基于实际项目，避免猜测和编造
- [ ] 开发内容占比60%，测试内容占比40%
- [ ] 文档结构清晰，符合AI阅读习惯
- [ ] 提供可执行的操作步骤和命令

### 验证标准
1. **完整性**: 覆盖所有要求的分析维度
2. **准确性**: 所有信息基于实际项目文件
3. **实用性**: 提供有实际价值的建议和指导
4. **可读性**: 文档结构清晰，易于理解
5. **可执行性**: 提供的操作步骤和命令可执行

## 输出文件
\`${WIKI_OUTPUT_DIR}${SUBTASK_OUTPUT_FILENAMES.DEVELOPMENT_TEST_ANALYSIS_TASK_FILE}\`

注意：如果\${WIKI_OUTPUT_DIR} 目录不存在，则创建。
\`\`\`
`

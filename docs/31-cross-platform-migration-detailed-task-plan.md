# Roo Code 跨平台迁移详细任务计划

> **文档版本**: 1.0.0  
> **创建日期**: 2025-10-12  
> **项目周期**: 约 5 个月（20 周）  
> **架构方案**: Rust/C++ → WebAssembly + 平台适配器  
> **项目代号**: Project Phoenix

---

## 📋 快速导航

- [阶段 0: 准备与验证 (Week 1-2)](#阶段-0-准备与验证)
- [阶段 1: WASM 核心开发 (Week 3-12)](#阶段-1-wasm-核心开发)
- [阶段 2: 平台适配器开发 (Week 9-16)](#阶段-2-平台适配器开发)
- [阶段 3: 集成测试与优化 (Week 17-18)](#阶段-3-集成测试与优化)
- [阶段 4: 文档与发布 (Week 19-20)](#阶段-4-文档与发布)
- [详细任务清单](#详细任务清单)

---

## 项目概览

### 核心目标

将 Roo Code 从 VSCode 专属扩展迁移为跨平台 AI 代码助手，支持：

- ✅ **VSCode** - 保持 100% 现有功能
- ✅ **Blender** - 3D 建模/脚本开发 IDE
- ✅ **Unreal Engine** - 游戏引擎/C++ 开发 IDE
- ✅ **Unity** - 游戏引擎/C# 开发 IDE

### 技术架构

```
┌─────────────────────────────────────────────────────────┐
│              Platform UI Layer (各自实现)                 │
│  VSCode WebView │ Blender UI │ UE Slate │ Unity ImGUI   │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────────────┐
│           Platform Adapters (桥接层)                      │
│  TypeScript │ Python │ C++ │ C#                          │
│  - 文件系统  │ - 终端  │ - UI  │ - 网络                  │
└──────────────────────┬──────────────────────────────────┘
                       │ Host Interface (FFI)
┌──────────────────────┴──────────────────────────────────┐
│          roo-core.wasm (核心逻辑 - 100% 复用)            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Task Engine  │  │ AI Integration│  │  Tool System │  │
│  │   (Rust)     │  │   (Rust)      │  │   (Rust)     │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Memory System│  │ Code Indexing │  │ Judge Mode   │  │
│  │   (Rust)     │  │   (C++/Rust)  │  │   (Rust)     │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### 关键指标

| 指标          | 目标值   | 当前基准      | 度量方法                  |
| ------------- | -------- | ------------- | ------------------------- |
| 代码复用率    | ≥ 85%    | 0% (平台专属) | 核心代码行数 / 总代码行数 |
| WASM 文件大小 | < 2 MB   | N/A           | 优化后的 .wasm 文件大小   |
| 性能提升      | 50-200%  | 基准 (纯 TS)  | 关键操作响应时间对比      |
| 测试覆盖率    | ≥ 80%    | ~65%          | cargo tarpaulin           |
| 构建时间      | < 5 分钟 | N/A           | CI/CD 流水线时间          |
| 内存占用      | < 150 MB | ~200 MB       | 运行时内存峰值            |

---

## 阶段 0: 准备与验证

**时间**: Week 1-2 (2 周)  
**团队**: 全员  
**目标**: 环境搭建、技术验证、规范制定

### 任务清单

#### ✅ TASK 0.1: 开发环境搭建 (3 天)

**负责人**: DevOps Lead  
**依赖**: 无

<details>
<summary><b>📋 子任务详情</b></summary>

##### 0.1.1 安装 Rust 工具链

```bash
# 执行步骤
□ 安装 rustup
  $ curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
  $ rustc --version  # 验证: 应 ≥ 1.75.0

□ 添加 WASM 目标
  $ rustup target add wasm32-unknown-unknown
  $ rustup target add wasm32-wasi

□ 安装构建工具
  $ cargo install wasm-pack
  $ cargo install wasm-bindgen-cli
  $ cargo install cargo-tarpaulin  # 代码覆盖率
  $ cargo install cargo-watch      # 热重载

□ 验证安装
  $ wasm-pack --version
  $ wasm-bindgen --version
```

**验收标准**:

- [x] `rustc --version` ≥ 1.75.0
- [x] `wasm-pack build` 可构建示例项目
- [x] 生成的 .wasm 可在 Node.js 中加载

**交付物**:

- `docs/dev-setup-guide.md`
- `scripts/setup-dev-env.sh`

---

##### 0.1.2 配置 C++ 工具链

```bash
□ 安装 LLVM/Clang (≥ 15)
  # Ubuntu
  $ sudo apt install clang-15 libc++-15-dev
  # macOS
  $ brew install llvm

□ 安装 Emscripten
  $ git clone https://github.com/emscripten-core/emsdk.git
  $ cd emsdk
  $ ./emsdk install latest
  $ ./emsdk activate latest
  $ source ./emsdk_env.sh

□ 配置 CMake (≥ 3.20)
  $ cmake --version  # 验证版本
```

**验收标准**:

- [x] `emcc --version` 正常输出
- [x] 可编译 C++ 到 WASM

---

##### 0.1.3 创建项目结构

```bash
□ 创建核心目录
  $ mkdir -p core/{rust,cpp,tests}
  $ mkdir -p adapters/{vscode,blender,unreal,unity}

□ 初始化 Rust Workspace
  $ cd core
  $ cargo new --lib rust/host-interface
  $ cargo new --lib rust/task-engine
  $ cargo new --lib rust/ai-integration
  $ cargo new --lib rust/tool-system
  $ cargo new --lib rust/memory
  $ cargo new --lib rust/code-indexing

□ 配置 Workspace Cargo.toml
  [workspace]
  members = [
    "rust/host-interface",
    "rust/task-engine",
    "rust/ai-integration",
    "rust/tool-system",
    "rust/memory",
    "rust/code-indexing",
  ]
  resolver = "2"

□ 配置 Git
  $ echo "target/" >> .gitignore
  $ echo "*.wasm" >> .gitignore
  $ echo "pkg/" >> .gitignore
```

**验收标准**:

- [x] 目录结构符合规范
- [x] `cargo build` 成功构建所有 crate
- [x] Git 配置正确

**交付物**:

- `core/Cargo.toml`
- `docs/project-structure.md`

</details>

---

#### ✅ TASK 0.2: POC 技术验证 (5 天)

**负责人**: Rust Lead + Backend Dev  
**依赖**: TASK 0.1

<details>
<summary><b>📋 子任务详情</b></summary>

##### 0.2.1 Hello World WASM

```rust
// core/rust/poc/src/lib.rs
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn greet(name: &str) -> String {
    format!("Hello from Roo WASM, {}!", name)
}

#[wasm_bindgen]
pub fn add(a: i32, b: i32) -> i32 {
    a + b
}
```

```bash
□ 创建 POC 项目
  $ cargo new --lib core/rust/poc
  $ cd core/rust/poc

□ 添加依赖 (Cargo.toml)
  [package]
  name = "roo-poc"
  version = "0.1.0"

  [lib]
  crate-type = ["cdylib", "rlib"]

  [dependencies]
  wasm-bindgen = "0.2"

□ 构建 WASM
  $ wasm-pack build --target web

□ Node.js 测试
  $ node
  > const wasm = require('./pkg/roo_poc.js');
  > console.log(wasm.greet('World'));  // "Hello from Roo WASM, World!"
  > console.log(wasm.add(2, 3));        // 5

□ 浏览器测试
  <!DOCTYPE html>
  <script type="module">
    import init, { greet, add } from './pkg/roo_poc.js';
    await init();
    console.log(greet('Browser'));
    console.log(add(10, 20));
  </script>
```

**验收标准**:

- [x] WASM 模块编译成功
- [x] Node.js 可正常调用
- [x] 浏览器可正常调用
- [x] 函数返回正确结果

---

##### 0.2.2 Host Interface 双向调用

```rust
// core/rust/poc/src/host_interface.rs
use wasm_bindgen::prelude::*;

// WASM 调用宿主函数（由 TypeScript 提供）
#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = hostAPI)]
    pub fn host_read_file(path: &str) -> String;

    #[wasm_bindgen(js_namespace = hostAPI)]
    pub fn host_log(level: &str, message: &str);
}

// 宿主调用 WASM 函数
#[wasm_bindgen]
pub fn process_file(path: &str) -> String {
    unsafe {
        host_log("info", &format!("Processing: {}", path));
        let content = host_read_file(path);
        host_log("info", &format!("Read {} bytes", content.len()));
        content.to_uppercase()
    }
}
```

```typescript
// adapters/vscode/poc-host.ts
import * as fs from "fs"

export const hostAPI = {
	host_read_file: (path: string): string => {
		console.log(`[Host] Reading file: ${path}`)
		return fs.readFileSync(path, "utf-8")
	},

	host_log: (level: string, message: string): void => {
		console.log(`[Host ${level.toUpperCase()}] ${message}`)
	},
}

// 使用
import init, { process_file } from "./pkg/roo_poc.js"

const wasmInstance = await init()
// 注入宿主 API
;(globalThis as any).hostAPI = hostAPI

const result = process_file("./test.txt")
console.log("Result:", result)
```

```bash
□ 实现 Host Interface
□ 编写 TypeScript 宿主函数
□ 测试双向调用
  - WASM → TypeScript (host_read_file)
  - TypeScript → WASM (process_file)
□ 测试错误处理
  - 文件不存在
  - 权限错误
□ 测试数据类型
  - String, Number, Boolean
  - Array, Object (通过 JSON 序列化)
```

**验收标准**:

- [x] WASM 可调用 TypeScript 函数
- [x] TypeScript 可调用 WASM 函数
- [x] 数据传递正确
- [x] 错误可正确传播

**交付物**:

- `core/rust/poc/src/`
- `adapters/vscode/poc-host.ts`
- `docs/poc-report.md`

---

##### 0.2.3 性能基准测试

```rust
// core/rust/poc/benches/performance.rs
use criterion::{black_box, criterion_group, criterion_main, Criterion};

fn benchmark_string_ops(c: &mut Criterion) {
    c.bench_function("uppercase 1KB", |b| {
        let text = "a".repeat(1024);
        b.iter(|| black_box(text.to_uppercase()));
    });

    c.bench_function("uppercase 100KB", |b| {
        let text = "a".repeat(102400);
        b.iter(|| black_box(text.to_uppercase()));
    });
}

fn benchmark_json_parse(c: &mut Criterion) {


c.bench_function("parse 1KB JSON", |b| {
        let json = r#"{"name":"test","value":123,"nested":{"key":"value"}}"#;
        b.iter(|| black_box(serde_json::from_str::<serde_json::Value>(json)));
    });
}

criterion_group!(benches, benchmark_string_ops, benchmark_json_parse);
criterion_main!(benches);
```

```typescript
// adapters/vscode/poc-benchmark.ts
import Benchmark from "benchmark"

const suite = new Benchmark.Suite()

suite
	.add("TypeScript uppercase 1KB", function () {
		const text = "a".repeat(1024)
		text.toUpperCase()
	})
	.add("TypeScript uppercase 100KB", function () {
		const text = "a".repeat(102400)
		text.toUpperCase()
	})
	.add("TypeScript parse JSON", function () {
		const json = '{"name":"test","value":123,"nested":{"key":"value"}}'
		JSON.parse(json)
	})
	.on("cycle", function (event: any) {
		console.log(String(event.target))
	})
	.on("complete", function (this: any) {
		console.log("Fastest is " + this.filter("fastest").map("name"))
	})
	.run({ async: true })
```

```bash
□ 添加基准测试依赖
  # Rust
  [dev-dependencies]
  criterion = "0.5"

  # TypeScript
  $ npm install --save-dev benchmark @types/benchmark

□ 运行基准测试
  $ cd core/rust/poc
  $ cargo bench
  $ cd ../../../adapters/vscode
  $ ts-node poc-benchmark.ts

□ 记录性能数据
  - 创建对比表格
  - 绘制性能图表
  - 分析瓶颈
```

**验收标准**:

- [x] WASM 比 TypeScript 快 ≥ 30%
- [x] 内存占用更低
- [x] 性能报告已完成

**交付物**:

- `docs/performance-benchmark-report.md`
- 性能对比图表

</details>

---

#### ✅ TASK 0.3: 技术规范制定 (2 天)

**负责人**: Tech Lead + 架构师  
**依赖**: TASK 0.2

<details>
<summary><b>📋 子任务详情</b></summary>

##### 0.3.1 代码规范文档

```bash
□ 编写 Rust 代码风格指南
  - 命名约定: snake_case (函数/变量), CamelCase (类型)
  - 错误处理: 使用 Result<T, E>，避免 panic!
  - 文档注释: 每个公共 API 必须有 /// 注释
  - 异步编程: 优先使用 async/await
  - 所有权: 明确生命周期，减少克隆

□ 编写 Host Interface 设计原则
  - 接口最小化: 只暴露必需功能
  - 版本兼容: 使用语义化版本
  - 错误处理: 统一错误码 (100-999)
  - 数据序列化: 统一使用 JSON

□ 编写测试规范
  - 单元测试: 覆盖率 ≥ 80%
  - 集成测试: 必须包含跨边界调用
  - 性能测试: 关键路径必须有基准测试
  - 回归测试: PR 必须通过所有测试
```

**验收标准**:

- [x] 所有规范文档完成
- [x] 团队评审通过

**交付物**:

- `docs/rust-coding-standards.md`
- `docs/host-interface-design-principles.md`
- `docs/testing-guidelines.md`

---

##### 0.3.2 CI/CD 配置

```yaml
# .github/workflows/wasm-build.yml
name: WASM Build & Test

on:
    push:
        branches: [main, develop]
    pull_request:
        branches: [main]

jobs:
    build-wasm:
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v3

            - name: Setup Rust
              uses: actions-rs/toolchain@v1
              with:
                  toolchain: stable
                  target: wasm32-unknown-unknown
                  components: rustfmt, clippy

            - name: Cache cargo
              uses: actions/cache@v3
              with:
                  path: |
                      ~/.cargo/bin/
                      ~/.cargo/registry/
                      target/
                  key: ${{ runner.os }}-cargo-${{ hashFiles('**/Cargo.lock') }}

            - name: Format check
              run: cargo fmt --all -- --check

            - name: Clippy
              run: cargo clippy --all-features -- -D warnings

            - name: Build WASM
              run: |
                  cd core
                  wasm-pack build --release --target web

            - name: Run tests
              run: |
                  cd core
                  cargo test --all-features

            - name: Code coverage
              run: |
                  cargo install cargo-tarpaulin
                  cargo tarpaulin --out Xml

            - name: Upload coverage
              uses: codecov/codecov-action@v3

            - name: Upload WASM artifact
              uses: actions/upload-artifact@v3
              with:
                  name: roo-core-wasm
                  path: core/pkg/*.wasm
                  retention-days: 7

    test-adapters:
        runs-on: ${{ matrix.os }}
        strategy:
            matrix:
                os: [ubuntu-latest, macos-latest, windows-latest]
        steps:
            - uses: actions/checkout@v3

            - name: Setup Node.js
              uses: actions/setup-node@v3
              with:
                  node-version: 18

            - name: Install dependencies
              run: |
                  cd adapters/vscode
                  npm install

            - name: Run adapter tests
              run: |
                  cd adapters/vscode
                  npm test
```

```bash
□ 配置 GitHub Actions
  - 创建工作流文件
  - 配置矩阵构建 (Linux/macOS/Windows)
  - 配置缓存策略

□ 配置分支保护
  - main 分支: 禁止直接推送
  - PR 要求: 至少 1 个审批
  - CI 检查: 必须全部通过

□ 配置 Git Hooks
  # .husky/pre-commit
  #!/bin/sh
  cd core && cargo fmt --all -- --check
  cd core && cargo clippy --all-features -- -D warnings
  cd adapters/vscode && npm run lint
```

**验收标准**:

- [x] CI/CD 流水线配置完成
- [x] 第一次 PR 触发构建成功
- [x] 测试失败时 PR 无法合并

**交付物**:

- `.github/workflows/wasm-build.yml`
- `.github/workflows/adapter-tests.yml`
- `.husky/pre-commit`

</details>

---

#### ✅ TASK 0.4: 团队培训 (2 天)

**负责人**: Tech Lead  
**依赖**: TASK 0.1, 0.2, 0.3

<details>
<summary><b>📋 培训计划</b></summary>

##### Day 1: Rust 基础培训 (4 小时)

```bash
□ 上午 (2 小时): Rust 核心概念
  - 所有权、借用、生命周期
  - Result/Option 错误处理
  - 模式匹配与解构
  - 迭代器与闭包

□ 下午 (2 小时): 实战练习
  - 练习 1: 实现文件处理工具
  - 练习 2: 错误处理最佳实践
  - 练习 3: 使用 Iterator 重构代码
```

**验收标准**:

- [x] 所有开发者完成培训
- [x] 通过 Rust 基础测试 (≥ 80 分)

---

##### Day 2: WASM 开发培训 (4 小时)

```bash
□ 上午 (2 小时): WASM 概念
  - WASM 沙箱模型
  - 内存管理与线性内存
  - wasm-bindgen 使用
  - 与 JavaScript 互操作

□ 下午 (2 小时): Host Interface 实战
  - 设计 Host Interface
  - 实现双向调用
  - 错误处理与调试
  - 性能优化技巧
```

**验收标准**:

- [x] 每个开发者独立完成 POC 项目
- [x] 理解 Host Interface 设计原则

**交付物**:

- `docs/rust-training-materials.md`
- `docs/wasm-training-materials.md`

</details>

---

## 阶段 1: WASM 核心开发

**时间**: Week 3-12 (10 周)  
**团队**: Rust Lead + 3 Backend Devs  
**目标**: 实现所有核心功能的 Rust 版本

### 任务清单

#### ✅ TASK 1.1: Host Interface 完整实现 (Week 3-4)

**负责人**: Rust Lead + Backend Dev 1  
**预计时间**: 2 周

<details>
<summary><b>📋 子任务详情</b></summary>

##### 1.1.1 定义完整接口 (3 天)

**文件**: `core/rust/host-interface/src/lib.rs`

```rust
use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};

// ============= 文件系统接口 =============
#[wasm_bindgen]
extern "C" {
    /// 读取文件内容
    #[wasm_bindgen(catch)]
    pub async fn host_read_file(path: &str) -> Result<String, JsValue>;

    /// 写入文件
    #[wasm_bindgen(catch)]
    pub async fn host_write_file(path: &str, content: &str) -> Result<(), JsValue>;

    /// 列出目录
    #[wasm_bindgen(catch)]
    pub async fn host_list_directory(path: &str, recursive: bool) -> Result<String, JsValue>;

    /// 文件是否存在
    #[wasm_bindgen]
    pub async fn host_path_exists(path: &str) -> bool;

    /// 创建目录
    #[wasm_bindgen(catch)]
    pub async fn host_create_directory(path: &str) -> Result<(), JsValue>;

    /// 删除文件/目录
    #[wasm_bindgen(catch)]
    pub async fn host_remove_path(path: &str, recursive: bool) -> Result<(), JsValue>;
}

// ============= 终端接口 =============
#[wasm_bindgen]
extern "C" {
    /// 执行命令
    #[wasm_bindgen(catch)]
    pub async fn host_execute_command(command: &str, cwd: Option<String>) -> Result<String, JsValue>;

    /// 流式执行命令
    #[wasm_bindgen(catch)]
    pub async fn host_execute_stream(command: &str, callback_id: u32) -> Result<(), JsValue>;

    /// 终止命令
    #[wasm_bindgen(catch)]
    pub async fn host_terminate_command(process_id: u32) -> Result<(), JsValue>;
}

// ============= UI 接口 =============
#[wasm_bindgen]
extern "C" {
    /// 显示通知
    pub fn host_show_notification(level: &str, message: &str);

    /// 请求批准
    #[wasm_bindgen(catch)]
    pub async fn host_ask_approval(message: &str, options: &str) -> Result<u32, JsValue>;

    /// 请求输入
    #[wasm_bindgen(catch)]
    pub async fn host_ask_input(prompt: &str, default_value: Option<String>) -> Result<String, JsValue>;

    /// 显示错误对话框
    pub fn host_show_error(title: &str, message: &str);
}

// ============= 网络接口 =============
#[wasm_bindgen]
extern "C" {
    /// HTTP 请求
    #[wasm_bindgen(catch)]
    pub async fn host_http_request(config: &str) -> Result<String, JsValue>;

    /// HTTP 流式请求
    #[wasm_bindgen(catch)]
    pub async fn host_http_stream(config: &str, callback_id: u32) -> Result<(), JsValue>;
}

// ============= 配置接口 =============
#[wasm_bindgen]
extern "C" {
    /// 获取配置
    #[wasm_bindgen(catch)]
    pub async fn host_get_config(key: &str) -> Result<String, JsValue>;

    /// 设置配置
    #[wasm_bindgen(catch)]
    pub async fn host_set_config(key: &str, value: &str) -> Result<(), JsValue>;

    /// 列出所有配置
    #[wasm_bindgen(catch)]
    pub async fn host_list_configs() -> Result<String, JsValue>;
}

// ============= 日志接口 =============
#[wasm_bindgen]
extern "C" {
    /// 记录日志
    pub fn host_log(level: &str, message: &str, context: Option<String>);
}

// ============= 向量数据库接口 =============
#[wasm_bindgen]
extern "C" {
    /// 向量搜索
    #[wasm_bindgen(catch)]
    pub async fn host_vector_search(collection: &str, query: &str, limit: u32) -> Result<String, JsValue>;

    /// 插入向量
    #[wasm_bindgen(catch)]
    pub async fn host_vector_insert(collection: &str, data: &str) -> Result<(), JsValue>;
}
```

**执行步骤**:

```bash
□ 定义所有接口函数
□ 添加详细文档注释
□ 定义 Rust 包装类型
  pub struct FileInfo {
      pub path: String,
      pub size: u64,

```

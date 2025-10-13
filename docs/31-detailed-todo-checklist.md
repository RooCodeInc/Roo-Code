# Roo Code 跨平台迁移 - 详细任务清单

> **文档版本**: 1.0.0  
> **创建日期**: 2025-10-12  
> **总任务数**: 285 个任务  
> **预计工时**: 6,400 小时

---

## 📋 使用说明

### 符号说明

- ☐ 未开始
- ⏳ 进行中
- ✅ 已完成
- ❌ 已阻塞
- ⚠️ 有风险

### 优先级标记

- 🔴 P0 - Critical（阻塞性任务）
- 🟡 P1 - High（高优先级）
- 🟢 P2 - Medium（中优先级）
- ⚪ P3 - Low（低优先级）

### 任务编号规则

- 格式：`[阶段].[模块].[任务].[子任务]`
- 示例：`0.1.1.1` = 阶段0 > 模块1 > 任务1 > 子任务1

---

## 阶段 0: 准备与验证 (Week 1-2)

### 模块 0.1: 开发环境搭建 (3 天)

#### 🔴 Task 0.1.1: 安装 Rust 工具链 (4 小时)

**负责人**: DevOps Lead  
**依赖**: 无  
**交付物**: 工作的 Rust 开发环境

**详细步骤**:

```bash
☐ 0.1.1.1 下载并安装 rustup
  命令: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
  验证: rustc --version
  预期输出: rustc 1.75.0 或更高
  预计时间: 15 分钟

☐ 0.1.1.2 配置 Rust 环境变量
  - 添加到 ~/.bashrc 或 ~/.zshrc:
    export PATH="$HOME/.cargo/bin:$PATH"
  - 重新加载: source ~/.bashrc
  验证: which cargo
  预计时间: 5 分钟

☐ 0.1.1.3 安装 stable 和 nightly toolchain
  命令:
    rustup toolchain install stable
    rustup toolchain install nightly
  验证: rustup toolchain list
  预计时间: 10 分钟

☐ 0.1.1.4 添加 WASM 编译目标
  命令:
    rustup target add wasm32-unknown-unknown
    rustup target add wasm32-wasi
  验证: rustup target list | grep wasm
  预计时间: 5 分钟

☐ 0.1.1.5 安装 wasm-pack
  命令: cargo install wasm-pack
  验证: wasm-pack --version
  预期输出: wasm-pack 0.12.1 或更高
  预计时间: 20 分钟

☐ 0.1.1.6 安装 wasm-bindgen-cli
  命令: cargo install wasm-bindgen-cli
  验证: wasm-bindgen --version
  预计时间: 15 分钟

☐ 0.1.1.7 安装 cargo-watch (开发热重载)
  命令: cargo install cargo-watch
  验证: cargo watch --version
  预计时间: 10 分钟

☐ 0.1.1.8 安装 cargo-tarpaulin (代码覆盖率)
  命令: cargo install cargo-tarpaulin
  验证: cargo tarpaulin --version
  注意: Linux only，macOS 使用 cargo-llvm-cov
  预计时间: 15 分钟

☐ 0.1.1.9 安装 cargo-audit (安全审计)
  命令: cargo install cargo-audit
  验证: cargo audit --version
  预计时间: 5 分钟

☐ 0.1.1.10 测试完整工具链
  - 创建测试项目: cargo new --lib test-wasm
  - 构建: cd test-wasm && wasm-pack build
  - 清理: cd .. && rm -rf test-wasm
  验证: 构建成功无错误
  预计时间: 10 分钟

☐ 0.1.1.11 配置 Rust 分析器（rust-analyzer）
  - VSCode: 安装 rust-analyzer 扩展
  - 配置 settings.json:
    "rust-analyzer.cargo.features": "all",
    "rust-analyzer.checkOnSave.command": "clippy"
  预计时间: 10 分钟

☐ 0.1.1.12 配置 Rust 代码格式化
  - 创建 rustfmt.toml:
    edition = "2021"
    max_width = 100
    use_small_heuristics = "Max"
  - 测试: cargo fmt --check
  预计时间: 5 分钟
```

**验收标准**:

- ✅ `rustc --version` 输出 >= 1.75.0
- ✅ `wasm-pack build` 可成功构建示例项目
- ✅ `cargo fmt` 和 `cargo clippy` 正常运行
- ✅ 所有工具安装路径在 $PATH 中

**常见问题**:

- Q: Windows 上 rustup 安装失败？
  A: 需要先安装 Visual Studio C++ Build Tools
- Q: wasm-pack 构建慢？
  A: 配置国内镜像源（见文档）

---

#### 🔴 Task 0.1.2: 配置 C++ 工具链 (4 小时)

**负责人**: C++ Dev  
**依赖**: 无  
**交付物**: 可编译 C++ 到 WASM 的环境

**详细步骤**:

```bash
☐ 0.1.2.1 检查系统要求
  - Linux: GCC >= 9.0 或 Clang >= 10
  - macOS: Xcode Command Line Tools
  - Windows: Visual Studio 2019+
  预计时间: 5 分钟

☐ 0.1.2.2 安装 LLVM/Clang (Linux)
  命令:
    sudo apt update
    sudo apt install clang-15 libc++-15-dev libc++abi-15-dev
  验证: clang --version
  预期输出: clang version 15.0 或更高
  预计时间: 15 分钟

☐ 0.1.2.3 安装 LLVM/Clang (macOS)
  命令:
    brew install llvm
    echo 'export PATH="/usr/local/opt/llvm/bin:$PATH"' >> ~/.zshrc
  验证: clang --version
  预计时间: 20 分钟

☐ 0.1.2.4 安装 CMake
  - Linux: sudo apt install cmake
  - macOS: brew install cmake
  - Windows: 下载安装包从 cmake.org
  验证: cmake --version >= 3.20
  预计时间: 10 分钟

☐ 0.1.2.5 克隆 Emscripten SDK
  命令:
    cd ~/dev
    git clone https://github.com/emscripten-core/emsdk.git
    cd emsdk
  预计时间: 5 分钟

☐ 0.1.2.6 安装 Emscripten
  命令:
    ./emsdk install latest
    ./emsdk activate latest
  注意: 下载约 500MB，需要时间
  预计时间: 30 分钟

☐ 0.1.2.7 配置 Emscripten 环境变量
  - 添加到 ~/.bashrc:
    source ~/dev/emsdk/emsdk_env.sh
  - 重新加载: source ~/.bashrc
  验证: which emcc
  预计时间: 5 分钟

☐ 0.1.2.8 验证 Emscripten 安装
  命令: emcc --version
  预期输出: emcc (Emscripten) 3.1.x
  预计时间: 2 分钟

☐ 0.1.2.9 测试 C++ 到 WASM 编译
  - 创建 hello.cpp:
    #include <emscripten/emscripten.h>
    extern "C" {
      EMSCRIPTEN_KEEPALIVE
      int add(int a, int b) { return a + b; }
    }
  - 编译: emcc hello.cpp -o hello.js \
           -s WASM=1 \
           -s EXPORTED_FUNCTIONS='["_add"]'
  - 验证: 生成 hello.wasm 和 hello.js
  预计时间: 15 分钟

☐ 0.1.2.10 配置 CMake 工具链文件
  - 创建 cmake/Emscripten.cmake:
    set(CMAKE_SYSTEM_NAME Emscripten)
    set(CMAKE_C_COMPILER "emcc")
    set(CMAKE_CXX_COMPILER "em++")
  预计时间: 10 分钟

☐ 0.1.2.11 安装 wabt (WebAssembly Binary Toolkit)
  - Linux: sudo apt install wabt
  - macOS: brew install wabt
  - 验证: wasm-objdump --version
  用途: WASM 二进制分析工具
  预计时间: 5 分钟

☐ 0.1.2.12 测试完整工具链
  - 使用 CMake 构建 WASM 项目
  - 验证: wasm-objdump -x output.wasm
  预计时间: 20 分钟
```

**验收标准**:

- ✅ `emcc --version` 正常输出
- ✅ 可成功编译 C++ 到 WASM
- ✅ 生成的 .wasm 文件可用 wasm-objdump 分析
- ✅ CMake 可使用 Emscripten 工具链

---

#### 🔴 Task 0.1.3: 创建项目结构 (2 小时)

**负责人**: Tech Lead  
**依赖**: 0.1.1, 0.1.2  
**交付物**: 完整的项目目录结构

**详细步骤**:

```bash
☐ 0.1.3.1 创建顶层目录
  命令:
    cd /path/to/Roo-Code
    mkdir -p core/{rust,cpp,tests,benches}
    mkdir -p adapters/{vscode,blender,unreal,unity}
  预计时间: 2 分钟

☐ 0.1.3.2 创建 Rust workspace
  命令: cd core && touch Cargo.toml
  内容:
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

    [workspace.package]
    version = "0.1.0"
    edition = "2021"
    authors = ["Roo Code Team"]

    [workspace.dependencies]
    wasm-bindgen = "0.2"
    serde = { version = "1.0", features = ["derive"] }
    serde_json = "1.0"
    tokio = { version = "1", features = ["full"] }
  预计时间: 10 分钟

☐ 0.1.3.3 创建 host-interface crate
  命令:
    cd core/rust
    cargo new --lib host-interface
  - 编辑 Cargo.toml 添加依赖
  - 创建 src/lib.rs 基础结构
  预计时间: 10 分钟

☐ 0.1.3.4 创建 task-engine crate
  命令: cargo new --lib task-engine
  预计时间: 5 分钟

☐ 0.1.3.5 创建 ai-integration crate
  命令: cargo new --lib ai-integration
  预计时间: 5 分钟

☐ 0.1.3.6 创建 tool-system crate
  命令: cargo new --lib tool-system
  预计时间: 5 分钟

☐ 0.1.3.7 创建 memory crate
  命令: cargo new --lib memory
  预计时间: 5 分钟

☐ 0.1.3.8 创建 code-indexing crate
  命令: cargo new --lib code-indexing
  预计时间: 5 分钟

☐ 0.1.3.9 验证 workspace 构建
  命令:
    cd core
    cargo build --workspace
  验证: 所有 crate 编译成功
  预计时间: 10 分钟

☐ 0.1.3.10 创建 C++ 目录结构
  命令:
    cd core/cpp
    mkdir -p {include,src,tests}
    touch CMakeLists.txt
  预计时间: 5 分钟

☐ 0.1.3.11 创建 adapters 基础结构
  命令:
    cd adapters/vscode
    npm init -y
    mkdir -p src/{host,ui,tests}

    cd ../blender
    mkdir -p {roo_addon,tests}
    touch __init__.py

    cd ../unreal
    mkdir -p {Source/RooPlugin,Content}

    cd ../unity
    mkdir -p {Runtime,Editor,Tests}
  预计时间: 15 分钟

☐ 0.1.3.12 配置 .gitignore
  内容:
    # Rust
    target/
    Cargo.lock
    **/*.rs.bk

    # WASM
    *.wasm
    pkg/

    # Node
    node_modules/
    *.log
    dist/

    # C++
    build/
    *.o
    *.a

    # IDE
    .vscode/
    .idea/
    *.swp

    # OS
    .DS_Store
    Thumbs.db
```

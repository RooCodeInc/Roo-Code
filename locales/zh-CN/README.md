<p align="center">
<img src="https://media.githubusercontent.com/media/zgsm-ai/costrict/main/src/assets/docs/demo.gif" width="100%" />
</p>

<a href="https://marketplace.visualstudio.com/items?itemName=zgsm-ai.zgsm" target="_blank"><img src="https://img.shields.io/badge/%E5%9C%A8%20VS%20Marketplace%20%E4%B8%8A%E4%B8%8B%E8%BD%BD-blue?style=for-the-badge&logo=visualstudiocode&logoColor=white" alt="在 VS Marketplace 上下载"></a>
<a href="https://github.com/zgsm-ai/costrict/discussions/categories/feature-requests?discussions_q=is%3Aopen+category%3A%22Feature+Requests%22+sort%3Atop" target="_blank"><img src="https://img.shields.io/badge/%E5%8A%9F%E8%83%BD%E8%AF%B7%E6%B1%82-yellow?style=for-the-badge" alt="功能请求"></a>
<a href="https://marketplace.visualstudio.com/items?itemName=zgsm-ai.zgsm&ssr=false#review-details" target="_blank"><img src="https://img.shields.io/badge/%E8%AF%84%E5%88%86%20%26%20%E8%AF%84%E8%AE%BA-green?style=for-the-badge" alt="评分 & 评论"></a>
<a href="https://docs.roocode.com" target="_blank"><img src="https://img.shields.io/badge/%E6%96%87%E6%A1%A3-6B46C1?style=for-the-badge&logo=readthedocs&logoColor=white" alt="文档"></a>

</div>
<p align="center">
<a href="https://docs.roocode.com/tutorial-videos">更多快速教程和功能视频...</a>
</p>

## 资源

### 文档

- [基本使用指南](https://docs.roocode.com/basic-usage/the-chat-interface)
- [高级功能](https://docs.roocode.com/advanced-usage/auto-approving-actions)
- [常见问题](https://docs.roocode.com/faq)

### 社区

- **Discord：** [加入我们的 Discord 服务器](https://discord.gg/roocode)获取实时帮助和讨论
- **Reddit：** [访问我们的 subreddit](https://www.reddit.com/r/RooCode)分享经验和技巧
- **GitHub：** 报告[问题](https://github.com/zgsm-ai/costrict/issues)或请求[功能](https://github.com/zgsm-ai/costrict/discussions/categories/feature-requests?discussions_q=is%3Aopen+category%3A%22Feature+Requests%22+sort%3Atop)

---

## 本地设置与开发

1. **克隆**仓库：

```sh
git clone https://github.com/zgsm-ai/costrict.git
```

2. **安装依赖项**:

```sh
pnpm install
```

3. **运行扩展程序**:

有几种方法可以运行 Roo Code 扩展程序：

### 开发模式（F5）

对于积极开发，请使用 VSCode 的内置调试功能：

在 VSCode 中按 `F5`（或转到 **Run** → **Start Debugging**）。这将在运行 Roo Code 扩展程序的新 VSCode 窗口中打开。

- 对 webview 的更改将立即显示。
- 对核心扩展程序的更改也会自动热重载。

### 自动化 VSIX 安装

要将扩展程序构建为 VSIX 包并直接安装到 VSCode 中：

```sh
pnpm install:vsix [-y] [--editor=<command>]
```

此命令将：

- 询问要使用的编辑器命令（code/cursor/code-insiders） - 默认为“code”
- 卸载任何现有版本的扩展程序。
- 构建最新的 VSIX 包。
- 安装新构建的 VSIX。
- 提示您重新启动 VS Code 以使更改生效。

选项：

- `-y`: 跳过所有确认提示并使用默认值
- `--editor=<command>`: 指定编辑器命令（例如，`--editor=cursor` 或 `--editor=code-insiders`）

### 手动 VSIX 安装

```sh
code --install-extension bin/zgsm-<version>.vsix
```

1.  首先，构建 VSIX 包：
    ```sh
    pnpm vsix
    ```
2.  将在 `bin/` 目录中生成一个 `.vsix` 文件（例如，`bin/zgsm-<version>.vsix`）。
3.  使用 VSCode CLI 手动安装
    ```sh
    code --install-extension bin/zgsm-<version>.vsix
    ```

---

我们使用 [changesets](https://github.com/changesets/changesets) 进行版本控制和发布。有关发行说明，请查看我们的 `CHANGELOG.md`。

---

## 免责声明

**请注意**，Roo Code, Inc. **不**对与 Roo Code 相关的任何代码、模型或其他工具、任何相关的第三方工具或任何由此产生的输出作出任何陈述或保证。您承担使用任何此类工具或输出的**所有风险**；此类工具均按**“原样”**和**“可用”**的基础提供。此类风险可能包括但不限于知识产权侵权、网络漏洞或攻击、偏见、不准确、错误、缺陷、病毒、停机、财产损失或损害和/或人身伤害。您对自己使用任何此类工具或输出负全部责任（包括但不限于其合法性、适当性和结果）。

---

## 贡献

我们欢迎社区贡献！请阅读我们的 [CONTRIBUTING.md](CONTRIBUTING.md) 开始。

---

## 贡献者

感谢所有帮助改进 Roo Code 的贡献者！

<!-- START CONTRIBUTORS SECTION - AUTO-GENERATED, DO NOT EDIT MANUALLY -->

[![Contributors](https://contrib.rocks/image?repo=RooCodeInc/roo-code&max=120&columns=12&cacheBust=0000000000)](https://github.com/RooCodeInc/roo-code/graphs/contributors)

<!-- END CONTRIBUTORS SECTION -->

## 许可证

[Apache 2.0 © 2025 Roo Code, Inc.](../../LICENSE)

---

**享受 Roo Code！** 无论您是让它保持短绳还是让它自主漫游，我们都迫不及待地想看看您会构建什么。如果您有问题或功能想法，请访问我们的 [Reddit 社区](https://www.reddit.com/r/RooCode/)或 [Discord](https://discord.gg/roocode)。编码愉快！

<p align="center">
<img src="https://media.githubusercontent.com/media/zgsm-ai/costrict/main/src/assets/docs/demo.gif" width="100%" />
</p>

<a href="https://marketplace.visualstudio.com/items?itemName=zgsm-ai.zgsm" target="_blank"><img src="https://img.shields.io/badge/從%20VS%20Marketplace%20下載-blue?style=for-the-badge&logo=visualstudiocode&logoColor=white" alt="從 VS Marketplace 下載"></a>
<a href="https://github.com/zgsm-ai/costrict/discussions/categories/feature-requests?discussions_q=is%3Aopen+category%3A%22Feature+Requests%22+sort%3Atop" target="_blank"><img src="https://img.shields.io/badge/功能請求-yellow?style=for-the-badge" alt="功能請求"></a>
<a href="https://marketplace.visualstudio.com/items?itemName=zgsm-ai.zgsm&ssr=false#review-details" target="_blank"><img src="https://img.shields.io/badge/評分%20%26%20評論-green?style=for-the-badge" alt="評分 & 評論"></a>
<a href="https://docs.roocode.com" target="_blank"><img src="https://img.shields.io/badge/文件-6B46C1?style=for-the-badge&logo=readthedocs&logoColor=white" alt="文件"></a>

</div>
<p align="center">
<a href="https://docs.roocode.com/tutorial-videos">更多快速教學和功能影片...</a>
</p>

## 資源

### 文件

- [基本使用指南](https://docs.roocode.com/basic-usage/the-chat-interface)
- [進階功能](https://docs.roocode.com/advanced-usage/auto-approving-actions)
- [常見問題](https://docs.roocode.com/faq)

### 社群

- **Discord：** [加入我們的 Discord 伺服器](https://discord.gg/roocode)取得即時幫助和討論
- **Reddit：** [存取我們的 subreddit](https://www.reddit.com/r/RooCode)分享經驗和技巧
- **GitHub：** [報告問題](https://github.com/zgsm-ai/costrict/issues)或[請求功能](https://github.com/zgsm-ai/costrict/discussions/categories/feature-requests?discussions_q=is%3Aopen+category%3A%22Feature+Requests%22+sort%3Atop)

---

## 本地設定與開發

1. **複製**儲存庫：

```sh
git clone https://github.com/zgsm-ai/costrict.git
```

2. **安裝依賴套件**:

```sh
pnpm install
```

3. **執行擴充功能**:

有幾種方法可以執行 Roo Code 擴充功能：

### 開發模式（F5）

對於積極的開發，請使用 VSCode 的內建偵錯功能：

在 VSCode 中按 `F5`（或前往 **執行** → **開始偵錯**）。這將在執行 Roo Code 擴充功能的新 VSCode 視窗中開啟。

- 對 webview 的變更將立即顯示。
- 對核心擴充功能的變更也將自動熱重載。

### 自動化 VSIX 安裝

要將擴充功能建置為 VSIX 套件並直接安裝到 VSCode 中：

```sh
pnpm install:vsix [-y] [--editor=<command>]
```

此命令將：

- 詢問要使用的編輯器命令（code/cursor/code-insiders） - 預設為“code”
- 解除安裝任何現有版本的擴充功能。
- 建置最新的 VSIX 套件。
- 安裝新建立的 VSIX。
- 提示您重新啟動 VS Code 以使變更生效。

選項：

- `-y`: 跳過所有確認提示並使用預設值
- `--editor=<command>`: 指定編輯器命令（例如 `--editor=cursor` 或 `--editor=code-insiders`）

### 手動 VSIX 安裝

```sh
code --install-extension bin/zgsm-<version>.vsix
```

1.  首先，建置 VSIX 套件：
    ```sh
    pnpm vsix
    ```
2.  將在 `bin/` 目錄中產生一個 `.vsix` 檔案（例如 `bin/zgsm-<version>.vsix`）。
3.  使用 VSCode CLI 手動安裝
    ```sh
    code --install-extension bin/zgsm-<version>.vsix
    ```

---

我們使用 [changesets](https://github.com/changesets/changesets) 進行版本控制和發布。有關發行說明，請查看我們的 `CHANGELOG.md`。

---

## 免責聲明

**請注意**，Roo Code, Inc. **不**對與 Roo Code 相關的任何程式碼、模型或其他工具、任何相關的第三方工具或任何由此產生的輸出作出任何陳述或保證。您承擔使用任何此類工具或輸出的**所有風險**；此類工具均按**「原樣」**和**「可用」**的基礎提供。此類風險可能包括但不限於智慧財產權侵權、網路漏洞或攻擊、偏見、不準確、錯誤、缺陷、病毒、停機、財產損失或損害和/或人身傷害。您對自己使用任何此類工具或輸出負全部責任（包括但不限於其合法性、適當性和結果）。

---

## 貢獻

我們歡迎社群貢獻！請閱讀我們的 [CONTRIBUTING.md](CONTRIBUTING.md) 開始。

---

## 貢獻者

感謝所有幫助改進 Roo Code 的貢獻者！

<!-- START CONTRIBUTORS SECTION - AUTO-GENERATED, DO NOT EDIT MANUALLY -->

[![Contributors](https://contrib.rocks/image?repo=RooCodeInc/roo-code&max=120&columns=12&cacheBust=0000000000)](https://github.com/RooCodeInc/roo-code/graphs/contributors)

<!-- END CONTRIBUTORS SECTION -->

## 授權

[Apache 2.0 © 2025 Roo Code, Inc.](../../LICENSE)

---

**享受 Roo Code！** 無論您是將它拴在短繩上還是讓它自主漫遊，我們迫不及待地想看看您會建構什麼。如果您有問題或功能想法，請造訪我們的 [Reddit 社群](https://www.reddit.com/r/RooCode/)或 [Discord](https://discord.gg/roocode)。祝您開發愉快！

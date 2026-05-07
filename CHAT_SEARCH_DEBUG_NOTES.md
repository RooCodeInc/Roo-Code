# Chat Search Debug Notes

## 当前问题

搜索结果的计数基本正确，但跳转定位会出现偏移或二次跳转。

已观察到的现象：

- 搜索 `tiny` 时，结果不应该跳进 Mermaid/graph/flowchart 图表内容，因为这些块最终被渲染成图片。
- `📊 三种组合的预期准确率` 表格里的 `Tiny Image特征` 应该作为普通文本结果参与搜索和跳转。
- 搜索 `nearest` 时，有两个结果；第二个结果如果不在当前窗口内，可能无法跳转，除非它已经被虚拟列表渲染出来。
- 搜索 `bag` 时，`11 -> 12 -> 13 -> 12` 正常，但 `1 -> 17 -> ... -> 13 -> 12` 会把 no12 定位到 no11。
- no12、no15、no17 等结果都出现过“先跳到正确位置，然后马上又跳走”的现象。

## 根因判断

定位问题不是单纯的计数错误，而是“搜索结果列表”和“实际 DOM 高亮节点”之间不完全一致：

- 计数如果包含了 Mermaid/graph/flowchart 源码，但 DOM 中该部分被 Mermaid 渲染成 SVG/图片，就会导致第 N 个结果映射到错误 DOM 节点。
- 虚拟列表中未挂载的行不能直接查找 DOM，高亮节点需要等 Virtuoso 渲染出目标行后再定位。
- Shiki 代码高亮、Markdown 渲染、行高变化都会异步更新 DOM，过早 scroll 会出现目标行先到位、随后又被后续布局或旧目标覆盖。

## 已恢复的实现方向

- 新增 `webview-ui/src/utils/chatSearchText.ts`，统一抽取搜索文本。
- 新增 `webview-ui/src/utils/searchHighlight.tsx`，统一生成可定位的 `data-chat-search-match` 高亮节点。
- `graph`、`flowchart`、`mermaid` 等会渲染为图表的 fenced code block 会被排除在搜索文本之外。
- Markdown 和 CodeBlock 的高亮都走同一个 query，避免计数和渲染分裂。
- ChatRow 使用 `message.ts + matchIndex` 定位当前行内的第 N 个高亮节点。
- 当目标行还未挂载时，ChatView 先让 Virtuoso 滚到目标 message index；行挂载后由 ChatRow 再定位到具体高亮节点。
- 保留 `[chat-search]` console debug 输出，方便继续看 active result、row match count 和实际滚动目标。

## Timeline 恢复结果

检查过 VS Code Local History：

- 未找到 `ChatView.tsx`、`ChatRow.tsx`、`chatSearch`、`searchHighlight` 等相关快照。
- 这批改动大概率是通过工具直接写入文件，没有进入 VS Code Timeline。

因此当前内容是根据代码结构和之前调试结论重建，不是从 Timeline 直接恢复。

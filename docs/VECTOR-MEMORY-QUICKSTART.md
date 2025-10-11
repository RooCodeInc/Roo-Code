# 向量记忆系统快速开始指南

本指南将帮助您在5分钟内启用Roo-Code的向量记忆功能。

## 🚀 快速开始（3步骤）

### 步骤1：启动Qdrant服务（1分钟）

```bash
# 进入qdrant目录
cd qdrant

# 启动Qdrant容器
docker-compose up -d

# 验证服务运行
curl http://localhost:6333/health
# 预期输出：{"title":"qdrant - vector search engine","version":"..."}
```

### 步骤2：配置Embedder（2分钟）

选择以下任一方式：

#### 选项A：使用OpenAI（推荐用于生产）

1. 在VSCode设置中搜索 "Roo Code: Embedding Provider"
2. 选择 "openai"
3. 配置API Key（如果尚未配置）
4. 选择模型：`text-embedding-3-small`（性价比高）

#### 选项B：使用本地Ollama（推荐用于开发）

```bash
# 安装Ollama
curl -fsSL https://ollama.com/install.sh | sh

# 下载embedding模型
ollama pull nomic-embed-text

# 验证运行
ollama list | grep nomic-embed-text
```

然后在VSCode设置中：

- Embedding Provider: `ollama`
- Ollama Model: `nomic-embed-text`

### 步骤3：初始化代码索引（2分钟）

1. 打开命令面板（Cmd/Ctrl+Shift+P）
2. 运行命令：`Roo: Index Codebase`
3. 等待索引完成（首次需要几分钟）
4. 看到成功消息：✅ 向量记忆系统已自动启用

## ✅ 验证安装

### 测试1：检查向量记忆初始化

创建新对话并发送：

```
请记住这个配置：使用PostgreSQL数据库，端口设置为5432
```

然后触发上下文压缩（发送多条消息使上下文达到阈值），查看日志应包含：

```
[VectorMemoryStore] Storing 1 memories
[VectorMemoryStore] Searching project memories
```

### 测试2：验证跨对话记忆

1. 在第一个对话中：

    ```
    记住：项目使用TypeScript和React
    ```

2. 开始新对话并发送：

    ```
    继续开发前端功能
    ```

3. 观察Roo是否自动提及TypeScript和React配置

## 📊 功能确认清单

- [ ] Qdrant服务运行正常（端口6333）
- [ ] Embedder已配置（OpenAI或Ollama）
- [ ] 代码索引初始化完成
- [ ] 向量记忆在日志中可见
- [ ] 跨对话记忆测试成功

## 🎯 使用示例

### 示例1：保存项目配置

```
用户："记住这个重要配置：
- 数据库：PostgreSQL 14
- 缓存：Redis 7
- API端口：3001
- 启用HTTPS"

Roo："好的，已记录项目配置信息。"
```

### 示例2：技术决策记录

```
用户："我们决定使用JWT进行认证，因为需要无状态的API"

Roo："明白了，已记录这个技术决策。"
```

### 示例3：自动检索（新对话）

```
用户："开始实现用户认证功能"

Roo："基于项目记忆，我注意到：
- 项目使用PostgreSQL 14作为数据库
- 已决定使用JWT进行认证
- API端口配置为3001

我将基于这些配置实现认证功能..."
```

## 🔧 配置调优

### 调整记忆相似度阈值

编辑 `src/core/condense/index.ts`，找到第271行附近：

```typescript
const relevantMemories = await vectorMemoryStore.searchProjectMemories(queryContext, {
	minScore: 0.75, // 提高至0.80获取更精确的记忆
	maxResults: 5, // 增加至10获取更多上下文
})
```

### 查看记忆统计

```typescript
// 在浏览器控制台或Node REPL中
const stats = await vectorMemoryStore.getMemoryStats()
console.log("总记忆数:", stats.totalMemories)
console.log("按类型分布:", stats.byType)
console.log("按优先级分布:", stats.byPriority)
```

## 🐛 常见问题

### Q1：向量记忆未启用？

**症状**：上下文压缩时没有检索历史记忆

**解决方案**：

```bash
# 1. 检查Qdrant状态
curl http://localhost:6333/health

# 2. 检查Qdrant日志
docker-compose logs qdrant | tail -20

# 3. 重新初始化代码索引
# 在VSCode命令面板运行: Roo: Index Codebase
```

### Q2：Qdrant连接失败？

**错误**：`ECONNREFUSED 127.0.0.1:6333`

**解决方案**：

```bash
# 检查端口占用
lsof -i :6333

# 重启Qdrant
cd qdrant
docker-compose restart

# 查看详细日志
docker-compose logs -f qdrant
```

### Q3：Embedder初始化失败？

**OpenAI相关错误**：

- 检查API Key是否正确
- 验证网络连接
- 确认账户余额

**Ollama相关错误**：

```bash
# 检查Ollama服务
systemctl status ollama

# 或（MacOS）
brew services list | grep ollama

# 重启Ollama
ollama serve
```

### Q4：记忆不准确？

**可能原因**：

1. 相似度阈值过低
2. 记忆描述不够清晰
3. Embedding模型质量问题

**优化建议**：

- 提高minScore阈值至0.80-0.85
- 使用更明确的关键词（"重要"、"记住"、"配置"）
- 切换到quality更高的embedding模型（如text-embedding-3-large）

## 📚 深入学习

- **完整用户指南**：[docs/28-vector-memory-user-guide.md](./28-vector-memory-user-guide.md)
- **技术实现细节**：[docs/27-vector-memory-integration-implementation.md](./27-vector-memory-integration-implementation.md)
- **上下文压缩**：[docs/03-context-compression.md](./03-context-compression.md)
- **代码索引**：[docs/06-codebase-indexing.md](./06-codebase-indexing.md)

## 🔗 相关资源

- [Qdrant文档](https://qdrant.tech/documentation/)
- [OpenAI Embeddings](https://platform.openai.com/docs/guides/embeddings)
- [Ollama](https://ollama.com/)

## 💡 最佳实践

1. **明确表达重要信息**

    - ✅ "记住：使用PostgreSQL数据库"
    - ❌ "数据库"

2. **使用触发词**

    - "记住"、"重要"、"配置"
    - "决定使用"、"采用"

3. **结构化描述**

    - ✅ "配置：数据库=PostgreSQL，端口=5432"
    - ❌ "我们用PostgreSQL，端口可能是5432吧"

4. **定期检查记忆**

    - 查看向量记忆统计
    - 清理过期或无用记忆

5. **合理使用项目ID**
    - 不同项目使用不同workspace
    - 避免记忆混淆

## 🎓 进阶技巧

### 自定义记忆提取

修改 `ConversationMemory.ts` 中的提取规则：

```typescript
private analyzeMessage(message: ApiMessage): void {
    // 添加自定义模式匹配
    if (content.includes('custom-keyword')) {
        this.addMemory({
            type: MemoryType.CUSTOM,
            priority: MemoryPriority.HIGH,
            content: extractedContent,
        })
    }
}
```

### 集成到CI/CD

```yaml
# .github/workflows/memory-backup.yml
name: Backup Vector Memories
on:
    schedule:
        - cron: "0 0 * * 0" # 每周日备份
jobs:
    backup:
        runs-on: ubuntu-latest
        steps:
            - name: Export Qdrant snapshot
              run: |
                  curl -X POST "http://qdrant:6333/collections/roo-memories/snapshots"
```

---

**🎉 恭喜！** 您已成功启用Roo-Code的向量记忆系统。现在可以享受跨对话的智能记忆管理了！

有问题？查看[完整用户指南](./28-vector-memory-user-guide.md)或[提交Issue](https://github.com/RooCodeInc/Roo-Code/issues)。

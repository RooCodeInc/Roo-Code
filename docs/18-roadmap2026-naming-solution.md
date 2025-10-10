# Roadmap2026 分支命名和标识方案

## 问题分析

### 原始问题

尝试将扩展名称从 `roo-cline` 改为 `roo-codep` 导致扩展无法加载。

### 根本原因

VSCode 扩展系统的工作原理：

1. **扩展ID** = `publisher.name` （例如：`RooVeterinaryInc.roo-cline`）
2. **命令注册** 使用固定的前缀（例如：`roo-cline.plusButtonClicked`）
3. 当 `name` 字段改变时，扩展ID也会改变
4. 但 `package.json` 中的 `contributes` 部分所有命令、视图、配置项都硬编码为 `roo-cline.*`
5. VSCode 无法将新的扩展ID（`RooVeterinaryInc.roo-codep`）与旧的命令ID（`roo-cline.*`）匹配
6. 结果：扩展注册失败，无法加载

## 解决方案

### 核心策略

**保持 `name` 不变，仅修改显示相关的字段**

### 具体实施

#### 1. package.json 修改

```json
{
	"name": "roo-cline", // 保持不变，确保扩展ID和命令ID匹配
	"displayName": "Roo-Cline (Roadmap2026)", // 修改显示名称以区分版本
	"description": "... [Roadmap2026 Testing Branch]", // 在描述中标注测试分支
	"version": "3.28.15-preview.1" // 使用preview版本号
}
```

#### 2. 国际化文件修改

修改 `src/package.nls.json` 和 `src/package.nls.zh-CN.json`：

```json
{
	"views.activitybar.title": "Roo Code (R2026)",
	"views.contextMenu.label": "Roo Code (R2026)",
	"views.sidebar.name": "Roo Code (R2026)",
	"configuration.title": "Roo Code (R2026)"
}
```

### 效果

- ✅ 扩展ID保持为 `RooVeterinaryInc.roo-cline`
- ✅ 命令注册正常工作（`roo-cline.*`）
- ✅ 显示名称包含 "Roadmap2026" 标识
- ✅ 界面标题显示 "Roo Code (R2026)"
- ✅ 与官方版本可以共存（因为扩展ID相同会被视为同一扩展的不同版本）

## 技术细节

### VSCode 扩展命名规范

1. **name**: 扩展包名，用于生成扩展ID，必须与命令前缀一致
2. **displayName**: 显示在市场和扩展列表中的名称，可自由修改
3. **publisher**: 发布者名称，与 name 组合形成完整的扩展ID

### 命令注册系统

```json
{
	"contributes": {
		"commands": [
			{
				"command": "roo-cline.plusButtonClicked", // 必须与 name 字段匹配
				"title": "%command.newTask.title%"
			}
		]
	}
}
```

### 视图容器注册

```json
{
	"contributes": {
		"viewsContainers": {
			"activitybar": [
				{
					"id": "roo-cline-ActivityBar", // 必须与 name 字段匹配
					"title": "%views.activitybar.title%"
				}
			]
		}
	}
}
```

## 最佳实践

### ✅ 推荐做法

1. 保持 `name` 字段不变
2. 修改 `displayName` 添加版本标识
3. 修改国际化文件中的标题文本
4. 使用 `preview` 或 `beta` 版本号

### ❌ 避免做法

1. 修改 `name` 字段（除非同时修改所有命令ID）
2. 修改 `publisher` 字段
3. 修改已注册的命令前缀

## 编译结果

```
DONE Packaged: ../bin/roo-cline-3.28.15-preview.1.vsix (1718 files, 27.37 MB)
```

### 验证检查清单

- [x] 扩展ID正确: `RooVeterinaryInc.roo-cline`
- [x] 显示名称包含版本标识: "Roo-Cline (Roadmap2026)"
- [x] 命令前缀匹配: `roo-cline.*`
- [x] 界面标题正确: "Roo Code (R2026)"
- [x] VSIX 文件生成成功

## 总结

通过保持 `name` 字段不变，仅修改 `displayName` 和国际化文件，我们成功实现了：

1. 扩展能正常加载和运行
2. 用户能清晰识别这是 Roadmap2026 测试版本
3. 与现有扩展系统完全兼容
4. 避免了命令注册和视图系统的冲突

这种方案既满足了版本区分的需求，又保证了技术实现的正确性。

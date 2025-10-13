# 任务拆分系统分析与改进方案

**创建时间**: 2025-10-13  
**相关文档**: docs/32-task-decomposition-and-ui-display.md, docs/32-task-decomposition-summary.md

## 1. 系统现状分析

### 1.1 现有任务拆分机制

Roo-Code 当前有**两种**任务拆分方式：

#### 方式1: TODO列表系统 (`update_todo_list` 工具)

- **实现**: `src/core/tools/updateTodoListTool.ts`
- **提示词**: `src/core/prompts/tools/update-todo-list.ts`
- **特点**: 轻量级、同一上下文、不能切换模式
- **优点**: 已有明确的使用场景指导（When to Use / When NOT to Use）

#### 方式2: 子任务系统 (`new_task` 工具)

- **实现**: `src/core/tools/newTaskTool.ts`
- **提示词**: `src/core/prompts/tools/new-task.ts`
- **特点**: 独立上下文、可切换模式、支持初始TODO
- **问题**: ❌ **完全没有使用场景说明**

### 1.2 核心问题

1. **提示词缺少决策指导**: `new_task` 工具没有 "When to Use" 说明
2. **UI缺少层级结构**: TODO列表只显示扁平表格，没有进度条
3. **子任务关系不可见**: 父子任务关系未在UI中展示

## 2. 改进方案

### 2.1 提示词增强（优先级：P0 - 立即实施）

#### 改进1: 增强 `new_task` 工具描述

**文件**: `src/core/prompts/tools/new-task.ts`

添加完整的使用场景指导，与 `update_todo_list` 形成对照。

#### 改进2: 增强 OBJECTIVE 部分

**文件**: `src/core/prompts/sections/objective.ts`

添加任务拆分策略指导，明确两种工具的决策原则。

### 2.2 环境详情增强（优先级：P1 - 短期实施）

#### 改进3: 增强 `formatReminderSection`

**文件**: `src/core/environment/reminder.ts`

添加：

- 进度百分比和进度条
- 按状态分组显示（进行中 / 待办 / 已完成）
- 折叠已完成项的选项

#### 改进4: 添加任务层级信息

**文件**: `src/core/environment/getEnvironmentDetails.ts`

显示当前任务在任务树中的位置。

## 3. 实施计划

### Phase 1: 提示词改进（本次实施）

1. ✅ 创建分析文档
2. 🔄 修改 `new-task.ts` 添加使用场景
3. 🔄 修改 `objective.ts` 添加策略指导
4. 🔄 添加单元测试
5. 🔄 运行测试验证

### Phase 2: 环境详情改进（后续PR）

1. 修改 `reminder.ts` 增强显示格式
2. 修改 `getEnvironmentDetails.ts` 添加层级信息
3. 添加相关测试

## 4. 预期效果

### 提示词改进后：

- ✅ 大模型能明确知道何时使用哪个工具
- ✅ 复杂任务能正确拆分为子任务
- ✅ 模式切换场景能被正确识别

### UI改进后：

- ✅ 用户能快速了解任务完成进度
- ✅ TODO列表更易浏览和理解
- ✅ 任务层级关系清晰可见

---

**下一步**: 开始实施Phase 1 - 提示词改进

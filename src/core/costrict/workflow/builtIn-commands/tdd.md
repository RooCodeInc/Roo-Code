---
description: "测试驱动开发"
---

请严格遵守以下规则:

1. 查看 .cospec/TEST_GUIDE.md 文件是否存在，若文件不存在，则使用 ask_followup_question 工具告知用户如何创建测试指导文档：“未找到测试指导文档，请通过触发首页的《测试方案》功能来生成。<suggest>确定并退出</suggest><suggest>跳过测试步骤</suggest>”，然后可忽略后续测试要求；若文件存在，则读取该文件作为测试方法的唯一真相来源 (Single Source of Truth)。
2. 确保所有测试用例 100% 执行通过
3. 如果测试用例没有全部通过，必须使用 ask_followup_question 工具询问我：“测试未完全通过（当前通过率：[请填入实际通过率]%），是否允许结束任务？”。只有我给出肯定答复，才可以使用 attempt_completion 工具

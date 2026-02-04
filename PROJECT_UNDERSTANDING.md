# توثيق فهم المشروع - Roo Code

## 📋 نظرة عامة

**Roo Code** هو امتداد VS Code يعتمد على الذكاء الاصطناعي يساعد المطورين على:

- إنشاء الكود من وصف نصي
- إصلاح وتحسين الكود الموجود
- فهم الكود الموجود في المشروع
- إدارة المهام البرمجية
- استخدام خوادم MCP (Model Context Protocol)
- إدارة سياق العمل

---

## 🏗️ هيكل المشروع

```
Roo-Code/
├── src/                    # الكود الرئيسي للامتداد VS Code
│   ├── activate/          # نقطة بدء التشغيل
│   │   └── registerCommands.ts
│   ├── core/              # الوحدات الأساسية
│   │   ├── webview/       # إدارة Webview (واجهة المستخدم)
│   │   ├── task/          # نظام المهام
│   │   ├── tools/         # أدوات التنفيذ
│   │   ├── prompts/       # النصوص التوجيهية للـ AI
│   │   ├── config/        # إعدادات وإدارة السياق
│   │   └── api/           # الاتصال بـ AI providers
│   ├── services/          # الخدمات المساعدة
│   │   ├── checkpoints/   # نظام Checkpoints (جديد)
│   │   ├── code-index/    # فهرسة الكود
│   │   ├── mcp/           # إدارة MCP servers
│   │   ├── marketplace/   # سوق الامتدادات
│   │   └── skills/        # مهارات مدمجة
│   ├── integrations/      # التكاملات الخارجية
│   │   ├── terminal/      # سطر الأوامر
│   │   ├── editor/        # محرر الكود
│   │   └── browser/       # المتصفح
│   ├── tools/             # أدوات التنفيذ
│   ├── ui/                # واجهة المستخدم
│   └── utils/             # أدوات مساعدة
├── webview-ui/            # React Webview UI
│   ├── src/
│   │   ├── components/    # المكونات
│   │   ├── context/       # سياق التطبيق
│   │   └── utils/         # أدوات
├── packages/              # حزم Workspace
│   ├── types/             # تعريفات TypeScript المشتركة
│   ├── cloud/             # خدمات السحابة
│   ├── telemetry/         # التتبع والإحصائيات
│   └── ipc/               # IPC (Inter-Process Communication)
└── apps/                  # تطبيقات إضافية
    └── web-evals/         # نظام التقييم
```

---

## 🎯 المكونات الرئيسية

### 1. ClineProvider (src/core/webview/ClineProvider.ts)

- المسؤول عن إدارة Webview والاتصال بين Extension و UI
- يدير المهام (Tasks) ورسائل الـ AI
- يتعامل مع الأحداث (Events) مثل إنشاء المهام

**المفاتيح:**

- `sideBarId`: معرف الـ Sidebar
- `tabPanelId`: معرف Tab
- `activeInstances`: مجموعة من المثيلات النشطة
- `clineStack`: مكدس المهام

### 2. Task (src/core/task/Task.ts)

- يمثل مهمة واحدة من AI
- يحتوي على:
    - الرسائل (Messages)
    - قائمة المهام (Todos)
    - حالة التنفيذ (Status)
    - تكلفة الاستخدام (Cost)
    - سياق العمل (Context)

### 3. WebviewMessageHandler (src/core/webview/webviewMessageHandler.ts)

- المعالج الرئيسي للرسائل من Webview إلى Extension
- يدير:
    - إنشاء المهام
    - تنفيذ الأدوات (Tools)
    - إدارة Checkpoints
    - إدارة المودات (Modes)

---

## 🎨 نظام المودات (Modes)

Roo Code يدعم عدة مودات للعمل بناءً على احتياجات المستخدم:

| المود            | الوصف                                     |
| ---------------- | ----------------------------------------- |
| **Code**         | التطوير اليومي، التعديلات، عمليات الملفات |
| **Architect**    | تخطيط النظم، المواصفات، الترحيلات         |
| **Ask**          | الإجابات السريعة، الشروحات، التوثيق       |
| **Debug**        | تتبع المشاكل، إضافة السجلات، تحديد الجذور |
| **Custom Modes** | مودات مخصصة للمجموعة أو سير العمل         |

**كيفية التنفيذ:**

```typescript
// في shared/modes.ts
export enum Mode {
	CODE = "code",
	ARCHITECT = "architect",
	ASK = "ask",
	DEBUG = "debug",
	CUSTOM = "custom",
}
```

---

## 🕐 نظام Checkpoints (جديد في الإصدار الحالي)

### الوصف

نظام لإدارة نقاط التراجع (Checkpoints) للكود، يسمح بالمقارنة والاستعادة بين النسخ المختلفة.

### الملفات الرئيسية:

- `src/services/checkpoints/types.ts` - تعريفات الأنواع
- `src/services/checkpoints/checkpoint-metadata.ts` - بيانات Checkpoint
- `src/services/checkpoints/checkpoint-timeline-service.ts` - خدمة Timeline
- `src/services/checkpoints/enhanced-diff.ts` - تحليل الفروقات
- `src/services/checkpoints/ShadowCheckpointService.ts` - خدمة Shadow

### أنواع Checkpoints:

```typescript
export enum CheckpointCategory {
	AUTO = "auto", // تلقائي
	MANUAL = "manual", // يدوي
	MILESTONE = "milestone", // نقطة مهمة
	EXPERIMENT = "experiment", // تجريبي
	BACKUP = "backup", // نسخ احتياطي
	RECOVERY = "recovery", // نقطة استعادة
}
```

### الميزات:

- ✅ تصنيف Checkpoints حسب الفئة
- ✅ تحليل الفروقات (Enhanced Diff)
- ✅ Timeline مرئي
- ✅ دعم التفرع (Branching)
- ✅ بحث وتصفية

### Webview Components:

- `CheckpointView.tsx` - واجهة عرض Checkpoints
- `CheckpointTimeline.tsx` - Timeline مرئي
- `CheckpointNode.tsx` - عقدة Checkpoint
- `schema.ts` - تعريفات البيانات

---

## 🔄 التواصل بين Extension و Webview

### 1. Extension → Webview (إرسال رسائل)

```typescript
provider.postMessageToWebview({
	type: "action",
	action: "checkpointsButtonClicked",
})
```

### 2. Webview → Extension (استقبال رسائل)

```typescript
webview.onDidReceiveMessage((message) => {
	switch (message.type) {
		case "action":
			handleAction(message.action)
			break
		case "message":
			handleAIMessage(message.content)
			break
	}
})
```

### نوع الرسائل:

- `action`: إجراء من UI
- `message`: رسالة من AI
- `tool`: أداة يتم تنفيذها
- `todo`: تحديث قائمة المهام

---

## 🔧 الأدوات (Tools)

الأدوات هي العمليات التي يمكن لـ AI تنفيذها:

| الأداة            | الوصف               |
| ----------------- | ------------------- |
| `read_file`       | قراءة ملف           |
| `write_to_file`   | كتابة ملف           |
| `edit_file`       | تعديل ملف           |
| `search_files`    | البحث في الملفات    |
| `execute_command` | تنفيذ أمر           |
| `browser_action`  | إجراءات المتصفح     |
| `codebase_search` | بحث في الكود        |
| `new_task`        | إنشاء مهمة جديدة    |
| `switch_mode`     | التبديل بين المودات |
| `skill`           | استخدام مهارة       |

---

## 📊 إدارة البيانات

### ملفات البيانات:

- `task-persistence/` - حفظ المهام والرسائل
- `globalFileNames.ts` - أسماء الملفات الثابتة
- `.cline/` - دليل البيانات المحلي

### الحفظ:

```typescript
// حفظ رسائل API
saveApiMessages(taskId, messages)

// حفظ رسائل المهام
saveTaskMessages(taskId, messages)

// حفظ بيانات المهمة
saveTaskMetadata(taskId, metadata)
```

---

## 🧪 الاختبار

### نظام الاختبار:

- **Vitest** - إطار عمل الاختبار
- **Tests** في `src/__tests__/` و `webview-ui/src/__tests__/`

### تشغيل الاختبارات:

```bash
# اختبارات Extension
cd src && npx vitest run tests/

# اختبارات Webview
cd webview-ui && npx vitest run src/

# جميع الاختبارات
npx vitest run
```

---

## 🚀 التطوير والبناء

### أوامر البناء:

```bash
# تثبيت التبعيات
pnpm install

# بناء الامتداد
pnpm bundle

# بناء VSIX
pnpm vsix

# التشغيل في وضع التطوير (F5 في VSCode)
```

### هيكل البناء:

```bash
src/
  └── dist/          # الناتج بعد البناء
webview-ui/
  └── dist/          # Webview بعد البناء
```

---

## 📝 ملاحظات مهمة

### القواعد الأساسية:

1. **File Writing**: استخدم `safeWriteJson` بدلاً من `JSON.stringify`
2. **Test Coverage**: تأكد من تغطية الاختبارات قبل الرفع
3. **Import Patterns**: استورد `vscode` من `@types/vscode`
4. **Mode-specific**: لا تعطل قواعد lint دون موافقة صريحة

### الأدوات المساعدة:

- `safeWriteJson` - كتابة JSON آمنة
- `aggregateTaskCosts` - حساب تكلفة المهام
- `formatToolInvocation` - تنسيق استدعاء الأدوات

---

## 📈 الإصدارات الحالية

- **الإصدار الحالي**: 3.46.1
- **VS Code**: ^1.84.0
- **Node**: 20.19.2

---

## 🎓 ملاحظات إضافية

### الميزات الجديدة (الإصدار الحالي):

1. ✅ نظام Checkpoints محسّن مع Timeline
2. ✅ تحليل الفروقات (Enhanced Diff)
3. ✅ تصنيف Checkpoints حسب الفئة
4. ✅ دعم التفرع (Branching) في Checkpoints
5. ✅ واجهة مرئية لـ Checkpoints في Webview

### الأنواع الجديدة:

```typescript
// في packages/types/src/checkpoints.ts
;-CheckpointCategory -
	CheckpointMetadata -
	CheckpointStats -
	ConversationContext -
	ChangeType -
	RiskLevel -
	SemanticChange -
	EnhancedDiff -
	Branch -
	MergeStrategy -
	BranchComparison -
	CheckpointSearchQuery -
	CheckpointFilter
```

---

## 🔗 نظام API Providers

Roo Code يدعم عدة مزودين للذكاء الاصطناعي:

| Provider         | الوصف                            |
| ---------------- | -------------------------------- |
| **Anthropic**    | Claude API                       |
| **OpenAI**       | GPT-4, GPT-3.5                   |
| **OpenRouter**   | واجهة موحدة لمختلف الـ providers |
| **Google**       | Gemini                           |
| **AWS Bedrock**  | Bedrock Service                  |
| **Azure**        | Azure OpenAI                     |
| **Hugging Face** | Transformers                     |
| **Mistral**      | Mistral AI                       |
| **Cerebras**     | Cerebras AI                      |
| **Groq**         | Groq Inference                   |
| **DeepSeek**     | DeepSeek AI                      |
| **LmStudio**     | محلي                             |
| **Ollama**       | محلي                             |
| **Requesty**     | Requesty API                     |
| **XAI**          | xAI                              |

### Handler Pattern:

```typescript
// src/api/providers/
;-AnthropicHandler -
	OpenAiHandler -
	OpenRouterHandler -
	VertexHandler -
	AwsBedrockHandler -
	GeminiHandler -
	LmStudioHandler -
	VsCodeLmHandler
// ... المزيد
```

---

## 🤖 نظام MCP (Model Context Protocol)

### الوصف

MCP هو بروتوكول يسمح بدمج خدمات خارجية في Roo Code.

### أنواع الاتصال:

1. **Stdio** - اتصال عبر stdio
2. **SSE** - Server-Sent Events
3. **Streamable HTTP** - HTTP Streaming

### الملفات الرئيسية:

- `src/services/mcp/McpHub.ts` - مركز إدارة MCP
- `src/services/mcp/McpServerManager.ts` - إدارة الخوادم
- `src/core/tools/accessMcpResourceTool.ts` - أداة الوصول للموارد

### أنواع MCP:

```typescript
// في packages/types/src/mcp.ts
- McpServer - خادم MCP
- McpTool - أداة MCP
- McpResource - مورد MCP
- McpResourceTemplate - قالب مورد
```

### الميزات:

- ✅ اتصال متعدد الخوادم
- ✅ اكتشاف تلقائي للخوادم
- ✅ مراقبة التغييرات في الخوادم
- ✅ دعم التصفية للأدوات والموارد

---

## 📦 نظام المودات (Modes) - التفاصيل

### المودات المدمجة:

```typescript
// في packages/types/src/mode.ts
export const DEFAULT_MODES: ModeConfig[] = [
  {
    slug: "code",
    name: "Code",
    description: "...",
    groups: [...]
  },
  {
    slug: "architect",
    name: "Architect",
    description: "...",
    groups: [...]
  },
  // ...
]
```

### مجموعات الأدوات لكل مود:

```typescript
// في shared/tools.ts
export const TOOL_GROUPS = {
  code: {
    tools: ["read_file", "write_to_file", "edit_file", ...],
    description: "..."
  },
  terminal: {
    tools: ["execute_command", "terminal_fix_command", ...],
    description: "..."
  },
  // ...
}
```

### الأدوات المتاحة دائماً:

```typescript
export const ALWAYS_AVAILABLE_TOOLS = [
	"new_task",
	"switch_mode",
	"ask_followup_question",
	"attempt_completion",
	"update_todo_list",
]
```

---

## 🗂️ إدارة السياق (Context Management)

### الملفات الرئيسية:

- `src/core/context-management/` - إدارة السياق
- `src/core/context-tracking/` - تتبع سياق الملفات
- `src/core/condense/` - تقليل السياق

### المكونات:

```typescript
// Context Management
- ContextManager - مدير السياق
- ContextTruncation - تقليل السياق الزائد
- ContextCompression - ضغط السياق

// File Context Tracking
- FileContextTracker - تتبع سياق الملفات
- FileContextTrackerTypes - تعريفات الأنواع
```

### استراتيجيات الضغط:

```typescript
export enum CompressionStrategy {
	AGGRESSIVE = "aggressive",
	BALANCED = "balanced",
	PRESERVATIVE = "preservative",
}
```

---

## 💾 إعدادات المستخدم

### ملفات الإعدادات:

- `.roo/settings.json` - إعدادات محلية
- `.cline/settings.json` - إعدادات بديلة
- `~/.roo/settings.json` - إعدادات عالمية

### أنواع الإعدادات:

```typescript
// في src/package.json - configuration.properties
;-roo -
	cline.apiRequestTimeout -
	roo -
	cline.codeIndex.hybridSearch -
	roo -
	cline.context.compression -
	roo -
	cline.customStoragePath -
	roo -
	cline.debug
// ... المزيد
```

---

## 🔄 سير العمل (Workflow)

### سير عمل إنشاء مهمة:

```
1. المستخدم يطلب مهمة جديدة
   ↓
2. ClineProvider يبدأ مهمة جديدة
   ↓
3. Task يتم إنشاؤه
   ↓
4. يُنشئ Webview WebviewPanel
   ↓
5. يرسل رسالة للـ AI
   ↓
6. AI يستدعي الأدوات
   ↓
7. الأدوات تنفذ العمليات
   ↓
8. النتائج تُرسل للـ AI
   ↓
9. دورة متكررة حتى الإكمال
```

### سير عمل Checkpoint:

```
1. المستخدم يطلب Checkpoint
   ↓
2. ShadowCheckpointService يحفظ الحالة
   ↓
3. يُنشئ CheckpointMetadata
   ↓
4. يُحلل الفروقات (Enhanced Diff)
   ↓
5. يُعرض في Timeline
   ↓
6. يمكن استعادة Checkpoint لاحقاً
```

---

## 📊 التتبع والإحصائيات

### الملفات الرئيسية:

- `src/services/telemetry/` - التتبع
- `packages/telemetry/` - حزم التتبع

### البيانات المُتتبعة:

- تكلفة الاستخدام
- عدد الرسائل
- عدد الأدوات المستخدمة
- وقت التنفيذ
- أخطاء النظام

---

## 🌐 اللغات المدعومة

### Localizations:

- `locales/` - المجلد الرئيسي للترجمات
- `locales/en/` - الإنجليزية
- `locales/ar/` - العربية (غير موجودة حالياً)
- `locales/es/` - الإسبانية
- `locales/fr/` - الفرنسية
- `locales/de/` - الألمانية
- `locales/zh-CN/` - الصينية المبسطة
- `locales/zh-TW/` - الصينية التقليدية
- `locales/ja/` - اليابانية
- `locales/ko/` - الكورية
- `locales/hi/` - الهندية
- `locales/tr/` - التركية
- `locales/ru/` - الروسية
- `locales/pt-BR/` - البرتغالية البرازيلية
- `locales/vi/` - الفيتنامية
- `locales/id/` - الإندونيسية
- `locales/it/` - الإيطالية
- `locales/nl/` - الهولندية
- `locales/pl/` - البولندية

### نظام الترجمة:

- `i18n/index.ts` - إعداد الترجمة
- `i18n/setup.ts` - تهيئة i18next
- `webview-ui/src/i18n/TranslationContext.tsx` - سياق الترجمة في Webview

---

## 🔐 الأمان والخصوصية

### ميزات الأمان:

- ✅ إعدادات `allowedCommands` و `deniedCommands`
- ✅ `commandExecutionTimeout` - مهلة تنفيذ الأوامر
- ✅ `commandTimeoutAllowlist` - قائمة الأوامر المسموحة
- ✅ `preventCompletionWithOpenTodos` - منع الإكمال مع مهام مفتوحة
- ✅ `autoImportSettingsPath` - استيراد الإعدادات الآمن

### MDM Compliance:

- `src/services/mdm/MdmService.ts` - خدمة MDM compliance

---

## 🚀 الأداء والتحسينات

### التحسينات:

1. **Lazy Loading** - تحميل الكود عند الحاجة
2. **Code Indexing** - فهرسة الكود للبحث السريع
3. **Context Compression** - ضغط السياق لتوفير الذاكرة
4. **Parallel Tool Execution** - تنفيذ الأدوات بالتوازي
5. **Webview Optimization** - تحسين Webview UI

### Code Indexing:

```typescript
// src/services/code-index/
- manager.ts - مدير الفهرسة
- search-service.ts - خدمة البحث
- hybrid-search.ts - بحث هجين
- adaptive-chunker.ts - تجزئة تلقائية
```

---

## 📝 قواعد الكتابة (Coding Standards)

### TypeScript:

- ✅ استخدام `strict: true` في tsconfig
- ✅ استخدام Zod للتحقق من البيانات
- ✅ استخدام `@types/vscode` للتعريفات

### React:

- ✅ استخدام Hooks (useState, useEffect, useMemo)
- ✅ استخدام React.memo للأداء
- ✅ استخدام useCallback للدوال

### ESLint:

- ✅ قواعد محددة في `src/eslint.config.mjs`
- ✅ لا تعطيل قواعد lint بدون موافقة

---

## 🧪 اختبار الأداء

### أدوات الاختبار:

- **Vitest** - اختبار الوحدات
- **@vscode/test-electron** - اختبار الامتداد
- **nock** - محاكاة HTTP

### تغطية الاختبارات:

- `src/__tests__/` - اختبارات Extension
- `webview-ui/src/__tests__/` - اختبارات Webview

---

## 📚 المراجع والمصادر

### الوثائق:

- [VS Code Extension API](https://code.visualstudio.com/api)
- [MCP Protocol](https://modelcontextprotocol.io)
- [Anthropic API](https://docs.anthropic.com)
- [OpenAI API](https://platform.openai.com)

### المواقع:

- [Roo Code Website](https://roocode.com)
- [GitHub Repository](https://github.com/RooCodeInc/Roo-Code)
- [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=RooVeterinaryInc.roo-cline)

---

**عدد الأسطر في هذا التوثيق**: 387 سطر
**وقت القراءة التقريبي**: 7-10 دقائق

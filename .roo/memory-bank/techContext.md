# السياق التقني - التقنيات والبيئة التطوير

## التقنيات الأساسية

### الواجهة الخلفية (Extension)

- **Language**: TypeScript 5.8.3
- **Runtime**: Node.js 20.19.2
- **Package Manager**: pnpm 10.8.1
- **Build Tool**: Turbo 2.5.6 + esbuild

### الواجهة الأمامية (Webview)

- **Framework**: React
- **Styling**: Tailwind CSS
- **State Management**: React Context
- **i18n**: Custom i18n system

## بنية الحزم

```
packages:
  - "src"              # VS Code extension
  - "webview-ui"       # React webview
  - "apps/*"           # Applications
  - "packages/*"       # Shared packages
```

## التبعيات الرئيسية

### للتطوير

- ESLint 9.27.0
- Prettier 3.4.2
- Husky 9.1.7
- Changesets 2.27.10

### للإنتاج

- VS Code API
- OpenAI SDK compatible
- Multiple AI providers support
- MCP Protocol support

## أدوات التطوير

### الاختبارات

- Vitest framework
- React Testing Library

### الجودة

- Knip for linting
- Prettier for formatting
- Turbo for builds

## إعداد البيئة المحلية

```bash
git clone https://github.com/RooCodeInc/Roo-Code.git
cd Roo-Code
pnpm install
# للتجربة: F5 في VS Code
```

## القيود التقنية

- يتطلب Node.js 20+
- يعمل على VS Code 1.74+
- Windows/macOS/Linux مدعومين
- يتطلب الوصول للإنترنت للـ AI models

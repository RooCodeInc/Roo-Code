# CoStrict Commit Message 规范

我们遵循 Angular 规范，该规范对 Git commit 的格式有非常精确的规则，使提交历史更易于阅读。

符合 Angular 规范的 commit message 包含三个部分，分别是 **Header** 、**Body** 和 **Footer**，格式如下：

```
<type>[optional scope]: <description>
<BLANK LINE>
[optional body]
<BLANK LINE>
[optional footer(s)]
```

其中，**Header** 是必需的，**Body** 和 **Footer **可以省略。

以下是一个符合 Angular 规范的 commit message:

```
feat(config): add validation mode for JWT tokens

Add `validationMode` option to enforce strict JWT validation as per RFC 7519.
Default value 'loose' maintains backward compatibility.

Closes #392
BREAKING CHANGE: `legacyCheck` method removed
Use `secureValidate` with `{ validationMode: 'strict' }` instead.
Update config before v3.0 release.
```

注意提交信息中任意行的长度均不得超过 100 个字符。

接下来，我们详细看看 Angular 规范中 Commit Message 的三个部分。

## Header

Header 部分只有⼀⾏，包括三个字段：type（必选）、scope（可选）和 subject（必选）。

### type

它⽤来说明 commit 的类型，下面是常⻅ type。

- **feat**：新增功能
- **fix**：错误修复
- **perf**：性能优化的代码变更
- **style**：代码格式类的变更，比如删除空行等
- **refactor**：其他代码类的变更，这些变更不属于 feat、fix、perf 和 style，例如简化代码，重命名变量，删除冗余代码等
- **test**：补充缺失测试或修正现有测试
- **ci**：持续集成和部署相关的改动，比如修改 Jenkins、Gitlab CI 等 CI 配置文件或者更新 systemd unit 文件
- **docs**：文档变更
- **chore**： 其他类型，比如构建流程，依赖管理或者辅助工具的变动等
- **change**： 不兼容的改动

### scope。

scope 是⽤来说明 commit 的影响范围的，它必须是名词，这个没有具体的规定，可以根据修改内容自由填写。

注意 scope 必须⽤括号 () 括起来，后面紧跟冒号，冒号后必须紧跟空格。

### subject。

subject 是 commit 的简短描述，必须以动词开头、使⽤现在时。⽐如，我们可以⽤ change，却不能⽤
changed 或 changes，⽽且这个动词的第⼀个字⺟必须是⼩写。通过这个动词，我们可以明确地知道
commit 所执⾏的操作。此外我们还要注意，subject 的结尾不能加英⽂句号。

## Body

Body 部分是对本次 commit 的更详细描述，是可选的。

Body 部分可以分成多⾏，⽽且格式也⽐较⾃由。不过，和 Header ⾥的⼀样，它也要以动词开头，使⽤现
在时。此外，它还必须要包括修改的动机，以及和跟上⼀版本相⽐的改动点。

我们来看一个范例

```
Safari 15.4+ enforces stricter CORS policies for localStorage access,
causing intermittent auth failures. Added retry logic for token refresh.
```

## Footer

Footer 部分是可选的，主要⽤来说明本次 commit 导致的后果。在实际应⽤中，Footer 通常⽤来说明不兼容的改动和关闭的 Issue 列表，格式如下：

```
BREAKING CHANGE: <breaking change summary>
<BLANK LINE>
<breaking change description + migration instructions>
<BLANK LINE>
<BLANK LINE>
Fixes #<issue number>
```

接下来，我给你详细说明下这两种情况：

- 不兼容的改动：如果当前代码跟上⼀个版本不兼容，需要在 Footer 部分，以 BREAKING CHANG: 开头，
  后⾯跟上不兼容改动的摘要。Footer 的其他部分需要说明变动的描述、变动的理由和迁移⽅法，例如：

```
BREAKING CHANGE: Legacy token validation removed
The deprecated `auth.legacyCheck` method is no longer supported.
Migration: Use `auth.secureValidate` with JWT v2.0+ tokens and
set `{ validationMode: 'strict' }` in config.
```

- 关闭的 Issue 列表：关闭的 Bug 需要在 Footer 部分新建⼀⾏，并以 Closes 开头列出，例如：Closes
  #123。如果关闭了多个 Issue，可以这样列出：Closes #123, #432, #886。例如:

```
Safari 15.4+ enforces stricter CORS policies for localStorage access,
causing intermittent auth failures. Added retry logic for token refresh.

Closes #392
```

## Revert Commit

除了 Header、Body 和 Footer 这 3 个部分，Commit Message 还有⼀种特殊情况：如果当前 commit 还
原了先前的 commit，则应以 revert: 开头，后跟还原的 commit 的 Header。⽽且，在 Body 中必须写成
This reverts commit <hash> ，其中 hash 是要还原的 commit 的 SHA 标识。例如：

```
revert: feat: add 'Host' option
This reverts commit bb42d749a7d129db0546bf89a48f84ec127843ce.
```

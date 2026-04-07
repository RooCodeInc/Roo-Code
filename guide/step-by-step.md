План миграции: Нелинейное
управление контекстом (Conversation

## Tree Architecture)

Данный документ представляет собой пошаговое руководство для ИИ-агента по
миграции кодовой базы форка Jabberwock (ветка jebberwock-migration-2) на архитектуру
изолированных контекстов, графового управления состоянием и виртуальных файловых
систем.
План разбит на 4 фазы. Агент должен выполнять их строго последовательно, тестируя
каждый шаг перед переходом к следующему.
Фаза 1: Интеграция графового менеджера
состояний (Backend)
Цель: Заменить плоские массивы истории в памяти на строго типизированное дерево с
поддержкой сериализации и time-travel.
Шаг 1.1: Установка зависимостей и проектирование схем MST
Вам необходимо добавить базовые пакеты и создать модели MobX-State-Tree (MST) для
управления узлами графа (TaskNode) и сообщениями.
● Промпт для агента:
"Мы начинаем миграцию на Conversation Tree Architecture.

- Установи зависимости: npm install mobx mobx-state-tree.
- Создай файл src/core/state/ChatTreeStore.ts.
- Реализуй три модели с помощью types.model: Message (содержит role,
  content, toolCalls), TaskNode (содержит id, title, статус, массив сообщений и
  массив children через types.array(types.late(() => types.reference(TaskNode)))) и
  корневой ChatStore (хранит nodes: types.map(TaskNode) и activeNodeId).
- Добавь в ChatStore экшены createBranch(parentId, title) и
  switchContext(nodeId).
- Напиши простой unit-тест, проверяющий создание двух веток и переключение
  между ними. Не переходи к следующему шагу, пока тест не будет зеленым."
  ● Пример кода (ChatTreeStore.ts):
  TypeScript
  import { types } from "mobx-state-tree";

export const Message = types.model("Message", {
id: types.identifier,

role: types.string,
content: types.string,

## });

export const TaskNode = types.model("TaskNode", {
id: types.identifier,
title: types.string,
status: types.optional(types.enumeration(["pending", "in_progress", "completed",

## "failed"]), "pending"),

messages: types.array(Message),
children: types.array(types.late(() => types.reference(TaskNode))),
parentId: types.maybe(types.string)

## });

export const ChatStore = types.model("ChatStore", {
nodes: types.map(TaskNode),
activeNodeId: types.maybe(types.reference(TaskNode))

## }).actions(self => ({

createBranch(parentId: string | undefined, title: string, id: string) {
const node = TaskNode.create({ id, title, parentId });
self.nodes.put(node);
if (parentId && self.nodes.has(parentId)) {
self.nodes.get(parentId)!.children.push(node.id);

## }

return node;

## },

switchContext(nodeId: string) {
if (self.nodes.has(nodeId)) self.activeNodeId = nodeId;

## }

## }));

Шаг 1.2: Подключение MST к workspaceState VS Code
Необходимо обеспечить выживаемость графа при перезагрузке расширения.

## 1

Мы будем
использовать onSnapshot для сохранения и applySnapshot для восстановления.

## 2

● Промпт для агента:
"Открой src/core/webview/ClineProvider.ts (или класс, управляющий стейтом).

- Интегрируй созданный ChatStore.
- Используй метод onSnapshot(store, snapshot => {...}) из mobx-state-tree, чтобы
  при любом изменении графа сериализованный JSON сохранялся в
  context.workspaceState.update('jabberwock_chat_tree', snapshot).
- В методе инициализации провайдера читай этот ключ, и если он есть,
  используй applySnapshot(store, savedSnapshot), чтобы восстановить стейт.

- Проверь работоспособность: создай тестовую ветку, перезагрузи окно VS
  Code (Developer: Reload Window) и убедись, что ветка осталась в памяти."
  Фаза 2: Виртуальная изоляция файлов (Без Git

## Worktree)

Цель: Дать агентам возможность вносить деструктивные изменения и создавать
временные файлы, не ломая основную кодовую базу.
Шаг 2.1: Создание CoW (Copy-on-Write) файловой системы
Мы будем использовать memfs для виртуального слоя записи и unionfs для объединения
реального жесткого диска и виртуального слоя.
● Промпт для агента:"1. Установи зависимости: npm install memfs unionfs.

- Создай модуль src/core/fs/VirtualWorkspace.ts.
- Реализуй класс VirtualWorkspace, который создает инстанс Volume из memfs и
  объединяет его с реальным fs с помощью unionfs.
- Настрой логику так, чтобы чтение шло из unionfs (сначала ищет в памяти, потом на
  диске), а все инструменты редактирования файлов, вызываемые агентом (например,
  write_to_file, replace_in_file), писали СТРОГО в виртуальный Volume (memfs), а не на
  жесткий диск.
- Напиши скрипт-тест: создай виртуальный файл test.js, убедись, что он читается
  через виртуальный fs, но не существует на реальном жестком диске."
  ● Пример кода (VirtualWorkspace.ts):
  TypeScript
  import { Volume, createFsFromVolume } from 'memfs';
  import { ufs } from 'unionfs';
  import \* as fs from 'fs';

export class VirtualWorkspace {
public vol: InstanceType<typeof Volume>;
public overlayFs: typeof ufs;

constructor() {
this.vol = new Volume();
const virtualFs = createFsFromVolume(this.vol);

// Объединяем реальную ФС и виртуальную
this.overlayFs = ufs.use(fs).use(virtualFs as any);

## }

// Агент использует этот метод для записи (только в память)

async writeFile(path: string, content: string) {
return new Promise((resolve, reject) => {
this.vol.writeFile(path, content, (err) => err? reject(err) : resolve(true));

## });

## }

// Агент использует этот метод для чтения (из памяти или с диска)
async readFile(path: string) {
return new Promise((resolve, reject) => {
this.overlayFs.readFile(path, 'utf8', (err, data) => err? reject(err) : resolve(data));

## });

## }

## }

Шаг 2.2: Алгоритмический Rollback и Commit
При завершении задачи (ветки) нам нужно либо сбросить временные файлы, либо
перенести их на реальный диск.
● Промпт для агента:
"Расширь класс VirtualWorkspace двумя методами:

- rollback(): просто очищает инстанс Volume (например, this.vol.reset()),
  откатывая все изменения агента.
- commitToDisk(): проходит по всем файлам, измененным в this.vol, и физически
  записывает их на жесткий диск с помощью встроенного fs.
- Интегрируй вызов rollback() при пометке ветки статусом failed, и
  commitToDisk() при статусе completed в нашем ChatStore.
- Протестируй процесс отката изменений."
  Фаза 3: Маршрутизация контекста и MCP Инъекции
  Цель: Разделить контекст, реализовать алгоритмический Squash & Merge и настроить
  проброс системных переменных во внешние MCP.
  Шаг 3.1: Алгоритм Squash and Merge для истории сообщений
  Вместо переноса тысяч токенов из ветки субагента в главную ветку оркестратора, мы
  алгоритмически сжимаем результат.
  ● Промпт для агента:
  "Создай функцию squashAndMergeBranch(branchId: string, parentId: string) в
  сервисе управления задачами.
  Алгоритм работы:
- Собери все сообщения из ветки branchId.
- Выполни скрытый LLM-запрос (без показа в UI) с системным промптом:

'Сформируй краткий технический отчет о проделанной работе: измененные
файлы, новые зависимости. Исключи логи ошибок и процесс рассуждения.'

- Полученный ответ добавь как ЕДИНСТВЕННОЕ сообщение с ролью user или
  system (уведомление о завершении задачи) в ветку оркестратора parentId.
- Вызови ChatStore.switchContext(parentId) для возврата оркестратора к списку
  задач.
  Протестируй логику, имитируя длинную ветку."
  Шаг 3.2: Скрытая инъекция контекста \_meta в MCP инструменты
  Для работы внешнего todo-mcp (например, md-todo-mcp) без засорения промпта агента,
  мы используем механизм \_meta спецификации JSON-RPC.
  ● Промпт для агента:
  "Найди место, где расширение вызывает инструменты MCP (обычно это метод
  callTool у ClientSession).
  Согласно спецификации MCP, мы можем передавать скрытые системные
  переменные через поле \_meta.
- Перехвати вызов инструмента до отправки на сервер.
- Добавь объект meta в запрос, вложив туда: workspacePath, activeAgentRole
  (например, 'orchestrator' или 'debugger'), и activeTaskId.
- Убедись, что сам LLM-агент не видит эти переменные в своем JSON Schema
  описании инструмента — они инжектируются алгоритмически на уровне
  транспортного клиента расширения.
  Проверь, доходят ли метаданные до MCP сервера."
  ● Пример кода (перехватчик MCP клиента):
  TypeScript
  // В месте вызова MCP-тула:
  async callMcpTool(serverName: string, toolName: string, arguments: any) {
  const activeNode = store.activeNodeId;

// Инъекция скрытого контекста через \_meta
const result = await mcpClient.callTool(toolName, arguments, {
meta: {
workspacePath: vscode.workspace.workspaceFolders?..uri.fsPath,
activeTaskId: activeNode?.id,
agentRole: currentAgentRole

## }

## });

return result;

## }

Фаза 4: Транзакционная память (Human-in-the-loop)
Цель: Разрешить пользователю корректировать сгенерированный оркестратором
Todo-лист так, чтобы оркестратор считал эти правки своими собственными (защита
мета-осознанности).
Шаг 4.1: Переписывание графа памяти (Memory Rewrite

## Transaction)

Если агент сгенерировал плохой план, а пользователь его поправил, мы должны
использовать MST для перезаписи истории, убрав ошибку модели.
● Промпт для агента:
"Добавь в ChatStore экшен rewriteAssistantMessage(messageId: string,
newContent: string).

- Алгоритм должен находить сообщение ассистента по ID.
- Поскольку мы используем MobX-State-Tree, простое изменение
  message.content = newContent сгенерирует JSON-patch и автоматически
  обновит стейт.

## 2

- Если пользователь через UI редактирует план задач перед запуском, вызывай
  этот экшен.
- При следующем обращении к LLM отправляй историю, в которой ответ
  ассистента уже содержит идеальный (отредактированный человеком) план.
  Убедись, что модель продолжает диалог, опираясь на исправленный текст, не
  подозревая о вмешательстве."
  Шаг 4.2: Алгоритмический перехват делегирования (Deterministic

## Routing)

Запретить LLM напрямую вызывать агентов, если пользователь явно указал другого
исполнителя в Todo.
● Промпт для агента:"1. Удали из системного промпта оркестратора инструменты
прямого вызова других агентов (call_agent).

- Замени их на инструмент delegate_task(task_id, target_role).
- В обработчике этого инструмента в Node.js добавьте проверку (Хук): если
  target_role не совпадает с ролью, утвержденной человеком для этого пункта в
  Todo-листе (данные берем из внешнего MCP или стейта), верните ошибку
  инструмента LLM: 'Делегирование отклонено: ожидался исполнитель [role]'.
- Это заставит модель алгоритмически подчиняться роутингу, заданному
  человеком. Реализуй этот хук проверки."
  Следуя этому гранулированному плану, вы сможете поэтапно внедрить MST, виртуальную
  файловую систему и механизмы слияния контекстов, получив надежную и
  масштабируемую архитектуру.

## Источники

- Roo-Code/src/core/webview/ClineProvider.ts at main - GitHub, дата последнего
  обращения: апреля 6, 2026,
  https://github.com/RooCodeInc/Roo-Code/blob/main/src/core/webview/ClineProv
  ider.ts
- Getting Started Tutorial - MobX-state-tree, дата последнего обращения:
  апреля 6, 2026, https://mobx-state-tree.js.org/intro/getting-started

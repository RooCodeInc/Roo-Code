# Hook System Architecture Diagrams

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    VS Code Extension                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐         ┌──────────────┐                  │
│  │ Extension.ts │────────▶│ HookManager │                  │
│  │  (Activate)  │         │  (Singleton) │                  │
│  └──────────────┘         └──────────────┘                  │
│         │                        │                           │
│         │                        │                           │
│         ▼                        ▼                           │
│  ┌──────────────┐         ┌──────────────┐                  │
│  │ ClineProvider│         │ Lifecycle    │                  │
│  │              │         │ Hooks        │                  │
│  └──────────────┘         └──────────────┘                  │
│         │                        │                           │
│         │                        │                           │
│         ▼                        ▼                           │
│  ┌──────────────┐         ┌──────────────┐                  │
│  │    Task      │         │ Event Hooks  │                  │
│  │   System     │         │              │                  │
│  └──────────────┘         └──────────────┘                  │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Hook Registration Flow

```
┌─────────────┐
│   Hook      │
│  Consumer   │
└──────┬──────┘
       │
       │ createHook()
       ▼
┌─────────────┐
│ createHook()│
│   Factory   │
└──────┬──────┘
       │
       │ registerLifecycleHook()
       │ registerEventHook()
       ▼
┌─────────────┐
│ HookManager │
│  (Singleton)│
└──────┬──────┘
       │
       │ Store Registration
       ▼
┌─────────────┐
│   Hooks     │
│   Storage   │
│  (Maps)     │
└─────────────┘
```

## Hook Execution Flow

```
┌─────────────────┐
│ Extension Event │
│  or Lifecycle   │
└────────┬────────┘
         │
         │ executeLifecycleHook()
         │ executeEventHook()
         ▼
┌─────────────────┐
│  HookManager    │
│  Execution     │
└────────┬────────┘
         │
         │ Get Hooks by Stage/Event
         ▼
┌─────────────────┐
│ Sort by Priority│
│ (Critical → Low)│
└────────┬────────┘
         │
         │ Execute in Order
         ▼
┌─────────────────┐
│   Hook 1        │──┐
│   (Critical)    │  │
└─────────────────┘  │
         │           │ Sequential
         ▼           │ Execution
┌─────────────────┐  │
│   Hook 2        │  │
│   (High)        │  │
└─────────────────┘  │
         │           │
         ▼           │
┌─────────────────┐  │
│   Hook 3        │  │
│   (Normal)       │  │
└─────────────────┘  │
         │           │
         ▼           │
┌─────────────────┐  │
│   Hook 4        │◀─┘
│   (Low)         │
└─────────────────┘
```

## Hook Priority System

```
Priority Levels (Execution Order):

┌─────────────┐
│  Critical   │ ← Executes First
│  Priority   │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│    High     │
│  Priority   │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Normal    │ ← Default
│  Priority   │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│     Low     │ ← Executes Last
│  Priority   │
└─────────────┘
```

## Lifecycle Hooks Timeline

```
Extension Lifecycle:

┌─────────────────────────────────────────────────────────────┐
│                                                               │
│  BeforeActivate                                              │
│  ┌──────────────┐                                           │
│  │ Critical Init │                                           │
│  │ Security Check│                                           │
│  └──────────────┘                                           │
│                                                               │
│  ─────────────────────────────────────────────────────────── │
│                                                               │
│  Extension Activation                                        │
│  ─────────────────────────────────────────────────────────── │
│                                                               │
│  AfterActivate                                               │
│  ┌──────────────┐                                           │
│  │ Service Init │                                           │
│  │ Registration │                                           │
│  └──────────────┘                                           │
│                                                               │
│  ─────────────────────────────────────────────────────────── │
│                                                               │
│  Extension Running                                           │
│  ─────────────────────────────────────────────────────────── │
│                                                               │
│  BeforeDeactivate                                            │
│  ┌──────────────┐                                           │
│  │ Cleanup Prep │                                           │
│  │ State Save   │                                           │
│  └──────────────┘                                           │
│                                                               │
│  ─────────────────────────────────────────────────────────── │
│                                                               │
│  Extension Deactivation                                      │
│  ─────────────────────────────────────────────────────────── │
│                                                               │
│  AfterDeactivate                                             │
│  ┌──────────────┐                                           │
│  │ Final Cleanup│                                           │
│  │ Resource Free │                                           │
│  └──────────────┘                                           │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Event Hook Flow

```
┌──────────────┐
│   Task       │
│   Created    │
└──────┬───────┘
       │
       │ Emit Event
       ▼
┌──────────────┐
│ HookManager  │
│ executeEvent │
│    Hook      │
└──────┬───────┘
       │
       │ Get Registered Hooks
       ▼
┌──────────────┐
│ Event Hooks  │
│ for Task     │
│ Created      │
└──────┬───────┘
       │
       │ Execute in Priority Order
       ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Hook: Log    │  │ Hook: Track  │  │ Hook: Notify │
│ Task Created │  │ Analytics    │  │ User         │
└──────────────┘  └──────────────┘  └──────────────┘
```

## Hook Data Flow

```
┌──────────────┐
│   Context    │
│  (Extension  │
│   Context,   │
│   Output     │
│   Channel)   │
└──────┬───────┘
       │
       │ Passed to All Hooks
       ▼
┌──────────────┐
│   Hook 1     │──┐
│   Callback   │  │
└──────────────┘  │
       │          │
       ▼          │
┌──────────────┐  │
│   Hook 2     │  │ Same Context
│   Callback   │  │ Different Data
└──────────────┘  │
       │          │
       ▼          │
┌──────────────┐  │
│   Hook 3     │◀─┘
│   Callback   │
└──────────────┘
```

## Error Handling Flow

```
┌──────────────┐
│ Hook Execution│
└──────┬───────┘
       │
       │ Try
       ▼
┌──────────────┐
│ Execute Hook │
│  Callback    │
└──────┬───────┘
       │
       │ Success / Error
       ▼
┌──────────────┐
│   Error?     │
└───┬──────┬───┘
    │      │
    │ Yes  │ No
    ▼      ▼
┌──────────────┐  ┌──────────────┐
│ Log Error    │  │ Continue to  │
│ to Output    │  │ Next Hook    │
│ Channel      │  │              │
└──────────────┘  └──────────────┘
```

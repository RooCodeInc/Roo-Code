# CLI Performance Baseline: Ink UI

**Issue:** [#11705](https://github.com/RooCodeInc/Roo-Code/issues/11705)
**Date:** 2026-02-22
**Purpose:** Establish baseline performance metrics for the current Ink-based CLI UI to enable comparison with OpenTUI prototype.

## Methodology

Measurements should be taken on a standardized environment:
- **Hardware:** Modern laptop/desktop (Apple M-series or equivalent x86_64)
- **Node.js:** v22 LTS
- **Terminal:** iTerm2 (macOS), GNOME Terminal (Linux), Windows Terminal (Windows)
- **Measurement tool:** `process.hrtime.bigint()` instrumentation, `node --cpu-prof`, `node --heap-prof`

Each metric should be measured across 10 runs with the median reported.

## Metrics

### 1. Startup Time

Time from process start to first UI frame rendered.

| Metric | Description | Target Measurement |
|--------|-------------|-------------------|
| Cold start | First run after clearing module cache | `process.hrtime` from entry to first Ink `render()` call |
| Warm start | Subsequent runs with module cache | Same as above |
| TTY detection | Time to determine TUI vs non-TUI mode | `run.ts` TTY check to renderer selection |
| React hydration | Time for React/Ink to initialize component tree | Ink `render()` call to first `useEffect` fire |

**Expected baseline (Ink):**
- Cold start: ~300-500ms (includes module loading, React init, Ink renderer setup)
- Warm start: ~150-250ms
- TTY detection: <1ms (synchronous `process.stdin.isTTY` check)

### 2. Input Latency

Time from keypress to visible UI update.

| Metric | Description | Target Measurement |
|--------|-------------|-------------------|
| Single character | Typing a character in the input field | Keypress event to re-render completion |
| Backspace | Deleting a character | Same as above |
| Cursor navigation | Arrow key movement | Keypress to cursor position update |
| Autocomplete trigger | Typing `@` or `/` to open autocomplete | Keypress to picker display |
| Autocomplete selection | Selecting an item from picker | Enter key to picker close + text insert |

**Expected baseline (Ink):**
- Single character input: ~8-16ms (Ink batches renders at ~60fps)
- Autocomplete trigger: ~16-32ms (state update + picker render)
- Selection: ~16ms (state update + re-render)

### 3. Render Cadence

Frame timing for continuous updates (e.g., streaming AI responses).

| Metric | Description | Target Measurement |
|--------|-------------|-------------------|
| Idle render rate | Renders per second when no updates | Should be 0 (Ink only renders on state change) |
| Streaming render rate | Renders per second during message streaming | Ink throttled to ~30fps by default |
| Scroll render rate | Renders during scroll through history | Depends on `ScrollArea` implementation |
| Max render time | Longest single render cycle | `console.time` around render function |

**Expected baseline (Ink):**
- Idle: 0 renders/sec (event-driven)
- Streaming: ~15-30 renders/sec (Ink's internal throttle)
- Scroll: ~30 renders/sec
- Max render time: <16ms for typical content, <50ms for large message histories

### 4. Memory Usage

Heap consumption across different UI states.

| Metric | Description | Target Measurement |
|--------|-------------|-------------------|
| Baseline heap | Memory after initial render with empty chat | `process.memoryUsage().heapUsed` |
| After 10 messages | Heap after 10 chat messages rendered | Same |
| After 100 messages | Heap after 100 chat messages with scroll | Same |
| Peak heap | Maximum heap during heavy rendering | `--max-old-space-size` monitoring |
| GC pressure | Frequency and duration of garbage collection | `--trace-gc` flag |

**Expected baseline (Ink):**
- Baseline heap: ~30-50MB (React + Ink + Zustand + component tree)
- After 10 messages: ~40-60MB
- After 100 messages: ~60-100MB (depends on message content size)
- Peak heap: ~80-120MB during rapid streaming

### 5. Bundle Size

Size of the built CLI artifact.

| Metric | Description | Target Measurement |
|--------|-------------|-------------------|
| Total bundle | Size of `dist/index.js` | `ls -la dist/index.js` |
| Ink dependency tree | Size of ink + react + @inkjs/ui in node_modules | `du -sh` on relevant directories |
| UI-specific code | Size of `apps/cli/src/ui/` source | `find ... -exec wc -c` |

**Current measurements:**
- UI source: 69 files, 10,619 LOC
- Key dependencies: `ink` (6.6.0), `react` (19.1.0), `@inkjs/ui` (2.0.0), `zustand` (5.0.0)

## Instrumentation Plan

To collect these metrics, the following instrumentation should be added:

### Phase 1: Non-invasive (no code changes)

```bash
# Startup time
time node dist/index.js --help

# Memory baseline
node --expose-gc --max-old-space-size=256 dist/index.js --print "hello"

# CPU profile
node --cpu-prof dist/index.js --print "hello"

# Heap snapshot
node --heap-prof dist/index.js --print "hello"
```

### Phase 2: Instrumented (minimal code changes)

Add timing markers at key points in the render pipeline:

1. `run.ts` -- Process start timestamp
2. `App.tsx` -- First render timestamp (via `useEffect`)
3. `MultilineTextInput.tsx` -- Input event to render completion
4. `ScrollArea.tsx` -- Scroll render timing
5. `ChatHistoryItem.tsx` -- Message render timing

### Phase 3: Automated benchmark suite

Create a benchmark script that:
1. Launches the CLI in TUI mode with a mock backend
2. Simulates keypress sequences
3. Records render timings via process instrumentation
4. Outputs a JSON report for comparison

## Terminal Compatibility Matrix

| Terminal | OS | ANSI Support | 256 Color | True Color | Unicode | Mouse | Notes |
|----------|-----|-------------|-----------|------------|---------|-------|-------|
| iTerm2 | macOS | Full | Yes | Yes | Yes | Yes | Primary dev terminal |
| Terminal.app | macOS | Full | Yes | Limited | Yes | No | Default macOS terminal |
| GNOME Terminal | Linux | Full | Yes | Yes | Yes | Yes | Default Ubuntu/GNOME |
| Windows Terminal | Windows | Full | Yes | Yes | Yes | Yes | Modern Windows default |
| tmux | Cross-platform | Full | Yes | Varies | Yes | Yes | Needs `TERM=xterm-256color` |
| VS Code Terminal | Cross-platform | Full | Yes | Yes | Yes | Yes | Common dev environment |
| Alacritty | Cross-platform | Full | Yes | Yes | Yes | Yes | GPU-accelerated |
| Warp | macOS | Full | Yes | Yes | Yes | Yes | Modern terminal |

### Known Issues

- **tmux:** True color support requires `set -g default-terminal "tmux-256color"` in tmux.conf
- **Terminal.app:** No true color support; falls back to 256 color palette
- **Older Windows cmd.exe:** Not supported (use Windows Terminal instead)
- **SSH sessions:** Terminal capabilities depend on client terminal, not server

## Comparison Framework

When OpenTUI prototype is ready, compare using this template:

| Metric | Ink Baseline | OpenTUI Prototype | Delta | Notes |
|--------|-------------|-------------------|-------|-------|
| Cold start | ___ ms | ___ ms | ___% | |
| Warm start | ___ ms | ___ ms | ___% | |
| Input latency | ___ ms | ___ ms | ___% | |
| Streaming FPS | ___ fps | ___ fps | ___% | |
| Baseline heap | ___ MB | ___ MB | ___% | |
| Bundle size | ___ MB | ___ MB | ___% | |

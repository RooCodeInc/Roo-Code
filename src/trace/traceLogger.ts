import * as fs from 'fs';
import * as path from 'path';
import { TraceRecord } from './traceTypes';

const TRACE_FILE = path.join('.orchestration', 'agent_trace.jsonl');

export class TraceLogger {
  private filePath: string;

  constructor(filePath?: string) {
    this.filePath = filePath || TRACE_FILE;
    this.ensureTraceFile();
  }

  private ensureTraceFile() {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(this.filePath)) fs.writeFileSync(this.filePath, '');
  }

  public log(trace: TraceRecord) {
    const line = JSON.stringify(trace);
    fs.appendFileSync(this.filePath, line + '\n', { encoding: 'utf-8' });
  }

  public readAll(): TraceRecord[] {
    if (!fs.existsSync(this.filePath)) return [];
    const content = fs.readFileSync(this.filePath, 'utf-8');
    return content
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as TraceRecord);
  }
}

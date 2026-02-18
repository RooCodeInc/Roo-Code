import fs from "fs";
import path from "path";

type LockFile = {
  intentId: string;
  owner: string;
  timestamp: number;
  ttlMs: number;
};

export class IntentLockManager {
  private lockDir: string;

  constructor(lockDir?: string) {
    this.lockDir = lockDir ?? path.resolve(".orchestration/locks");
  }

  private getLockPath(intentId: string): string {
    const base = `intent-${intentId}.lock`;
    return path.join(this.lockDir, base);
  }

  private async ensureDir(): Promise<void> {
    await fs.promises.mkdir(this.lockDir, { recursive: true });
  }

  async isLocked(intentId: string): Promise<boolean> {
    const lockPath = this.getLockPath(intentId);
    try {
      await fs.promises.access(lockPath, fs.constants.F_OK);
      const raw = await fs.promises.readFile(lockPath, "utf8");
      const data = JSON.parse(raw) as LockFile;
      if (Date.now() - data.timestamp > data.ttlMs) {
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  async acquire(intentId: string, owner: string, ttlMs: number = 300_000): Promise<boolean> {
    await this.ensureDir();
    const lockPath = this.getLockPath(intentId);
    const payload: LockFile = {
      intentId,
      owner,
      timestamp: Date.now(),
      ttlMs,
    };

    try {
      await fs.promises.writeFile(lockPath, JSON.stringify(payload), { flag: "wx" });
      return true;
    } catch (err: any) {
      if (err?.code !== "EEXIST") return false;
      try {
        const raw = await fs.promises.readFile(lockPath, "utf8");
        const existing = JSON.parse(raw) as LockFile;
        const expired = Date.now() - existing.timestamp > existing.ttlMs;
        if (!expired) return false;
        await fs.promises.writeFile(lockPath, JSON.stringify(payload), { flag: "w" });
        return true;
      } catch {
        return false;
      }
    }
  }

  async release(intentId: string, owner: string): Promise<boolean> {
    const lockPath = this.getLockPath(intentId);
    try {
      const raw = await fs.promises.readFile(lockPath, "utf8");
      const data = JSON.parse(raw) as LockFile;
      if (data.owner !== owner) return false;
      await fs.promises.unlink(lockPath);
      return true;
    } catch {
      return false;
    }
  }
}

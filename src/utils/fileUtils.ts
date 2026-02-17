// src/utils/fileUtils.ts

import * as fs from "fs";
import * as path from "path";

/**
 * Utility functions for reading and writing files safely
 * within the VS Code extension context.
 */

export class FileUtils {
  /**
   * Reads a file asynchronously and returns its content as string
   */
  static async readFile(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      fs.readFile(filePath, { encoding: "utf-8" }, (err, data) => {
        if (err) reject(err);
        else resolve(data);
      });
    });
  }

  /**
   * Writes content to a file asynchronously, creating parent directories if needed
   */
  static async writeFile(filePath: string, content: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const dir = path.dirname(filePath);
      fs.mkdir(dir, { recursive: true }, (err) => {
        if (err) return reject(err);
        fs.writeFile(filePath, content, { encoding: "utf-8" }, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });
  }

  /**
   * Checks if a file exists
   */
  static exists(filePath: string): boolean {
    return fs.existsSync(filePath);
  }

  /**
   * Appends content to a file, creating it if it doesn't exist
   */
  static async appendToFile(filePath: string, content: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const dir = path.dirname(filePath);
      fs.mkdir(dir, { recursive: true }, (err) => {
        if (err) return reject(err);
        fs.appendFile(filePath, content, { encoding: "utf-8" }, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });
  }
}

// src/utils/jsonlWriter.ts

import { FileUtils } from "./fileUtils";

/**
 * Utility to write JSON objects to a JSONL (JSON Lines) file.
 * Each object is serialized into one line.
 */
export class JSONLWriter {
  /**
   * Appends a JSON object as a single line to a JSONL file
   * @param filePath The path to the .jsonl file
   * @param obj The object to append
   */
  static async appendObject(filePath: string, obj: any): Promise<void> {
    const line = JSON.stringify(obj) + "\n";
    await FileUtils.appendToFile(filePath, line);
  }

  /**
   * Reads all JSON objects from a JSONL file
   * @param filePath The path to the .jsonl file
   * @returns Array of parsed JSON objects
   */
  static async readAll(filePath: string): Promise<any[]> {
    if (!FileUtils.exists(filePath)) return [];

    const content = await FileUtils.readFile(filePath);
    return content
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line));
  }
}

import fs from "node:fs";
import path from "node:path";

export type LogLevel = "info" | "success" | "warn" | "error" | "debug" | "raw";

export interface LoggerOptions {
  logDir?: string;
  maxSizeBytes?: number; // Rotate when single file exceeds this (default 10MB)
  maxRetentionDays?: number; // Keep logs for N days (default 14)
}

const ANSI_COLORS = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  gray: "\x1b[90m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  magenta: "\x1b[35m",
  blue: "\x1b[34m",
  bgCyan: "\x1b[46m\x1b[30m",
  bgGreen: "\x1b[42m\x1b[30m",
  bgYellow: "\x1b[43m\x1b[30m",
  bgRed: "\x1b[41m\x1b[37m",
  bgMagenta: "\x1b[45m\x1b[37m",
  bgBlue: "\x1b[44m\x1b[37m",
};

const STRIP_ANSI_REGEX = /\x1b\[[0-9;]*m/g;

export class RotatingLogger {
  private logDir: string;
  private maxSizeBytes: number;
  private maxRetentionDays: number;

  constructor(options: LoggerOptions = {}) {
    this.logDir = options.logDir || path.resolve(process.cwd(), "logs");
    this.maxSizeBytes = options.maxSizeBytes || 10 * 1024 * 1024; // 10MB
    this.maxRetentionDays = options.maxRetentionDays || 14;

    this.ensureLogDir();
  }

  private ensureLogDir() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private getFormattedDate(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  private getFormattedTimestamp(): string {
    const now = new Date();
    const time = now.toTimeString().split(" ")[0];
    const ms = String(now.getMilliseconds()).padStart(3, "0");
    return `${this.getFormattedDate()} ${time}.${ms}`;
  }

  /**
   * Resolves the log file path, rotating if size limit is exceeded.
   */
  private getLogFilePath(prefix: string = "app"): string {
    const dateStr = this.getFormattedDate();
    let index = 0;
    let filePath = path.join(this.logDir, `${prefix}-${dateStr}.log`);

    while (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      if (stats.size < this.maxSizeBytes) {
        break;
      }
      index++;
      filePath = path.join(this.logDir, `${prefix}-${dateStr}.${index}.log`);
    }

    return filePath;
  }

  /**
   * Write raw line to rotating file and prune older logs.
   */
  private writeToFile(prefix: string, content: string) {
    try {
      this.ensureLogDir();
      const filePath = this.getLogFilePath(prefix);
      const cleanLine = content.replace(STRIP_ANSI_REGEX, "") + "\n";
      fs.appendFileSync(filePath, cleanLine, "utf-8");

      // Periodic cleanup of old logs (10% chance per write)
      if (Math.random() < 0.1) {
        this.cleanOldLogs();
      }
    } catch (err) {
      console.error("Failed to write to log file:", err);
    }
  }

  /**
   * Prunes log files older than maxRetentionDays.
   */
  private cleanOldLogs() {
    try {
      const files = fs.readdirSync(this.logDir);
      const now = Date.now();
      const maxAgeMs = this.maxRetentionDays * 24 * 60 * 60 * 1000;

      for (const file of files) {
        if (!file.endsWith(".log")) continue;
        const fullPath = path.join(this.logDir, file);
        const stats = fs.statSync(fullPath);
        if (now - stats.mtimeMs > maxAgeMs) {
          fs.unlinkSync(fullPath);
        }
      }
    } catch {}
  }

  private formatMeta(meta: any[]): string {
    if (!meta || meta.length === 0) return "";
    return meta
      .map((item) => {
        if (typeof item === "object" && item !== null) {
          return JSON.stringify(item, null, 2);
        }
        return String(item);
      })
      .join(" ");
  }

  private getBadge(level: LogLevel): string {
    switch (level) {
      case "info":
        return `${ANSI_COLORS.bgCyan} INFO ${ANSI_COLORS.reset}`;
      case "success":
        return `${ANSI_COLORS.bgGreen} SUCCESS ${ANSI_COLORS.reset}`;
      case "warn":
        return `${ANSI_COLORS.bgYellow} WARN ${ANSI_COLORS.reset}`;
      case "error":
        return `${ANSI_COLORS.bgRed} ERROR ${ANSI_COLORS.reset}`;
      case "debug":
        return `${ANSI_COLORS.bgMagenta} DEBUG ${ANSI_COLORS.reset}`;
      case "raw":
        return `${ANSI_COLORS.bgBlue} AI-RAW ${ANSI_COLORS.reset}`;
    }
  }

  private log(level: LogLevel, message: string, ...meta: any[]) {
    const timestamp = this.getFormattedTimestamp();
    const timeStr = `${ANSI_COLORS.gray}[${timestamp}]${ANSI_COLORS.reset}`;
    const badge = this.getBadge(level);
    const metaStr = this.formatMeta(meta);

    const consoleOutput = `${timeStr} ${badge} ${message} ${metaStr}`.trimEnd();
    const fileOutput = `[${timestamp}] [${level.toUpperCase()}] ${message} ${metaStr}`.trimEnd();

    // Print to console
    if (level === "error") {
      console.error(consoleOutput);
    } else if (level === "warn") {
      console.warn(consoleOutput);
    } else {
      console.log(consoleOutput);
    }

    // Write to system rotating log
    this.writeToFile("system", fileOutput);
  }

  public info(message: string, ...meta: any[]) {
    this.log("info", message, ...meta);
  }

  public success(message: string, ...meta: any[]) {
    this.log("success", message, ...meta);
  }

  public warn(message: string, ...meta: any[]) {
    this.log("warn", message, ...meta);
  }

  public error(message: string, ...meta: any[]) {
    this.log("error", message, ...meta);
  }

  public debug(message: string, ...meta: any[]) {
    this.log("debug", message, ...meta);
  }

  /**
   * Specifically for raw AI responses: logs summary cleanly to console
   * while saving full raw JSON into rotating files.
   */
  public raw(title: string, rawData: any) {
    const timestamp = this.getFormattedTimestamp();
    const timeStr = `${ANSI_COLORS.gray}[${timestamp}]${ANSI_COLORS.reset}`;
    const badge = this.getBadge("raw");

    // Extract quick high-level summary if it's an OpenAI chat completion
    const model = rawData?.model || "Unknown Model";
    const tokens = rawData?.usage
      ? `(Prompt: ${rawData.usage.prompt_tokens}, Completion: ${rawData.usage.completion_tokens}, Total: ${rawData.usage.total_tokens})`
      : "";
    const id = rawData?.id ? `[ID: ${rawData.id}]` : "";

    // Pretty summary for terminal
    console.log(
      `${timeStr} ${badge} ${ANSI_COLORS.bold}${title}${ANSI_COLORS.reset} ${ANSI_COLORS.cyan}${model}${ANSI_COLORS.reset} ${ANSI_COLORS.gray}${tokens} ${id}${ANSI_COLORS.reset}`
    );

    // Write full raw payload exclusively to rotating logs/raw-YYYY-MM-DD.log
    const fullJson =
      typeof rawData === "object"
        ? JSON.stringify(rawData, null, 2)
        : String(rawData);
    const fileEntry = `[${timestamp}] [RAW-AI] ${title} ${model} ${id}\n${fullJson}\n----------------------------------------`;

    this.writeToFile("raw", fileEntry);
  }
}

// Export singleton instance for immediate use
export const logger = new RotatingLogger();

type LogLevel = "info" | "warn" | "error" | "debug";

import { env } from "@/env";

const isProduction = env.NODE_ENV === "production";

class Logger {
  static log(level: LogLevel, message: string, data?: unknown) {
    if (isProduction && level === "debug") return;

    const timestamp = new Date().toISOString();
    const payload = {
      timestamp,
      level,
      message,
      data:
        data instanceof Error
          ? { message: data.message, stack: data.stack }
          : data,
    };

    // In production, use structured JSON logging
    // In development, keep readable console output
    if (isProduction) {
      const logEntry = JSON.stringify(payload);
      switch (level) {
        case "error":
          console.error(logEntry);
          break;
        case "warn":
          console.warn(logEntry);
          break;
        case "info":
        case "debug":
          console.log(logEntry);
          break;
      }
    } else {
      // Development readable format
      const prefix = `[${level.toUpperCase()}]`;
      const args = data ? [message, data] : [message];

      switch (level) {
        case "error":
          console.error(prefix, ...args);
          break;
        case "warn":
          console.warn(prefix, ...args);
          break;
        case "info":
          console.info(prefix, ...args);
          break;
        case "debug":
          console.debug(prefix, ...args);
          break;
      }
    }
  }

  static info(message: string, data?: unknown) {
    this.log("info", message, data);
  }

  static warn(message: string, data?: unknown) {
    this.log("warn", message, data);
  }

  static error(message: string, error?: unknown) {
    this.log("error", message, error);
  }

  static debug(message: string, data?: unknown) {
    this.log("debug", message, data);
  }
}

export default Logger;

type LogLevel = "info" | "warn" | "error" | "debug";

const isProduction = process.env.NODE_ENV === "production";

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

    // In production, this would send to Sentry/Datadog
    // For now, we sanitize console output
    switch (level) {
      case "error":
        console.error(JSON.stringify(payload));
        break;
      case "warn":
        console.warn(JSON.stringify(payload));
        break;
      case "info":
        console.info(`[INFO] ${message}`, data || "");
        break;
      case "debug":
        console.debug(`[DEBUG] ${message}`, data || "");
        break;
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

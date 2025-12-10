export function safeGetItem(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    // Accessing localStorage property can throw SecurityError in some iframe/privacy contexts
    const storage = window.localStorage;
    return storage.getItem(key);
  } catch (e) {
    // Suppress warning to keep console clean in restricted environments
    return null;
  }
}

export function safeSetItem(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    const storage = window.localStorage;
    storage.setItem(key, value);
  } catch (e) {
    // Ignore write errors (e.g. quota exceeded or access denied)
  }
}

export function safeRemoveItem(key: string): void {
  if (typeof window === "undefined") return;
  try {
    const storage = window.localStorage;
    storage.removeItem(key);
  } catch (e) {
    // Ignore
  }
}

// Fallback en memoria por si el localStorage está bloqueado
const memStorage: Record<string, string> = {};

// Helper de Cookies Simple
const setCookie = (name: string, value: string, days = 7) => {
  if (typeof document === "undefined") return;
  const date = new Date();
  date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
  const expires = "; expires=" + date.toUTCString();
  document.cookie =
    name +
    "=" +
    (encodeURIComponent(value) || "") +
    expires +
    "; path=/; SameSite=Lax";
};

const getCookie = (name: string) => {
  if (typeof document === "undefined") return null;
  const nameEQ = name + "=";
  const ca = document.cookie.split(";");
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === " ") c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0)
      return decodeURIComponent(c.substring(nameEQ.length, c.length));
  }
  return null;
};

const eraseCookie = (name: string) => {
  if (typeof document === "undefined") return;
  document.cookie = name + "=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;";
};

export function safeGetItem(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    // Si falla el acceso nativo, buscar en memoria
    if (memStorage[key]) return memStorage[key];
    // Si no está en memoria, buscar en cookies (Persistencia F5)
    return getCookie(key);
  }
}

export function safeSetItem(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Fallback a memoria y cookies
    memStorage[key] = value;
    // Intentar guardar en cookie también para persistencia
    try {
      setCookie(key, value);
    } catch (cookieErr) {
      console.warn("Storage and Cookies blocked", cookieErr);
    }
  }
}

export function safeRemoveItem(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    delete memStorage[key];
    eraseCookie(key);
  }
}

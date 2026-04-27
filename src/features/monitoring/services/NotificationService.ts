/**
 * NotificationService
 * Encapsulates the logic for Browser System Notifications.
 */
export class NotificationService {
  private static instance: NotificationService;

  private constructor() {
    this.requestPermission();
  }

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  public async requestPermission(): Promise<NotificationPermission> {
    if (!("Notification" in window)) {
      console.warn("Este navegador no soporta notificaciones de escritorio");
      return "denied";
    }

    if (Notification.permission === "default") {
      return await Notification.requestPermission();
    }

    return Notification.permission;
  }

  public notify(
    title: string,
    options?: NotificationOptions,
  ): Notification | null {
    if (!("Notification" in window) || Notification.permission !== "granted") {
      return null;
    }

    try {
      return new Notification(title, {
        icon: "/web-app-manifest-192x192.png",
        ...options,
      });
    } catch (error) {
      console.error("Error al enviar notificación del sistema:", error);
      return null;
    }
  }
}

export const notificationService =
  typeof window !== "undefined" ? NotificationService.getInstance() : null;

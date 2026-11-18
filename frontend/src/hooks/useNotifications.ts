import { useState, useEffect } from "react";
import {
  dismissAll as storeDismissAll,
  dismissNotification as storeDismiss,
  getNotifications,
  markAllRead as storeMarkAllRead,
  subscribe,
} from "../utils/notificationStore";
import type { AppNotification } from "../utils/notificationStore";

export function useNotifications() {
  const [notifications, setNotifications] =
    useState<AppNotification[]>(getNotifications);

  useEffect(() => {
    const unsubscribe = subscribe((updated) => {
      setNotifications(updated);
    });
    return unsubscribe;
  }, []);

  function dismiss(id: string): void {
    storeDismiss(id);
  }

  function dismissAll(): void {
    storeDismissAll();
  }

  function markAllRead(): void {
    storeMarkAllRead();
  }

  return { notifications, dismiss, dismissAll, markAllRead };
}

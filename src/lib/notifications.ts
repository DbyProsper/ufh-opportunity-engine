export interface NotificationUpdate {
  id: string;
  read_at: string | null;
}

export interface NotificationLike {
  id: string;
  read_at: string | null;
}

export const applyNotificationUpdates = <T extends NotificationLike>(items: T[], updates: NotificationUpdate[]): T[] => {
  if (!updates.length) return items;

  const byId = new Map(updates.map((update) => [update.id, update.read_at]));

  return items.map((item) => {
    const readAt = byId.get(item.id);
    return readAt === undefined ? item : { ...item, read_at: readAt };
  });
};

export const publishNotificationUpdates = (updates: NotificationUpdate[]) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<NotificationUpdate[]>("ufh:notifications-updated", { detail: updates }));
};

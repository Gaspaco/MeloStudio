import { type Component, createSignal, For, Show, onMount, onCleanup } from "solid-js";
import { getNotificationsApi, markNotificationsReadApi, type AppNotification } from "~/lib/api";
import { pfpUrl } from "~/lib/api";
import "./notifications.scss";

const NotificationsDropdown: Component = () => {
  const [open, setOpen] = createSignal(false);
  const [notifications, setNotifications] = createSignal<AppNotification[]>([]);
  const [unread, setUnread] = createSignal(0);
  const [loading, setLoading] = createSignal(false);

  let dropdownRef: HTMLDivElement | undefined;

  const load = async () => {
    setLoading(true);
    try {
      const data = await getNotificationsApi();
      setNotifications(data.items);
      setUnread(data.unread);
    } catch {}
    finally { setLoading(false); }
  };

  onMount(() => {
    load();
    const interval = setInterval(load, 30_000);
    onCleanup(() => clearInterval(interval));
  });

  onMount(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef && !dropdownRef.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    onCleanup(() => document.removeEventListener("mousedown", handler));
  });

  const toggle = async () => {
    const next = !open();
    setOpen(next);
    if (next && unread() > 0) {
      await markNotificationsReadApi();
      setUnread(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    }
  };

  const notifText = (n: AppNotification) => {
    switch (n.type) {
      case "like": return "liked your project";
      case "comment": return "commented on your project";
      case "follow": return "started following you";
      default: return "interacted with you";
    }
  };

  const notifIcon = (type: string) => {
    switch (type) {
      case "like": return (
        <svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" /></svg>
      );
      case "comment": return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
      );
      case "follow": return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="8.5" cy="7" r="4" /><path d="M20 8v6M23 11h-6" /></svg>
      );
      default: return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>
      );
    }
  };

  const relativeTime = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "now";
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    return `${days}d`;
  };

  return (
    <div class="db__notif-wrap" ref={(el) => { dropdownRef = el; }}>
      <button class="db__notif-bell" onClick={toggle} title="Notifications">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" /></svg>
        <Show when={unread() > 0}>
          <span class="db__notif-badge">{unread() > 9 ? "9+" : unread()}</span>
        </Show>
      </button>

      <Show when={open()}>
        <div class="db__notif-dropdown">
          <div class="db__notif-header">
            <span class="db__notif-header-title">Notifications</span>
          </div>
          <div class="db__notif-list">
            <Show when={!loading()} fallback={
              <div class="db__notif-loading">Loading...</div>
            }>
              <Show when={notifications().length > 0} fallback={
                <div class="db__notif-empty">No notifications yet</div>
              }>
                <For each={notifications()}>{(n) =>
                  <div class={`db__notif-item${!n.read ? " db__notif-item--unread" : ""}`}>
                    <div class={`db__notif-item-icon db__notif-item-icon--${n.type}`}>
                      {notifIcon(n.type)}
                    </div>
                    <div class="db__notif-item-body">
                      <span class="db__notif-item-text">
                        <strong>User</strong> {notifText(n)}
                      </span>
                      <span class="db__notif-item-time">{relativeTime(n.createdAt)}</span>
                    </div>
                  </div>
                }</For>
              </Show>
            </Show>
          </div>
        </div>
      </Show>
    </div>
  );
};

export default NotificationsDropdown;

import { useEffect, useState } from "react";
import { Bell, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { useNotificationSound } from "@/hooks/useNotificationSound";

interface Notification {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  type: string;
  read_at: string | null;
  created_at: string;
}

export const NotificationBell = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<Notification[]>([]);
  const { enabled: soundOn, setEnabled: setSoundOn, play } = useNotificationSound();

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(15);
      setItems(data ?? []);
    };
    load();

    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          setItems((prev) => [payload.new as Notification, ...prev]);
          play();
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, play]);

  const unread = items.filter((n) => !n.read_at).length;

  const markAllRead = async () => {
    if (!user) return;
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .is("read_at", null);
    setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-accent-foreground text-[10px] font-bold flex items-center justify-center">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 bg-popover">
        <div className="flex items-center justify-between p-3 border-b">
          <h4 className="font-semibold text-sm">Notifications</h4>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSoundOn(!soundOn)}
              title={soundOn ? "Mute notification sound" : "Enable notification sound"}
              className="text-muted-foreground hover:text-foreground"
            >
              {soundOn ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            </button>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs text-primary hover:underline">
                Mark all read
              </button>
            )}
            <Link to="/notifications" className="text-xs text-primary hover:underline">View all</Link>
          </div>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground text-center">No notifications yet</p>
          ) : (
            items.map((n) => {
              const content = (
                <div className={`p-3 border-b hover:bg-muted/50 transition-colors ${!n.read_at ? "bg-primary/5" : ""}`}>
                  <p className="text-sm font-medium">{n.title}</p>
                  {n.body && <p className="text-xs text-muted-foreground mt-1">{n.body}</p>}
                  <p className="text-[10px] text-muted-foreground mt-1.5">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                  </p>
                </div>
              );
              return n.link ? (
                <Link key={n.id} to={n.link}>{content}</Link>
              ) : (
                <div key={n.id}>{content}</div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;
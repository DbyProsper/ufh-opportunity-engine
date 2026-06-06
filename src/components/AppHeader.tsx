import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { UFHLogo } from "./UFHLogo";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LayoutDashboard, LogOut, Shield, User as UserIcon, Bell, MessageSquare, Settings as SettingsIcon } from "lucide-react";
import { NotificationBell } from "./NotificationBell";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

export const AppHeader = () => {
  const { user, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const [unreadMsgs, setUnreadMsgs] = useState(0);

  useEffect(() => {
    if (!user) { setUnreadMsgs(0); return; }
    let active = true;
    const load = async () => {
      const { data: threads } = await supabase.from("message_threads").select("id");
      const ids = (threads ?? []).map((t: any) => t.id);
      if (!ids.length) { if (active) setUnreadMsgs(0); return; }
      const { count } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .in("thread_id", ids)
        .neq("sender_id", user.id)
        .is("read_at", null);
      if (active) setUnreadMsgs(count ?? 0);
    };
    load();
    const channel = supabase
      .channel(`hdr-msgs-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, load)
      .subscribe();
    return () => { active = false; supabase.removeChannel(channel); };
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-background/85 backdrop-blur-md border-b border-border">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-3">
        <Link to="/" className="flex items-center gap-3 min-w-0">
          <div className="shrink-0">
            <UFHLogo className="w-10 h-10" />
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-base md:text-lg text-foreground truncate">
              UFH Opportunity Hub
            </h1>
            <p className="text-[11px] md:text-xs text-muted-foreground truncate">
              University of Fort Hare
            </p>
          </div>
        </Link>

        <div className="flex items-center gap-2 md:gap-3">
          {user ? (
            <>
              <NotificationBell />
              <ThemeSwitcher />
              <Link to="/messages" className="hidden sm:inline-flex relative">
                <Button variant="ghost" size="sm" className="gap-2">
                  <MessageSquare className="w-4 h-4" />
                  <span className="hidden md:inline">Messages</span>
                </Button>
                {unreadMsgs > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] flex items-center justify-center">
                    {unreadMsgs > 9 ? "9+" : unreadMsgs}
                  </Badge>
                )}
              </Link>
              <Link to="/dashboard" className="hidden sm:inline-flex">
                <Button variant="ghost" size="sm" className="gap-2">
                  <LayoutDashboard className="w-4 h-4" />
                  <span className="hidden md:inline">Dashboard</span>
                </Button>
              </Link>
              {isAdmin && (
                <Link to="/admin" className="hidden sm:inline-flex">
                  <Button variant="outline" size="sm" className="gap-2">
                    <Shield className="w-4 h-4" />
                    <span className="hidden md:inline">Admin</span>
                  </Button>
                </Link>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full">
                    <UserIcon className="w-5 h-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-popover">
                  <DropdownMenuLabel className="truncate">{user.email}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/dashboard"><LayoutDashboard className="w-4 h-4 mr-2" />Dashboard</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/profile"><UserIcon className="w-4 h-4 mr-2" />Profile</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/messages"><MessageSquare className="w-4 h-4 mr-2" />Messages{unreadMsgs > 0 ? ` (${unreadMsgs})` : ""}</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/settings"><SettingsIcon className="w-4 h-4 mr-2" />Settings</Link>
                  </DropdownMenuItem>
                  {isAdmin && (
                    <DropdownMenuItem asChild>
                      <Link to="/admin"><Shield className="w-4 h-4 mr-2" />Admin</Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="w-4 h-4 mr-2" />Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Link to="/auth">
                <Button variant="ghost" size="sm">Sign In</Button>
              </Link>
              <Link to="/auth?mode=signup">
                <Button size="sm" className="btn-gradient-primary text-primary-foreground shadow-md">
                  Get Started
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
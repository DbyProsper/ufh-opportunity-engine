import { useTheme, THEMES, THEME_META, type Theme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Palette, Check, Sun, Moon, Image as ImageIcon, GraduationCap, Minimize2 } from "lucide-react";

const ICONS: Record<Theme, any> = {
  light: Sun, dark: Moon, image: ImageIcon, ufh: GraduationCap, minimal: Minimize2,
};

export const ThemeSwitcher = ({ variant = "ghost" as const }: { variant?: "ghost" | "outline" }) => {
  const { theme, setTheme } = useTheme();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant={variant} aria-label="Change theme" title={`Theme: ${THEME_META[theme].label}`}>
          <Palette className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 bg-popover">
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {THEMES.map((t) => {
          const Icon = ICONS[t];
          return (
            <DropdownMenuItem key={t} onClick={() => setTheme(t)} className="gap-2">
              <Icon className="w-4 h-4" />
              <div className="flex-1">
                <div className="text-sm font-medium">{THEME_META[t].label}</div>
                <div className="text-[11px] text-muted-foreground line-clamp-1">{THEME_META[t].description}</div>
              </div>
              {theme === t && <Check className="w-4 h-4 text-success" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ThemeSwitcher;
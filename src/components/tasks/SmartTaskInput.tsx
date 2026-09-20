import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PRIORITIES, type PriorityKey } from "@/components/ui/badge";
import { parseSmartInput, addDaysKey, todayKey } from "@/lib/task-utils";
import { toFa, formatJalaliShort } from "@/lib/persian";
import { CalendarClock, Clock, CornerDownLeft, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export function SmartTaskInput({
  onCreate,
  placeholder = "یه کار جدید بنویس… مثلاً: جلسه تیم محصول فردا ساعت ۱۰ #محصول",
  autoFocus = false,
  defaultStatus = "todo",
  className,
}: {
  onCreate: (parsed: {
    title: string;
    dueDate?: string;
    dueTime?: string;
    priority?: string;
    tags: string[];
  }) => void;
  placeholder?: string;
  autoFocus?: boolean;
  defaultStatus?: string;
  className?: string;
}) {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const parsed = useMemo(() => parseSmartInput(value), [value]);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const submit = () => {
    const t = value.trim();
    if (!t) return;
    onCreate({
      title: parsed.title,
      dueDate: parsed.dueDate,
      dueTime: parsed.dueTime,
      priority: parsed.priority,
      tags: parsed.tags,
    });
    setValue("");
    inputRef.current?.focus();
  };

  const previewItems: Array<{ icon: React.ReactNode; text: string }> = [];
  if (parsed.dueDate) {
    previewItems.push({
      icon: <CalendarClock className="size-3" />,
      text:
        parsed.dueDate === todayKey()
          ? "امروز"
          : parsed.dueDate === addDaysKey(1)
            ? "فردا"
            : formatJalaliShort(new Date(parsed.dueDate + "T00:00:00")),
    });
  }
  if (parsed.dueTime) {
    previewItems.push({ icon: <Clock className="size-3" />, text: toFa(parsed.dueTime) });
  }
  if (parsed.priority) {
    const p = PRIORITIES[parsed.priority as PriorityKey];
    previewItems.push({ icon: <span className="size-2 rounded-full" style={{ background: p.color }} />, text: p.label });
  }
  for (const tag of parsed.tags) {
    previewItems.push({ icon: <span className="font-bold text-primary">#</span>, text: tag });
  }

  return (
    <div
      className={cn(
        "ui-surface ui-surface-hover overflow-hidden rounded-2xl transition-all",
        focused &&
          "border-primary/60 shadow-[0_0_0_4px_rgba(59,130,246,0.12),0_20px_44px_-20px_rgba(37,99,235,0.35)]",
        className,
      )}
    >
      <div className="flex items-center gap-2.5 p-2">
        <span className="ui-icon-tile size-9 shrink-0">
          <Sparkles className="size-4 text-primary" />
        </span>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={placeholder}
          aria-label="ایجاد سریع کار با زبان طبیعی"
          className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground/70"
        />
        {value && (
          <Button variant="ghost" size="icon-sm" onClick={() => setValue("")} title="پاک کردن">
            <X className="size-3.5 text-muted-foreground" />
          </Button>
        )}
        <Button size="sm" onClick={submit} disabled={!value.trim()} title="افزودن (Enter)">
          <CornerDownLeft className="size-3.5" />
          افزودن
        </Button>
      </div>
      {value.trim() && previewItems.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-border/50 bg-white/40 px-3 py-2 dark:bg-white/5">
          <span className="text-[10px] font-bold text-muted-foreground">
            تشخیص سیستم:
          </span>
          {previewItems.map((item, i) => (
            <Badge key={i} variant="accent" className="gap-1">
              {item.icon}
              {item.text}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

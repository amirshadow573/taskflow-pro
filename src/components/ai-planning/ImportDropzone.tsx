/**
 * Phase 10.5 — drag & drop import surface.
 *
 * Security posture (§25): the file is treated strictly as DATA. It is read with
 * `File.text()`, parsed with `JSON.parse` and handed to the validator. Nothing
 * in the file is ever executed, and no instruction inside it can call a backend
 * function — only the typed schema is read.
 */
import { useCallback, useRef, useState } from "react";
import { FileJson, Upload, Download, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AI_PLAN_SCHEMA_VERSION } from "@/lib/ai-planning/types";
import { looksLikeAIPlanText } from "@/lib/ai-planning/schema";

export interface PickedFile {
  name: string;
  text: string;
  json: unknown;
}

export function ImportDropzone({
  onPicked,
  disabled,
  onError,
  sampleJson,
}: {
  onPicked: (file: PickedFile) => void;
  disabled?: boolean;
  onError: (message: string) => void;
  /** A valid sample document so the user can see the exact expected shape. */
  sampleJson?: unknown;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const read = useCallback(
    async (file: File) => {
      if (!/\.json$/i.test(file.name) && file.type !== "application/json") {
        onError("فقط فایل JSON پذیرفته می‌شود.");
        return;
      }
      if (file.size > 4_000_000) {
        onError("حجم فایل بیش از حد مجاز است.");
        return;
      }
      let text: string;
      try {
        text = await file.text();
      } catch {
        onError("خواندن فایل ممکن نشد.");
        return;
      }
      const check = looksLikeAIPlanText(text);
      if (!check.ok) {
        onError(check.message ?? "فایل معتبر نیست.");
        return;
      }
      try {
        onPicked({ name: file.name, text, json: JSON.parse(text) as unknown });
      } catch {
        onError("محتوای فایل JSON معتبر نیست.");
      }
    },
    [onError, onPicked],
  );

  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={0}
        aria-label="رها کردن فایل برنامهٔ AI یا انتخاب فایل"
        aria-disabled={disabled}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (!disabled) inputRef.current?.click();
          }
        }}
        onClick={() => !disabled && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (disabled) return;
          const file = e.dataTransfer.files?.[0];
          if (file) void read(file);
        }}
        className={[
          "ui-surface flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-4 py-10 text-center transition-colors",
          dragging
            ? "border-primary bg-primary/5"
            : "border-border/70 hover:border-primary/50",
          disabled ? "pointer-events-none opacity-60" : "",
        ].join(" ")}
      >
        <span
          className="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary"
          aria-hidden="true"
        >
          {dragging ? <Upload className="size-5" /> : <FileJson className="size-5" />}
        </span>
        <p className="text-sm font-bold">
          {dragging ? "فایل را رها کنید" : "فایل برنامهٔ AI را اینجا رها کنید"}
        </p>
        <p className="text-xs text-muted-foreground">
          یا برای انتخاب فایل کلیک کنید.
        </p>
        <p className="text-[11px] text-muted-foreground">
          JSON • قالب برنامه‌ریزی AI نسخه {AI_PLAN_SCHEMA_VERSION}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          aria-hidden="true"
          tabIndex={-1}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void read(file);
            e.target.value = "";
          }}
        />
      </div>

      <p className="flex items-start gap-1.5 text-[11px] leading-5 text-muted-foreground">
        <Sparkles className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
        فایل فقط به‌عنوان داده خوانده می‌شود؛ هیچ کد یا دستوری از داخل آن اجرا نمی‌شود.
      </p>

      {sampleJson !== undefined && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full"
          onClick={() => {
            const blob = new Blob([JSON.stringify(sampleJson, null, 2)], {
              type: "application/json",
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "ai-plan-sample.json";
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          <Download className="size-4" aria-hidden="true" />
          دانلود فایل نمونه برای آشنایی با قالب
        </Button>
      )}
    </div>
  );
}

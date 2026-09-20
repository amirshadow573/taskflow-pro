import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

/** Priority system — never color-only; always pairs color with a label. */
export const PRIORITIES = {
  urgent: { label: "فوری", color: "#ef4444", soft: "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/20" },
  high: { label: "بالا", color: "#f59e0b", soft: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20" },
  medium: { label: "متوسط", color: "#3b82f6", soft: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/20" },
  low: { label: "پایین", color: "#10b981", soft: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20" },
} as const

export type PriorityKey = keyof typeof PRIORITIES

export const STATUSES = {
  inbox: { label: "صندوق ورودی" },
  todo: { label: "انجام نشده" },
  in_progress: { label: "در حال انجام" },
  review: { label: "در حال بررسی" },
  done: { label: "انجام شده" },
} as const

export type StatusKey = keyof typeof STATUSES

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-4 whitespace-nowrap transition-colors [&_svg]:size-3 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "border-white/50 bg-white/70 text-secondary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] dark:border-white/10 dark:bg-slate-800/60",
        outline: "border-border/70 bg-transparent text-muted-foreground",
        accent:
          "border-primary/20 bg-primary/10 text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]",
        info: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-300",
        success:
          "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300",
        warning:
          "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300",
        danger:
          "border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300",
        gradient:
          "border-transparent bg-gradient-to-l from-primary to-[#5B5FE6] text-white shadow-[0_4px_12px_-6px_rgba(37,99,235,0.8)]",
      },
    },
    defaultVariants: { variant: "default" },
  },
)

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }

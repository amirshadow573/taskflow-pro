import * as React from "react"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Task checkbox with a satisfying completion micro-interaction.
 * Fully keyboard accessible; respects reduced-motion preferences via CSS.
 */
export function TaskCheckbox({
  checked,
  onChange,
  color = "var(--primary)",
  label,
  className,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  color?: string
  label: string
  className?: string
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation()
        onChange(!checked)
      }}
      className={cn(
        "grid size-5 shrink-0 place-items-center rounded-full border-2 transition-all",
        checked ? "task-pop" : "hover:scale-110",
        className,
      )}
      style={{
        borderColor: checked ? color : "var(--border)",
        background: checked ? color : "transparent",
      }}
    >
      {checked && <Check className="size-3 text-white" strokeWidth={3.5} />}
    </button>
  )
}

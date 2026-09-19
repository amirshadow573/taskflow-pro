import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Compass } from "lucide-react";
import { useNavigate } from "react-router";

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="grid min-h-svh place-items-center bg-background px-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="rounded-3xl border border-border bg-card px-10 py-12 text-center elev-2"
      >
        <div className="mx-auto mb-5 grid size-14 place-items-center rounded-2xl bg-primary text-primary-foreground">
          <Compass className="size-7" />
        </div>
        <h1 className="text-5xl font-extrabold tabular-nums">۴۰۴</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          صفحه‌ای که دنبالش بودی پیدا نشد. ممکن است جابه‌جا یا حذف شده باشد.
        </p>
        <div className="mt-6 flex items-center justify-center gap-2">
          <Button onClick={() => navigate("/")}>صفحه اصلی</Button>
          <Button variant="outline" onClick={() => navigate("/app/dashboard")}>
            رفتن به فضای کاری
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

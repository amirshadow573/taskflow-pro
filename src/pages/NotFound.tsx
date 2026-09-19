import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Compass } from "lucide-react";
import { useNavigate } from "react-router";

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="app-bg grid min-h-screen place-items-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="glass rounded-3xl px-10 py-12 text-center"
      >
        <div className="mx-auto mb-5 grid size-14 place-items-center rounded-2xl bg-[oklch(0.72_0.19_122)] text-[oklch(0.22_0.05_130)] shadow-lg shadow-emerald-500/25">
          <Compass className="size-7" />
        </div>
        <h1 className="text-5xl font-extrabold">۴۰۴</h1>
        <p className="mt-3 text-muted-foreground">
          صفحه‌ای که دنبالش بودی پیدا نشد.
        </p>
        <Button className="mt-6" onClick={() => navigate("/")}>
          بازگشت به خانه
        </Button>
      </motion.div>
    </div>
  );
}

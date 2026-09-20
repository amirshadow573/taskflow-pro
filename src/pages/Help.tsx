import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Keyboard, LifeBuoy, MousePointerClick } from "lucide-react";

const SHORTCUTS: Array<[string, string]> = [
  ["Ctrl + K", "باز کردن جست‌وجوی سریع"],
  ["N", "افزودن سریع کار جدید"],
  ["Esc", "بستن پنجره‌های باز"],
  ["Enter", "ثبت کار در ورودی هوشمند"],
  ["↑ ↓", "حرکت بین نتایج جست‌وجو"],
];

const FAQ: Array<[string, string]> = [
  [
    "چطور سریع کار اضافه کنم؟",
    "کافی است در ورودی هوشمند بنویسی: «جلسه تیم فردا ساعت ۱۰ #محصول». سیستم خودش تاریخ، ساعت و تگ را تشخیص می‌دهد.",
  ],
  [
    "صندوق ورودی برای چیست؟",
    "هر ایده یا کاری که عجله‌ای برای مرتب‌کردنش نداری را اینجا بریز. بعداً با چند کلیک به پروژه و تاریخ وصلش می‌کنی.",
  ],
  [
    "زیرکار چیست و چطور کار می‌کند؟",
    "روی هر کار کلیک کن؛ در پنل جزئیات می‌توانی زیرکار اضافه کنی. پیشرفت زیرکارها به‌صورت خودکار روی کار اصلی نمایش داده می‌شود.",
  ],
  [
    "امنیت اطلاعات من چطور است؟",
    "اطلاعات شما روی سرور اختصاصی همین فضای کاری ذخیره می‌شود و فقط با حساب کاربری خودت در دسترس است.",
  ],
];

export default function Help() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 md:p-8">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
          <LifeBuoy className="size-6 text-primary" />
          راهنما
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          هر چه برای شروع سریع لازم داری، اینجاست.
        </p>
      </header>

      <section className="ui-surface rounded-2xl p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold">
          <MousePointerClick className="size-4 text-primary" />
          شروع سریع
        </h2>
        <ol className="list-inside list-decimal space-y-2 text-sm leading-6 text-muted-foreground">
          <li>کارهای ذهنت را در «صندوق ورودی» بریز — بی‌نظم بودن اشکالی ندارد.</li>
          <li>پروژه بساز و کارهای مرتبط را به آن وصل کن.</li>
          <li>هر روز وارد «امروز» شو و کارهایت را تیک بزن.</li>
          <li>هفته‌ای یک بار «پیشرفت» را ببین تا روندت را بشناسی.</li>
        </ol>
      </section>

      <section className="ui-surface rounded-2xl p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold">
          <Keyboard className="size-4 text-primary" />
          کلیدهای میان‌بر
        </h2>
        <ul className="divide-y divide-border/70">
          {SHORTCUTS.map(([keys, desc]) => (
            <li key={keys} className="flex items-center justify-between py-2 text-sm">
              <span className="text-muted-foreground">{desc}</span>
              <kbd className="rounded-md border border-border bg-muted px-2 py-0.5 text-xs font-bold" dir="ltr">
                {keys}
              </kbd>
            </li>
          ))}
        </ul>
      </section>

      <section className="ui-surface rounded-2xl p-5">
        <h2 className="mb-2 text-sm font-bold">سؤال‌های پرتکرار</h2>
        <Accordion type="single" collapsible>
          {FAQ.map(([q, a]) => (
            <AccordionItem key={q} value={q}>
              <AccordionTrigger className="text-sm">{q}</AccordionTrigger>
              <AccordionContent className="text-sm leading-6 text-muted-foreground">
                {a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>
    </div>
  );
}

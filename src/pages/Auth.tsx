import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

import { useAuth } from "@/hooks/use-auth";
import logo from "@/assets/logo.svg";
import { ArrowLeft, Loader2, Mail, UserX } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";

interface AuthProps {
  redirectAfterAuth?: string;
}

function resolveRedirectAfterAuth(
  returnTo: string | null,
  fallback = "/onboarding",
) {
  if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) {
    return returnTo;
  }
  return fallback;
}

function Auth({ redirectAfterAuth }: AuthProps = {}) {
  const { isLoading: authLoading, isAuthenticated, signIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = resolveRedirectAfterAuth(
    searchParams.get("returnTo"),
    redirectAfterAuth,
  );
  const [step, setStep] = useState<"signIn" | { email: string }>("signIn");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(redirect);
    }
  }, [authLoading, isAuthenticated, navigate, redirect]);

  const handleEmailSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      await signIn("email-otp", formData);
      setStep({ email: formData.get("email") as string });
      setIsLoading(false);
    } catch (error) {
      console.error("Email sign-in error:", error);
      setError(
        error instanceof Error
          ? error.message
          : "ارسال کد تأیید ناموفق بود. دوباره تلاش کنید.",
      );
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      await signIn("email-otp", formData);
      navigate(redirect);
    } catch (error) {
      console.error("OTP verification error:", error);
      setError("کد تأیید وارد شده صحیح نیست.");
      setIsLoading(false);
      setOtp("");
    }
  };

  const handleGuestLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signIn("anonymous");
      navigate(redirect);
    } catch (error) {
      console.error("Guest login error:", error);
      setError("ورود به عنوان مهمان ناموفق بود. دوباره تلاش کنید.");
      setIsLoading(false);
    }
  };

  return (
    <div className="grid min-h-svh place-items-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <span className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-primary to-[#5B5FE6] text-white shadow-[0_8px_20px_-10px_rgba(37,99,235,0.9)]">
            <Mail className="size-5" />
          </span>
          <span className="ui-text-gradient text-xl font-extrabold">تسک‌لی</span>
        </div>

        <Card className="overflow-hidden pt-6">
          {step === "signIn" ? (
            <>
              <CardHeader className="text-center">
                <CardTitle className="text-lg">خوش آمدید</CardTitle>
                <CardDescription>
                  با ایمیل وارد شوید یا حساب بسازید — بدون رمز عبور
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleEmailSubmit}>
                <CardContent>
                  <div className="relative flex items-center gap-2">
                    <div className="relative flex-1">
                      <Mail className="absolute end-3 top-3 size-4 text-muted-foreground" />
                      <Input
                        name="email"
                        placeholder="name@example.com"
                        type="email"
                        dir="ltr"
                        className="pe-9 text-end"
                        disabled={isLoading}
                        required
                      />
                    </div>
                    <Button
                      type="submit"
                      variant="outline"
                      size="icon"
                      disabled={isLoading}
                      aria-label="ارسال کد"
                    >
                      {isLoading ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <ArrowLeft className="size-4" />
                      )}
                    </Button>
                  </div>
                  {error && (
                    <p className="mt-2 text-sm text-destructive" role="alert">
                      {error}
                    </p>
                  )}

                  <div className="my-5 flex items-center gap-3">
                    <span className="ui-divider flex-1" />
                    <span className="text-[11px] font-bold text-muted-foreground">یا</span>
                    <span className="ui-divider flex-1" />
                  </div>

                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full"
                    onClick={handleGuestLogin}
                    disabled={isLoading}
                  >
                    <UserX className="size-4" />
                    ورود سریع به عنوان مهمان
                  </Button>
                </CardContent>
              </form>
            </>
          ) : (
            <>
              <CardHeader className="text-center">
                <CardTitle className="text-lg">کد تأیید را وارد کنید</CardTitle>
                <CardDescription>
                  کدی ۶ رقمی به {step.email} فرستادیم
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleOtpSubmit}>
                <CardContent className="pb-4">
                  <input type="hidden" name="email" value={step.email} />
                  <input type="hidden" name="code" value={otp} />

                  <div className="flex justify-center" dir="ltr">
                    <InputOTP
                      value={otp}
                      onChange={setOtp}
                      maxLength={6}
                      disabled={isLoading}
                      onKeyDown={(e) => {
                        if (
                          e.key === "Enter" &&
                          otp.length === 6 &&
                          !isLoading
                        ) {
                          const form = (e.target as HTMLElement).closest("form");
                          if (form) form.requestSubmit();
                        }
                      }}
                    >
                      <InputOTPGroup>
                        {Array.from({ length: 6 }).map((_, index) => (
                          <InputOTPSlot key={index} index={index} />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                  {error && (
                    <p className="mt-2 text-center text-sm text-destructive" role="alert">
                      {error}
                    </p>
                  )}
                  <p className="mt-4 text-center text-sm text-muted-foreground">
                    کد دریافت نشد؟{" "}
                    <Button
                      variant="link"
                      className="size-auto p-0"
                      onClick={() => setStep("signIn")}
                    >
                      دوباره تلاش کنید
                    </Button>
                  </p>
                </CardContent>
                <CardFooter className="flex-col gap-2">
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isLoading || otp.length !== 6}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="ml-2 size-4 animate-spin" />
                        در حال بررسی…
                      </>
                    ) : (
                      <>
                        تأیید و ورود
                        <ArrowLeft className="size-4" />
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setStep("signIn")}
                    disabled={isLoading}
                    className="w-full"
                  >
                    تغییر ایمیل
                  </Button>
                </CardFooter>
              </form>
            </>
          )}
        </Card>

        <p className="mt-5 text-center text-xs text-muted-foreground">
          با ورود، <button className="underline">شرایط استفاده</button> و{" "}
          <button className="underline">حریم خصوصی</button> را می‌پذیرید.
        </p>
        <button
          onClick={() => navigate("/")}
          className="mt-3 block w-full text-center text-xs text-muted-foreground transition hover:text-foreground"
        >
          برگشت به صفحه اصلی
        </button>
      </div>
    </div>
  );
}

export default function AuthPage(props: AuthProps) {
  return (
    <Suspense>
      <Auth {...props} />
    </Suspense>
  );
}

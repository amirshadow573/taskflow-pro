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
  fallback = "/dashboard",
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
    <div className="app-bg min-h-screen">
      <div className="flex min-h-screen flex-col">
        <div className="flex flex-1 items-center justify-center px-4 py-12">
          <Card className="glass min-w-[350px] rounded-3xl border-white/60 pb-0 shadow-xl">
            {step === "signIn" ? (
              <>
                <CardHeader className="text-center">
                  <div className="flex justify-center">
                    <img
                      src={logo}
                      alt="لوگو"
                      width={64}
                      height={64}
                      className="mb-4 mt-4 cursor-pointer rounded-lg"
                      onClick={() => navigate("/")}
                    />
                  </div>
                  <CardTitle className="text-xl">خوش آمدید</CardTitle>
                  <CardDescription>
                    ایمیل خود را وارد کنید تا وارد شوید یا ثبت‌نام کنید
                  </CardDescription>
                </CardHeader>
                <form onSubmit={handleEmailSubmit}>
                  <CardContent>
                    <div className="relative flex items-center gap-2">
                      <div className="relative flex-1">
                        <Mail className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          name="email"
                          placeholder="name@example.com"
                          type="email"
                          dir="ltr"
                          className="glass-row pr-9 text-right"
                          disabled={isLoading}
                          required
                        />
                      </div>
                      <Button
                        type="submit"
                        variant="outline"
                        size="icon"
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ArrowLeft className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    {error && (
                      <p className="mt-2 text-sm text-rose-500">{error}</p>
                    )}

                    <div className="mt-4">
                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <span className="w-full border-t" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                          <span className="bg-background px-2 text-muted-foreground">
                            یا
                          </span>
                        </div>
                      </div>

                      <Button
                        type="button"
                        variant="glass"
                        className="mt-4 w-full"
                        onClick={handleGuestLogin}
                        disabled={isLoading}
                      >
                        <UserX className="ml-2 h-4 w-4" />
                        ورود سریع به عنوان مهمان
                      </Button>
                    </div>
                  </CardContent>
                </form>
              </>
            ) : (
              <>
                <CardHeader className="mt-4 text-center">
                  <CardTitle>ایمیل خود را بررسی کنید</CardTitle>
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
                            const form = (e.target as HTMLElement).closest(
                              "form",
                            );
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
                      <p className="mt-2 text-center text-sm text-rose-500">
                        {error}
                      </p>
                    )}
                    <p className="mt-4 text-center text-sm text-muted-foreground">
                      کد دریافت نشد؟{" "}
                      <Button
                        variant="link"
                        className="h-auto p-0"
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
                          <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                          در حال بررسی…
                        </>
                      ) : (
                        <>
                          تأیید کد
                          <ArrowLeft className="mr-2 h-4 w-4" />
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

            <div className="rounded-b-3xl border-t border-white/50 bg-white/40 px-6 py-4 text-center text-xs text-muted-foreground backdrop-blur-sm">
              امن شده توسط{" "}
              <a
                href="https://freebuff.com"
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors underline hover:text-primary"
              >
                freebuff.com
              </a>
            </div>
          </Card>
        </div>
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

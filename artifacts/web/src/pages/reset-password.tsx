import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Activity, AlertCircle, ArrowLeft, CheckCircle, Eye, EyeOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { customFetch } from "@workspace/api-client-react";
import { useLanguage } from "@/context/language-context";

export default function ResetPassword() {
  const { t } = useLanguage();
  const [, setLocation] = useLocation();
  const token = new URLSearchParams(window.location.search).get("token") || "";

  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError(t("resetPassword.minChars"));
      return;
    }

    if (password !== passwordConfirm) {
      setError(t("signup.passwordMismatch"));
      return;
    }

    setIsLoading(true);

    try {
      await customFetch("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password, passwordConfirm }),
        headers: { "Content-Type": "application/json" },
      });
      setSuccess(true);
    } catch (err: unknown) {
      const apiErr = err as { data?: { error?: string } };
      setError(apiErr.data?.error || t("forgotPassword.somethingWentWrong"));
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="mobile-container flex flex-col justify-center px-6">
        <div className="text-center">
          <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-7 h-7 text-destructive" />
          </div>
          <h1 className="text-xl font-bold mb-2">{t("resetPassword.invalidLink")}</h1>
          <p className="text-muted-foreground text-sm mb-6">{t("resetPassword.invalidLinkMsg")}</p>
          <Link href="/forgot-password">
            <Button className="w-full h-11 rounded-xl bg-primary hover:bg-primary/90 text-black font-semibold text-sm">
              {t("resetPassword.requestNew")}
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mobile-container flex flex-col justify-center px-6 relative overflow-hidden">
      <div className="absolute top-[-10%] right-[-20%] w-[140%] h-[50%] bg-primary/5 blur-[120px] rounded-full pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full relative z-10"
      >
        <AnimatePresence mode="wait">
          {!success ? (
            <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Link href="/login" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors">
                <ArrowLeft className="w-4 h-4" />
                {t("forgotPassword.backToLogin")}
              </Link>

              <div className="flex justify-center mb-8">
                <div className="w-16 h-16 rounded-2xl bg-card border border-card-border flex items-center justify-center shadow-2xl shadow-primary/20">
                  <Activity className="w-8 h-8 text-primary" />
                </div>
              </div>

              <div className="text-center mb-10">
                <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">{t("resetPassword.title")}</h1>
                <p className="text-muted-foreground">{t("resetPassword.subtitle")}</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {error}
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-muted-foreground px-1">{t("resetPassword.newPassword")}</label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder={t("resetPassword.minCharsPlaceholder")}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-muted-foreground px-1">{t("resetPassword.confirmPassword")}</label>
                  <div className="relative">
                    <Input
                      type={showConfirm ? "text" : "password"}
                      placeholder={t("resetPassword.repeatPassword")}
                      value={passwordConfirm}
                      onChange={(e) => setPasswordConfirm(e.target.value)}
                      required
                      minLength={8}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {password.length > 0 && passwordConfirm.length > 0 && (
                  <div className={`text-xs px-1 ${password === passwordConfirm ? "text-primary" : "text-destructive"}`}>
                    {password === passwordConfirm ? t("resetPassword.passwordsMatch") : t("resetPassword.passwordsDontMatch")}
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full mt-6 h-12 rounded-xl bg-primary hover:bg-primary/90 text-black font-semibold text-sm"
                  disabled={isLoading}
                >
                  {isLoading ? t("resetPassword.resetting") : t("resetPassword.submit")}
                </Button>
              </form>
            </motion.div>
          ) : (
            <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-primary" />
                </div>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground mb-2">{t("resetPassword.successTitle")}</h1>
              <p className="text-muted-foreground text-sm mb-8">{t("resetPassword.successMsg")}</p>
              <Button
                onClick={() => setLocation("/login")}
                className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-black font-semibold text-sm"
              >
                {t("login.signIn")}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

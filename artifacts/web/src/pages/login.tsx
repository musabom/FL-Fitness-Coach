import { useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/context/language-context";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AlertCircle, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

export default function Login() {
  const { login } = useAuth();
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    login.mutate(
      { email, password },
      {
        onError: (err: any) => {
          if (err?.status === 403 && err?.data?.error === "ACCOUNT_DEACTIVATED") {
            setError("ACCOUNT_DEACTIVATED");
          } else {
            setError(t("login.invalidCredentials"));
          }
        },
      },
    );
  };

  return (
    <div className="mobile-container flex flex-col justify-center min-h-screen px-6 py-16 relative overflow-hidden">
      {/* Ambient teal glow blob — LoginScreen signature */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: "-20%", left: "-30%",
          width: "160%", height: "60%",
          background: "rgba(45,212,191,0.08)",
          filter: "blur(100px)",
          borderRadius: "50%",
        }}
      />

      {/* Language switcher */}
      <div className="absolute top-4 end-4 z-10">
        <LanguageSwitcher />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="w-full relative z-10"
      >
        {/* Logo chip — white card so the dark logo is visible on navy bg */}
        <div className="flex justify-center mb-8">
          <div
            className="bg-white rounded-2xl p-2 inline-flex"
            style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.4), 0 0 40px rgba(45,212,191,0.15)" }}
          >
            <img src="/logo.png" alt="FutureLine Fitness" className="w-14 h-14 object-contain block" />
          </div>
        </div>

        {/* Headline */}
        <div className="text-center mb-9">
          <h1 className="text-[30px] font-bold tracking-[-0.02em] text-foreground leading-tight">
            {t("login.welcomeBack")}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{t("login.subtitle")}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Error banner */}
          {error === "ACCOUNT_DEACTIVATED" ? (
            <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-sm space-y-1">
              <div className="flex items-center gap-2 text-destructive font-semibold">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {t("login.accountDeactivated")}
              </div>
              <p className="text-muted-foreground text-xs ps-6">{t("login.deactivatedMessage")}</p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          ) : null}

          {/* Email */}
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-muted-foreground ps-1">{t("login.email")}</label>
            <Input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between ps-1">
              <label className="text-[13px] font-medium text-muted-foreground">{t("login.password")}</label>
              <Link href="/forgot-password" className="text-xs text-primary hover:text-primary/80 transition-colors">
                {t("login.forgotPassword")}
              </Link>
            </div>
            <Input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          {/* CTA */}
          <Button
            type="submit"
            className="w-full mt-2 justify-center"
            size="lg"
            disabled={login.isPending}
          >
            {login.isPending ? (
              <><Loader2 className="w-4 h-4 animate-spin" />{t("login.signingIn")}</>
            ) : (
              t("login.signIn")
            )}
          </Button>
        </form>

        {/* Sign-up link */}
        <p className="mt-7 text-center text-[13px] text-muted-foreground">
          {t("login.noAccount")}{" "}
          <Link href="/signup" className="text-primary font-semibold hover:text-primary/80 transition-colors">
            {t("login.createOne")}
          </Link>
        </p>
      </motion.div>
    </div>
  );
}

import { useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/context/language-context";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
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
        }
      }
    );
  };

  return (
    <div className="mobile-container flex flex-col justify-center px-6 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-20%] w-[140%] h-[50%] bg-primary/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="absolute top-4 end-4">
        <LanguageSwitcher />
      </div>
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full relative z-10"
      >
        <div className="flex justify-center mb-8">
          <div className="bg-white rounded-2xl p-2 shadow-2xl inline-flex">
            <img src="/logo.png" alt="FutureLine Fitness" className="w-16 h-16 object-contain" />
          </div>
        </div>
        
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">{t("login.welcomeBack")}</h1>
          <p className="text-muted-foreground">{t("login.subtitle")}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error === "ACCOUNT_DEACTIVATED" ? (
            <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-sm space-y-1">
              <div className="flex items-center gap-2 text-destructive font-semibold">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {t("login.accountDeactivated")}
              </div>
              <p className="text-muted-foreground text-xs ps-6">
                {t("login.deactivatedMessage")}
              </p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          ) : null}
          
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-muted-foreground px-1">{t("login.email")}</label>
            <Input 
              type="email" 
              placeholder="you@example.com" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          
          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-1">
              <label className="text-sm font-medium text-muted-foreground">{t("login.password")}</label>
              <Link href="/forgot-password" className="text-xs text-primary hover:underline">
                {t("login.forgotPassword")}
              </Link>
            </div>
            <Input 
              type="password" 
              placeholder="••••••••" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          
          <Button 
            type="submit" 
            className="w-full mt-6" 
            size="lg"
            disabled={login.isPending}
          >
            {login.isPending ? t("login.signingIn") : t("login.signIn")}
          </Button>
        </form>

        <div className="mt-8 text-center text-sm text-muted-foreground">
          {t("login.noAccount")}{" "}
          <Link href="/signup" className="text-primary font-medium hover:underline">
            {t("login.createOne")}
          </Link>
        </div>
      </motion.div>
    </div>
  );
}

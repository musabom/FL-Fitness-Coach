import { useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/context/language-context";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Activity, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";

export default function Signup() {
  const { signup } = useAuth();
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    if (!firstName.trim() || !lastName.trim()) {
      setError("First name and last name are required");
      return;
    }

    if (password !== passwordConfirm) {
      setError(t("signup.passwordMismatch"));
      return;
    }

    signup.mutate(
      { email, password, passwordConfirm, firstName, lastName },
      {
        onError: (err: unknown) => {
          const apiErr = err as { data?: { error?: string } };
          setError(apiErr.data?.error || t("signup.failedToCreate"));
        }
      }
    );
  };

  return (
    <div className="mobile-container flex flex-col justify-center px-6 py-12 relative overflow-hidden">
      <div className="absolute top-[-10%] right-[-20%] w-[140%] h-[50%] bg-primary/5 blur-[120px] rounded-full pointer-events-none" />

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
          <div className="w-16 h-16 rounded-2xl bg-card border border-card-border flex items-center justify-center shadow-2xl shadow-primary/20">
            <Activity className="w-8 h-8 text-primary" />
          </div>
        </div>
        
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">{t("signup.title")}</h1>
          <p className="text-muted-foreground">{t("signup.subtitle")}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground px-1">
                {t("signup.firstName")} <span className="text-destructive">*</span>
              </label>
              <Input
                type="text"
                placeholder="John"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground px-1">
                {t("signup.lastName")} <span className="text-destructive">*</span>
              </label>
              <Input
                type="text"
                placeholder="Doe"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-muted-foreground px-1">{t("signup.email")} <span className="text-destructive">*</span></label>
            <Input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-muted-foreground px-1">{t("signup.password")} <span className="text-destructive">*</span></label>
            <Input
              type="password"
              placeholder={t("signup.minChars")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-muted-foreground px-1">{t("signup.confirmPassword")} <span className="text-destructive">*</span></label>
            <Input
              type="password"
              placeholder={t("signup.minChars")}
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              required
              minLength={8}
            />
          </div>
          
          <Button 
            type="submit" 
            className="w-full mt-6" 
            size="lg"
            disabled={signup.isPending}
          >
            {signup.isPending ? t("signup.creating") : t("signup.createAccount")}
          </Button>
        </form>

        <div className="mt-8 text-center text-sm text-muted-foreground">
          {t("signup.alreadyHaveAccount")}{" "}
          <Link href="/login" className="text-primary font-medium hover:underline">
            {t("signup.signIn")}
          </Link>
        </div>
      </motion.div>
    </div>
  );
}

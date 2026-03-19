import { useState } from "react";
import { Link } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Activity, AlertCircle, ArrowLeft, CheckCircle, Copy, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { customFetch } from "@workspace/api-client-react";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const data = await customFetch<{ message: string; token?: string }>("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
        headers: { "Content-Type": "application/json" },
      });
      if (data.token) {
        setResetToken(data.token);
      } else {
        setResetToken("EMAIL_NOT_FOUND");
      }
    } catch (err: unknown) {
      const apiErr = err as { data?: { error?: string } };
      setError(apiErr.data?.error || "Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const resetLink = resetToken && resetToken !== "EMAIL_NOT_FOUND"
    ? `${window.location.origin}/reset-password?token=${resetToken}`
    : null;

  const handleCopy = () => {
    if (resetLink) {
      navigator.clipboard.writeText(resetLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="mobile-container flex flex-col justify-center px-6 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-20%] w-[140%] h-[50%] bg-primary/5 blur-[120px] rounded-full pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full relative z-10"
      >
        <Link href="/login" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to login
        </Link>

        <div className="flex justify-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-card border border-card-border flex items-center justify-center shadow-2xl shadow-primary/20">
            <Activity className="w-8 h-8 text-primary" />
          </div>
        </div>

        <AnimatePresence mode="wait">
          {!resetToken ? (
            <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="text-center mb-10">
                <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">Forgot password?</h1>
                <p className="text-muted-foreground">Enter your email and we'll send you a reset link</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {error}
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-muted-foreground px-1">Email</label>
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full mt-6"
                  size="lg"
                  disabled={isLoading}
                >
                  {isLoading ? "Sending..." : "Send Reset Link"}
                </Button>
              </form>

              <div className="mt-8 text-center text-sm text-muted-foreground">
                Remember your password?{" "}
                <Link href="/login" className="text-primary font-medium hover:underline">
                  Sign in
                </Link>
              </div>
            </motion.div>
          ) : (
            <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
              <div className="text-center mb-8">
                <div className="flex justify-center mb-4">
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                    <CheckCircle className="w-7 h-7 text-primary" />
                  </div>
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground mb-2">Reset link ready</h1>
                {resetToken === "EMAIL_NOT_FOUND" ? (
                  <p className="text-muted-foreground text-sm">If that email exists in our system, a reset link has been generated.</p>
                ) : (
                  <p className="text-muted-foreground text-sm">Your password reset link has been generated below.</p>
                )}
              </div>

              {resetLink && (
                <div className="space-y-3">
                  <div className="p-4 rounded-xl bg-card border border-card-border space-y-2">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Reset Link</p>
                    <p className="text-xs text-foreground break-all font-mono leading-relaxed">{resetLink}</p>
                  </div>
                  <Button
                    onClick={handleCopy}
                    className="w-full h-11 rounded-xl bg-primary hover:bg-primary/90 text-black font-semibold text-sm gap-2"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Copy Link
                      </>
                    )}
                  </Button>
                  <Link href={`/reset-password?token=${resetToken}`}>
                    <Button variant="outline" className="w-full h-11 rounded-xl">
                      Go to Reset Password
                    </Button>
                  </Link>
                </div>
              )}

              {resetToken === "EMAIL_NOT_FOUND" && (
                <Link href="/login">
                  <Button className="w-full mt-4 h-11 rounded-xl bg-primary hover:bg-primary/90 text-black font-semibold text-sm">
                    Back to Login
                  </Button>
                </Link>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

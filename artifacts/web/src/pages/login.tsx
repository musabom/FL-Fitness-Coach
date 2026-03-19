import { useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Activity, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    login.mutate(
      { email, password },
      {
        onError: () => {
          setError("Invalid email or password");
        }
      }
    );
  };

  return (
    <div className="mobile-container flex flex-col justify-center px-6 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-[-10%] left-[-20%] w-[140%] h-[50%] bg-primary/5 blur-[120px] rounded-full pointer-events-none" />
      
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
          <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">Welcome back</h1>
          <p className="text-muted-foreground">Sign in to your precision plan</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
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
          
          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-1">
              <label className="text-sm font-medium text-muted-foreground">Password</label>
              <Link href="/forgot-password" className="text-xs text-primary hover:underline">
                Forgot password?
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
            {login.isPending ? "Signing in..." : "Sign In"}
          </Button>
        </form>

        <div className="mt-8 text-center text-sm text-muted-foreground">
          Don't have an account?{" "}
          <Link href="/signup" className="text-primary font-medium hover:underline">
            Create one
          </Link>
        </div>
      </motion.div>
    </div>
  );
}

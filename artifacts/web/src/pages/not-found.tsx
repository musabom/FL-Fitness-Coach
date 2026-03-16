import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mobile-container flex flex-col items-center justify-center text-center px-6">
      <h1 className="text-6xl font-bold text-muted mb-4">404</h1>
      <h2 className="text-2xl font-semibold mb-2">Page not found</h2>
      <p className="text-muted-foreground mb-8">The page you're looking for doesn't exist or has been moved.</p>
      <Link href="/dashboard" className="w-full">
        <Button className="w-full" size="lg">Return to Dashboard</Button>
      </Link>
    </div>
  );
}

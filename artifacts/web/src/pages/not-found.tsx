import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/context/language-context";

export default function NotFound() {
  const { t } = useLanguage();
  return (
    <div className="mobile-container flex flex-col items-center justify-center text-center px-6">
      <h1 className="text-6xl font-bold text-muted mb-4">404</h1>
      <h2 className="text-2xl font-semibold mb-2">{t("notFound.title")}</h2>
      <p className="text-muted-foreground mb-8">{t("notFound.subtitle")}</p>
      <Link href="/dashboard" className="w-full">
        <Button className="w-full" size="lg">{t("notFound.goHome")}</Button>
      </Link>
    </div>
  );
}

import { Globe } from "lucide-react";
import { useLanguage } from "@/context/language-context";

interface LanguageSwitcherProps {
  className?: string;
  variant?: "icon-text" | "text-only" | "icon-only";
}

export function LanguageSwitcher({ className = "", variant = "icon-text" }: LanguageSwitcherProps) {
  const { lang, setLang, t } = useLanguage();

  const toggle = () => setLang(lang === "en" ? "ar" : "en");

  return (
    <button
      onClick={toggle}
      title={t("lang.switchLabel")}
      className={`flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-white/5 ${className}`}
    >
      {variant !== "text-only" && <Globe className="w-4 h-4 shrink-0" />}
      {variant !== "icon-only" && (
        <span className="text-xs font-semibold tracking-wide">{t("lang.switch")}</span>
      )}
    </button>
  );
}

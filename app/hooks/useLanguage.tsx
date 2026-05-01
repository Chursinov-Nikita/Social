import { useEffect, useState } from "react";

const useLanguage = () => {
  const [lang, setLang] = useState<"en" | "ru">("en");

  useEffect(() => {
    const saved = localStorage.getItem("lang") as "en" | "ru" | null;
    if (saved) setLang(saved);
  }, []);

  const toggle = () => {
    setLang((prev) => {
      const next = prev === "en" ? "ru" : "en";
      localStorage.setItem("lang", next);
      return next;
    });
  };
  return { toggle, lang };
};

export default useLanguage;

import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

const ThemeToggle = () => {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <Button
      variant="glass"
      size="sm"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="relative"
    >
      <Settings className="w-4 h-4 mr-2" />
      {theme === "dark" ? "Modo Claro" : "Modo Escuro"}
    </Button>
  );
};

export default ThemeToggle;
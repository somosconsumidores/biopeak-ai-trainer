import { Button } from "@/components/ui/button";
import { LogOut, Menu } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ThemeToggle from "@/components/ui/theme-toggle";
import { useTheme } from "next-themes";

const MobileHeader = () => {
  const { signOut, user } = useAuth();
  const { toast } = useToast();
  const { theme } = useTheme();

  const handleSignOut = async () => {
    try {
      await signOut();
      toast({
        title: "Logout realizado",
        description: "Até logo!",
      });
    } catch (error) {
      toast({
        title: "Erro no logout",
        description: "Tente novamente",
        variant: "destructive",
      });
    }
  };

  return (
    <header className="md:hidden fixed top-0 left-0 right-0 z-40 glass border-b border-primary/20 h-14">
      <div className="flex items-center justify-between px-4 h-full">
        {/* Logo */}
        <div className="flex items-center space-x-2">
          <img 
            src={theme === 'dark' ? "/lovable-uploads/75b2021e-81b9-4f5c-833e-adfc1e81f664.png" : "/lovable-uploads/6dd7da64-0e29-4226-8bb4-99185306e197.png"}
            alt="BioPeak" 
            className="h-8 w-auto" 
          />
          <span className="text-lg font-bold text-foreground">BioPeak</span>
        </div>

        {/* Menu Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <Menu className="w-5 h-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 glass">
            {user && (
              <>
                <div className="px-2 py-1.5">
                  <p className="text-sm text-muted-foreground">Logado como:</p>
                  <p className="text-sm font-medium text-foreground truncate">{user.email}</p>
                </div>
                <DropdownMenuSeparator />
              </>
            )}
            
            <div className="px-2 py-1">
              <ThemeToggle />
            </div>
            
            <DropdownMenuSeparator />
            
            <DropdownMenuItem onClick={handleSignOut} className="text-muted-foreground">
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {/* Spacer to prevent top content overlap */}
      <div className="h-14"></div>
    </header>
  );
};

export default MobileHeader;
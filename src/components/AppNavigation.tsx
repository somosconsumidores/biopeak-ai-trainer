import { Button } from "@/components/ui/button";
import { Activity, LayoutDashboard, ChartBar, Settings, User, LogOut } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import ThemeToggle from "@/components/ui/theme-toggle";

interface AppNavigationProps {
  activeView: string;
  onViewChange: (view: string) => void;
}

const AppNavigation = ({ activeView, onViewChange }: AppNavigationProps) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { signOut, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

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

  const navigationItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'session', label: 'Sessão', icon: Activity },
    { id: 'compare', label: 'Comparar', icon: ChartBar },
    { id: 'insights', label: 'Insights', icon: Settings },
    { id: 'profile', label: 'Perfil', icon: User },
  ];

  return (
    <nav className={`glass h-screen transition-all duration-300 ${isCollapsed ? 'w-20' : 'w-64'} p-4 border-r border-primary/20 hidden md:block`}>
      {/* Logo */}
      <div className="flex items-center mb-8 px-2">
        <img src="/lovable-uploads/6dd7da64-0e29-4226-8bb4-99185306e197.png" alt="BioPeak" className="h-8 w-auto" />
        {!isCollapsed && (
          <span className="ml-3 text-xl font-bold text-foreground">BioPeak</span>
        )}
      </div>

      {/* Navigation Items */}
      <div className="space-y-2 mb-8">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          
          return (
            <Button
              key={item.id}
              variant={isActive ? "default" : "ghost"}
              className={`w-full justify-start h-12 ${isCollapsed ? 'px-3' : 'px-4'} ${
                isActive ? 'glow' : ''
              }`}
              onClick={() => {
                if (item.id === 'session') {
                  navigate('/sessions');
                } else {
                  onViewChange(item.id);
                }
              }}
            >
              <Icon className="w-5 h-5" />
              {!isCollapsed && <span className="ml-3">{item.label}</span>}
            </Button>
          );
        })}
      </div>

      {/* User Info & Actions */}
      {!isCollapsed && user && (
        <div className="mb-4 p-3 glass rounded-lg">
          <p className="text-sm text-muted-foreground">Olá,</p>
          <p className="text-sm font-medium text-foreground truncate">{user.email}</p>
        </div>
      )}

      {/* Theme Toggle */}
      {!isCollapsed && (
        <div className="mb-4">
          <ThemeToggle />
        </div>
      )}

      {/* Strava Integration Button */}
      {!isCollapsed && (
        <div className="mb-4">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground hover:text-foreground hover:text-orange-500"
            onClick={() => {
              console.log('Desktop Strava button clicked - navigating to /strava');
              navigate('/strava');
            }}
          >
            <Activity className="w-4 h-4 mr-2" />
            Integração Strava
          </Button>
        </div>
      )}

      {/* Sign Out Button */}
      {!isCollapsed && (
        <div className="mb-4">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground hover:text-foreground"
            onClick={handleSignOut}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sair
          </Button>
        </div>
      )}

      {/* Collapse Toggle */}
      <div className="absolute bottom-4 left-4 right-4">
        <Button
          variant="glass"
          size="sm"
          className="w-full"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          {isCollapsed ? '→' : '←'}
        </Button>
      </div>
    </nav>
  );
};

export default AppNavigation;
import { Button } from "@/components/ui/button";
import { Activity, LayoutDashboard, ChartBar, Settings, User } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface MobileNavigationProps {
  activeView: string;
  onViewChange: (view: string) => void;
}

const MobileNavigation = ({ activeView, onViewChange }: MobileNavigationProps) => {
  const navigate = useNavigate();
  
  const navigationItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'session', label: 'Treino', icon: Activity },
    { id: 'compare', label: 'Comparar', icon: ChartBar },
    { id: 'insights', label: 'Insights', icon: Settings },
    { id: 'profile', label: 'Perfil', icon: User },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
      <div className="glass border-t border-primary/20 p-2">
        <div className="flex justify-around items-center max-w-md mx-auto">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            
            return (
              <Button
                key={item.id}
                variant="ghost"
                size="sm"
                className={`flex flex-col items-center justify-center h-14 w-14 p-1 rounded-xl transition-all ${
                  isActive 
                    ? 'bg-primary/20 text-primary border border-primary/30' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
                onClick={() => {
                  if (item.id === 'session') {
                    navigate('/sessions');
                  } else {
                    onViewChange(item.id);
                  }
                }}
              >
                <Icon className={`w-5 h-5 mb-1 ${isActive ? 'animate-pulse' : ''}`} />
                <span className="text-xs font-medium leading-none">{item.label}</span>
              </Button>
            );
          })}
          
          {/* Strava Button */}
          <Button
            variant="ghost"
            size="sm"
            className="flex flex-col items-center justify-center h-14 w-14 p-1 rounded-xl transition-all text-orange-500 hover:text-orange-400 hover:bg-orange-500/10"
            onClick={() => {
              console.log('Strava button clicked - navigating to /strava');
              navigate('/strava');
            }}
          >
            <Activity className="w-5 h-5 mb-1" />
            <span className="text-xs font-medium leading-none">Strava</span>
          </Button>
        </div>
      </div>
      {/* Spacer to prevent bottom content overlap */}
      <div className="h-16"></div>
    </div>
  );
};

export default MobileNavigation;
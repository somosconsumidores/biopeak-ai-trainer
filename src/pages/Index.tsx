import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import BioPeakLanding from "@/components/BioPeakLanding";
import AppNavigation from "@/components/AppNavigation";
import MobileNavigation from "@/components/MobileNavigation";
import MobileHeader from "@/components/MobileHeader";
import Dashboard from "@/components/Dashboard";
import TrainingSession from "@/components/TrainingSession";
import TrainingComparison from "@/components/TrainingComparison";
import PersonalizedInsights from "@/components/PersonalizedInsights";
import AthleteProfile from "@/components/AthleteProfile";

const Index = () => {
  const [currentView, setCurrentView] = useState('landing');
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  // Redirect authenticated users - handle new user flow properly
  useEffect(() => {
    const currentPath = window.location.pathname;
    const urlParams = new URLSearchParams(window.location.search);
    const hasStravaCode = urlParams.get('code') && localStorage.getItem('strava_connecting') === 'true';
    
    // Don't redirect if we're processing a Strava OAuth callback
    if (hasStravaCode) {
      console.log('[Index] Strava OAuth callback detected, skipping redirects');
      return;
    }
    
    if (user && !loading) {
      const isNewUser = localStorage.getItem('is_new_user') === 'true';
      if (isNewUser) {
        localStorage.removeItem('is_new_user');
        navigate('/strava');
      } else if (currentPath === '/' && currentView !== 'landing') {
        // Only redirect existing users from root path, not from other pages like /strava
        navigate('/');
      }
    } else if (!loading && !user && currentPath !== '/auth' && currentView !== 'landing') {
      navigate('/auth');
    }
  }, [user, loading, currentView, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <img 
            src="/lovable-uploads/6dd7da64-0e29-4226-8bb4-99185306e197.png" 
            alt="BioPeak" 
            className="h-12 w-auto mx-auto mb-4"
          />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (currentView === 'landing') {
    return <BioPeakLanding onEnterApp={() => setCurrentView('dashboard')} />;
  }

  if (!user) {
    return null; // Let useEffect handle navigation
  }

  const renderCurrentView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard />;
      case 'session':
        return <TrainingSession />;
      case 'compare':
        return <TrainingComparison />;
      case 'insights':
        return <PersonalizedInsights />;
      case 'profile':
        return <AthleteProfile />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header - only visible on mobile */}
      <MobileHeader />
      
      <div className="flex min-h-screen">
        {/* Desktop Sidebar - hidden on mobile */}
        <AppNavigation activeView={currentView} onViewChange={setCurrentView} />
        
        {/* Main Content */}
        <main className="flex-1 overflow-auto pt-14 md:pt-0 pb-20 md:pb-0">
          {renderCurrentView()}
        </main>
      </div>
      
      {/* Mobile Bottom Navigation */}
      <MobileNavigation activeView={currentView} onViewChange={setCurrentView} />
    </div>
  );
};

export default Index;

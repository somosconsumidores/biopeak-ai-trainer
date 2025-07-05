import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import BioPeakLanding from "@/components/BioPeakLanding";
import AppNavigation from "@/components/AppNavigation";
import Dashboard from "@/components/Dashboard";
import TrainingSession from "@/components/TrainingSession";
import TrainingComparison from "@/components/TrainingComparison";
import PersonalizedInsights from "@/components/PersonalizedInsights";
import AthleteProfile from "@/components/AthleteProfile";

const Index = () => {
  const [currentView, setCurrentView] = useState('landing');
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user && currentView !== 'landing') {
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
    navigate('/auth');
    return null;
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
    <div className="min-h-screen bg-background flex">
      <AppNavigation activeView={currentView} onViewChange={setCurrentView} />
      <main className="flex-1 overflow-auto">
        {renderCurrentView()}
      </main>
    </div>
  );
};

export default Index;

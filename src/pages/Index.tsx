import { useState } from "react";
import BioPeakLanding from "@/components/BioPeakLanding";
import AppNavigation from "@/components/AppNavigation";
import Dashboard from "@/components/Dashboard";
import TrainingSession from "@/components/TrainingSession";
import TrainingComparison from "@/components/TrainingComparison";
import PersonalizedInsights from "@/components/PersonalizedInsights";
import AthleteProfile from "@/components/AthleteProfile";

const Index = () => {
  const [currentView, setCurrentView] = useState('landing');

  if (currentView === 'landing') {
    return <BioPeakLanding />;
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

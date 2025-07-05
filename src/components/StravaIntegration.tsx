import { Card } from "@/components/ui/card";
import { useStravaIntegration } from "@/hooks/useStravaIntegration";
import StravaConnectionStatus from "./StravaConnectionStatus";
import StravaActivityList from "./StravaActivityList";

const StravaIntegration = () => {
  const {
    isConnected,
    isSyncing,
    isConnecting,
    activities,
    loading,
    stravaConfig,
    handleStravaConnect,
    handleSync
  } = useStravaIntegration();

  if (loading) {
    return (
      <Card className="glass p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-muted/50 rounded mb-4"></div>
          <div className="h-4 bg-muted/50 rounded mb-2"></div>
          <div className="h-4 bg-muted/50 rounded"></div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <StravaConnectionStatus
        isConnected={isConnected}
        isConnecting={isConnecting}
        isSyncing={isSyncing}
        stravaConfig={stravaConfig}
        onConnect={handleStravaConnect}
        onSync={handleSync}
      />

      {isConnected && <StravaActivityList activities={activities} />}
    </div>
  );
};

export default StravaIntegration;
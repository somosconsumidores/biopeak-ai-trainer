import { Card } from "@/components/ui/card";
import { useStravaIntegration } from "@/hooks/useStravaIntegration";
import StravaConnectionStatus from "./StravaConnectionStatus";
import StravaActivityList from "./StravaActivityList";
import StravaDebugPanel from "./StravaDebugPanel";
import StravaDebugInfo from "./StravaDebugInfo";
import StreamlinedGarminConnection from "./StreamlinedGarminConnection";

const StravaIntegration = () => {
  const {
    isConnected,
    isSyncing,
    isConnecting,
    activities,
    stravaConfig,
    handleStravaConnect,
    handleSync
  } = useStravaIntegration();

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
      
      {/* Streamlined Garmin Connection */}
      <StreamlinedGarminConnection />
      
      {/* Debug panels - remover em produção */}
      <StravaDebugPanel />
      <StravaDebugInfo />
    </div>
  );
};

export default StravaIntegration;
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useStravaConfig } from "./strava/useStravaConfig";
import { useStravaAuth } from "./strava/useStravaAuth";
import { useStravaSync } from "./strava/useStravaSync";
import { useStravaCallbackHandler } from "./strava/useStravaCallbackHandler";

export const useStravaIntegration = () => {
  console.log('useStravaIntegration hook initialized');
  const { user, session } = useAuth();
  console.log('[useStravaIntegration] Auth context:', { hasUser: !!user, userId: user?.id, hasSession: !!session });
  
  const { stravaConfig } = useStravaConfig();
  const { 
    isConnected, 
    isConnecting, 
    setIsConnecting, 
    checkStravaConnection, 
    handleStravaConnect, 
    handleStravaCallback 
  } = useStravaAuth(stravaConfig);
  
  const { isSyncing, activities, loadActivities, handleSync } = useStravaSync();

  // Enhanced callback handler that includes sync functionality
  const handleStravaCallbackWithSync = (code: string) => {
    handleStravaCallback(code, () => handleSync(true));
  };

  useStravaCallbackHandler({ 
    handleStravaCallback: handleStravaCallbackWithSync, 
    setIsConnecting 
  });

  useEffect(() => {
    if (user) {
      console.log('[useStravaIntegration] User authenticated, checking Strava connection...');
      checkStravaConnection();
      loadActivities();
    }
  }, [user]);

  const handleSyncWrapper = () => handleSync(isConnected);

  return {
    isConnected,
    isSyncing,
    isConnecting,
    activities,
    stravaConfig,
    handleStravaConnect,
    handleSync: handleSyncWrapper,
    loadActivities
  };
};
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
  
  // Initialize all hooks in consistent order
  const { stravaConfig } = useStravaConfig();
  const { isSyncing, activities, syncStatus, loadActivities, loadSyncStatus, handleSync } = useStravaSync();
  const { 
    isConnected, 
    isConnecting, 
    setIsConnecting, 
    checkStravaConnection, 
    handleStravaConnect, 
    handleStravaCallback 
  } = useStravaAuth(stravaConfig);

  // Enhanced callback handler that includes sync functionality
  const handleStravaCallbackWithSync = (code: string) => {
    handleStravaCallback(code, () => handleSync(true));
  };

  // Use callback handler after all other hooks are initialized
  useStravaCallbackHandler({ 
    handleStravaCallback: handleStravaCallbackWithSync, 
    setIsConnecting 
  });

  useEffect(() => {
    if (user) {
      console.log('[useStravaIntegration] User authenticated, checking Strava connection...');
      checkStravaConnection();
      loadActivities();
      loadSyncStatus();
    }
  }, [user]);

  const handleSyncWrapper = () => handleSync(isConnected);

  return {
    isConnected,
    isSyncing,
    isConnecting,
    activities,
    syncStatus,
    stravaConfig,
    handleStravaConnect,
    handleSync: handleSyncWrapper,
    loadActivities
  };
};
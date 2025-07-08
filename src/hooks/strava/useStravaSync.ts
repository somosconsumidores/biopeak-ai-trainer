import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { StravaActivity } from "@/types/strava";

export const useStravaSync = () => {
  const { user } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  const [activities, setActivities] = useState<StravaActivity[]>([]);
  const [syncStatus, setSyncStatus] = useState<{
    lastSync: Date | null;
    totalSynced: number;
    isIncremental: boolean;
    status: 'completed' | 'in_progress' | 'error' | null;
    errorMessage?: string;
  }>({
    lastSync: null,
    totalSynced: 0,
    isIncremental: false,
    status: null
  });

  const loadSyncStatus = async () => {
    if (!user) return;

    try {
      const { data } = await supabase
        .from('strava_sync_status')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data) {
        setSyncStatus({
          lastSync: data.last_sync_at ? new Date(data.last_sync_at) : null,
          totalSynced: data.total_activities_synced || 0,
          isIncremental: !!data.last_activity_date,
          status: (['completed', 'in_progress', 'error'].includes(data.sync_status)) ? 
            data.sync_status as 'completed' | 'in_progress' | 'error' : null,
          errorMessage: data.error_message
        });
      }
    } catch (error) {
      console.error('Error loading sync status:', error);
    }
  };

  const loadActivities = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('strava_activities')
        .select('*')
        .eq('user_id', user.id)
        .order('start_date', { ascending: false })
        .limit(20);

      if (!error && data) {
        setActivities(data);
      }
    } catch (error) {
      console.error('Error loading activities:', error);
    }
  };

  const handleSync = async (isConnected: boolean) => {
    if (!isConnected) {
      toast.error('Conecte-se ao Strava primeiro.');
      return;
    }

    setIsSyncing(true);
    
    try {
      console.log('[useStravaSync] Starting Strava sync...');
      console.log('[useStravaSync] User:', user?.id);
      
      // Get current session for proper authorization
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Sessão não encontrada. Faça login novamente.');
      }
      
      console.log('[useStravaSync] Session token available, calling strava-sync function...');
      
      const { data, error } = await supabase.functions.invoke('strava-sync', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      console.log('[useStravaSync] Strava sync response:', { data, error });

      if (error) {
        console.error('[useStravaSync] Strava sync error:', error);
        throw error;
      }

      if (data?.success) {
        const isIncrementalSync = data.isIncremental || false;
        const syncType = isIncrementalSync ? 'incremental' : 'completa';
        const message = `Sincronização ${syncType}: ${data.synced} atividades processadas!`;
        
        toast.success(message);
        console.log('[useStravaSync] Sync completed:', { 
          synced: data.synced, 
          total: data.total,
          isIncremental: isIncrementalSync,
          lastSyncDate: data.lastSyncDate,
          mostRecentActivity: data.mostRecentActivity
        });
        
        // Update local sync status
        setSyncStatus({
          lastSync: new Date(),
          totalSynced: data.debug?.previouslySynced + data.synced || data.synced,
          isIncremental: isIncrementalSync,
          status: 'completed'
        });
        
        // Reload activities from database
        await loadActivities();
        await loadSyncStatus();
        
        // Auto-trigger training session processing if activities were synced
        if (data.synced > 0) {
          toast.info('Processando dados de treino automaticamente...');
          // Dispatch custom event to trigger training session processing
          window.dispatchEvent(new CustomEvent('strava-activities-synced', { 
            detail: { synced: data.synced, total: data.total } 
          }));
        }
      } else {
        console.error('[useStravaSync] Strava sync failed:', data);
        throw new Error(data?.error || 'Falha na sincronização de atividades');
      }
    } catch (error) {
      console.error('[useStravaSync] Error syncing Strava activities:', error);
      const errorMessage = error?.message || error?.details || 'Erro desconhecido na sincronização';
      toast.error(`Erro ao sincronizar atividades: ${errorMessage}`);
      
      // Update sync status with error
      setSyncStatus(prev => ({
        ...prev,
        status: 'error',
        errorMessage: errorMessage
      }));
    } finally {
      setIsSyncing(false);
    }
  };

  return {
    isSyncing,
    activities,
    syncStatus,
    loadActivities,
    loadSyncStatus,
    handleSync
  };
};
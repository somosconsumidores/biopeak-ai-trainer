import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { StravaActivity } from "@/types/strava";

export const useStravaSync = () => {
  const { user } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  const [activities, setActivities] = useState<StravaActivity[]>([]);

  const loadActivities = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('strava_activities')
        .select('*')
        .eq('user_id', user.id)
        .order('start_date', { ascending: false })
        .limit(10);

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
      console.log('Starting Strava sync...');
      
      const { data, error } = await supabase.functions.invoke('strava-sync');

      console.log('Strava sync response:', { data, error });

      if (error) {
        console.error('Strava sync error:', error);
        throw error;
      }

      if (data?.success) {
        const message = `${data.synced} atividades sincronizadas com sucesso!`;
        toast.success(message);
        console.log('[useStravaSync] Sync completed:', { synced: data.synced, total: data.total });
        loadActivities();
        
        // Auto-trigger training session processing if activities were synced
        if (data.synced > 0) {
          toast.info('Processando dados de treino automaticamente...');
          // Dispatch custom event to trigger training session processing
          window.dispatchEvent(new CustomEvent('strava-activities-synced', { 
            detail: { synced: data.synced, total: data.total } 
          }));
        }
      } else {
        console.error('Strava sync failed:', data);
        throw new Error(data?.error || 'Failed to sync activities');
      }
    } catch (error) {
      console.error('Error syncing Strava activities:', error);
      toast.error(`Erro ao sincronizar atividades: ${error.message || 'Tente novamente.'}`);
    } finally {
      setIsSyncing(false);
    }
  };

  return {
    isSyncing,
    activities,
    loadActivities,
    handleSync
  };
};
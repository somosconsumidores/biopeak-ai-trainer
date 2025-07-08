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
        const message = `${data.synced} atividades sincronizadas com sucesso!`;
        toast.success(message);
        console.log('[useStravaSync] Sync completed:', { synced: data.synced, total: data.total });
        
        // Reload activities from database
        await loadActivities();
        
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
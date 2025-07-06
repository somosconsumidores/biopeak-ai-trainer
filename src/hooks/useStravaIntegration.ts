import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export const useStravaIntegration = () => {
  console.log('useStravaIntegration hook initialized');
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stravaConfig, setStravaConfig] = useState<{clientId: string, redirectUri: string} | null>(null);

  useEffect(() => {
    loadStravaConfig();
    if (user) {
      checkStravaConnection();
      loadActivities();
    }
  }, [user]);

  const loadStravaConfig = async () => {
    try {
      console.log('[useStravaIntegration] Loading Strava config...');
      
      const timestamp = Date.now();
      const { data, error } = await supabase.functions.invoke('strava-config', {
        headers: {
          'Cache-Control': 'no-cache',
          'X-Request-ID': timestamp.toString()
        }
      });
      
      console.log('[useStravaIntegration] Strava config response:', { data, error, timestamp });
      
      if (error) {
        console.error('[useStravaIntegration] Error loading Strava config:', error);
        
        // Check if it's a network connectivity issue
        if (error.message?.includes('Failed to fetch') || error.message?.includes('Failed to send a request')) {
          console.warn('[useStravaIntegration] Network connectivity issue detected');
          toast.error(`Não foi possível conectar com o servidor. Verifique sua conexão com a internet.`);
        } else {
          toast.error(`Erro ao carregar configuração do Strava: ${error.message || 'Erro desconhecido'}`);
        }
        return;
      }

      if (data?.clientId) {
        console.log('[useStravaIntegration] Strava config loaded successfully:', { 
          clientId: data.clientId, 
          redirectUri: data.redirectUri,
          debug: data.debug 
        });
        setStravaConfig(data);
      } else {
        console.error('[useStravaIntegration] No client ID received from config:', data);
        toast.error(`Configuração do Strava inválida: ${JSON.stringify(data)}`);
      }
    } catch (error) {
      console.error('[useStravaIntegration] Exception loading Strava config:', error);
      toast.error(`Erro ao carregar configuração do Strava: ${error.message || 'Erro de rede'}`);
    } finally {
      setLoading(false);
    }
  };

  const checkStravaConnection = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('strava_tokens')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!error && data) {
        setIsConnected(true);
      }
    } catch (error) {
      console.error('Error checking Strava connection:', error);
    } finally {
      setLoading(false);
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
        .limit(10);

      if (!error && data) {
        setActivities(data);
      }
    } catch (error) {
      console.error('Error loading activities:', error);
    }
  };

  const handleStravaConnect = () => {
    if (!stravaConfig) {
      toast.error('Configuração do Strava não carregada. Tente novamente.');
      return;
    }

    const scope = 'read,activity:read_all';
    const authUrl = `https://www.strava.com/oauth/authorize?client_id=${stravaConfig.clientId}&response_type=code&redirect_uri=${encodeURIComponent(stravaConfig.redirectUri)}&approval_prompt=force&scope=${scope}`;
    
    console.log('Redirecting to Strava auth:', authUrl);
    
    localStorage.setItem('strava_connecting', 'true');
    window.location.href = authUrl;
  };

  const handleStravaCallback = async (code: string) => {
    setIsConnecting(true);
    
    try {
      console.log('Processing Strava callback with code:', code);
      
      const { data, error } = await supabase.functions.invoke('strava-auth', {
        body: { code }
      });

      console.log('Strava auth response:', { data, error });

      if (error) {
        console.error('Strava auth error:', error);
        throw error;
      }

      if (data?.success) {
        setIsConnected(true);
        toast.success(`Conectado ao Strava com sucesso! Bem-vindo, ${data.athlete?.firstname || 'Atleta'}!`);
        localStorage.removeItem('strava_connecting');
        
        setTimeout(() => handleSync(), 1000);
      } else {
        console.error('Strava auth failed:', data);
        throw new Error(data?.error || 'Failed to connect to Strava');
      }
    } catch (error) {
      console.error('Error connecting to Strava:', error);
      toast.error(`Erro ao conectar com Strava: ${error.message || 'Tente novamente.'}`);
      localStorage.removeItem('strava_connecting');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSync = async () => {
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
        toast.success(`${data.synced} atividades sincronizadas com sucesso!`);
        loadActivities();
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

  // Check for OAuth callback on component mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const isConnecting = localStorage.getItem('strava_connecting') === 'true';
    
    if (code && isConnecting) {
      handleStravaCallback(code);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  return {
    isConnected,
    isSyncing,
    isConnecting,
    activities,
    loading,
    stravaConfig,
    handleStravaConnect,
    handleSync,
    loadActivities
  };
};
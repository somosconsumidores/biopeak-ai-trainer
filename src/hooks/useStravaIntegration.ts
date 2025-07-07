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
  const [stravaConfig, setStravaConfig] = useState<{clientId: string, redirectUri: string, fallback?: boolean} | null>(null);

  useEffect(() => {
    loadStravaConfig();
    if (user) {
      checkStravaConnection();
      loadActivities();
    }
  }, [user]);

  const loadStravaConfig = async (retryCount = 0) => {
    try {
      console.log(`[useStravaIntegration] Loading Strava config from edge function... (attempt ${retryCount + 1})`);
      
      // Production fallback configuration
      const isProduction = window.location.hostname === 'biopeak-ai.com';
      const fallbackConfig = {
        clientId: '142473', // Known Strava client ID for BioPeak
        redirectUri: isProduction ? 'https://biopeak-ai.com/' : window.location.origin + '/'
      };
      
      const { data, error } = await supabase.functions.invoke('strava-config', {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log('[useStravaIntegration] Edge function response:', { data, error, isProduction });
      
      if (error) {
        console.error('[useStravaIntegration] Edge function error:', error);
        
        // Retry logic for network failures
        if (retryCount < 2 && (error.message?.includes('network') || error.message?.includes('fetch'))) {
          console.log('[useStravaIntegration] Retrying in 2 seconds...');
          setTimeout(() => loadStravaConfig(retryCount + 1), 2000);
          return;
        }
        
        // Use fallback for production
        if (isProduction) {
          console.log('[useStravaIntegration] Using production fallback config');
          setStravaConfig(fallbackConfig);
          return;
        }
        
        toast.error('Erro ao carregar configuração do Strava. Usando configuração de emergência.');
        setStravaConfig(fallbackConfig);
        return;
      }
      
      if (data?.clientId) {
        console.log('[useStravaIntegration] Config loaded successfully from edge function');
        setStravaConfig({
          clientId: data.clientId,
          redirectUri: data.redirectUri || fallbackConfig.redirectUri
        });
      } else {
        console.warn('[useStravaIntegration] No client ID from edge function, using fallback');
        setStravaConfig(fallbackConfig);
      }
    } catch (error) {
      console.error('[useStravaIntegration] Exception loading config:', error);
      
      // Always provide fallback configuration
      const isProduction = window.location.hostname === 'biopeak-ai.com';
      const fallbackConfig = {
        clientId: '142473',
        redirectUri: isProduction ? 'https://biopeak-ai.com/' : window.location.origin + '/'
      };
      
      console.log('[useStravaIntegration] Using fallback config due to exception');
      setStravaConfig(fallbackConfig);
      
      if (retryCount === 0) {
        toast.error('Configuração carregada em modo offline.');
      }
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
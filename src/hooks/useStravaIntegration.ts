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
  
  // IMMEDIATE fallback configuration - always available
  const getDefaultConfig = () => {
    const isProduction = window.location.hostname === 'biopeak-ai.com';
    return {
      clientId: '142473',
      redirectUri: isProduction ? 'https://biopeak-ai.com/' : `${window.location.origin}/`,
      fallback: true
    };
  };

  const [stravaConfig, setStravaConfig] = useState<{clientId: string, redirectUri: string, fallback?: boolean}>(getDefaultConfig());

  useEffect(() => {
    // Try to load from edge function but don't block UI
    loadStravaConfig();
    if (user) {
      checkStravaConnection();
      loadActivities();
    }
  }, [user]);

  const loadStravaConfig = async () => {
    try {
      console.log('[useStravaIntegration] Trying to load enhanced config from edge function...');
      
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 5000)
      );
      
      const configPromise = supabase.functions.invoke('strava-config', {
        headers: { 'Content-Type': 'application/json' }
      });
      
      const { data, error } = await Promise.race([configPromise, timeoutPromise]) as any;
      
      if (!error && data?.clientId) {
        console.log('[useStravaIntegration] Enhanced config loaded from edge function');
        setStravaConfig(prev => ({
          ...prev,
          clientId: data.clientId,
          redirectUri: data.redirectUri || prev.redirectUri,
          fallback: false
        }));
      } else {
        console.log('[useStravaIntegration] Edge function failed, keeping default config');
      }
    } catch (error) {
      console.log('[useStravaIntegration] Edge function call failed, keeping default config:', error.message);
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
    stravaConfig,
    handleStravaConnect,
    handleSync,
    loadActivities
  };
};
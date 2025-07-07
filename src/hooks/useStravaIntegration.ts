import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export const useStravaIntegration = () => {
  console.log('useStravaIntegration hook initialized');
  const { user, session } = useAuth();
  console.log('[useStravaIntegration] Auth context:', { hasUser: !!user, userId: user?.id, hasSession: !!session });
  const [isConnected, setIsConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [activities, setActivities] = useState<any[]>([]);
  
  // IMMEDIATE fallback configuration - always available
  const getDefaultConfig = () => {
    const hostname = window.location.hostname;
    const origin = window.location.origin;
    
    console.log('[useStravaIntegration] Detecting environment:', { hostname, origin });
    
    const isProduction = hostname === 'biopeak-ai.com' || hostname === 'www.biopeak-ai.com';
    const isPreview = hostname.includes('lovable.app') || hostname.includes('lovableproject.com');
    
    let redirectUri;
    if (isProduction) {
      redirectUri = 'https://biopeak-ai.com/strava';
      console.log('[useStravaIntegration] Using production config');
    } else if (isPreview) {
      redirectUri = 'https://preview--biopeak-ai-trainer.lovable.app/strava';
      console.log('[useStravaIntegration] Using preview config:', redirectUri);
    } else {
      redirectUri = `${origin}/strava`;
      console.log('[useStravaIntegration] Using local/development config:', redirectUri);
    }
    
    return {
      clientId: '142473',
      redirectUri,
      fallback: true,
      environment: isProduction ? 'production' : isPreview ? 'preview' : 'development'
    };
  };

  const [stravaConfig, setStravaConfig] = useState<{clientId: string, redirectUri: string, fallback?: boolean}>(getDefaultConfig());

  useEffect(() => {
    // Try to load from edge function but don't block UI
    loadStravaConfig();
  }, []);

  useEffect(() => {
    if (user) {
      console.log('[useStravaIntegration] User authenticated, checking Strava connection...');
      checkStravaConnection();
      loadActivities();
    }
  }, [user]);

  const loadStravaConfig = async () => {
    try {
      console.log('[useStravaIntegration] Trying to load enhanced config from edge function...');
      console.log('[useStravaIntegration] Current environment:', window.location.hostname);
      
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 5000)
      );
      
      const configPromise = supabase.functions.invoke('strava-config', {
        headers: { 'Content-Type': 'application/json' }
      });
      
      const { data, error } = await Promise.race([configPromise, timeoutPromise]) as any;
      
      if (!error && data?.clientId) {
        console.log('[useStravaIntegration] Enhanced config loaded from edge function:', {
          clientId: data.clientId,
          redirectUri: data.redirectUri,
          timestamp: data.timestamp
        });
        setStravaConfig(prev => ({
          ...prev,
          clientId: data.clientId,
          redirectUri: data.redirectUri || prev.redirectUri,
          fallback: false
        }));
      } else {
        console.log('[useStravaIntegration] Edge function failed, keeping default config:', { error, data });
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
    console.log('[useStravaIntegration] handleStravaConnect called - checking config:', {
      hasConfig: !!stravaConfig,
      config: stravaConfig
    });
    
    // Force clean any previous connection state and URL parameters
    localStorage.removeItem('strava_connecting');
    localStorage.removeItem('strava_state');
    localStorage.removeItem('strava_connect_time');
    
    // Clean URL of any existing OAuth parameters
    window.history.replaceState({}, document.title, window.location.pathname);
    
    console.log('[useStravaIntegration] Cleaned previous connection state and URL');

    if (!stravaConfig) {
      console.error('[useStravaIntegration] No Strava config available');
      toast.error('Configuração do Strava não carregada. Tente novamente.');
      return;
    }

    console.log('[useStravaIntegration] Starting Strava connection with config:', {
      clientId: stravaConfig.clientId,
      redirectUri: stravaConfig.redirectUri,
      fallback: stravaConfig.fallback,
      currentUrl: window.location.href
    });

    const scope = 'read,activity:read_all';
    const state = Math.random().toString(36).substring(2, 15);
    const authUrl = `https://www.strava.com/oauth/authorize?client_id=${stravaConfig.clientId}&response_type=code&redirect_uri=${encodeURIComponent(stravaConfig.redirectUri)}&approval_prompt=force&scope=${scope}&state=${state}`;
    
    console.log('[useStravaIntegration] Generated auth URL details:', {
      authUrl,
      clientId: stravaConfig.clientId,
      redirectUri: stravaConfig.redirectUri,
      encodedRedirectUri: encodeURIComponent(stravaConfig.redirectUri),
      scope,
      state
    });
    
    console.log('[useStravaIntegration] Generated auth URL:', authUrl);
    console.log('[useStravaIntegration] About to set localStorage items');
    
    // Store connection state and timestamp
    localStorage.setItem('strava_connecting', 'true');
    localStorage.setItem('strava_connect_time', Date.now().toString());
    localStorage.setItem('strava_state', state);
    
    // Verify localStorage was set
    console.log('[useStravaIntegration] localStorage verification:', {
      connecting: localStorage.getItem('strava_connecting'),
      connectTime: localStorage.getItem('strava_connect_time'),
      state: localStorage.getItem('strava_state')
    });
    
    // Add a small delay to ensure localStorage is set, then redirect
    setTimeout(() => {
      console.log('[useStravaIntegration] Executing redirect to Strava...');
      console.log('[useStravaIntegration] Final localStorage check before redirect:', {
        connecting: localStorage.getItem('strava_connecting'),
        timestamp: Date.now()
      });
      window.location.href = authUrl;
    }, 200);
  };

  const handleStravaCallback = async (code: string) => {
    console.log('[useStravaIntegration] Starting Strava callback with code:', code)
    setIsConnecting(true);
    
    const maxRetries = 3;
    let attempt = 0;
    
    while (attempt < maxRetries) {
      try {
        attempt++;
        console.log(`[useStravaIntegration] Attempt ${attempt}/${maxRetries} - Processing Strava callback...`);
        console.log(`[useStravaIntegration] About to call strava-auth function with:`, {
          code: code,
          user: user?.id,
          hasUser: !!user,
          bodyData: { code }
        });
        
        console.log(`[useStravaIntegration] Trying direct fetch instead of supabase.functions.invoke`);
        
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        
        const response = await fetch(`https://qytorkjmzxscyaefkhnk.supabase.co/functions/v1/strava-auth`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF5dG9ya2ptenhzY3lhZWZraG5rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE3MzM0MTcsImV4cCI6MjA2NzMwOTQxN30.9V0Ir3gtRY3IfiCef7Nu2TKgRczDDYt2Edm1Bo_luAI'
          },
          body: JSON.stringify({ 
            code,
            redirect_uri: stravaConfig.redirectUri 
          })
        });
        
        const result = await response.json();
        const data = response.ok ? result : null;
        const error = response.ok ? null : result;

        console.log(`[useStravaIntegration] Strava auth response (attempt ${attempt}):`, { 
          data, 
          error,
          hasData: !!data,
          hasError: !!error,
          errorDetails: error ? JSON.stringify(error, null, 2) : null
        });

        if (error) {
          console.error(`[useStravaIntegration] Strava auth error (attempt ${attempt}):`, {
            error,
            errorMessage: error.message,
            errorCode: error.code,
            errorDetails: error.details,
            fullError: JSON.stringify(error, null, 2)
          });
          
          // If this is the last attempt, throw the error
          if (attempt === maxRetries) {
            throw new Error(`Falha na autenticação após ${maxRetries} tentativas: ${error.message || error.details || JSON.stringify(error)}`);
          }
          
          // Wait before retrying (exponential backoff)
          const delay = Math.pow(2, attempt) * 1000;
          console.log(`[useStravaIntegration] Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        if (data?.success) {
          setIsConnected(true);
          toast.success(`Conectado ao Strava com sucesso! Bem-vindo, ${data.athlete?.firstname || 'Atleta'}!`);
          localStorage.removeItem('strava_connecting');
          
          // Auto-sync activities after successful connection
          console.log('[useStravaIntegration] Auto-syncing activities after connection...');
          setTimeout(() => handleSync(), 1000);
          return; // Success, exit the retry loop
        } else {
          const errorMsg = data?.error || data?.details || 'Resposta inválida do servidor';
          console.error(`[useStravaIntegration] Strava auth failed (attempt ${attempt}):`, {
            data,
            errorMsg,
            fullData: JSON.stringify(data, null, 2)
          });
          
          if (attempt === maxRetries) {
            throw new Error(`Falha na conexão: ${errorMsg}`);
          }
          
          // Wait before retrying
          const delay = Math.pow(2, attempt) * 1000;
          console.log(`[useStravaIntegration] Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (error) {
        console.error(`[useStravaIntegration] Error on attempt ${attempt}:`, {
          error,
          errorMessage: error?.message,
          errorStack: error?.stack,
          fullError: JSON.stringify(error, null, 2)
        });
        
        if (attempt === maxRetries) {
          const errorMessage = error?.message || error?.details || 'Erro desconhecido na conexão';
          toast.error(`Erro ao conectar com Strava: ${errorMessage}`);
          localStorage.removeItem('strava_connecting');
          break;
        }
        
        // Wait before retrying
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`[useStravaIntegration] Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    setIsConnecting(false);
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
        const message = `${data.synced} atividades sincronizadas com sucesso!`;
        toast.success(message);
        console.log('[useStravaIntegration] Sync completed:', { synced: data.synced, total: data.total });
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

  // Check for OAuth callback on component mount - MUST be last useEffect
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const error = urlParams.get('error');
    const errorDescription = urlParams.get('error_description');
    const state = urlParams.get('state');
    const storedState = localStorage.getItem('strava_state');
    const isConnecting = localStorage.getItem('strava_connecting') === 'true';
    
    console.log('[useStravaIntegration] ===== CALLBACK CHECK =====');
    console.log('[useStravaIntegration] Current URL:', window.location.href);
    console.log('[useStravaIntegration] URL Search Params:', window.location.search);
    console.log('[useStravaIntegration] Callback analysis:', {
      hasCode: !!code,
      code: code ? `${code.substring(0, 10)}...` : null,
      hasError: !!error,
      error,
      errorDescription,
      state,
      storedState,
      stateMatches: state === storedState,
      isConnecting,
      user: user?.id,
      hasUser: !!user,
      allParams: Array.from(urlParams.entries())
    });
    console.log('[useStravaIntegration] LocalStorage state:', {
      connecting: localStorage.getItem('strava_connecting'),
      state: localStorage.getItem('strava_state'),
      connectTime: localStorage.getItem('strava_connect_time')
    });
    
    if (error && isConnecting) {
      // User denied authorization or other OAuth error
      console.error('[useStravaIntegration] OAuth error from Strava:', { error, errorDescription });
      let errorMessage = 'Autorização negada pelo usuário';
      
      if (error === 'access_denied') {
        errorMessage = 'Você precisa autorizar o acesso ao Strava para continuar';
      } else if (errorDescription) {
        errorMessage = errorDescription;
      }
      
      toast.error(`Erro na conexão: ${errorMessage}`);
      localStorage.removeItem('strava_connecting');
      setIsConnecting(false);
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }
    
    if (code && isConnecting && user) {
      // Validate state parameter for security
      if (state && storedState && state !== storedState) {
        console.error('[useStravaIntegration] State parameter mismatch - possible CSRF attack');
        toast.error('Erro de segurança na autenticação. Tente novamente.');
        localStorage.removeItem('strava_connecting');
        localStorage.removeItem('strava_state');
        setIsConnecting(false);
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
      }
      
      console.log('[useStravaIntegration] Processing Strava OAuth callback...');
      localStorage.removeItem('strava_state'); // Clean up state
      handleStravaCallback(code);
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (code && !isConnecting) {
      console.warn('[useStravaIntegration] Code found but not in connecting state');
      // Clean up the URL anyway
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (!code && isConnecting && window.location.pathname === '/strava') {
      // User is on /strava page but no code and was connecting - likely denied or error
      console.warn('[useStravaIntegration] User returned to /strava without code during connection process');
      
      // Check if this might be a denied authorization
      setTimeout(() => {
        if (localStorage.getItem('strava_connecting') === 'true') {
          console.log('[useStravaIntegration] Assuming authorization was denied or failed');
          toast.error('Conexão cancelada. Tente conectar novamente ao Strava.');
          localStorage.removeItem('strava_connecting');
          setIsConnecting(false);
        }
      }, 2000); // Give some time for potential delayed redirects
    }
  }, [user]); // Add user as dependency

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
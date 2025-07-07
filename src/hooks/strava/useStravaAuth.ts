import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { StravaConfig } from "@/types/strava";

export const useStravaAuth = (stravaConfig: StravaConfig | null) => {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

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

  const handleStravaConnect = () => {
    console.log('[useStravaAuth] handleStravaConnect called - checking config:', {
      hasConfig: !!stravaConfig,
      config: stravaConfig
    });
    
    // Force clean any previous connection state and URL parameters
    localStorage.removeItem('strava_connecting');
    localStorage.removeItem('strava_state');
    localStorage.removeItem('strava_connect_time');
    
    // Clean URL of any existing OAuth parameters to prevent code reuse
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.delete('code');
    currentUrl.searchParams.delete('state');
    currentUrl.searchParams.delete('scope');
    window.history.replaceState({}, document.title, currentUrl.pathname);
    
    console.log('[useStravaAuth] Cleaned previous connection state and URL params');

    if (!stravaConfig) {
      console.error('[useStravaAuth] No Strava config available');
      toast.error('Configuração do Strava não carregada. Tente novamente.');
      return;
    }

    console.log('[useStravaAuth] Starting Strava connection with config:', {
      clientId: stravaConfig.clientId,
      redirectUri: stravaConfig.redirectUri,
      fallback: stravaConfig.fallback,
      currentUrl: window.location.href
    });

    const scope = 'read,activity:read_all';
    const state = Math.random().toString(36).substring(2, 15);
    const authUrl = `https://www.strava.com/oauth/authorize?client_id=${stravaConfig.clientId}&response_type=code&redirect_uri=${encodeURIComponent(stravaConfig.redirectUri)}&approval_prompt=force&scope=${scope}&state=${state}`;
    
    console.log('[useStravaAuth] Generated auth URL details:', {
      authUrl,
      clientId: stravaConfig.clientId,
      redirectUri: stravaConfig.redirectUri,
      encodedRedirectUri: encodeURIComponent(stravaConfig.redirectUri),
      scope,
      state
    });
    
    console.log('[useStravaAuth] Generated auth URL:', authUrl);
    console.log('[useStravaAuth] About to set localStorage items');
    
    // Store connection state and timestamp
    localStorage.setItem('strava_connecting', 'true');
    localStorage.setItem('strava_connect_time', Date.now().toString());
    localStorage.setItem('strava_state', state);
    
    // Verify localStorage was set
    console.log('[useStravaAuth] localStorage verification:', {
      connecting: localStorage.getItem('strava_connecting'),
      connectTime: localStorage.getItem('strava_connect_time'),
      state: localStorage.getItem('strava_state')
    });
    
    // Add a small delay to ensure localStorage is set, then redirect
    setTimeout(() => {
      console.log('[useStravaAuth] Executing redirect to Strava...');
      console.log('[useStravaAuth] Final localStorage check before redirect:', {
        connecting: localStorage.getItem('strava_connecting'),
        timestamp: Date.now()
      });
      window.location.href = authUrl;
    }, 200);
  };

  const handleStravaCallback = async (code: string, onSyncSuccess?: () => void) => {
    console.log('[useStravaAuth] Starting Strava callback with code:', code)
    setIsConnecting(true);
    
    const maxRetries = 3;
    let attempt = 0;
    
    while (attempt < maxRetries) {
      try {
        attempt++;
        console.log(`[useStravaAuth] Attempt ${attempt}/${maxRetries} - Processing Strava callback...`);
        console.log(`[useStravaAuth] About to call strava-auth function with:`, {
          code: code,
          user: user?.id,
          hasUser: !!user,
          bodyData: { code }
        });
        
        console.log(`[useStravaAuth] Trying direct fetch instead of supabase.functions.invoke`);
        
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
            redirect_uri: stravaConfig?.redirectUri 
          })
        });
        
        const result = await response.json();
        const data = response.ok ? result : null;
        const error = response.ok ? null : result;

        console.log(`[useStravaAuth] Strava auth response (attempt ${attempt}):`, { 
          data, 
          error,
          hasData: !!data,
          hasError: !!error,
          errorDetails: error ? JSON.stringify(error, null, 2) : null
        });

        if (error) {
          console.error(`[useStravaAuth] Strava auth error (attempt ${attempt}):`, {
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
          console.log(`[useStravaAuth] Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        if (data?.success) {
          setIsConnected(true);
          toast.success(`Conectado ao Strava com sucesso! Bem-vindo, ${data.athlete?.firstname || 'Atleta'}!`);
          localStorage.removeItem('strava_connecting');
          
          // Auto-sync activities after successful connection
          console.log('[useStravaAuth] Auto-syncing activities after connection...');
          setTimeout(() => onSyncSuccess?.(), 1000);
          return; // Success, exit the retry loop
        } else {
          const errorMsg = data?.error || data?.details || 'Resposta inválida do servidor';
          console.error(`[useStravaAuth] Strava auth failed (attempt ${attempt}):`, {
            data,
            errorMsg,
            fullData: JSON.stringify(data, null, 2)
          });
          
          if (attempt === maxRetries) {
            throw new Error(`Falha na conexão: ${errorMsg}`);
          }
          
          // Wait before retrying
          const delay = Math.pow(2, attempt) * 1000;
          console.log(`[useStravaAuth] Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (error) {
        console.error(`[useStravaAuth] Error on attempt ${attempt}:`, {
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
        console.log(`[useStravaAuth] Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    setIsConnecting(false);
  };

  return {
    isConnected,
    isConnecting,
    setIsConnected,
    setIsConnecting,
    checkStravaConnection,
    handleStravaConnect,
    handleStravaCallback
  };
};
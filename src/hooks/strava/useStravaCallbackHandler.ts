import { useEffect } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

interface UseStravaCallbackHandlerProps {
  handleStravaCallback: (code: string) => void;
  setIsConnecting: (connecting: boolean) => void;
}

export const useStravaCallbackHandler = ({ 
  handleStravaCallback, 
  setIsConnecting 
}: UseStravaCallbackHandlerProps) => {
  const { user } = useAuth();

  // Check for OAuth callback on component mount - MUST be last useEffect
  useEffect(() => {
    // Debounce to prevent multiple executions
    let timeoutId: NodeJS.Timeout;
    
    const processCallback = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const error = urlParams.get('error');
    const errorDescription = urlParams.get('error_description');
    const state = urlParams.get('state');
    const storedState = localStorage.getItem('strava_state');
    const isConnecting = localStorage.getItem('strava_connecting') === 'true';
    
    console.log('[useStravaCallbackHandler] ===== CALLBACK CHECK =====');
    console.log('[useStravaCallbackHandler] Current URL:', window.location.href);
    console.log('[useStravaCallbackHandler] URL Search Params:', window.location.search);
    console.log('[useStravaCallbackHandler] Callback analysis:', {
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
    console.log('[useStravaCallbackHandler] LocalStorage state:', {
      connecting: localStorage.getItem('strava_connecting'),
      state: localStorage.getItem('strava_state'),
      connectTime: localStorage.getItem('strava_connect_time')
    });
    
    if (error && isConnecting) {
      // User denied authorization or other OAuth error
      console.error('[useStravaCallbackHandler] OAuth error from Strava:', { error, errorDescription });
      let errorMessage = 'Autorização negada pelo usuário';
      
      if (error === 'access_denied') {
        errorMessage = 'Você precisa autorizar o acesso ao Strava para continuar';
      } else if (errorDescription) {
        errorMessage = errorDescription;
      }
      
      toast.error(`Erro na conexão: ${errorMessage}`);
      localStorage.removeItem('strava_connecting');
      localStorage.removeItem('strava_state');
      setIsConnecting(false);
      
      // Clean URL completely
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.delete('code');
      currentUrl.searchParams.delete('state');
      currentUrl.searchParams.delete('error');
      currentUrl.searchParams.delete('error_description');
      window.history.replaceState({}, document.title, currentUrl.pathname);
      return;
    }
    
    if (code && isConnecting && user) {
      // Validate state parameter for security
      if (state && storedState && state !== storedState) {
        console.error('[useStravaCallbackHandler] State parameter mismatch - possible CSRF attack');
        toast.error('Erro de segurança na autenticação. Tente novamente.');
        localStorage.removeItem('strava_connecting');
        localStorage.removeItem('strava_state');
        setIsConnecting(false);
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
      }
      
      // Check if code was already processed (prevent reuse)
      const processedCode = localStorage.getItem('strava_processed_code');
      if (processedCode === code) {
        console.warn('[useStravaCallbackHandler] Code already processed, ignoring');
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
      }
      
      // Check connection timeout (10 minutes)
      const connectTime = localStorage.getItem('strava_connect_time');
      if (connectTime && Date.now() - parseInt(connectTime) > 600000) {
        console.error('[useStravaCallbackHandler] Connection timeout - code expired');
        toast.error('Código de autorização expirou. Tente conectar novamente.');
        localStorage.removeItem('strava_connecting');
        localStorage.removeItem('strava_state');
        localStorage.removeItem('strava_connect_time');
        setIsConnecting(false);
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
      }
      
      console.log('[useStravaCallbackHandler] Processing Strava OAuth callback...');
      localStorage.setItem('strava_processed_code', code); // Mark code as processed
      localStorage.removeItem('strava_state'); // Clean up state
      handleStravaCallback(code);
      
      // Clean URL immediately
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.delete('code');
      currentUrl.searchParams.delete('state');
      currentUrl.searchParams.delete('scope');
      window.history.replaceState({}, document.title, currentUrl.pathname);
    } else if (code && !isConnecting) {
      console.warn('[useStravaCallbackHandler] Code found but not in connecting state');
      // Clean up the URL anyway
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (!code && isConnecting && window.location.pathname === '/strava') {
      // User is on /strava page but no code and was connecting - likely denied or error
      console.warn('[useStravaCallbackHandler] User returned to /strava without code during connection process');
      
      // Check if this might be a denied authorization
      setTimeout(() => {
        if (localStorage.getItem('strava_connecting') === 'true') {
          console.log('[useStravaCallbackHandler] Assuming authorization was denied or failed');
          toast.error('Conexão cancelada. Tente conectar novamente ao Strava.');
          localStorage.removeItem('strava_connecting');
          setIsConnecting(false);
        }
      }, 2000); // Give some time for potential delayed redirects
    }
    };
    
    // Debounce callback processing
    timeoutId = setTimeout(processCallback, 100);
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [user, handleStravaCallback, setIsConnecting]); // Add dependencies
};
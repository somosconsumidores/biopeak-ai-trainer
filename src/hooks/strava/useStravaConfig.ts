import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StravaConfig } from "@/types/strava";

export const useStravaConfig = () => {
  // IMMEDIATE fallback configuration - always available
  const getDefaultConfig = (): StravaConfig => {
    const hostname = window.location.hostname;
    const origin = window.location.origin;
    
    console.log('[useStravaConfig] Detecting environment:', { hostname, origin });
    
    const isProduction = hostname === 'biopeak-ai.com' || hostname === 'www.biopeak-ai.com';
    const isPreview = hostname.includes('lovable.app') || hostname.includes('lovableproject.com');
    
    let redirectUri;
    if (isProduction) {
      redirectUri = 'https://biopeak-ai.com/strava';
      console.log('[useStravaConfig] Using production config');
    } else if (isPreview) {
      redirectUri = 'https://preview--biopeak-ai-trainer.lovable.app/strava';
      console.log('[useStravaConfig] Using preview config:', redirectUri);
    } else {
      redirectUri = `${origin}/strava`;
      console.log('[useStravaConfig] Using local/development config:', redirectUri);
    }
    
    return {
      clientId: '142473',
      redirectUri,
      fallback: true,
      environment: isProduction ? 'production' : isPreview ? 'preview' : 'development'
    };
  };

  const [stravaConfig, setStravaConfig] = useState<StravaConfig>(getDefaultConfig());

  const loadStravaConfig = async () => {
    try {
      console.log('[useStravaConfig] Trying to load enhanced config from edge function...');
      console.log('[useStravaConfig] Current environment:', window.location.hostname);
      
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 5000)
      );
      
      const configPromise = supabase.functions.invoke('strava-config', {
        headers: { 'Content-Type': 'application/json' }
      });
      
      const { data, error } = await Promise.race([configPromise, timeoutPromise]) as any;
      
      if (!error && data?.clientId) {
        console.log('[useStravaConfig] Enhanced config loaded from edge function:', {
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
        console.log('[useStravaConfig] Edge function failed, keeping default config:', { error, data });
      }
    } catch (error) {
      console.log('[useStravaConfig] Edge function call failed, keeping default config:', error.message);
    }
  };

  useEffect(() => {
    // Try to load from edge function but don't block UI
    loadStravaConfig();
  }, []);

  return {
    stravaConfig,
    loadStravaConfig
  };
};
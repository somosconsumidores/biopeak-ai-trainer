const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

Deno.serve(async (req) => {
  console.log(`[strava-config] ${req.method} request received from ${req.headers.get('origin') || 'unknown origin'}`)
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('[strava-config] Handling OPTIONS request')
    return new Response(null, { headers: corsHeaders })
  }

  // Accept GET and POST requests
  if (req.method !== 'GET' && req.method !== 'POST') {
    console.log(`[strava-config] Method ${req.method} not allowed`)
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const clientId = Deno.env.get('STRAVA_CLIENT_ID')
    
    console.log('[strava-config] STRAVA_CLIENT_ID configured:', !!clientId)
    
    if (!clientId) {
      console.error('[strava-config] STRAVA_CLIENT_ID not configured')
      return new Response(JSON.stringify({ 
        error: 'Strava configuration missing',
        details: 'STRAVA_CLIENT_ID não configurado nos secrets do Supabase'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Smart redirect URI logic with environment detection
    const origin = req.headers.get('origin') || req.headers.get('referer')
    const host = req.headers.get('host')
    const forwardedHost = req.headers.get('x-forwarded-host')
    
    console.log('[strava-config] Request headers:', {
      origin,
      host,
      forwardedHost,
      userAgent: req.headers.get('user-agent')
    })
    
    let redirectUri = 'https://preview--biopeak-ai-trainer.lovable.app/strava' // Use preview URL that matches Strava app config
    
    // Environment detection logic - prioritize preview URL that matches Strava app configuration
    if (origin && origin.includes('preview--biopeak-ai-trainer.lovable.app')) {
      redirectUri = 'https://preview--biopeak-ai-trainer.lovable.app/strava'
      console.log('[strava-config] Using preview environment:', redirectUri)
    } else if (origin && origin.includes('f57b9513-c7c3-4577-8f1c-9c357d60d4b2.lovableproject.com')) {
      redirectUri = 'https://preview--biopeak-ai-trainer.lovable.app/strava' // Still use preview URL to match Strava config
      console.log('[strava-config] Using preview URL for current project environment:', redirectUri)
    } else if (forwardedHost && forwardedHost.includes('biopeak-ai.com')) {
      redirectUri = 'https://biopeak-ai.com/strava'
      console.log('[strava-config] Detected production environment via forwarded host')
    } else if (host && host.includes('biopeak-ai.com')) {
      redirectUri = 'https://biopeak-ai.com/strava'
      console.log('[strava-config] Detected production environment via host')
    } else if (origin && origin.includes('biopeak-ai.com')) {
      redirectUri = 'https://biopeak-ai.com/strava'
      console.log('[strava-config] Detected production environment via origin')
    } else if (origin) {
      // For preview, local development or other environments
      try {
        const url = new URL(origin)
        const hostname = url.hostname
        
        if (hostname === 'localhost' || hostname.includes('127.0.0.1')) {
          redirectUri = `${url.origin}/strava`
          console.log('[strava-config] Using local development environment:', redirectUri)
        } else if (hostname.includes('lovable.app') || hostname.includes('lovableproject.com')) {
          redirectUri = `${url.origin}/strava`
          console.log('[strava-config] Using Lovable environment:', redirectUri)
        } else {
          redirectUri = `${url.origin}/strava`
          console.log('[strava-config] Using other environment:', redirectUri)
        }
      } catch (e) {
        console.warn('[strava-config] Failed to parse origin, using production fallback:', e)
      }
    }
    
    console.log('[strava-config] Final redirect URI:', redirectUri)

    const response = {
      clientId: clientId,
      redirectUri: redirectUri,
      timestamp: new Date().toISOString()
    }

    console.log('[strava-config] Sending response:', response)

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('[strava-config] Error in function:', error)
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
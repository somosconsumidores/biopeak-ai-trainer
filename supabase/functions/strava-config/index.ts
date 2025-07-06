const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  console.log(`[strava-config] ${req.method} request received`)
  
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

    // Simplified redirect URI logic
    const origin = req.headers.get('origin') || req.headers.get('referer')
    let redirectUri = '/'
    
    if (origin) {
      try {
        const url = new URL(origin)
        redirectUri = `${url.origin}/`
      } catch (e) {
        console.warn('[strava-config] Failed to parse origin, using root:', e)
      }
    }
    
    console.log('[strava-config] Using redirect URI:', redirectUri)

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
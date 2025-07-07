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

    // Force preview URL for consistent OAuth configuration
    const redirectUri = 'https://preview--biopeak-ai-trainer.lovable.app/strava'
    
    console.log('[strava-config] Using consistent preview URL for OAuth:', redirectUri)
    
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
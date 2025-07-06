import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  console.log(`[strava-config] ${req.method} request received from:`, req.headers.get('origin'))
  console.log(`[strava-config] Request URL:`, req.url)
  console.log(`[strava-config] User-Agent:`, req.headers.get('user-agent'))
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('[strava-config] Handling OPTIONS request')
    return new Response(null, { headers: corsHeaders })
  }

  // Accept both GET and POST requests
  if (req.method !== 'GET' && req.method !== 'POST') {
    console.log(`[strava-config] Method ${req.method} not allowed`)
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    const clientId = Deno.env.get('STRAVA_CLIENT_ID')
    
    console.log('[strava-config] STRAVA_CLIENT_ID configured:', !!clientId)
    if (clientId) {
      console.log('[strava-config] Client ID length:', clientId.length)
      console.log('[strava-config] Client ID preview:', clientId.substring(0, 8) + '...')
    } else {
      console.error('[strava-config] STRAVA_CLIENT_ID is missing!')
    }
    
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

    // Get origin from request
    const origin = req.headers.get('origin')
    const referer = req.headers.get('referer')
    const host = req.headers.get('host')
    
    console.log('[strava-config] Origin:', origin)
    console.log('[strava-config] Referer:', referer)
    console.log('[strava-config] Host:', host)
    
    // Determine the correct redirect URI
    let redirectOrigin = origin
    
    if (!redirectOrigin && referer) {
      // Extract origin from referer
      try {
        const refererUrl = new URL(referer)
        redirectOrigin = refererUrl.origin
      } catch (e) {
        console.warn('[strava-config] Failed to parse referer URL:', e)
      }
    }
    
    // Default fallback logic
    if (!redirectOrigin) {
      // Check if this is a preview domain based on the request URL
      const requestUrl = new URL(req.url)
      if (requestUrl.hostname.includes('lovableproject.com')) {
        redirectOrigin = `https://${requestUrl.hostname}`
        console.log('[strava-config] Using preview domain from request URL:', redirectOrigin)
      } else {
        // Production fallback
        redirectOrigin = 'https://biopeak-ai.com'
        console.log('[strava-config] Using production fallback:', redirectOrigin)
      }
    }
    
    const redirectUri = `${redirectOrigin}/`
    console.log('[strava-config] Final redirect URI:', redirectUri)

    const response = {
      clientId: clientId,
      redirectUri: redirectUri,
      debug: {
        origin,
        referer,
        host,
        timestamp: new Date().toISOString()
      }
    }

    console.log('[strava-config] Sending response:', JSON.stringify(response, null, 2))

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
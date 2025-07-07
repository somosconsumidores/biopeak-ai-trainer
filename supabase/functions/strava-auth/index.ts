
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface StravaTokenResponse {
  access_token: string
  refresh_token: string
  expires_at: number
  athlete: {
    id: number
    firstname: string
    lastname: string
  }
}

Deno.serve(async (req) => {
  console.log(`[strava-auth] ${req.method} request received from ${req.headers.get('origin') || 'unknown'}`)
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('[strava-auth] Handling CORS preflight')
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('[strava-auth] Starting authentication process...')
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.error('[strava-auth] No Authorization header provided')
      return new Response(JSON.stringify({ error: 'Authorization header required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    
    const token = authHeader.replace('Bearer ', '')
    console.log('[strava-auth] Auth token present:', !!token)
    
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
    if (authError) {
      console.error('[strava-auth] Auth error:', authError)
      return new Response(JSON.stringify({ error: 'Authentication failed', details: authError.message }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    
    if (!user) {
      console.error('[strava-auth] No user found from token')
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    
    console.log('[strava-auth] Authenticated user:', user.id)

    let requestBody;
    try {
      requestBody = await req.json()
      console.log('[strava-auth] Request body parsed successfully')
    } catch (parseError) {
      console.error('[strava-auth] Failed to parse request body:', parseError)
      return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { code } = requestBody
    
    console.log('[strava-auth] Received authorization code:', code ? 'present' : 'missing')
    
    if (!code) {
      console.error('[strava-auth] No authorization code provided')
      return new Response(JSON.stringify({ error: 'Authorization code required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Exchange authorization code for access token
    const clientId = Deno.env.get('STRAVA_CLIENT_ID')
    const clientSecret = Deno.env.get('STRAVA_CLIENT_SECRET')
    
    console.log('[strava-auth] Using client ID:', clientId ? 'configured' : 'missing')
    console.log('[strava-auth] Using client secret:', clientSecret ? 'configured' : 'missing')
    
    if (!clientId || !clientSecret) {
      console.error('[strava-auth] Missing Strava credentials - Client ID:', !!clientId, 'Client Secret:', !!clientSecret)
      return new Response(JSON.stringify({ 
        error: 'Strava credentials not configured',
        details: `Missing: ${!clientId ? 'STRAVA_CLIENT_ID ' : ''}${!clientSecret ? 'STRAVA_CLIENT_SECRET' : ''}`.trim()
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    
    console.log('[strava-auth] Exchanging code for token...')
    const tokenResponse = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('[strava-auth] Strava token exchange failed:', {
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        body: errorText
      })
      return new Response(JSON.stringify({ 
        error: 'Failed to exchange authorization code',
        details: errorText 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const tokenData: StravaTokenResponse = await tokenResponse.json()
    console.log('[strava-auth] Token exchange successful, storing in database...')
    
    // Store tokens in database
    const { error: upsertError } = await supabaseClient
      .from('strava_tokens')
      .upsert({
        user_id: user.id,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: new Date(tokenData.expires_at * 1000).toISOString(),
      })

    if (upsertError) {
      console.error('[strava-auth] Error storing Strava tokens:', upsertError)
      return new Response(JSON.stringify({ error: 'Failed to store tokens', details: upsertError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log('[strava-auth] Strava integration successful for user:', user.id)

    return new Response(JSON.stringify({ 
      success: true,
      athlete: tokenData.athlete 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('[strava-auth] Error in strava-auth function:', error)
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

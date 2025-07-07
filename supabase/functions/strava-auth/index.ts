
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
    console.log('[strava-auth] Request origin:', req.headers.get('origin'))
    console.log('[strava-auth] Request referer:', req.headers.get('referer'))
    console.log('[strava-auth] User agent:', req.headers.get('user-agent'))
    
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
      const bodyText = await req.text();
      console.log('[strava-auth] Raw request body:', bodyText);
      
      if (!bodyText || bodyText.trim() === '') {
        console.error('[strava-auth] Empty request body received');
        return new Response(JSON.stringify({ error: 'Empty request body' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      requestBody = JSON.parse(bodyText);
      console.log('[strava-auth] Request body parsed successfully:', requestBody);
    } catch (parseError) {
      console.error('[strava-auth] Failed to parse request body:', parseError);
      console.error('[strava-auth] Parse error details:', {
        message: parseError.message,
        name: parseError.name,
        stack: parseError.stack
      });
      return new Response(JSON.stringify({ 
        error: 'Invalid JSON in request body',
        details: parseError.message 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { code, redirect_uri } = requestBody
    
    console.log('[strava-auth] Received authorization code and redirect_uri:', {
      hasCode: !!code,
      codeLength: code?.length,
      codePreview: code ? `${code.substring(0, 8)}...` : null,
      redirect_uri,
      userId: user.id
    })
    
    // Validate authorization code format (Strava codes are typically 40 characters)
    if (!code) {
      console.error('[strava-auth] No authorization code provided')
      return new Response(JSON.stringify({ error: 'Authorization code required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    
    if (typeof code !== 'string' || code.length < 20 || code.length > 80) {
      console.error('[strava-auth] Invalid authorization code format:', {
        type: typeof code,
        length: code?.length,
        preview: typeof code === 'string' ? `${code.substring(0, 8)}...` : 'not string'
      })
      return new Response(JSON.stringify({ 
        error: 'Invalid authorization code format',
        details: 'Authorization code must be a valid string from Strava'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    
    // Validate redirect_uri
    if (!redirect_uri || typeof redirect_uri !== 'string') {
      console.error('[strava-auth] Invalid redirect_uri:', redirect_uri)
      return new Response(JSON.stringify({ 
        error: 'Invalid redirect_uri',
        details: 'redirect_uri is required and must be a valid URL'
      }), {
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
    
    const tokenRequestBody = {
      client_id: clientId,
      client_secret: clientSecret,
      code: code,
      grant_type: 'authorization_code',
      redirect_uri: redirect_uri
    };
    
    console.log('[strava-auth] Token request body:', {
      client_id: clientId,
      client_secret: clientSecret ? 'configured' : 'missing',
      code: code,
      grant_type: 'authorization_code',
      redirect_uri: redirect_uri
    })
    
    console.log('[strava-auth] Making token request to Strava...')
    
    const tokenResponse = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(tokenRequestBody),
    })

    console.log('[strava-auth] Strava token response status:', tokenResponse.status)
    console.log('[strava-auth] Strava token response headers:', Object.fromEntries(tokenResponse.headers.entries()))

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('[strava-auth] Strava token exchange failed:', {
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        body: errorText,
        headers: Object.fromEntries(tokenResponse.headers.entries()),
        requestBody: {
          client_id: clientId,
          grant_type: 'authorization_code',
          redirect_uri: redirect_uri,
          code_preview: code ? `${code.substring(0, 8)}...${code.substring(code.length - 4)}` : null,
          code_length: code?.length
        }
      })
      
      // Parse Strava error response for better error messages
      let errorMessage = 'Failed to exchange authorization code'
      let errorDetails = errorText
      
      try {
        const errorJson = JSON.parse(errorText)
        console.error('[strava-auth] Parsed Strava error:', errorJson)
        
        if (errorJson.message) {
          errorDetails = errorJson.message
          if (errorJson.message.includes('invalid')) {
            errorMessage = 'Invalid authorization code or expired'
          } else if (errorJson.message.includes('redirect_uri')) {
            errorMessage = 'Redirect URI mismatch - check Strava app settings'
          } else if (errorJson.message.includes('client')) {
            errorMessage = 'Invalid client credentials'
          }
        }
        
        if (errorJson.errors) {
          errorDetails = `${errorDetails} - Errors: ${JSON.stringify(errorJson.errors)}`
        }
      } catch (e) {
        console.warn('[strava-auth] Could not parse Strava error as JSON:', e)
      }
      
      return new Response(JSON.stringify({ 
        error: errorMessage,
        details: errorDetails,
        strava_status: tokenResponse.status,
        debug_info: {
          client_id: clientId,
          redirect_uri: redirect_uri,
          timestamp: new Date().toISOString()
        }
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const tokenData: StravaTokenResponse = await tokenResponse.json()
    console.log('[strava-auth] Token exchange successful, storing in database...')
    
    // Store tokens in database
    console.log('[strava-auth] About to store tokens in database for user:', user.id)
    console.log('[strava-auth] Token data structure:', {
      hasAccessToken: !!tokenData.access_token,
      hasRefreshToken: !!tokenData.refresh_token,
      expiresAt: tokenData.expires_at,
      athlete: tokenData.athlete?.id
    })
    
    const { error: upsertError } = await supabaseClient
      .from('strava_tokens')
      .upsert({
        user_id: user.id,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: new Date(tokenData.expires_at * 1000).toISOString(),
      })

    console.log('[strava-auth] Upsert result:', { 
      error: upsertError,
      errorCode: upsertError?.code,
      errorMessage: upsertError?.message,
      errorDetails: upsertError?.details
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

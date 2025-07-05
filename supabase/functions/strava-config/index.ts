import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const clientId = Deno.env.get('STRAVA_CLIENT_ID')
    
    console.log('STRAVA_CLIENT_ID configured:', !!clientId)
    console.log('Client ID value (first 10 chars):', clientId ? clientId.substring(0, 10) + '...' : 'MISSING')
    
    if (!clientId) {
      console.error('STRAVA_CLIENT_ID not configured')
      return new Response(JSON.stringify({ 
        error: 'Strava configuration missing',
        details: 'STRAVA_CLIENT_ID não configurado nos secrets do Supabase'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log('Returning Strava client ID for user:', user.id)

    // Get the origin from the request headers to use the correct domain
    const origin = req.headers.get('origin') || req.headers.get('referer')?.split('/').slice(0, 3).join('/') || 'https://f57b9513-c7c3-4577-8f1c-9c357d60d4b2.lovableproject.com'
    
    console.log('Using redirect URI origin:', origin)

    return new Response(JSON.stringify({ 
      clientId: clientId,
      redirectUri: `${origin}/`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Error in strava-config function:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
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

    console.log('Request headers - Origin:', req.headers.get('origin'))
    console.log('Request headers - Referer:', req.headers.get('referer'))
    console.log('Request headers - Host:', req.headers.get('host'))
    console.log('Request URL:', req.url)
    
    // Get the origin from the request headers to use the correct domain
    let origin = req.headers.get('origin') || req.headers.get('referer')?.split('/').slice(0, 3).join('/')
    
    console.log('Initial origin detected:', origin)
    
    // Use the appropriate domain based on the request
    if (!origin || origin.includes('lovableproject.com') || origin.includes('biopeak-ai.com')) {
      if (origin && origin.includes('lovable')) {
        // Keep lovable preview domain
        console.log('Using preview domain:', origin)
      } else {
        // Use production domain
        origin = 'https://biopeak-ai.com'
        console.log('Using production domain: biopeak-ai.com')
      }
    }
    
    console.log('Final redirect URI origin:', origin)

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
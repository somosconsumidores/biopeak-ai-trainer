import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  console.log('[strava-sync-test] Function called, method:', req.method)
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('[strava-sync-test] Handling CORS preflight')
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('[strava-sync-test] Starting test function...')
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )
    console.log('[strava-sync-test] Supabase client created')

    const authHeader = req.headers.get('Authorization')
    console.log('[strava-sync-test] Auth header present:', !!authHeader)
    
    if (!authHeader) {
      console.error('[strava-sync-test] No Authorization header')
      return new Response(JSON.stringify({ error: 'Authorization header required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    
    const token = authHeader.replace('Bearer ', '')
    console.log('[strava-sync-test] Token extracted, length:', token?.length)
    
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
    console.log('[strava-sync-test] Auth check result:', { hasUser: !!user, authError: !!authError })
    
    if (authError || !user) {
      console.error('[strava-sync-test] Authentication failed:', authError?.message)
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log('[strava-sync-test] User authenticated:', user.id)

    // Test basic functionality
    return new Response(JSON.stringify({ 
      success: true,
      message: 'Test function works',
      userId: user.id,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('[strava-sync-test] Caught error:', error)
    console.error('[strava-sync-test] Error message:', error?.message)
    console.error('[strava-sync-test] Error stack:', error?.stack)
    
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error?.message || 'Unknown error',
      errorType: error?.name || 'Unknown',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
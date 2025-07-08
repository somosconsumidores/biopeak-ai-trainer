interface StravaTokenData {
  access_token: string
  refresh_token: string
  expires_at: string
}

// Helper function to get user's Strava tokens
export async function getStravaTokens(supabaseClient: any, userId: string): Promise<StravaTokenData> {
  console.log('[strava-sync] Fetching Strava tokens for user:', userId)
  
  const { data: tokenData, error: tokenError } = await supabaseClient
    .from('strava_tokens')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  console.log('[strava-sync] Token fetch result:', {
    hasTokenData: !!tokenData,
    tokenError: tokenError,
    userId: userId
  })

  if (tokenError) {
    console.error('[strava-sync] Error fetching Strava tokens:', tokenError)
    throw new Error('Error fetching Strava connection')
  }
  
  if (!tokenData) {
    console.log('[strava-sync] No Strava tokens found for user:', userId)
    throw new Error('Strava not connected')
  }

  return tokenData
}

// Helper function to refresh expired Strava tokens
export async function refreshStravaToken(tokenData: StravaTokenData, supabaseClient: any, userId: string): Promise<string> {
  console.log('Token expired, refreshing...')
  
  const refreshResponse = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: Deno.env.get('STRAVA_CLIENT_ID'),
      client_secret: Deno.env.get('STRAVA_CLIENT_SECRET'),
      refresh_token: tokenData.refresh_token,
      grant_type: 'refresh_token',
    }),
  })

  if (!refreshResponse.ok) {
    const errorText = await refreshResponse.text()
    console.error('Failed to refresh Strava token:', {
      status: refreshResponse.status,
      body: errorText
    })
    throw new Error(`Failed to refresh Strava token: ${errorText}`)
  }

  const refreshData = await refreshResponse.json()

  // Update tokens in database
  const { error: updateError } = await supabaseClient
    .from('strava_tokens')
    .update({
      access_token: refreshData.access_token,
      refresh_token: refreshData.refresh_token,
      expires_at: new Date(refreshData.expires_at * 1000).toISOString(),
    })
    .eq('user_id', userId)
  
  if (updateError) {
    console.error('[strava-sync] Error updating refreshed tokens:', updateError)
  }

  return refreshData.access_token
}

// Helper function to ensure valid access token
export async function ensureValidAccessToken(supabaseClient: any, userId: string): Promise<string> {
  const tokenData = await getStravaTokens(supabaseClient, userId)
  
  // Check if token is expired and refresh if needed
  const now = new Date()
  const expiresAt = new Date(tokenData.expires_at)
  
  if (now >= expiresAt) {
    return await refreshStravaToken(tokenData, supabaseClient, userId)
  }
  
  return tokenData.access_token
}
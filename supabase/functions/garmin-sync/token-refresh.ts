/**
 * Token refresh utilities for Garmin OAuth 2.0
 */

export interface TokenRefreshResult {
  success: boolean;
  accessToken?: string;
  tokenSecret?: string;
  expiresAt?: string;
  error?: string;
}

/**
 * Refresh expired Garmin tokens using the refresh token
 */
export async function refreshGarminTokens(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<TokenRefreshResult> {
  try {
    console.log('🔄 Attempting to refresh Garmin tokens...');
    
    // Prepare the request data for OAuth 2.0 token refresh
    const tokenUrl = 'https://connect.garmin.com/oauth-service/oauth/token';
    
    // Create Basic Auth header for client credentials
    const authHeader = btoa(`${clientId}:${clientSecret}`);
    
    const requestBody = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    });

    console.log('Making token refresh request to Garmin...');
    
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${authHeader}`,
        'Accept': 'application/json'
      },
      body: requestBody.toString()
    });

    const responseText = await response.text();
    console.log('Token refresh response:', {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      body: responseText
    });

    if (!response.ok) {
      console.error('Token refresh failed:', {
        status: response.status,
        body: responseText
      });
      
      return {
        success: false,
        error: `Token refresh failed: ${response.status} ${response.statusText}`
      };
    }

    let tokenData;
    try {
      tokenData = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse token response:', parseError);
      return {
        success: false,
        error: 'Invalid token response format'
      };
    }

    // Validate the response contains required fields
    if (!tokenData.access_token) {
      console.error('Token response missing access_token:', tokenData);
      return {
        success: false,
        error: 'Token response missing access_token'
      };
    }

    // Calculate expiration time
    const expiresIn = tokenData.expires_in || 86400; // Default 24 hours
    const expiresAt = new Date(Date.now() + (expiresIn * 1000));

    console.log('✅ Token refresh successful:', {
      hasAccessToken: !!tokenData.access_token,
      hasRefreshToken: !!tokenData.refresh_token,
      expiresIn,
      expiresAt: expiresAt.toISOString()
    });

    return {
      success: true,
      accessToken: tokenData.access_token,
      tokenSecret: tokenData.refresh_token || refreshToken, // Use new refresh token if provided
      expiresAt: expiresAt.toISOString()
    };

  } catch (error) {
    console.error('Token refresh error:', error);
    return {
      success: false,
      error: `Token refresh error: ${error.message}`
    };
  }
}

/**
 * Check if tokens are expired and refresh if needed
 */
export async function ensureValidTokens(
  supabase: any,
  userId: string,
  clientId: string,
  clientSecret: string
): Promise<{ accessToken: string; tokenSecret: string; error?: string }> {
  try {
    console.log('🔍 Checking token validity for user:', userId);
    
    // Get current tokens
    const { data: tokenData, error: tokenError } = await supabase
      .from('garmin_tokens')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (tokenError || !tokenData) {
      return { 
        accessToken: '', 
        tokenSecret: '', 
        error: 'No Garmin tokens found' 
      };
    }

    // Check if tokens are expired
    const expiresAt = new Date(tokenData.expires_at);
    const now = new Date();
    const timeUntilExpiry = expiresAt.getTime() - now.getTime();
    const minutesUntilExpiry = timeUntilExpiry / (1000 * 60);

    console.log('Token expiry check:', {
      expiresAt: expiresAt.toISOString(),
      now: now.toISOString(),
      minutesUntilExpiry: Math.round(minutesUntilExpiry),
      isExpired: expiresAt <= now
    });

    // If tokens are expired or expire within 5 minutes, refresh them
    if (minutesUntilExpiry <= 5) {
      console.log('🔄 Tokens are expired or expiring soon, attempting refresh...');
      
      if (!tokenData.refresh_token) {
        return {
          accessToken: '',
          tokenSecret: '',
          error: 'No refresh token available'
        };
      }

      const refreshResult = await refreshGarminTokens(
        tokenData.refresh_token,
        clientId,
        clientSecret
      );

      if (!refreshResult.success) {
        console.error('Token refresh failed:', refreshResult.error);
        return {
          accessToken: '',
          tokenSecret: '',
          error: refreshResult.error
        };
      }

      // Update tokens in database
      console.log('💾 Updating refreshed tokens in database...');
      const { error: updateError } = await supabase
        .from('garmin_tokens')
        .update({
          access_token: refreshResult.accessToken,
          token_secret: refreshResult.tokenSecret,
          refresh_token: refreshResult.tokenSecret, // Store refresh token
          expires_at: refreshResult.expiresAt,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (updateError) {
        console.error('Failed to update tokens:', updateError);
        return {
          accessToken: '',
          tokenSecret: '',
          error: 'Failed to update refreshed tokens'
        };
      }

      console.log('✅ Tokens refreshed and updated successfully');
      return {
        accessToken: refreshResult.accessToken!,
        tokenSecret: refreshResult.tokenSecret!
      };
    }

    // Tokens are still valid
    console.log('✅ Tokens are still valid');
    return {
      accessToken: tokenData.access_token,
      tokenSecret: tokenData.token_secret
    };

  } catch (error) {
    console.error('Error ensuring valid tokens:', error);
    return {
      accessToken: '',
      tokenSecret: '',
      error: `Token validation error: ${error.message}`
    };
  }
}
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
    
    // Garmin uses OAuth 2.0 with JWT tokens
    // The refresh token is base64 encoded JSON containing refreshTokenValue and garminGuid
    let decodedRefreshToken;
    try {
      const decoded = atob(refreshToken);
      decodedRefreshToken = JSON.parse(decoded);
      console.log('Decoded refresh token structure:', { 
        hasRefreshTokenValue: !!decodedRefreshToken.refreshTokenValue,
        hasGarminGuid: !!decodedRefreshToken.garminGuid 
      });
    } catch (decodeError) {
      console.error('Failed to decode refresh token:', decodeError);
      return {
        success: false,
        error: 'Invalid refresh token format'
      };
    }
    
    // Prepare the request data for Garmin OAuth 2.0 token refresh
    const tokenUrl = 'https://diauth.garmin.com/token';
    
    const requestBody = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: decodedRefreshToken.refreshTokenValue,
      client_id: clientId,
      client_secret: clientSecret
    });

    console.log('Making token refresh request to Garmin...');
    
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
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

    // For Garmin OAuth 2.0, we need to encode the new refresh token if provided
    let newRefreshToken = refreshToken; // Default to current refresh token
    if (tokenData.refresh_token) {
      // If Garmin provides a new refresh token, use it
      // Check if it's already properly formatted or needs encoding
      try {
        JSON.parse(atob(tokenData.refresh_token));
        newRefreshToken = tokenData.refresh_token; // It's already base64 encoded
      } catch {
        // It might be a plain refresh token that needs to be combined with garmin guid
        const decodedCurrentToken = JSON.parse(atob(refreshToken));
        const newTokenObj = {
          refreshTokenValue: tokenData.refresh_token,
          garminGuid: decodedCurrentToken.garminGuid
        };
        newRefreshToken = btoa(JSON.stringify(newTokenObj));
      }
    }

    return {
      success: true,
      accessToken: tokenData.access_token,
      tokenSecret: newRefreshToken, // This will be stored as token_secret
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
      .maybeSingle();

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
          token_secret: tokenData.token_secret, // Keep the original token_secret (not refresh token)
          refresh_token: refreshResult.tokenSecret, // Store new refresh token
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
        tokenSecret: tokenData.token_secret // Return original token_secret
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
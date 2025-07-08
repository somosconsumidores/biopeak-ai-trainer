import { generateSignature, buildAuthorizationHeader } from './oauth-utils.ts';

// Make authenticated API call to Garmin
export async function makeGarminApiCall(url: string, accessToken: string, tokenSecret: string, clientId: string, clientSecret: string) {
  console.log(`Making OAuth 1.0 call to: ${url}`);
  console.log('Token validation:', {
    accessToken: accessToken?.substring(0, 8) + '...',
    tokenSecret: tokenSecret?.substring(0, 8) + '...',
    clientId: clientId?.substring(0, 8) + '...',
    clientSecret: clientSecret ? 'present' : 'missing'
  });
  
  // Validate that we have real tokens, not demo UUIDs
  if (accessToken?.includes('-') && accessToken.length === 36) {
    console.warn('Access token appears to be a UUID (demo token)');
    throw new Error('Demo tokens cannot be used for real API calls');
  }
  
  const apiParams = {
    oauth_consumer_key: clientId,
    oauth_token: accessToken,
    oauth_nonce: Math.random().toString(36).substring(2, 15),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_version: '1.0'
  };

  console.log('OAuth parameters:', { ...apiParams, oauth_signature: '[will be generated]' });

  // Generate signature (exclude oauth_signature from params for signature generation)
  const signature = await generateSignature('GET', url, apiParams, clientSecret, tokenSecret);
  
  console.log('Generated signature:', signature);
  
  // Build authorization header
  const authParams = {
    ...apiParams,
    oauth_signature: signature
  };
  
  const authHeader = buildAuthorizationHeader(authParams);
  
  console.log('Authorization header:', authHeader);

  // Headers according to official Garmin API documentation
  const headers = {
    'Authorization': authHeader,
    'Accept': 'application/json;charset=UTF-8',
    'User-Agent': 'Mozilla/5.0 (compatible; GarminConnect/1.0; +https://connect.garmin.com)',
    'Cache-Control': 'no-cache'
  };

  console.log('Request headers:', headers);

  // Make API call with enhanced error handling
  const response = await fetch(url, {
    method: 'GET',
    headers
  });

  console.log('Response status:', response.status);
  console.log('Response status text:', response.statusText);
  console.log('Response headers:', Object.fromEntries(response.headers.entries()));
  
  // Log response body preview for debugging (first 500 chars)
  if (!response.ok) {
    const responseClone = response.clone();
    const errorPreview = await responseClone.text();
    console.log('Error response preview:', errorPreview.substring(0, 500) + (errorPreview.length > 500 ? '...' : ''));
  }

  return response;
}

export function getGarminApiEndpoints() {
  const baseUrl = 'https://connectapi.garmin.com';
  
  // Convert to UTC timestamps in seconds (official API requirement)
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const uploadStartTime = Math.floor(thirtyDaysAgo.getTime() / 1000);
  const uploadEndTime = Math.floor(now.getTime() / 1000);
  
  // Updated endpoints based on official Garmin Developer Program research
  // Note: Actual partner API endpoints may differ and require business approval
  return [
    // Primary official connectapi endpoint with time range (most likely to work)
    `${baseUrl}/activity-service/activity`,
    
    // Alternative activity service endpoints
    `${baseUrl}/activity-service/activities?uploadStartTimeInSeconds=${uploadStartTime}&uploadEndTimeInSeconds=${uploadEndTime}`,
    `${baseUrl}/activity-service/activities`,
    
    // Legacy endpoints (likely deprecated but worth testing)
    `${baseUrl}/rest/activities?uploadStartTimeInSeconds=${uploadStartTime}&uploadEndTimeInSeconds=${uploadEndTime}`,
    `${baseUrl}/rest/activities`
  ];
}

export async function fetchGarminActivities(accessToken: string, tokenSecret: string, clientId: string, clientSecret: string) {
  const apiEndpoints = getGarminApiEndpoints();
  let activitiesData = null;
  let lastError = null;
  let attemptedEndpoints = [];
  
  console.log('===== GARMIN API ENDPOINTS TEST =====');
  console.log('Total endpoints to test:', apiEndpoints.length);
  console.log('Endpoints list:', apiEndpoints);
  console.log('Token validation:', {
    accessToken: accessToken ? `${accessToken.substring(0, 8)}...` : 'Missing',
    tokenSecret: tokenSecret ? `${tokenSecret.substring(0, 8)}...` : 'Missing',
    clientId: clientId ? `${clientId.substring(0, 8)}...` : 'Missing',
    clientSecret: clientSecret ? 'Present' : 'Missing'
  });
  console.log('======================================');
  
  for (let i = 0; i < apiEndpoints.length; i++) {
    const endpoint = apiEndpoints[i];
    console.log(`\n[${i + 1}/${apiEndpoints.length}] ===== TESTING ENDPOINT =====`);
    console.log(`Endpoint: ${endpoint}`);
    attemptedEndpoints.push({
      url: endpoint,
      attempt: i + 1,
      timestamp: new Date().toISOString()
    });
    
    try {
      console.log(`🔄 Making OAuth 1.0 call...`);
      const activitiesResponse = await makeGarminApiCall(endpoint, accessToken, tokenSecret, clientId, clientSecret);
      
      console.log(`📊 Response details:`, {
        status: activitiesResponse.status,
        statusText: activitiesResponse.statusText,
        headers: Object.fromEntries(activitiesResponse.headers.entries()),
        url: endpoint
      });
      
      if (activitiesResponse.ok) {
        const responseData = await activitiesResponse.json();
        console.log(`✅ SUCCESS! Working endpoint found: ${endpoint}`);
        console.log(`📋 Response preview:`, JSON.stringify(responseData, null, 2).substring(0, 500) + '...');
        
        // Validate response structure
        if (Array.isArray(responseData)) {
          activitiesData = responseData;
          console.log(`✅ Found ${responseData.length} activities in array format`);
        } else if (responseData && typeof responseData === 'object') {
          // Handle different response formats
          activitiesData = responseData.activities || responseData.activityList || responseData.data || [responseData];
          console.log(`✅ Extracted ${activitiesData?.length || 0} activities from object format`);
          console.log(`📊 Available keys in response:`, Object.keys(responseData));
        } else {
          console.warn('⚠️ Unexpected response format, treating as single activity');
          activitiesData = [responseData];
        }
        
        console.log(`🏁 SUCCESS SUMMARY: Found ${activitiesData?.length || 0} activities using endpoint ${endpoint}`);
        break;
      } else {
        const errorText = await activitiesResponse.text();
        console.error(`❌ ENDPOINT FAILED: ${endpoint}`);
        console.error(`📊 Error details: Status ${activitiesResponse.status} - ${activitiesResponse.statusText}`);
        console.error(`📄 Error body preview: ${errorText.substring(0, 300)}${errorText.length > 300 ? '...' : ''}`);
        
        // Enhanced error categorization with actionable advice
        if (activitiesResponse.status === 400) {
          console.error('🔧 Bad Request Analysis:');
          console.error('  - Possible issue: Invalid OAuth parameters or request format');
          console.error('  - Check: OAuth signature generation and timestamp format');
          lastError = `Bad Request (400) on ${endpoint}: ${errorText.substring(0, 150)}...`;
        } else if (activitiesResponse.status === 401) {
          console.error('🔐 Unauthorized Analysis:');
          console.error('  - Possible issue: Invalid OAuth signature, expired tokens, or wrong credentials');
          console.error('  - Check: GARMIN_CLIENT_ID, GARMIN_CLIENT_SECRET, and OAuth signature algorithm');
          lastError = `Unauthorized (401) on ${endpoint}: ${errorText.substring(0, 150)}...`;
          
          // For 401 errors, continue testing other endpoints to identify signature vs endpoint issues
          console.log('  - Continuing to test other endpoints to isolate the issue...');
        } else if (activitiesResponse.status === 403) {
          console.error('🚫 Forbidden Analysis:');
          console.error('  - Possible issue: Access denied, insufficient permissions, or app not approved');
          console.error('  - Check: Garmin Developer Program approval status');
          lastError = `Forbidden (403) on ${endpoint}: ${errorText.substring(0, 150)}...`;
        } else if (activitiesResponse.status === 404) {
          console.error('🔍 Not Found Analysis:');
          console.error('  - Confirmed: This endpoint does not exist or is deprecated');
          console.error('  - Action: Moving to next endpoint...');
          lastError = `Not Found (404) on ${endpoint}: Endpoint deprecated or incorrect`;
          // Continue testing other endpoints for 404s
        } else if (activitiesResponse.status === 429) {
          console.error('⏳ Rate Limited: Stopping endpoint tests to avoid further rate limiting');
          lastError = `Rate Limited (429): Too many requests`;
          break; // Stop trying other endpoints
        } else if (activitiesResponse.status >= 500) {
          console.error('🚨 Server Error: Garmin service experiencing issues');
          console.error('  - Action: Will retry with other endpoints');
          lastError = `Server Error (${activitiesResponse.status}) on ${endpoint}: ${errorText.substring(0, 150)}...`;
        } else {
          console.error(`❓ Unexpected Status: ${activitiesResponse.status}`);
          lastError = `HTTP ${activitiesResponse.status} on ${endpoint}: ${errorText.substring(0, 150)}...`;
        }
        
        // Stop early for certain error patterns
        if (activitiesResponse.status === 429) {
          console.log('🛑 Stopping due to rate limiting');
          break;
        }
      }
    } catch (error) {
      console.error(`💥 EXCEPTION on endpoint ${endpoint}:`, error);
      console.error(`🔍 Exception details:`, {
        message: error.message,
        stack: error.stack?.substring(0, 300),
        type: error.constructor.name
      });
      lastError = `Exception on ${endpoint}: ${error.message}`;
      
      // Continue to next endpoint unless it's a systematic issue
      if (error.message.includes('network') || error.message.includes('timeout')) {
        console.log('🌐 Network issue detected, continuing to test other endpoints...');
      }
    }
    
    console.log(`===== ENDPOINT ${i + 1} COMPLETE =====\n`);
  }
  
  // Final summary
  console.log('===== FINAL GARMIN API TEST SUMMARY =====');
  console.log('📊 Results:', {
    totalEndpointsTested: attemptedEndpoints.length,
    successfulActivities: activitiesData?.length || 0,
    finalError: lastError,
    workingEndpoint: activitiesData ? attemptedEndpoints[attemptedEndpoints.length - 1]?.url : 'None'
  });
  console.log('📋 All tested endpoints:', attemptedEndpoints.map(e => `${e.attempt}: ${e.url}`));
  console.log('========================================');
  
  if (!activitiesData) {
    console.log('❌ All API endpoints failed - no activities retrieved');
    console.log('🔧 Troubleshooting suggestions:');
    console.log('  1. Verify GARMIN_CLIENT_ID and GARMIN_CLIENT_SECRET are correct');
    console.log('  2. Check if Garmin Developer Program access is approved');
    console.log('  3. Validate OAuth 1.0 signature generation');
    console.log('  4. Confirm user has authorized the application');
  }

  return { activitiesData, lastError, attemptedEndpoints };
}
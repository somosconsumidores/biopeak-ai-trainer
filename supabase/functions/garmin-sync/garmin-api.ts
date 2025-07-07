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
  
  // Official Garmin Connect API endpoints based on documentation
  return [
    // Primary official endpoint with time range parameters
    `${baseUrl}/rest/activities?uploadStartTimeInSeconds=${uploadStartTime}&uploadEndTimeInSeconds=${uploadEndTime}`,
    
    // Primary endpoint without time range (all activities)
    `${baseUrl}/rest/activities`,
    
    // Alternative base URLs to test if connectapi.garmin.com doesn't work
    `https://connect.garmin.com/rest/activities?uploadStartTimeInSeconds=${uploadStartTime}&uploadEndTimeInSeconds=${uploadEndTime}`,
    `https://connect.garmin.com/rest/activities`
  ];
}

export async function fetchGarminActivities(accessToken: string, tokenSecret: string, clientId: string, clientSecret: string) {
  const apiEndpoints = getGarminApiEndpoints();
  let activitiesData = null;
  let lastError = null;
  
  console.log('Trying Garmin Connect API endpoints...');
  console.log('Using access token:', accessToken ? 'Present' : 'Missing');
  console.log('Using token secret:', tokenSecret ? 'Present' : 'Missing');
  console.log('Using client ID:', clientId ? 'Present' : 'Missing');
  console.log('Using client secret:', clientSecret ? 'Present' : 'Missing');
  
  for (const endpoint of apiEndpoints) {
    try {
      console.log(`Attempting API call to: ${endpoint}`);
      const activitiesResponse = await makeGarminApiCall(endpoint, accessToken, tokenSecret, clientId, clientSecret);
      
      console.log(`Response status for ${endpoint}:`, activitiesResponse.status);
      console.log(`Response headers:`, Object.fromEntries(activitiesResponse.headers.entries()));
      
      if (activitiesResponse.ok) {
        const responseData = await activitiesResponse.json();
        console.log(`✅ SUCCESS! Endpoint working: ${endpoint}`);
        console.log(`Response data structure:`, JSON.stringify(responseData, null, 2));
        
        // Validate response structure
        if (Array.isArray(responseData)) {
          activitiesData = responseData;
          console.log(`Found ${responseData.length} activities`);
        } else if (responseData && typeof responseData === 'object') {
          // Handle different response formats
          activitiesData = responseData.activities || responseData.activityList || responseData.data || [responseData];
          console.log(`Extracted ${activitiesData.length} activities from response object`);
        } else {
          console.warn('Unexpected response format, treating as single activity');
          activitiesData = [responseData];
        }
        break;
      } else {
        const errorText = await activitiesResponse.text();
        console.error(`❌ FAILED: ${endpoint} - Status: ${activitiesResponse.status}`);
        console.error('Error response body:', errorText);
        
        // Enhanced error categorization based on official API documentation
        if (activitiesResponse.status === 400) {
          console.error('🔧 Bad Request: Invalid parameters or request format');
          lastError = `Bad Request (400): ${errorText.substring(0, 200)}...`;
        } else if (activitiesResponse.status === 401) {
          console.error('🔐 Unauthorized: Invalid OAuth signature or expired tokens');
          lastError = `Unauthorized (401): ${errorText.substring(0, 200)}...`;
          
          // For 401, we might want to try fewer endpoints as it's likely a global auth issue
          if (apiEndpoints.indexOf(endpoint) > 1) {
            console.log('Stopping early due to repeated auth failures');
            break;
          }
        } else if (activitiesResponse.status === 403) {
          console.error('🚫 Forbidden: Access denied to this resource');
          lastError = `Forbidden (403): ${errorText.substring(0, 200)}...`;
        } else if (activitiesResponse.status === 404) {
          console.error('🔍 Not Found: Endpoint does not exist');
          lastError = `Not Found (404): ${errorText.substring(0, 200)}...`;
        } else if (activitiesResponse.status === 405) {
          console.error('🚫 Method Not Allowed: HTTP method not supported');
          lastError = `Method Not Allowed (405): ${errorText.substring(0, 200)}...`;
        } else if (activitiesResponse.status === 410) {
          console.error('📋 Gone: Resource no longer available');
          lastError = `Gone (410): ${errorText.substring(0, 200)}...`;
        } else if (activitiesResponse.status === 412) {
          console.error('⚠️ Precondition Failed: Request precondition not met');
          lastError = `Precondition Failed (412): ${errorText.substring(0, 200)}...`;
        } else if (activitiesResponse.status === 429) {
          console.error('⏳ Rate Limited: Too many requests');
          lastError = `Rate Limited (429): ${errorText.substring(0, 200)}...`;
          
          // For rate limits, we should stop trying
          break;
        } else if (activitiesResponse.status === 500) {
          console.error('🚨 Internal Server Error: Garmin service issue');
          lastError = `Internal Server Error (500): ${errorText.substring(0, 200)}...`;
        } else if (activitiesResponse.status >= 500) {
          console.error('🚨 Server Error: Garmin service issue');
          lastError = `Server Error (${activitiesResponse.status}): ${errorText.substring(0, 200)}...`;
        } else {
          console.error(`❓ Unknown Error: ${activitiesResponse.status}`);
          lastError = `HTTP ${activitiesResponse.status}: ${errorText.substring(0, 200)}...`;
        }
      }
    } catch (error) {
      console.error(`Exception calling ${endpoint}:`, error);
      lastError = error.message;
    }
  }
  
  if (!activitiesData) {
    console.log('All API endpoints failed, will use fallback data');
  }

  return { activitiesData, lastError };
}
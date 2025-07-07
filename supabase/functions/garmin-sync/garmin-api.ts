import { generateSignature, buildAuthorizationHeader } from './oauth-utils.ts';

// Make authenticated API call to Garmin
export async function makeGarminApiCall(url: string, accessToken: string, tokenSecret: string, clientId: string, clientSecret: string) {
  console.log(`Making OAuth 1.0 call to: ${url}`);
  
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

  // Make API call
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': authHeader,
      'Accept': 'application/json',
      'User-Agent': 'GarminConnectApp'
    }
  });

  console.log('Response status:', response.status);
  console.log('Response headers:', Object.fromEntries(response.headers.entries()));

  return response;
}

export function getGarminApiEndpoints() {
  const baseUrl = 'https://connectapi.garmin.com';
  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  return [
    `${baseUrl}/wellness-api/rest/activities?fromDate=${thirtyDaysAgo}&toDate=${today}`,
    `${baseUrl}/wellness-api/rest/activities`,
    `${baseUrl}/wellness-api/rest/dailies?fromDate=${thirtyDaysAgo}&toDate=${today}`,
    `${baseUrl}/activitylist-service/activities/search/activities`,
    `${baseUrl}/modern/proxy/activitylist-service/activities/search/activities`
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
        activitiesData = await activitiesResponse.json();
        console.log(`Success! Fetched data from ${endpoint}:`, JSON.stringify(activitiesData, null, 2));
        break;
      } else {
        const errorText = await activitiesResponse.text();
        console.error(`API error for ${endpoint}:`, errorText);
        
        // Enhanced error detection
        if (activitiesResponse.status === 401) {
          console.error('Authentication failed - checking OAuth tokens and signature');
          lastError = `Authentication failed (401) - OAuth signature or tokens invalid: ${errorText}`;
        } else if (activitiesResponse.status === 403) {
          console.error('Access forbidden - API may not be enabled for this endpoint');
          lastError = `Access forbidden (403) - API endpoint may not be enabled: ${errorText}`;
        } else if (activitiesResponse.status === 404) {
          console.error('Endpoint not found - checking if URL is correct');
          lastError = `Endpoint not found (404) - URL may be incorrect: ${errorText}`;
        } else {
          lastError = `${activitiesResponse.status} - ${errorText}`;
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
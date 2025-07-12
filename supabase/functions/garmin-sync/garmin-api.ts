// Make authenticated API call to Garmin using OAuth 2.0
export async function makeGarminApiCall(url: string, accessToken: string, tokenSecret: string, clientId: string, clientSecret: string) {
  console.log(`Making OAuth 2.0 call to: ${url}`);
  console.log('Token validation:', {
    accessToken: accessToken?.substring(0, 8) + '...',
    hasToken: !!accessToken,
    tokenType: 'OAuth 2.0 Bearer',
    isJWT: accessToken?.startsWith('eyJ')
  });
  
  // Validate OAuth 2.0 access token (JWT format)
  if (!accessToken || accessToken.includes('demo_') || (accessToken.includes('-') && accessToken.length === 36)) {
    console.warn('Invalid access token detected');
    throw new Error('Invalid access token - please reconnect your Garmin account');
  }

  // OAuth 2.0 Bearer token authorization
  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Accept': 'application/json',
    'User-Agent': 'BioPeak/1.0'
  };

  console.log('Request headers:', { ...headers, Authorization: 'Bearer [REDACTED]' });

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
  const baseUrl = 'https://apis.garmin.com';
  
  // Convert to UTC timestamps in seconds (official API requirement)
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago (API limit)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); // Extended period for VO2 Max
  
  // Recent activities (last 24h with uploadStartTimeInSeconds - respects API 24h limit)
  const uploadStartTime24h = Math.floor(yesterday.getTime() / 1000);
  const uploadStartTime90d = Math.floor(ninetyDaysAgo.getTime() / 1000);
  const uploadEndTime = Math.floor(now.getTime() / 1000);
  
  return {
    // Activity API endpoints - CORRECTED to use wellness-api
    activities: [
      // Recent activities (last 24h) - respects uploadStartTimeInSeconds limit
      `${baseUrl}/wellness-api/rest/activities?uploadStartTimeInSeconds=${uploadStartTime24h}&uploadEndTimeInSeconds=${uploadEndTime}`,
      // Historical activities using date range (30 days)
      `${baseUrl}/wellness-api/rest/activities?startDate=${thirtyDaysAgo.toISOString().split('T')[0]}&endDate=${now.toISOString().split('T')[0]}`,
      // Fallback without parameters
      `${baseUrl}/wellness-api/rest/activities`
    ],
    
    // Daily Health Stats API endpoints (already correct)
    dailyHealth: [
      // Recent health data (last 24h)
      `${baseUrl}/wellness-api/rest/dailies?uploadStartTimeInSeconds=${uploadStartTime24h}&uploadEndTimeInSeconds=${uploadEndTime}`,
      // Historical health data using date range (90 days for VO2 Max fallback)
      `${baseUrl}/wellness-api/rest/dailies?startDate=${ninetyDaysAgo.toISOString().split('T')[0]}&endDate=${now.toISOString().split('T')[0]}`,
      // Historical health data using date range (30 days)
      `${baseUrl}/wellness-api/rest/dailies?startDate=${thirtyDaysAgo.toISOString().split('T')[0]}&endDate=${now.toISOString().split('T')[0]}`,
      // Fallback without parameters
      `${baseUrl}/wellness-api/rest/dailies`
    ],
    
    // User Metrics API endpoints (for VO2 Max data) - MULTIPLE APPROACHES
    userMetrics: [
      // Use metricType=vo2Max specifically for VO2 Max data
      `${baseUrl}/wellness-api/rest/userMetrics?metricType=vo2Max&startDate=${ninetyDaysAgo.toISOString().split('T')[0]}&endDate=${now.toISOString().split('T')[0]}`,
      // Try fitness metrics endpoint
      `${baseUrl}/wellness-api/rest/fitnessAge?startDate=${ninetyDaysAgo.toISOString().split('T')[0]}&endDate=${now.toISOString().split('T')[0]}`,
      // Extended historical user metrics using date range (90 days for better VO2 Max coverage)
      `${baseUrl}/wellness-api/rest/userMetrics?startDate=${ninetyDaysAgo.toISOString().split('T')[0]}&endDate=${now.toISOString().split('T')[0]}`,
      // Extended user metrics with upload timestamps (90 days)
      `${baseUrl}/wellness-api/rest/userMetrics?uploadStartTimeInSeconds=${uploadStartTime90d}&uploadEndTimeInSeconds=${uploadEndTime}`,
      // Fallback without parameters
      `${baseUrl}/wellness-api/rest/userMetrics`
    ],
    
    // User permissions endpoint (to verify access)
    permissions: `${baseUrl}/wellness-api/rest/user/permissions`
  };
}

// Fetch activities from Activity API
export async function fetchGarminActivities(accessToken: string, tokenSecret: string, clientId: string, clientSecret: string) {
  const { activities: activityEndpoints } = getGarminApiEndpoints();
  return await testApiEndpoints('ACTIVITIES', activityEndpoints, accessToken, tokenSecret, clientId, clientSecret);
}

// Fetch daily health stats from Daily Health Stats API
export async function fetchGarminDailyHealth(accessToken: string, tokenSecret: string, clientId: string, clientSecret: string) {
  const { dailyHealth: healthEndpoints } = getGarminApiEndpoints();
  return await testApiEndpoints('DAILY HEALTH', healthEndpoints, accessToken, tokenSecret, clientId, clientSecret);
}

// Fetch user metrics from User Metrics API - optimized approach
export async function fetchGarminUserMetrics(accessToken: string, tokenSecret: string, clientId: string, clientSecret: string) {
  console.log('===== STARTING VO2 MAX FETCH (OPTIMIZED) =====');
  
  const baseUrl = 'https://apis.garmin.com';
  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  
  // Try optimized endpoints first (larger date ranges)
  const optimizedEndpoints = [
    // Try full 90-day range first
    `${baseUrl}/wellness-api/rest/userMetrics?metricType=vo2Max&startDate=${ninetyDaysAgo.toISOString().split('T')[0]}&endDate=${now.toISOString().split('T')[0]}`,
    `${baseUrl}/wellness-api/rest/userMetrics?startDate=${ninetyDaysAgo.toISOString().split('T')[0]}&endDate=${now.toISOString().split('T')[0]}`,
    // Try 30-day chunks
    `${baseUrl}/wellness-api/rest/userMetrics?startDate=${new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}&endDate=${now.toISOString().split('T')[0]}`,
  ];
  
  console.log('Testing optimized endpoints first...');
  for (let i = 0; i < optimizedEndpoints.length; i++) {
    const endpoint = optimizedEndpoints[i];
    console.log(`\n[Optimized ${i + 1}/${optimizedEndpoints.length}] Testing: ${endpoint}`);
    
    try {
      const response = await makeGarminApiCall(endpoint, accessToken, tokenSecret, clientId, clientSecret);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Optimized endpoint successful! Found ${Array.isArray(data) ? data.length : 1} records`);
        return { 
          data: Array.isArray(data) ? data : [data], 
          lastError: null, 
          attemptedEndpoints: [endpoint] 
        };
      } else {
        const errorText = await response.text();
        console.error(`❌ Optimized endpoint failed: Status ${response.status} - ${errorText.substring(0, 150)}`);
      }
    } catch (error) {
      console.error(`💥 Exception on optimized endpoint:`, error);
    }
  }
  
  // If optimized approach fails, fall back to weekly chunks (more manageable than daily)
  console.log('\n===== FALLING BACK TO WEEKLY CHUNKS =====');
  const allVo2MaxData = [];
  let lastError = null;
  
  // Try 7-day chunks going backwards in time (13 weeks = 91 days)
  for (let weekOffset = 0; weekOffset < 13; weekOffset++) {
    // Calculate dates going backwards from today
    const endTime = new Date(now.getTime() - (weekOffset * 7 * 24 * 60 * 60 * 1000));
    const startTime = new Date(endTime.getTime() - (7 * 24 * 60 * 60 * 1000));
    
    const url = `${baseUrl}/wellness-api/rest/userMetrics?startDate=${startTime.toISOString().split('T')[0]}&endDate=${endTime.toISOString().split('T')[0]}`;
    
    console.log(`\n[Week ${weekOffset + 1}/13] Fetching: ${startTime.toISOString().split('T')[0]} to ${endTime.toISOString().split('T')[0]}`);
    
    try {
      const response = await makeGarminApiCall(url, accessToken, tokenSecret, clientId, clientSecret);
      
      if (response.ok) {
        const weekData = await response.json();
        
        if (Array.isArray(weekData) && weekData.length > 0) {
          console.log(`✅ Week ${weekOffset + 1}: Found ${weekData.length} records`);
          allVo2MaxData.push(...weekData);
        } else {
          console.log(`ℹ️ Week ${weekOffset + 1}: No data`);
        }
      } else {
        const errorText = await response.text();
        console.error(`❌ Week ${weekOffset + 1} failed: Status ${response.status}`);
        lastError = `Week ${weekOffset + 1}: HTTP ${response.status}`;
        
        if (response.status === 429) {
          console.log('🛑 Rate limited, stopping');
          break;
        }
      }
    } catch (error) {
      console.error(`💥 Week ${weekOffset + 1} exception:`, error);
      lastError = `Week ${weekOffset + 1}: ${error.message}`;
    }
    
    // Shorter delay between weeks
    if (weekOffset < 12) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }
  
  console.log(`===== VO2 MAX FETCH COMPLETE =====`);
  console.log(`📊 Total records: ${allVo2MaxData.length}`);
  
  return { 
    data: allVo2MaxData, 
    lastError, 
    attemptedEndpoints: ['Weekly chunks fallback'] 
  };
}

// Check user permissions
export async function checkGarminPermissions(accessToken: string, tokenSecret: string, clientId: string, clientSecret: string) {
  const { permissions: permissionsEndpoint } = getGarminApiEndpoints();
  
  try {
    console.log('===== CHECKING GARMIN PERMISSIONS =====');
    const response = await makeGarminApiCall(permissionsEndpoint, accessToken, tokenSecret, clientId, clientSecret);
    
    if (response.ok) {
      const permissions = await response.json();
      console.log('✅ User permissions:', permissions);
      return { permissions, error: null };
    } else {
      const errorText = await response.text();
      console.error('❌ Failed to get permissions:', errorText);
      return { permissions: null, error: `Failed to get permissions: ${response.status}` };
    }
  } catch (error) {
    console.error('💥 Exception checking permissions:', error);
    return { permissions: null, error: error.message };
  }
}

// Generic function to test API endpoints
async function testApiEndpoints(
  apiType: string,
  endpoints: string[],
  accessToken: string,
  tokenSecret: string,
  clientId: string,
  clientSecret: string
) {
  let data = null;
  let lastError = null;
  let attemptedEndpoints = [];
  
  console.log(`===== GARMIN ${apiType} API TEST =====`);
  console.log('Total endpoints to test:', endpoints.length);
  console.log('Endpoints list:', endpoints);
  console.log('Token validation:', {
    accessToken: accessToken ? `${accessToken.substring(0, 8)}...` : 'Missing',
    tokenSecret: tokenSecret ? `${tokenSecret.substring(0, 8)}...` : 'Missing',
    clientId: clientId ? `${clientId.substring(0, 8)}...` : 'Missing',
    clientSecret: clientSecret ? 'Present' : 'Missing'
  });
  console.log('======================================');
  
  for (let i = 0; i < endpoints.length; i++) {
    const endpoint = endpoints[i];
    console.log(`\n[${i + 1}/${endpoints.length}] ===== TESTING ${apiType} ENDPOINT =====`);
    console.log(`Endpoint: ${endpoint}`);
    attemptedEndpoints.push({
      url: endpoint,
      attempt: i + 1,
      timestamp: new Date().toISOString()
    });
    
    try {
      console.log(`🔄 Making OAuth 2.0 Bearer call...`);
      const response = await makeGarminApiCall(endpoint, accessToken, tokenSecret, clientId, clientSecret);
      
      console.log(`📊 Response details:`, {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        url: endpoint
      });
      
      if (response.ok) {
        const responseData = await response.json();
        console.log(`✅ SUCCESS! Working ${apiType} endpoint found: ${endpoint}`);
        console.log(`📋 Response preview:`, JSON.stringify(responseData, null, 2).substring(0, 500) + '...');
        
        // Validate response structure
        if (Array.isArray(responseData)) {
          data = responseData;
          console.log(`✅ Found ${responseData.length} ${apiType.toLowerCase()} items in array format`);
        } else if (responseData && typeof responseData === 'object') {
          // Handle different response formats
          data = responseData.activities || responseData.dailies || responseData.data || [responseData];
          console.log(`✅ Extracted ${data?.length || 0} ${apiType.toLowerCase()} items from object format`);
          console.log(`📊 Available keys in response:`, Object.keys(responseData));
        } else {
          console.warn(`⚠️ Unexpected response format for ${apiType}, treating as single item`);
          data = [responseData];
        }
        
        console.log(`🏁 SUCCESS SUMMARY: Found ${data?.length || 0} ${apiType.toLowerCase()} items using endpoint ${endpoint}`);
        break;
      } else {
        const errorText = await response.text();
        console.error(`❌ ${apiType} ENDPOINT FAILED: ${endpoint}`);
        console.error(`📊 Error details: Status ${response.status} - ${response.statusText}`);
        console.error(`📄 Error body preview: ${errorText.substring(0, 300)}${errorText.length > 300 ? '...' : ''}`);
        
        lastError = `HTTP ${response.status} on ${endpoint}: ${errorText.substring(0, 150)}...`;
        
        // Stop early for rate limiting
        if (response.status === 429) {
          console.log('🛑 Stopping due to rate limiting');
          break;
        }
      }
    } catch (error) {
      console.error(`💥 EXCEPTION on ${apiType} endpoint ${endpoint}:`, error);
      console.error(`🔍 Exception details:`, {
        message: error.message,
        stack: error.stack?.substring(0, 300),
        type: error.constructor.name
      });
      lastError = `Exception on ${endpoint}: ${error.message}`;
    }
    
    console.log(`===== ${apiType} ENDPOINT ${i + 1} COMPLETE =====\n`);
  }
  
  // Final summary
  console.log(`===== FINAL GARMIN ${apiType} API TEST SUMMARY =====`);
  console.log('📊 Results:', {
    totalEndpointsTested: attemptedEndpoints.length,
    successfulItems: data?.length || 0,
    finalError: lastError,
    workingEndpoint: data ? attemptedEndpoints[attemptedEndpoints.length - 1]?.url : 'None'
  });
  console.log('📋 All tested endpoints:', attemptedEndpoints.map(e => `${e.attempt}: ${e.url}`));
  console.log('========================================');
  
  if (!data) {
    console.log(`❌ All ${apiType} API endpoints failed - no data retrieved`);
    console.log('🔧 Troubleshooting suggestions:');
    console.log('  1. Verify OAuth 2.0 access token is not expired');
    console.log('  2. Check if Garmin Developer Program access is approved');
    console.log('  3. Validate Bearer token format (should be JWT)');
    console.log('  4. Confirm user has authorized the application with correct scopes');
  }

  return { data, lastError, attemptedEndpoints };
}
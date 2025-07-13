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

// Fetch user metrics from User Metrics API with 24-hour loops for 90 days
export async function fetchGarminUserMetrics(accessToken: string, tokenSecret: string, clientId: string, clientSecret: string) {
  console.log('===== STARTING VO2 MAX HISTORICAL FETCH (90 DAYS) =====');
  
  const baseUrl = 'https://apis.garmin.com';
  const now = new Date();
  const allVo2MaxData = [];
  let lastError = null;
  let processedDays = 0;
  let skippedDays = 0;
  let errors = [];
  
  // Generate 90 days of 24-hour intervals
  for (let dayOffset = 0; dayOffset < 90; dayOffset++) {
    const startTime = new Date(now.getTime() - ((dayOffset + 1) * 24 * 60 * 60 * 1000));
    const endTime = new Date(now.getTime() - (dayOffset * 24 * 60 * 60 * 1000));
    
    const startTimestamp = Math.floor(startTime.getTime() / 1000);
    const endTimestamp = Math.floor(endTime.getTime() / 1000);
    
    const url = `${baseUrl}/wellness-api/rest/userMetrics?uploadStartTimeInSeconds=${startTimestamp}&uploadEndTimeInSeconds=${endTimestamp}`;
    
    // Enhanced logging with timestamp details
    console.log(`\n🔄 [Day ${dayOffset + 1}/90] Processing timestamp range`);
    console.log(`📅 Date: ${startTime.toISOString().split('T')[0]} to ${endTime.toISOString().split('T')[0]}`);
    console.log(`⏰ Timestamps: ${startTimestamp} (${new Date(startTimestamp * 1000).toISOString()}) to ${endTimestamp} (${new Date(endTimestamp * 1000).toISOString()})`);
    console.log(`🔗 URL: ${url}`);
    
    let retryCount = 0;
    const maxRetries = 3;
    let success = false;
    
    while (retryCount < maxRetries && !success) {
      try {
        if (retryCount > 0) {
          console.log(`🔄 Retry attempt ${retryCount}/${maxRetries - 1} for day ${dayOffset + 1}`);
        }
        
        const response = await makeGarminApiCall(url, accessToken, tokenSecret, clientId, clientSecret);
        
        if (response.ok) {
          const dayData = await response.json();
          console.log(`📊 response for day ${dayOffset + 1}`, JSON.stringify(dayData, null, 2));
          
          if (Array.isArray(dayData) && dayData.length > 0) {
            console.log(`✅ Found ${dayData.length} user metrics records for day ${dayOffset + 1}`);
            allVo2MaxData.push(...dayData);
          } else {
            console.log(`ℹ️ No user metrics data for day ${dayOffset + 1}`);
          }
          processedDays++;
          success = true;
        } else {
          const errorText = await response.text();
          console.error(`❌ Day ${dayOffset + 1} failed: Status ${response.status} - ${errorText.substring(0, 150)}`);
          
          if (response.status === 429) {
            console.log(`⏸️ Rate limited on day ${dayOffset + 1}, waiting longer before retry...`);
            await new Promise(resolve => setTimeout(resolve, 2000 * (retryCount + 1))); // Exponential backoff
            retryCount++;
          } else if (response.status === 401 || response.status === 403) {
            console.log(`🔒 Authentication error on day ${dayOffset + 1}, stopping retries`);
            lastError = `Day ${dayOffset + 1}: HTTP ${response.status} - Authentication failed`;
            errors.push(`Day ${dayOffset + 1}: HTTP ${response.status}`);
            break; // Stop retrying for auth errors
          } else {
            console.log(`🔄 Retrying day ${dayOffset + 1} after error ${response.status}`);
            lastError = `Day ${dayOffset + 1}: HTTP ${response.status}`;
            errors.push(`Day ${dayOffset + 1}: HTTP ${response.status}`);
            retryCount++;
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount)); // Progressive delay
          }
        }
      } catch (error) {
        console.error(`💥 Exception on day ${dayOffset + 1}, attempt ${retryCount + 1}:`, error);
        lastError = `Day ${dayOffset + 1}: ${error.message}`;
        errors.push(`Day ${dayOffset + 1}: ${error.message}`);
        retryCount++;
        
        if (retryCount < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
        }
      }
    }
    
    if (!success) {
      console.error(`💀 Failed to process day ${dayOffset + 1} after ${maxRetries} attempts`);
      skippedDays++;
    }
    
    // Progressive delay to avoid rate limiting
    if (dayOffset < 89) {
      const delay = success ? 250 : 500; // Longer delay if there was an error
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  console.log(`===== VO2 MAX HISTORICAL FETCH COMPLETE =====`);
  console.log(`📊 Total records collected: ${allVo2MaxData.length}`);
  console.log(`📈 Days processed successfully: ${processedDays}/90`);
  console.log(`💀 Days skipped due to errors: ${skippedDays}/90`);
  console.log(`📋 Last error: ${lastError}`);
  console.log(`🔍 All errors encountered: ${errors.length > 0 ? errors.join(', ') : 'None'}`);
  
  return { 
    data: allVo2MaxData, 
    lastError, 
    processedDays,
    skippedDays,
    totalErrors: errors.length,
    attemptedEndpoints: [`90 days of userMetrics endpoints (24h intervals) - Processed: ${processedDays}, Skipped: ${skippedDays}`] 
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
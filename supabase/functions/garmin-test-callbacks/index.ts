import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[Garmin Test Callbacks] Request received:', req.method);

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (req.method === 'POST') {
      const { operation } = await req.json();
      let result;

      if (operation === 'diagnose-user') {
        // Get user tokens and backfill status
        const { data: userTokens } = await supabase
          .from('garmin_tokens')
          .select('user_id, access_token, consumer_key, oauth_verifier, expires_at')
          .limit(5);

        const { data: pendingBackfills } = await supabase
          .from('garmin_backfill_status')
          .select('*')
          .eq('status', 'pending')
          .order('requested_at', { ascending: true });

        result = {
          success: true,
          message: 'User diagnosis completed',
          diagnosis: {
            userTokens: userTokens?.map(t => ({
              user_id: t.user_id,
              consumer_key: t.consumer_key,
              oauth_verifier: t.oauth_verifier,
              expires_at: t.expires_at,
              expired: new Date(t.expires_at) <= new Date()
            })) || [],
            pendingBackfills: pendingBackfills || [],
            recommendations: []
          }
        };

        // Add recommendations
        if (!userTokens || userTokens.length === 0) {
          result.diagnosis.recommendations.push('No Garmin tokens found - users need to connect');
        }
        if (pendingBackfills && pendingBackfills.length > 0) {
          result.diagnosis.recommendations.push(`${pendingBackfills.length} backfills stuck in pending status`);
        }

      } else if (operation === 'test-callback') {
        // Test specific callback URL
        const { callbackURL } = await req.json();
        if (!callbackURL) {
          return new Response(JSON.stringify({
            success: false,
            message: 'CallbackURL required for testing'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Get a user token for testing
        const { data: userToken } = await supabase
          .from('garmin_tokens')
          .select('access_token, user_id')
          .limit(1)
          .maybeSingle();

        if (!userToken) {
          return new Response(JSON.stringify({
            success: false,
            message: 'No user tokens available for testing'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Test the callback URL
        try {
          const response = await fetch(callbackURL, {
            headers: {
              'Authorization': `Bearer ${userToken.access_token}`,
              'Accept': 'application/json'
            }
          });

          const responseData = response.ok ? await response.json() : await response.text();

          result = {
            success: response.ok,
            message: `Callback test ${response.ok ? 'successful' : 'failed'}`,
            callbackURL,
            response: {
              status: response.status,
              statusText: response.statusText,
              headers: Object.fromEntries(response.headers.entries()),
              data: responseData,
              dataType: typeof responseData,
              isArray: Array.isArray(responseData),
              count: Array.isArray(responseData) ? responseData.length : 'N/A'
            }
          };
        } catch (fetchError) {
          result = {
            success: false,
            message: 'Callback test failed with network error',
            callbackURL,
            error: fetchError.message
          };
        }

      } else if (operation === 'test-all-pending') {
        // Test all pending backfills
        const { data: pendingBackfills } = await supabase
          .from('garmin_backfill_status')
          .select('*')
          .eq('status', 'pending')
          .order('requested_at', { ascending: true });

        if (!pendingBackfills || pendingBackfills.length === 0) {
          result = {
            success: true,
            message: 'No pending backfills to test',
            results: []
          };
        } else {
          const testResults = [];
          
          for (const backfill of pendingBackfills) {
            // Get user token
            const { data: userToken } = await supabase
              .from('garmin_tokens')
              .select('access_token')
              .eq('user_id', backfill.user_id)
              .maybeSingle();

            if (!userToken) {
              testResults.push({
                backfillId: backfill.id,
                success: false,
                message: 'No token found for user'
              });
              continue;
            }

            // Create callback URL for this backfill period
            const startTime = Math.floor(new Date(backfill.period_start).getTime() / 1000);
            const endTime = Math.floor(new Date(backfill.period_end).getTime() / 1000);
            const callbackURL = `https://apis.garmin.com/wellness-api/rest/backfill/activities?uploadStartTimeInSeconds=${startTime}&uploadEndTimeInSeconds=${endTime}`;

            try {
              const response = await fetch(callbackURL, {
                headers: {
                  'Authorization': `Bearer ${userToken.access_token}`,
                  'Accept': 'application/json'
                }
              });

              const responseData = response.ok ? await response.json() : await response.text();

              testResults.push({
                backfillId: backfill.id,
                userId: backfill.user_id,
                period: {
                  start: backfill.period_start,
                  end: backfill.period_end
                },
                callbackURL,
                success: response.ok,
                response: {
                  status: response.status,
                  dataCount: Array.isArray(responseData) ? responseData.length : 'N/A',
                  sample: Array.isArray(responseData) && responseData.length > 0 ? Object.keys(responseData[0]) : 'N/A'
                }
              });
            } catch (fetchError) {
              testResults.push({
                backfillId: backfill.id,
                userId: backfill.user_id,
                success: false,
                error: fetchError.message
              });
            }
          }

          result = {
            success: true,
            message: `Tested ${pendingBackfills.length} pending backfills`,
            results: testResults
          };
        }

      } else if (operation === 'simulate-webhook') {
        // Get actual user data for simulation
        const { data: userTokens } = await supabase
          .from('garmin_tokens')
          .select('user_id, consumer_key, oauth_verifier')
          .limit(1)
          .maybeSingle();
          
        if (!userTokens) {
          return new Response(JSON.stringify({
            success: false,
            message: 'No user tokens found for simulation'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // Try different webhook formats that Garmin might send
        const webhookFormats = [
          // Format 1: PING format (what we expect for backfill)
          {
            format: 'PING_FORMAT',
            data: {
              userId: userTokens.consumer_key || userTokens.oauth_verifier,
              callbackURL: "https://apis.garmin.com/wellness-api/rest/backfill/activities?uploadStartTimeInSeconds=1672531200&uploadEndTimeInSeconds=1704067200"
            }
          },
          // Format 2: Activities array format (PUSH)
          {
            format: 'PUSH_FORMAT',
            data: {
              activities: [{
                userId: userTokens.consumer_key || userTokens.oauth_verifier,
                callbackURL: "https://apis.garmin.com/wellness-api/rest/backfill/activities?uploadStartTimeInSeconds=1672531200&uploadEndTimeInSeconds=1704067200"
              }]
            }
          }
        ];
        
        console.log('Simulating webhook with multiple formats...');
        const results = [];
        
        for (const format of webhookFormats) {
          console.log(`Testing ${format.format}:`, format.data);
          
          // Call the webhook function
          const webhookResponse = await supabase.functions.invoke('garmin-webhook', {
            body: format.data
          });
          
          results.push({
            format: format.format,
            data: format.data,
            response: webhookResponse.data,
            error: webhookResponse.error
          });
        }
        
        result = {
          success: true,
          message: 'Webhook simulation completed with multiple formats',
          simulationResults: results
        };
      } else {
        result = { success: false, message: 'Invalid operation' };
      }

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(
      JSON.stringify({ error: 'Invalid request' }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('[Garmin Test Callbacks] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

async function testCallbackURL(supabase: any, userId: string, callbackURL: string) {
  console.log('[Test Callback] Testing URL:', callbackURL);

  try {
    // Get user's token
    const { data: tokenData, error: tokenError } = await supabase
      .from('garmin_tokens')
      .select('access_token, expires_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (tokenError || !tokenData) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'User not connected to Garmin',
          details: { tokenError: tokenError?.message }
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Check token expiry
    const tokenExpiresAt = new Date(tokenData.expires_at);
    const now = new Date();
    const isExpired = tokenExpiresAt <= now;

    console.log('[Test Callback] Token status:', { 
      expires: tokenData.expires_at, 
      expired: isExpired,
      minutesUntilExpiry: (tokenExpiresAt.getTime() - now.getTime()) / (1000 * 60)
    });

    // Test the callback URL
    const startTime = Date.now();
    const response = await fetch(callbackURL, {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Accept': 'application/json'
      }
    });
    const responseTime = Date.now() - startTime;

    const responseData = response.ok ? await response.json() : await response.text();

    const result = {
      success: response.ok,
      status: response.status,
      statusText: response.statusText,
      responseTime: `${responseTime}ms`,
      headers: Object.fromEntries(response.headers.entries()),
      data: responseData,
      tokenStatus: {
        expired: isExpired,
        expiresAt: tokenData.expires_at,
        minutesUntilExpiry: Math.round((tokenExpiresAt.getTime() - now.getTime()) / (1000 * 60))
      }
    };

    console.log('[Test Callback] Result:', {
      success: result.success,
      status: result.status,
      dataType: typeof responseData,
      isArray: Array.isArray(responseData),
      dataLength: Array.isArray(responseData) ? responseData.length : 'N/A'
    });

    return new Response(
      JSON.stringify(result),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('[Test Callback] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        type: 'network_error'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}

async function testAllPendingBackfills(supabase: any, userId: string) {
  console.log('[Test All Pending] Starting for user:', userId);

  try {
    // Get all pending backfills
    const { data: pendingBackfills, error } = await supabase
      .from('garmin_backfill_status')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .order('requested_at', { ascending: true });

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    const results = [];
    
    for (const backfill of pendingBackfills || []) {
      console.log(`[Test All Pending] Testing backfill ${backfill.id}`);
      
      // Generate a test callback URL for this period
      const startSeconds = Math.floor(new Date(backfill.period_start).getTime() / 1000);
      const endSeconds = Math.floor(new Date(backfill.period_end).getTime() / 1000);
      const testCallbackURL = `https://apis.garmin.com/wellness-api/rest/activities?uploadStartTimeInSeconds=${startSeconds}&uploadEndTimeInSeconds=${endSeconds}`;
      
      try {
        const testResult = await testCallbackURL(supabase, userId, testCallbackURL);
        const testData = await testResult.json();
        
        results.push({
          backfillId: backfill.id,
          period: {
            start: backfill.period_start,
            end: backfill.period_end
          },
          testCallbackURL,
          result: testData
        });
      } catch (testError) {
        results.push({
          backfillId: backfill.id,
          period: {
            start: backfill.period_start,
            end: backfill.period_end
          },
          testCallbackURL,
          result: {
            success: false,
            error: testError.message
          }
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        totalPending: pendingBackfills?.length || 0,
        results
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('[Test All Pending] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}

async function simulateWebhook(supabase: any, userId: string, callbackURL: string) {
  console.log('[Simulate Webhook] Simulating webhook for user:', userId);

  try {
    // Create mock webhook data
    const mockWebhookData = {
      activities: [{
        userId: userId,
        callbackURL: callbackURL || `https://apis.garmin.com/wellness-api/rest/activities?uploadStartTimeInSeconds=${Math.floor(Date.now() / 1000) - 86400}&uploadEndTimeInSeconds=${Math.floor(Date.now() / 1000)}`
      }]
    };

    console.log('[Simulate Webhook] Mock data:', mockWebhookData);

    // Call our webhook function directly
    const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/garmin-webhook`;
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`
      },
      body: JSON.stringify(mockWebhookData)
    });

    const result = await response.json();

    return new Response(
      JSON.stringify({
        success: response.ok,
        status: response.status,
        webhookResponse: result,
        mockData: mockWebhookData
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('[Simulate Webhook] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}

async function diagnoseUser(supabase: any, userId: string) {
  console.log('[Diagnose User] Starting comprehensive diagnosis for:', userId);

  const diagnosis = {
    userId,
    timestamp: new Date().toISOString(),
    tokenStatus: null,
    backfillStatus: null,
    webhookStats: null,
    recentActivities: null,
    recommendations: []
  };

  try {
    // Check token status
    const { data: tokenData } = await supabase
      .from('garmin_tokens')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (tokenData) {
      const tokenExpiresAt = new Date(tokenData.expires_at);
      const now = new Date();
      diagnosis.tokenStatus = {
        connected: true,
        expired: tokenExpiresAt <= now,
        expiresAt: tokenData.expires_at,
        minutesUntilExpiry: Math.round((tokenExpiresAt.getTime() - now.getTime()) / (1000 * 60)),
        hasRefreshToken: !!tokenData.refresh_token
      };

      if (tokenExpiresAt <= now) {
        diagnosis.recommendations.push('Token expired - user needs to reconnect to Garmin');
      }
    } else {
      diagnosis.tokenStatus = { connected: false };
      diagnosis.recommendations.push('User not connected to Garmin');
    }

    // Check backfill status
    const { data: backfills } = await supabase
      .from('garmin_backfill_status')
      .select('status')
      .eq('user_id', userId);

    const backfillCounts = (backfills || []).reduce((acc, b) => {
      acc[b.status] = (acc[b.status] || 0) + 1;
      return acc;
    }, {});

    diagnosis.backfillStatus = {
      total: backfills?.length || 0,
      byStatus: backfillCounts
    };

    if (backfillCounts.pending > 0) {
      diagnosis.recommendations.push(`${backfillCounts.pending} backfill(s) stuck in pending status`);
    }

    // Check webhook stats
    const { data: webhookStats } = await supabase
      .from('webhook_stats')
      .select('*')
      .eq('user_id', userId)
      .order('call_timestamp', { ascending: false })
      .limit(10);

    diagnosis.webhookStats = {
      totalCalls: webhookStats?.length || 0,
      recentCalls: webhookStats || [],
      successRate: webhookStats?.length ? 
        webhookStats.filter(w => w.success).length / webhookStats.length : 0
    };

    if ((webhookStats?.length || 0) === 0) {
      diagnosis.recommendations.push('No webhook calls received - check webhook configuration');
    }

    // Check recent activities
    const { data: recentActivities } = await supabase
      .from('garmin_activities')
      .select('name, start_date, type')
      .eq('user_id', userId)
      .order('start_date', { ascending: false })
      .limit(5);

    diagnosis.recentActivities = recentActivities || [];

    if ((recentActivities?.length || 0) === 0) {
      diagnosis.recommendations.push('No activities found - check data sync');
    }

    return new Response(
      JSON.stringify(diagnosis),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('[Diagnose User] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        partialDiagnosis: diagnosis
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}

async function getDiagnosticInfo(supabase: any, userId: string) {
  console.log('[Get Diagnostic Info] For user:', userId);

  try {
    // Get pending backfills with more details
    const { data: pendingBackfills } = await supabase
      .from('garmin_backfill_status')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .order('requested_at', { ascending: true });

    // Get recent webhook stats
    const { data: recentWebhooks } = await supabase
      .from('webhook_stats')
      .select('*')
      .order('call_timestamp', { ascending: false })
      .limit(20);

    const info = {
      pendingBackfills: pendingBackfills || [],
      recentWebhooks: recentWebhooks || [],
      systemHealth: {
        webhookEndpoint: `${Deno.env.get('SUPABASE_URL')}/functions/v1/garmin-webhook`,
        testEndpoint: `${Deno.env.get('SUPABASE_URL')}/functions/v1/garmin-test-callbacks`
      }
    };

    return new Response(
      JSON.stringify(info),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('[Get Diagnostic Info] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}
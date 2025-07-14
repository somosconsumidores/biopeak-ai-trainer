import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BackfillRequest {
  periodStart: string; // ISO date string
  periodEnd: string;   // ISO date string
  summaryTypes?: string[]; // Array of summary types to backfill
}

// Garmin backfill endpoint mapping
const GARMIN_BACKFILL_ENDPOINTS = {
  dailies: 'https://apis.garmin.com/wellness-api/rest/backfill/dailies',
  epochs: 'https://apis.garmin.com/wellness-api/rest/backfill/epochs',
  sleeps: 'https://apis.garmin.com/wellness-api/rest/backfill/sleeps',
  bodyComps: 'https://apis.garmin.com/wellness-api/rest/backfill/bodyComps',
  stressDetails: 'https://apis.garmin.com/wellness-api/rest/backfill/stressDetails',
  userMetrics: 'https://apis.garmin.com/wellness-api/rest/backfill/userMetrics',
  pulseOx: 'https://apis.garmin.com/wellness-api/rest/backfill/pulseOx',
  respiration: 'https://apis.garmin.com/wellness-api/rest/backfill/respiration',
  healthSnapshot: 'https://apis.garmin.com/wellness-api/rest/backfill/healthSnapshot',
  hrv: 'https://apis.garmin.com/wellness-api/rest/backfill/hrv',
  bloodPressures: 'https://apis.garmin.com/wellness-api/rest/backfill/bloodPressures',
  skinTemp: 'https://apis.garmin.com/wellness-api/rest/backfill/skinTemp'
} as const;

type SummaryType = keyof typeof GARMIN_BACKFILL_ENDPOINTS;

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[Garmin Backfill] Request received:', req.method);

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing Authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Invalid user token');
    }

    console.log('[Garmin Backfill] User authenticated:', user.id);

    if (req.method === 'POST') {
      const { periodStart, periodEnd, summaryTypes = ['dailies'] }: BackfillRequest = await req.json();
      
      console.log('[Garmin Backfill] Requesting backfill for period:', { periodStart, periodEnd });

      // Validate dates
      const startDate = new Date(periodStart);
      const endDate = new Date(periodEnd);
      const now = new Date();

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        throw new Error('Invalid date format');
      }

      if (startDate >= endDate) {
        throw new Error('Start date must be before end date');
      }

      // Check if period is within 90 days limit (Garmin backfill API limit)
      const daysDifference = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysDifference > 90) {
        throw new Error('Period cannot exceed 90 days per backfill request');
      }

      // Check if period is not in the future
      if (startDate > now) {
        throw new Error('Start date cannot be in the future');
      }

      // Get user's Garmin tokens
      const { data: tokenData, error: tokenError } = await supabase
        .from('garmin_tokens')
        .select('access_token, token_secret, consumer_key, expires_at')
        .eq('user_id', user.id)
        .maybeSingle();

      if (tokenError || !tokenData) {
        throw new Error('User not connected to Garmin');
      }

      // Check if token is expired and needs refresh
      const tokenExpiresAt = new Date(tokenData.expires_at);
      if (tokenExpiresAt <= now) {
        console.log('[Garmin Backfill] Token expired, attempting to refresh...');
        // For OAuth 1.0a, tokens typically don't expire, but check anyway
        throw new Error('Token expired. Please reconnect to Garmin.');
      }

      // Validate summary types
      const validSummaryTypes = summaryTypes.filter(type => 
        type in GARMIN_BACKFILL_ENDPOINTS
      ) as SummaryType[];

      if (validSummaryTypes.length === 0) {
        throw new Error('No valid summary types provided');
      }

      // Process each summary type
      const results = [];
      const errors = [];

      for (const summaryType of validSummaryTypes) {
        try {
          // Check if backfill already exists for this period and summary type
          const { data: existingBackfill } = await supabase
            .from('garmin_backfill_status')
            .select('id, status, is_duplicate')
            .eq('user_id', user.id)
            .eq('period_start', startDate.toISOString())
            .eq('period_end', endDate.toISOString())
            .eq('summary_type', summaryType)
            .maybeSingle();

          let backfillRecord;

          if (existingBackfill) {
            if (existingBackfill.status !== 'error' && !existingBackfill.is_duplicate) {
              results.push({
                summaryType,
                status: 'existing',
                message: `Backfill already exists for ${summaryType}`,
                backfillId: existingBackfill.id
              });
              continue;
            }
            backfillRecord = existingBackfill;
          } else {
            // Create new backfill record
            const { data: newRecord, error: backfillError } = await supabase
              .from('garmin_backfill_status')
              .insert({
                user_id: user.id,
                period_start: startDate.toISOString(),
                period_end: endDate.toISOString(),
                summary_type: summaryType,
                status: 'pending',
                requested_at: new Date().toISOString(),
                activities_processed: 0,
                retry_count: 0
              })
              .select()
              .single();

            if (backfillError) {
              console.error(`[Garmin Backfill] Error creating backfill record for ${summaryType}:`, backfillError);
              errors.push(`Failed to create backfill record for ${summaryType}`);
              continue;
            }
            backfillRecord = newRecord;
          }

          // Update status to in_progress
          await supabase
            .from('garmin_backfill_status')
            .update({ 
              status: 'in_progress',
              is_duplicate: false,
              retry_count: 0,
              next_retry_at: null
            })
            .eq('id', backfillRecord.id);

          // Make backfill request to Garmin API
          const result = await makeBackfillRequest(
            summaryType, 
            startDate, 
            endDate, 
            tokenData, 
            supabase, 
            backfillRecord.id
          );

          results.push({
            summaryType,
            status: result.success ? 'requested' : 'error',
            message: result.message,
            backfillId: backfillRecord.id
          });

        } catch (error) {
          console.error(`[Garmin Backfill] Error processing ${summaryType}:`, error);
          errors.push(`Error processing ${summaryType}: ${error.message}`);
        }
      }

      // Return results
      const hasSuccessful = results.some(r => r.status === 'requested');
      const status = hasSuccessful ? 202 : (results.length > 0 ? 200 : 500);

      return new Response(
        JSON.stringify({
          message: hasSuccessful 
            ? 'Backfill requests submitted successfully'
            : 'Some backfill requests failed or already existed',
          results,
          errors: errors.length > 0 ? errors : undefined,
          period: { start: periodStart, end: periodEnd }
        }),
        { 
          status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // GET request - return backfill status for user
    if (req.method === 'GET') {
      const { data: backfillStatus, error } = await supabase
        .from('garmin_backfill_status')
        .select('*')
        .eq('user_id', user.id)
        .order('requested_at', { ascending: false });

      if (error) {
        throw new Error('Failed to fetch backfill status');
      }

      return new Response(
        JSON.stringify({ backfillStatus }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { 
        status: 405, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('[Garmin Backfill] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

// Helper function to make backfill request to Garmin API
async function makeBackfillRequest(
  summaryType: SummaryType,
  startDate: Date,
  endDate: Date,
  tokenData: any,
  supabase: any,
  backfillId: string
): Promise<{ success: boolean; message: string }> {
  try {
    const backfillUrl = GARMIN_BACKFILL_ENDPOINTS[summaryType];
    
    // Convert to UNIX timestamps in seconds (as required by Garmin API)
    const summaryStartTimeInSeconds = Math.floor(startDate.getTime() / 1000);
    const summaryEndTimeInSeconds = Math.floor(endDate.getTime() / 1000);
    
    const fullUrl = `${backfillUrl}?summaryStartTimeInSeconds=${summaryStartTimeInSeconds}&summaryEndTimeInSeconds=${summaryEndTimeInSeconds}`;
    
    console.log(`[Garmin Backfill] Making request for ${summaryType} to:`, fullUrl);

    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Accept': 'application/json'
      }
    });

    console.log(`[Garmin Backfill] ${summaryType} API response status:`, response.status);

    if (response.status === 202) {
      // Backfill request accepted - data will arrive via webhook
      console.log(`[Garmin Backfill] ${summaryType} backfill request accepted by Garmin`);
      return {
        success: true,
        message: `${summaryType} backfill request submitted successfully. Data will arrive via webhooks.`
      };
    } else if (response.status === 409) {
      // Duplicate request
      console.log(`[Garmin Backfill] Duplicate request for ${summaryType}`);
      
      await supabase
        .from('garmin_backfill_status')
        .update({ 
          status: 'completed',
          is_duplicate: true,
          error_message: 'Duplicate request - data already requested for this period'
        })
        .eq('id', backfillId);

      return {
        success: true,
        message: `${summaryType} backfill already requested for this period`
      };
    } else if (response.status === 429) {
      // Rate limited - schedule retry
      console.log(`[Garmin Backfill] Rate limited for ${summaryType}`);
      
      const retryAfter = response.headers.get('Retry-After');
      const retryDelay = retryAfter ? parseInt(retryAfter) * 1000 : 60000; // Default 1 minute
      const nextRetryAt = new Date(Date.now() + retryDelay);

      await supabase
        .from('garmin_backfill_status')
        .update({ 
          status: 'pending',
          next_retry_at: nextRetryAt.toISOString(),
          rate_limit_reset_at: nextRetryAt.toISOString(),
          error_message: `Rate limited. Retry scheduled for ${nextRetryAt.toISOString()}`
        })
        .eq('id', backfillId);

      return {
        success: false,
        message: `${summaryType} request rate limited. Retry scheduled for ${nextRetryAt.toISOString()}`
      };
    } else {
      // Handle other errors
      const errorText = await response.text();
      console.error(`[Garmin Backfill] ${summaryType} API error:`, response.status, errorText);
      
      // Determine if we should retry
      const shouldRetry = response.status >= 500 || response.status === 403; // Server errors or auth issues
      
      if (shouldRetry) {
        // Get current retry count
        const { data: currentRecord } = await supabase
          .from('garmin_backfill_status')
          .select('retry_count, max_retries')
          .eq('id', backfillId)
          .single();

        const retryCount = (currentRecord?.retry_count || 0) + 1;
        const maxRetries = currentRecord?.max_retries || 3;

        if (retryCount <= maxRetries) {
          // Schedule retry with exponential backoff
          const nextRetryAt = new Date(Date.now() + (Math.pow(2, retryCount) * 5 * 60 * 1000)); // 5min, 10min, 20min...

          await supabase
            .from('garmin_backfill_status')
            .update({ 
              status: 'pending',
              retry_count: retryCount,
              next_retry_at: nextRetryAt.toISOString(),
              error_message: `API error (attempt ${retryCount}/${maxRetries}): ${response.status} - ${errorText}`
            })
            .eq('id', backfillId);

          return {
            success: false,
            message: `${summaryType} API error. Retry ${retryCount}/${maxRetries} scheduled for ${nextRetryAt.toISOString()}`
          };
        }
      }

      // Final error - no more retries
      await supabase
        .from('garmin_backfill_status')
        .update({ 
          status: 'error',
          error_message: `Garmin API error: ${response.status} - ${errorText}`
        })
        .eq('id', backfillId);

      return {
        success: false,
        message: `${summaryType} API error: ${response.status} - ${errorText}`
      };
    }
  } catch (error) {
    console.error(`[Garmin Backfill] ${summaryType} request failed:`, error);
    
    await supabase
      .from('garmin_backfill_status')
      .update({ 
        status: 'error',
        error_message: `Request failed: ${error.message}`
      })
      .eq('id', backfillId);

    return {
      success: false,
      message: `${summaryType} request failed: ${error.message}`
    };
  }
}
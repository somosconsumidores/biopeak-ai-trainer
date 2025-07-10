import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BackfillRequest {
  periodStart: string; // ISO date string
  periodEnd: string;   // ISO date string
}

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
      const { periodStart, periodEnd }: BackfillRequest = await req.json();
      
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

      // Check if period is within 90 days limit
      const daysDifference = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysDifference > 90) {
        throw new Error('Period cannot exceed 90 days');
      }

      // Check if period is not in the future
      if (startDate > now) {
        throw new Error('Start date cannot be in the future');
      }

      // Get user's Garmin tokens
      const { data: tokenData, error: tokenError } = await supabase
        .from('garmin_tokens')
        .select('access_token, token_secret')
        .eq('user_id', user.id)
        .maybeSingle();

      if (tokenError || !tokenData) {
        throw new Error('User not connected to Garmin');
      }

      // Check if backfill already exists for this period
      const { data: existingBackfill } = await supabase
        .from('garmin_backfill_status')
        .select('id, status')
        .eq('user_id', user.id)
        .eq('period_start', startDate.toISOString())
        .eq('period_end', endDate.toISOString())
        .maybeSingle();

      if (existingBackfill && existingBackfill.status !== 'error') {
        return new Response(
          JSON.stringify({ 
            message: 'Backfill already exists for this period',
            status: existingBackfill.status,
            backfillId: existingBackfill.id
          }),
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      // Create or update backfill status record
      const { data: backfillRecord, error: backfillError } = await supabase
        .from('garmin_backfill_status')
        .upsert({
          user_id: user.id,
          period_start: startDate.toISOString(),
          period_end: endDate.toISOString(),
          status: 'pending',
          requested_at: new Date().toISOString(),
          activities_processed: 0
        }, {
          onConflict: 'user_id,period_start,period_end'
        })
        .select()
        .single();

      if (backfillError) {
        console.error('[Garmin Backfill] Error creating backfill record:', backfillError);
        throw new Error('Failed to create backfill record');
      }

      // Update status to in_progress
      await supabase
        .from('garmin_backfill_status')
        .update({ status: 'in_progress' })
        .eq('id', backfillRecord.id);

      // Make backfill request to Garmin API using OAuth 1.0
      try {
        const clientId = Deno.env.get('GARMIN_CLIENT_ID')!;
        const clientSecret = Deno.env.get('GARMIN_CLIENT_SECRET')!;
        
        const backfillUrl = 'https://apis.garmin.com/wellness-api/rest/backfill/activities';
        const summaryStartTimeInSeconds = Math.floor(startDate.getTime() / 1000);
        const summaryEndTimeInSeconds = Math.floor(endDate.getTime() / 1000);
        
        const fullUrl = `${backfillUrl}?summaryStartTimeInSeconds=${summaryStartTimeInSeconds}&summaryEndTimeInSeconds=${summaryEndTimeInSeconds}`;
        
        // Generate OAuth 1.0 signature
        const oauth = {
          oauth_consumer_key: clientId,
          oauth_token: tokenData.access_token,
          oauth_signature_method: 'HMAC-SHA1',
          oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
          oauth_nonce: Math.random().toString(36).substring(2, 15),
          oauth_version: '1.0'
        };
        
        // Create base string for signature
        const params = new URLSearchParams({
          summaryStartTimeInSeconds: summaryStartTimeInSeconds.toString(),
          summaryEndTimeInSeconds: summaryEndTimeInSeconds.toString(),
          ...oauth
        });
        
        const sortedParams = Array.from(params.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
          .join('&');
        
        const baseString = `GET&${encodeURIComponent(backfillUrl)}&${encodeURIComponent(sortedParams)}`;
        const signingKey = `${encodeURIComponent(clientSecret)}&${encodeURIComponent(tokenData.token_secret)}`;
        
        // Generate HMAC-SHA1 signature
        const encoder = new TextEncoder();
        const signingKeyData = encoder.encode(signingKey);
        const baseStringData = encoder.encode(baseString);
        
        const cryptoKey = await crypto.subtle.importKey(
          'raw',
          signingKeyData,
          { name: 'HMAC', hash: 'SHA-1' },
          false,
          ['sign']
        );
        
        const signature = await crypto.subtle.sign('HMAC', cryptoKey, baseStringData);
        const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)));
        
        oauth.oauth_signature = signatureBase64;
        
        // Build Authorization header
        const authHeader = 'OAuth ' + Object.entries(oauth)
          .map(([key, value]) => `${encodeURIComponent(key)}="${encodeURIComponent(value)}"`)
          .join(', ');

        const response = await fetch(fullUrl, {
          method: 'GET',
          headers: {
            'Authorization': authHeader,
            'Accept': 'application/json'
          }
        });

        console.log('[Garmin Backfill] Garmin API response status:', response.status);

        if (response.status === 202) {
          // Backfill request accepted
          console.log('[Garmin Backfill] Backfill request accepted by Garmin');
          
          return new Response(
            JSON.stringify({ 
              message: 'Backfill request submitted successfully',
              status: 'in_progress',
              backfillId: backfillRecord.id,
              period: { start: periodStart, end: periodEnd }
            }),
            { 
              status: 202, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        } else {
          // Handle error from Garmin API
          const errorText = await response.text();
          console.error('[Garmin Backfill] Garmin API error:', response.status, errorText);
          
          // Update backfill status to error
          await supabase
            .from('garmin_backfill_status')
            .update({ 
              status: 'error',
              error_message: `Garmin API error: ${response.status} - ${errorText}`
            })
            .eq('id', backfillRecord.id);

          throw new Error(`Garmin API error: ${response.status}`);
        }
      } catch (apiError) {
        console.error('[Garmin Backfill] API request failed:', apiError);
        
        // Update backfill status to error
        await supabase
          .from('garmin_backfill_status')
          .update({ 
            status: 'error',
            error_message: `API request failed: ${apiError.message}`
          })
          .eq('id', backfillRecord.id);

        throw apiError;
      }
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
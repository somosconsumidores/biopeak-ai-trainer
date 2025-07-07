import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// OAuth 1.0 signature generation
async function generateSignature(method: string, url: string, params: Record<string, string>, consumerSecret: string, tokenSecret = '') {
  const sortedParams = Object.keys(params).sort().map(key => `${key}=${encodeURIComponent(params[key])}`).join('&');
  const baseString = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(sortedParams)}`;
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;
  
  const encoder = new TextEncoder();
  const keyData = encoder.encode(signingKey);
  const baseData = encoder.encode(baseString);
  
  const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, baseData);
  const signatureArray = new Uint8Array(signature);
  
  return btoa(String.fromCharCode(...signatureArray));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const clientId = Deno.env.get('GARMIN_CLIENT_ID')!;
    const clientSecret = Deno.env.get('GARMIN_CLIENT_SECRET')!;

    if (!supabaseUrl || !supabaseKey || !clientId || !clientSecret) {
      throw new Error('Missing required environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Verify the JWT token
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Invalid token');
    }

    // Get user's Garmin tokens
    const { data: tokenData, error: tokenError } = await supabase
      .from('garmin_tokens')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (tokenError || !tokenData) {
      throw new Error('No Garmin connection found');
    }

    const { action } = await req.json();

    if (action === 'register') {
      // Register webhook subscriptions with Garmin
      const webhookUrl = 'https://qytorkjmzxscyaefkhnk.supabase.co/functions/v1/garmin-webhook';
      
      const subscriptionTypes = [
        'ACTIVITY',
        'DAILY_SUMMARY', 
        'SLEEP'
      ];

      const results = [];
      
      for (const summaryType of subscriptionTypes) {
        try {
          // Create webhook subscription request
          const subscriptionUrl = 'https://connectapi.garmin.com/webhook-service/registration';
          
          const timestamp = Math.floor(Date.now() / 1000).toString();
          const nonce = Math.random().toString(36).substring(7);
          
          const params = {
            oauth_consumer_key: clientId,
            oauth_token: tokenData.access_token,
            oauth_nonce: nonce,
            oauth_signature_method: 'HMAC-SHA1',
            oauth_timestamp: timestamp,
            oauth_version: '1.0'
          };

          const signature = await generateSignature('POST', subscriptionUrl, params, clientSecret, tokenData.token_secret);
          params['oauth_signature'] = signature;

          const requestBody = JSON.stringify({
            webhookURL: webhookUrl,
            summaryType: summaryType
          });

          console.log(`Registering webhook for ${summaryType}...`);

          const response = await fetch(subscriptionUrl, {
            method: 'POST',
            headers: {
              'Authorization': `OAuth ${Object.keys(params).map(key => `${key}="${encodeURIComponent(params[key])}"`).join(', ')}`,
              'Content-Type': 'application/json'
            },
            body: requestBody
          });

          if (response.ok) {
            const responseData = await response.text();
            console.log(`Successfully registered webhook for ${summaryType}:`, responseData);
            
            // Store webhook config in database
            await supabase
              .from('garmin_webhook_config')
              .upsert({
                user_id: user.id,
                webhook_url: webhookUrl,
                summary_type: summaryType,
                is_active: true
              });

            results.push({ summaryType, status: 'success', response: responseData });
          } else {
            const errorText = await response.text();
            console.error(`Failed to register webhook for ${summaryType}:`, response.status, errorText);
            results.push({ summaryType, status: 'error', error: errorText });
          }
        } catch (error) {
          console.error(`Error registering webhook for ${summaryType}:`, error);
          results.push({ summaryType, status: 'error', error: error.message });
        }
      }

      return new Response(JSON.stringify({
        success: true,
        message: 'Webhook registration completed',
        results,
        webhookUrl: webhookUrl
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'status') {
      // Get webhook configuration status
      const { data: webhookConfigs } = await supabase
        .from('garmin_webhook_config')
        .select('*')
        .eq('user_id', user.id);

      return new Response(JSON.stringify({
        success: true,
        webhooks: webhookConfigs || [],
        webhookUrl: 'https://qytorkjmzxscyaefkhnk.supabase.co/functions/v1/garmin-webhook'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    throw new Error('Invalid action');

  } catch (error) {
    console.error('Error in garmin-webhook-registration function:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
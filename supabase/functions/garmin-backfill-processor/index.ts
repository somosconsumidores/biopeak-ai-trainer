import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BackfillProcessorRequest {
  userId?: string; // Process specific user's backfills, or all if not provided
  batchSize?: number; // Number of backfills to process in this batch
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[Backfill Processor] Starting backfill processor...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request body (optional)
    let requestBody: BackfillProcessorRequest = {};
    if (req.method === 'POST' && req.body) {
      try {
        requestBody = await req.json();
      } catch (e) {
        // Ignore JSON parse errors for GET requests or empty bodies
      }
    }

    const { userId, batchSize = 10 } = requestBody;
    const now = new Date();

    // Build query to find pending backfills that are ready to process
    let query = supabase
      .from('garmin_backfill_status')
      .select('*')
      .lt('retry_count', 3) // Only process if retry_count < max_retries (3)
      .order('requested_at', { ascending: true })
      .limit(batchSize);

    // Filter by user if specified
    if (userId) {
      query = query.eq('user_id', userId);
    }

    // Filter for pending records OR error records that are ready for retry
    query = query.or(
      `status.eq.pending,and(status.eq.error,or(next_retry_at.is.null,next_retry_at.lt.${now.toISOString()}))`
    );

    const { data: pendingBackfills, error: queryError } = await query;

    if (queryError) {
      console.error('[Backfill Processor] Error querying backfills:', queryError);
      throw queryError;
    }

    console.log(`[Backfill Processor] Found ${pendingBackfills?.length || 0} backfills to process`);

    let processedCount = 0;
    let errorCount = 0;
    let rateLimit = false;
    let rateLimitReset: Date | null = null;

    // Group backfills by user to respect per-user rate limits
    const backfillsByUser = new Map<string, typeof pendingBackfills>();
    for (const backfill of pendingBackfills || []) {
      if (!backfillsByUser.has(backfill.user_id)) {
        backfillsByUser.set(backfill.user_id, []);
      }
      backfillsByUser.get(backfill.user_id)!.push(backfill);
    }

    // Process each user's backfills
    for (const [currentUserId, userBackfills] of backfillsByUser.entries()) {
      // Check if we're currently rate limited for this user
      const recentBackfill = await supabase
        .from('garmin_backfill_status')
        .select('rate_limit_reset_at')
        .eq('user_id', currentUserId)
        .not('rate_limit_reset_at', 'is', null)
        .gte('rate_limit_reset_at', now.toISOString())
        .limit(1)
        .maybeSingle();

      if (recentBackfill.data?.rate_limit_reset_at) {
        console.log(`[Backfill Processor] User ${currentUserId} is rate limited until ${recentBackfill.data.rate_limit_reset_at}`);
        continue;
      }

      // Get user's tokens
      const { data: tokenData, error: tokenError } = await supabase
        .from('garmin_tokens')
        .select('access_token, token_secret, expires_at')
        .eq('user_id', currentUserId)
        .maybeSingle();

      if (tokenError || !tokenData) {
        console.error(`[Backfill Processor] No valid tokens for user ${currentUserId}:`, tokenError);
        
        // Mark backfills as error
        for (const backfill of userBackfills) {
          await supabase
            .from('garmin_backfill_status')
            .update({
              status: 'error',
              error_message: 'User tokens not found or invalid',
              updated_at: now.toISOString()
            })
            .eq('id', backfill.id);
          errorCount++;
        }
        continue;
      }

      // Check if token is expired
      if (new Date(tokenData.expires_at) < now) {
        console.error(`[Backfill Processor] Token expired for user ${currentUserId}`);
        
        // Mark backfills as error
        for (const backfill of userBackfills) {
          await supabase
            .from('garmin_backfill_status')
            .update({
              status: 'error',
              error_message: 'User token expired',
              updated_at: now.toISOString()
            })
            .eq('id', backfill.id);
          errorCount++;
        }
        continue;
      }

      // Process backfills for this user with rate limiting
      let userDailyBackfillCount = 0;
      const dailyLimit = 100; // 100 days per minute for evaluation keys
      const batchDelay = 60000; // 1 minute delay between batches

      for (const backfill of userBackfills) {
        if (rateLimit) {
          console.log('[Backfill Processor] Rate limit hit, stopping processing');
          break;
        }

        try {
          console.log(`[Backfill Processor] Processing backfill ${backfill.id} for user ${currentUserId} (${backfill.summary_type})`);

          // Calculate the period length in days
          const periodStart = new Date(backfill.period_start);
          const periodEnd = new Date(backfill.period_end);
          const periodDays = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24));

          // Check daily rate limit
          if (userDailyBackfillCount + periodDays > dailyLimit) {
            console.log(`[Backfill Processor] Rate limit would be exceeded for user ${currentUserId}, delaying`);
            rateLimitReset = new Date(now.getTime() + batchDelay);
            
            // Update rate limit info
            await supabase
              .from('garmin_backfill_status')
              .update({
                rate_limit_reset_at: rateLimitReset.toISOString(),
                updated_at: now.toISOString()
              })
              .eq('id', backfill.id);
            
            rateLimit = true;
            break;
          }

          // Mark as in progress
          await supabase
            .from('garmin_backfill_status')
            .update({
              status: 'in_progress',
              updated_at: now.toISOString()
            })
            .eq('id', backfill.id);

          // Call the garmin-backfill function to process this backfill
          const { error: backfillError } = await supabase.functions.invoke('garmin-backfill', {
            body: {
              periodStart: backfill.period_start,
              periodEnd: backfill.period_end,
              summaryTypes: [backfill.summary_type],
              userId: currentUserId, // Pass user ID to avoid auth issues
              retryAttempt: true
            }
          });

          if (backfillError) {
            console.error(`[Backfill Processor] Error processing backfill ${backfill.id}:`, backfillError);
            
            // Update retry information
            const nextRetryResult = await supabase.rpc('calculate_next_retry', {
              retry_count: backfill.retry_count
            });

            await supabase
              .from('garmin_backfill_status')
              .update({
                status: 'error',
                error_message: backfillError.message || 'Processing error',
                retry_count: backfill.retry_count + 1,
                next_retry_at: nextRetryResult.data,
                updated_at: now.toISOString()
              })
              .eq('id', backfill.id);
            
            errorCount++;
          } else {
            console.log(`[Backfill Processor] Successfully initiated backfill ${backfill.id}`);
            userDailyBackfillCount += periodDays;
            processedCount++;
          }

          // Add a small delay between requests to be respectful to the API
          if (userBackfills.indexOf(backfill) < userBackfills.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
          }

        } catch (error) {
          console.error(`[Backfill Processor] Unexpected error processing backfill ${backfill.id}:`, error);
          
          // Update retry information
          const nextRetryResult = await supabase.rpc('calculate_next_retry', {
            retry_count: backfill.retry_count
          });

          await supabase
            .from('garmin_backfill_status')
            .update({
              status: 'error',
              error_message: `Processing error: ${error.message}`,
              retry_count: backfill.retry_count + 1,
              next_retry_at: nextRetryResult.data,
              updated_at: now.toISOString()
            })
            .eq('id', backfill.id);
          
          errorCount++;
        }
      }

      // Add delay between users to respect global rate limits
      if (backfillsByUser.size > 1 && currentUserId !== Array.from(backfillsByUser.keys()).pop()) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay between users
      }
    }

    console.log(`[Backfill Processor] Processing completed: ${processedCount} processed, ${errorCount} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Backfill processing completed: ${processedCount} processed, ${errorCount} errors`,
        processed: processedCount,
        errors: errorCount,
        rateLimited: rateLimit,
        rateLimitReset: rateLimitReset?.toISOString() || null,
        totalFound: pendingBackfills?.length || 0
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('[Backfill Processor] Error:', error);
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
});
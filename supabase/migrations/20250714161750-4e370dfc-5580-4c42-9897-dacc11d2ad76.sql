-- Clear all application data for testing reset
-- Order matters due to foreign key constraints

-- Clear activity-related data first
TRUNCATE TABLE public.strava_activity_streams CASCADE;
TRUNCATE TABLE public.garmin_activity_details CASCADE;
TRUNCATE TABLE public.training_sessions CASCADE;

-- Clear main activity tables
TRUNCATE TABLE public.strava_activities CASCADE;
TRUNCATE TABLE public.garmin_activities CASCADE;

-- Clear sync and backfill status
TRUNCATE TABLE public.strava_sync_status CASCADE;
TRUNCATE TABLE public.garmin_backfill_status CASCADE;

-- Clear health and metrics data
TRUNCATE TABLE public.garmin_daily_health CASCADE;
TRUNCATE TABLE public.garmin_vo2_max CASCADE;

-- Clear tokens and authentication data
TRUNCATE TABLE public.strava_tokens CASCADE;
TRUNCATE TABLE public.garmin_tokens CASCADE;
TRUNCATE TABLE public.oauth_temp_tokens CASCADE;

-- Clear webhook configurations and stats
TRUNCATE TABLE public.garmin_webhook_config CASCADE;
TRUNCATE TABLE public.webhook_stats CASCADE;

-- Clear user profiles (but keep auth.users intact)
TRUNCATE TABLE public.profiles CASCADE;

-- Reset any sequences if needed
-- (Postgres auto-generates UUIDs, so no sequences to reset)

-- Log the reset
INSERT INTO public.webhook_stats (webhook_type, success, activities_processed, call_timestamp) 
VALUES ('database_reset', true, 0, now());
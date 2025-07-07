export interface StravaConfig {
  clientId: string;
  redirectUri: string;
  fallback?: boolean;
  environment?: string;
}

export interface StravaActivity {
  id: string;
  strava_activity_id: number;
  name: string;
  type: string;
  distance: number | null;
  moving_time: number | null;
  elapsed_time: number | null;
  total_elevation_gain: number | null;
  start_date: string;
  average_speed: number | null;
  max_speed: number | null;
  average_heartrate: number | null;
  max_heartrate: number | null;
  calories: number | null;
  created_at: string;
  updated_at: string;
  user_id: string;
}
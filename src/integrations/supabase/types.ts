export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      garmin_activities: {
        Row: {
          average_heartrate: number | null
          average_speed: number | null
          calories: number | null
          created_at: string
          distance: number | null
          elapsed_time: number | null
          garmin_activity_id: number
          id: string
          max_heartrate: number | null
          max_speed: number | null
          moving_time: number | null
          name: string
          start_date: string
          total_elevation_gain: number | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          average_heartrate?: number | null
          average_speed?: number | null
          calories?: number | null
          created_at?: string
          distance?: number | null
          elapsed_time?: number | null
          garmin_activity_id: number
          id?: string
          max_heartrate?: number | null
          max_speed?: number | null
          moving_time?: number | null
          name: string
          start_date: string
          total_elevation_gain?: number | null
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          average_heartrate?: number | null
          average_speed?: number | null
          calories?: number | null
          created_at?: string
          distance?: number | null
          elapsed_time?: number | null
          garmin_activity_id?: number
          id?: string
          max_heartrate?: number | null
          max_speed?: number | null
          moving_time?: number | null
          name?: string
          start_date?: string
          total_elevation_gain?: number | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      garmin_activity_details: {
        Row: {
          activity_summary: Json | null
          created_at: string
          garmin_activity_id: number
          heart_rate_zones: Json | null
          id: string
          location_data: Json | null
          splits_data: Json | null
          time_in_zones: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_summary?: Json | null
          created_at?: string
          garmin_activity_id: number
          heart_rate_zones?: Json | null
          id?: string
          location_data?: Json | null
          splits_data?: Json | null
          time_in_zones?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_summary?: Json | null
          created_at?: string
          garmin_activity_id?: number
          heart_rate_zones?: Json | null
          id?: string
          location_data?: Json | null
          splits_data?: Json | null
          time_in_zones?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      garmin_backfill_status: {
        Row: {
          activities_processed: number | null
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          period_end: string
          period_start: string
          requested_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          activities_processed?: number | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          period_end: string
          period_start: string
          requested_at?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          activities_processed?: number | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          period_end?: string
          period_start?: string
          requested_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      garmin_daily_health: {
        Row: {
          active_time_in_seconds: number | null
          awake_duration_in_seconds: number | null
          body_battery_charged: number | null
          body_battery_drained: number | null
          calories_burned: number | null
          created_at: string
          deep_sleep_duration_in_seconds: number | null
          distance_in_meters: number | null
          floors_climbed: number | null
          id: string
          light_sleep_duration_in_seconds: number | null
          moderate_intensity_minutes: number | null
          rem_sleep_duration_in_seconds: number | null
          resting_heart_rate: number | null
          sleep_duration_in_seconds: number | null
          steps: number | null
          stress_score: number | null
          summary_date: string
          updated_at: string
          user_id: string
          vigorous_intensity_minutes: number | null
        }
        Insert: {
          active_time_in_seconds?: number | null
          awake_duration_in_seconds?: number | null
          body_battery_charged?: number | null
          body_battery_drained?: number | null
          calories_burned?: number | null
          created_at?: string
          deep_sleep_duration_in_seconds?: number | null
          distance_in_meters?: number | null
          floors_climbed?: number | null
          id?: string
          light_sleep_duration_in_seconds?: number | null
          moderate_intensity_minutes?: number | null
          rem_sleep_duration_in_seconds?: number | null
          resting_heart_rate?: number | null
          sleep_duration_in_seconds?: number | null
          steps?: number | null
          stress_score?: number | null
          summary_date: string
          updated_at?: string
          user_id: string
          vigorous_intensity_minutes?: number | null
        }
        Update: {
          active_time_in_seconds?: number | null
          awake_duration_in_seconds?: number | null
          body_battery_charged?: number | null
          body_battery_drained?: number | null
          calories_burned?: number | null
          created_at?: string
          deep_sleep_duration_in_seconds?: number | null
          distance_in_meters?: number | null
          floors_climbed?: number | null
          id?: string
          light_sleep_duration_in_seconds?: number | null
          moderate_intensity_minutes?: number | null
          rem_sleep_duration_in_seconds?: number | null
          resting_heart_rate?: number | null
          sleep_duration_in_seconds?: number | null
          steps?: number | null
          stress_score?: number | null
          summary_date?: string
          updated_at?: string
          user_id?: string
          vigorous_intensity_minutes?: number | null
        }
        Relationships: []
      }
      garmin_tokens: {
        Row: {
          access_token: string
          consumer_key: string | null
          created_at: string
          expires_at: string
          id: string
          oauth_verifier: string | null
          token_secret: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          consumer_key?: string | null
          created_at?: string
          expires_at: string
          id?: string
          oauth_verifier?: string | null
          token_secret: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          consumer_key?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          oauth_verifier?: string | null
          token_secret?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      garmin_webhook_config: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          summary_type: string
          updated_at: string
          user_id: string
          webhook_url: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          summary_type: string
          updated_at?: string
          user_id: string
          webhook_url: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          summary_type?: string
          updated_at?: string
          user_id?: string
          webhook_url?: string
        }
        Relationships: []
      }
      oauth_temp_tokens: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          oauth_token: string
          oauth_token_secret: string
          provider: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          oauth_token: string
          oauth_token_secret: string
          provider?: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          oauth_token?: string
          oauth_token_secret?: string
          provider?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          birth_date: string | null
          created_at: string
          display_name: string | null
          height: number | null
          id: string
          sport_preferences: string[] | null
          updated_at: string
          user_id: string
          weight: number | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          birth_date?: string | null
          created_at?: string
          display_name?: string | null
          height?: number | null
          id?: string
          sport_preferences?: string[] | null
          updated_at?: string
          user_id: string
          weight?: number | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          birth_date?: string | null
          created_at?: string
          display_name?: string | null
          height?: number | null
          id?: string
          sport_preferences?: string[] | null
          updated_at?: string
          user_id?: string
          weight?: number | null
        }
        Relationships: []
      }
      strava_activities: {
        Row: {
          average_heartrate: number | null
          average_speed: number | null
          calories: number | null
          created_at: string
          distance: number | null
          elapsed_time: number | null
          id: string
          max_heartrate: number | null
          max_speed: number | null
          moving_time: number | null
          name: string
          start_date: string
          strava_activity_id: number
          total_elevation_gain: number | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          average_heartrate?: number | null
          average_speed?: number | null
          calories?: number | null
          created_at?: string
          distance?: number | null
          elapsed_time?: number | null
          id?: string
          max_heartrate?: number | null
          max_speed?: number | null
          moving_time?: number | null
          name: string
          start_date: string
          strava_activity_id: number
          total_elevation_gain?: number | null
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          average_heartrate?: number | null
          average_speed?: number | null
          calories?: number | null
          created_at?: string
          distance?: number | null
          elapsed_time?: number | null
          id?: string
          max_heartrate?: number | null
          max_speed?: number | null
          moving_time?: number | null
          name?: string
          start_date?: string
          strava_activity_id?: number
          total_elevation_gain?: number | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      strava_activity_streams: {
        Row: {
          created_at: string
          id: string
          original_size: number | null
          resolution: string | null
          series_type: string | null
          strava_activity_id: number
          stream_data: Json
          stream_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          original_size?: number | null
          resolution?: string | null
          series_type?: string | null
          strava_activity_id: number
          stream_data: Json
          stream_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          original_size?: number | null
          resolution?: string | null
          series_type?: string | null
          strava_activity_id?: number
          stream_data?: Json
          stream_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_strava_activity_streams_activity"
            columns: ["user_id", "strava_activity_id"]
            isOneToOne: false
            referencedRelation: "strava_activities"
            referencedColumns: ["user_id", "strava_activity_id"]
          },
        ]
      }
      strava_sync_status: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          last_activity_date: string | null
          last_sync_at: string
          sync_status: string | null
          total_activities_synced: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          last_activity_date?: string | null
          last_sync_at?: string
          sync_status?: string | null
          total_activities_synced?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          last_activity_date?: string | null
          last_sync_at?: string
          sync_status?: string | null
          total_activities_synced?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      strava_tokens: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string
          id: string
          refresh_token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at: string
          id?: string
          refresh_token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string
          id?: string
          refresh_token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      training_sessions: {
        Row: {
          activity_type: string
          average_heartrate: number | null
          average_pace: number | null
          average_speed: number | null
          calories: number | null
          created_at: string
          distance: number | null
          duration: number
          elevation_gain: number | null
          id: string
          max_heartrate: number | null
          name: string
          notes: string | null
          performance_score: number | null
          recovery_metrics: Json | null
          splits_data: Json | null
          start_date: string
          strava_activity_id: number | null
          updated_at: string
          user_id: string
          zones_data: Json | null
        }
        Insert: {
          activity_type: string
          average_heartrate?: number | null
          average_pace?: number | null
          average_speed?: number | null
          calories?: number | null
          created_at?: string
          distance?: number | null
          duration: number
          elevation_gain?: number | null
          id?: string
          max_heartrate?: number | null
          name: string
          notes?: string | null
          performance_score?: number | null
          recovery_metrics?: Json | null
          splits_data?: Json | null
          start_date: string
          strava_activity_id?: number | null
          updated_at?: string
          user_id: string
          zones_data?: Json | null
        }
        Update: {
          activity_type?: string
          average_heartrate?: number | null
          average_pace?: number | null
          average_speed?: number | null
          calories?: number | null
          created_at?: string
          distance?: number | null
          duration?: number
          elevation_gain?: number | null
          id?: string
          max_heartrate?: number | null
          name?: string
          notes?: string | null
          performance_score?: number | null
          recovery_metrics?: Json | null
          splits_data?: Json | null
          start_date?: string
          strava_activity_id?: number | null
          updated_at?: string
          user_id?: string
          zones_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "training_sessions_strava_activity_fkey"
            columns: ["user_id", "strava_activity_id"]
            isOneToOne: false
            referencedRelation: "strava_activities"
            referencedColumns: ["user_id", "strava_activity_id"]
          },
        ]
      }
      webhook_stats: {
        Row: {
          activities_processed: number | null
          call_timestamp: string
          created_at: string
          error_message: string | null
          id: string
          success: boolean
          user_id: string | null
          webhook_type: string
        }
        Insert: {
          activities_processed?: number | null
          call_timestamp?: string
          created_at?: string
          error_message?: string | null
          id?: string
          success?: boolean
          user_id?: string | null
          webhook_type: string
        }
        Update: {
          activities_processed?: number | null
          call_timestamp?: string
          created_at?: string
          error_message?: string | null
          id?: string
          success?: boolean
          user_id?: string | null
          webhook_type?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_expired_oauth_tokens: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_old_webhook_stats: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

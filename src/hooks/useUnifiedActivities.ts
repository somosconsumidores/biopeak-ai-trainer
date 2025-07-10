import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface UnifiedActivity {
  id: string;
  name: string;
  type: string;
  start_date: string;
  distance: number | null;
  moving_time: number | null;
  elapsed_time: number | null;
  average_speed: number | null;
  max_speed: number | null;
  average_heartrate: number | null;
  max_heartrate: number | null;
  total_elevation_gain: number | null;
  calories: number | null;
  source: 'strava' | 'garmin';
  source_activity_id: number;
}

interface ActivityFilters {
  activityType: string;
  dateFrom: string;
  dateTo: string;
  keyword: string;
  source: string; // 'all', 'strava', 'garmin'
}

export const useUnifiedActivities = () => {
  const { user } = useAuth();
  const [activities, setActivities] = useState<UnifiedActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [activityTypes, setActivityTypes] = useState<string[]>([]);

  const loadActivities = async (page = 1, pageSize = 50, filters: ActivityFilters) => {
    if (!user) return;

    setLoading(true);
    try {
      let allActivities: UnifiedActivity[] = [];
      let totalStravaCount = 0;
      let totalGarminCount = 0;

      // Load Strava activities
      if (filters.source === 'all' || filters.source === 'strava') {
        let stravaQuery = supabase
          .from('strava_activities')
          .select('*', { count: 'exact' })
          .eq('user_id', user.id);

        // Apply filters
        if (filters.activityType && filters.activityType !== 'all') {
          stravaQuery = stravaQuery.eq('type', filters.activityType);
        }
        if (filters.dateFrom) {
          stravaQuery = stravaQuery.gte('start_date', `${filters.dateFrom}T00:00:00Z`);
        }
        if (filters.dateTo) {
          stravaQuery = stravaQuery.lte('start_date', `${filters.dateTo}T23:59:59Z`);
        }
        if (filters.keyword) {
          stravaQuery = stravaQuery.ilike('name', `%${filters.keyword}%`);
        }

        const { data: stravaData, error: stravaError, count: stravaCount } = await stravaQuery;
        
        if (!stravaError && stravaData) {
          const stravaActivities: UnifiedActivity[] = stravaData.map(activity => ({
            id: activity.id,
            name: activity.name,
            type: activity.type,
            start_date: activity.start_date,
            distance: activity.distance,
            moving_time: activity.moving_time,
            elapsed_time: activity.elapsed_time,
            average_speed: activity.average_speed,
            max_speed: activity.max_speed,
            average_heartrate: activity.average_heartrate,
            max_heartrate: activity.max_heartrate,
            total_elevation_gain: activity.total_elevation_gain,
            calories: activity.calories,
            source: 'strava',
            source_activity_id: activity.strava_activity_id
          }));
          allActivities.push(...stravaActivities);
          totalStravaCount = stravaCount || 0;
        }
      }

      // Load Garmin activities
      if (filters.source === 'all' || filters.source === 'garmin') {
        let garminQuery = supabase
          .from('garmin_activities')
          .select('*', { count: 'exact' })
          .eq('user_id', user.id);

        // Apply filters
        if (filters.activityType && filters.activityType !== 'all') {
          garminQuery = garminQuery.eq('type', filters.activityType);
        }
        if (filters.dateFrom) {
          garminQuery = garminQuery.gte('start_date', `${filters.dateFrom}T00:00:00Z`);
        }
        if (filters.dateTo) {
          garminQuery = garminQuery.lte('start_date', `${filters.dateTo}T23:59:59Z`);
        }
        if (filters.keyword) {
          garminQuery = garminQuery.ilike('name', `%${filters.keyword}%`);
        }

        const { data: garminData, error: garminError, count: garminCount } = await garminQuery;
        
        if (!garminError && garminData) {
          const garminActivities: UnifiedActivity[] = garminData.map(activity => ({
            id: activity.id,
            name: activity.name,
            type: activity.type,
            start_date: activity.start_date,
            distance: activity.distance,
            moving_time: activity.moving_time,
            elapsed_time: activity.elapsed_time,
            average_speed: activity.average_speed,
            max_speed: activity.max_speed,
            average_heartrate: activity.average_heartrate,
            max_heartrate: activity.max_heartrate,
            total_elevation_gain: activity.total_elevation_gain,
            calories: activity.calories,
            source: 'garmin',
            source_activity_id: activity.garmin_activity_id
          }));
          allActivities.push(...garminActivities);
          totalGarminCount = garminCount || 0;
        }
      }

      // Sort all activities by start date (most recent first)
      allActivities.sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());

      // Apply pagination
      const from = (page - 1) * pageSize;
      const to = from + pageSize;
      const paginatedActivities = allActivities.slice(from, to);

      setActivities(paginatedActivities);
      setTotalCount(totalStravaCount + totalGarminCount);
    } catch (error) {
      console.error('Error loading unified activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadActivityTypes = async () => {
    if (!user) return;

    try {
      const [stravaResult, garminResult] = await Promise.all([
        supabase.from('strava_activities').select('type').eq('user_id', user.id),
        supabase.from('garmin_activities').select('type').eq('user_id', user.id)
      ]);

      const stravaTypes = stravaResult.data?.map(item => item.type) || [];
      const garminTypes = garminResult.data?.map(item => item.type) || [];
      
      const uniqueTypes = [...new Set([...stravaTypes, ...garminTypes])];
      setActivityTypes(uniqueTypes.sort());
    } catch (error) {
      console.error('Error fetching activity types:', error);
    }
  };

  useEffect(() => {
    if (user) {
      loadActivityTypes();
    }
  }, [user]);

  return {
    activities,
    loading,
    totalCount,
    activityTypes,
    loadActivities
  };
};
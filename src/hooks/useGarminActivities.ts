import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface GarminActivity {
  id: string;
  garmin_activity_id: number;
  name: string;
  type: string;
  start_date: string;
  distance: number | null;
  elapsed_time: number | null;
  moving_time: number | null;
  average_heartrate: number | null;
  max_heartrate: number | null;
  average_speed: number | null;
  max_speed: number | null;
  calories: number | null;
  total_elevation_gain: number | null;
  created_at: string;
  updated_at: string;
}

export function useGarminActivities() {
  const [activities, setActivities] = useState<GarminActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      setActivities([]);
      setLoading(false);
      return;
    }

    fetchActivities();
  }, [user]);

  const fetchActivities = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('garmin_activities')
        .select('*')
        .order('start_date', { ascending: false });

      if (fetchError) {
        console.error('Error fetching Garmin activities:', fetchError);
        setError(fetchError.message);
        return;
      }

      console.log('[useGarminActivities] Fetched activities:', data?.length);
      setActivities(data || []);
    } catch (err) {
      console.error('Error in fetchActivities:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return {
    activities,
    loading,
    error,
    refetch: fetchActivities
  };
}
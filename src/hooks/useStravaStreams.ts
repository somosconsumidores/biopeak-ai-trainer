import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Json } from '@/integrations/supabase/types';

interface StravaStream {
  id: string;
  strava_activity_id: number;
  stream_type: string;
  stream_data: Json;
  original_size: number;
  resolution: string;
  series_type: string;
}

export const useStravaStreams = (activityId?: number) => {
  const { user } = useAuth();
  const [streams, setStreams] = useState<StravaStream[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStreams = async (stravaActivityId: number) => {
    if (!user) return;

    setIsLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('strava_activity_streams')
        .select('*')
        .eq('user_id', user.id)
        .eq('strava_activity_id', stravaActivityId);

      if (error) {
        setError(error.message);
      } else {
        setStreams(data || []);
      }
    } catch (err) {
      setError('Erro ao carregar dados de stream');
    } finally {
      setIsLoading(false);
    }
  };

  const getHeartRateStream = (stravaActivityId: number): number[] | null => {
    const heartRateStream = streams.find(
      s => s.strava_activity_id === stravaActivityId && s.stream_type === 'heartrate'
    );
    return heartRateStream && Array.isArray(heartRateStream.stream_data) ? 
      heartRateStream.stream_data as number[] : null;
  };

  useEffect(() => {
    if (activityId) {
      loadStreams(activityId);
    }
  }, [activityId, user]);

  return {
    streams,
    isLoading,
    error,
    loadStreams,
    getHeartRateStream
  };
};
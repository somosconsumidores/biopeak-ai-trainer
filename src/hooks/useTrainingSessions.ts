import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface TrainingSession {
  id: string;
  user_id: string;
  strava_activity_id: number | null;
  name: string;
  activity_type: string;
  start_date: string;
  duration: number; // in seconds
  distance: number | null; // in meters
  average_pace: number | null; // in seconds per km
  average_speed: number | null; // in m/s
  average_heartrate: number | null;
  max_heartrate: number | null;
  calories: number | null;
  elevation_gain: number | null;
  performance_score: number | null; // 0-100
  zones_data: any | null;
  splits_data: any | null;
  recovery_metrics: any | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function useTrainingSessions() {
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingStravaData, setProcessingStravaData] = useState(false);
  const { user } = useAuth();

  const fetchSessions = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('training_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('start_date', { ascending: false })
        .limit(20);

      if (error) {
        console.error('Error fetching training sessions:', error);
        toast.error('Erro ao carregar sessões de treino');
        return;
      }

      setSessions(data || []);
    } catch (error) {
      console.error('Error fetching training sessions:', error);
      toast.error('Erro ao carregar sessões de treino');
    } finally {
      setLoading(false);
    }
  };

  const processStravaData = async () => {
    if (!user) return;

    setProcessingStravaData(true);
    try {
      const { data, error } = await supabase.functions.invoke('process-training-sessions', {
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (error) {
        console.error('Error processing Strava data:', error);
        toast.error('Erro ao processar dados do Strava');
        return;
      }

      toast.success(`${data.processed} sessões processadas com sucesso!`);
      await fetchSessions(); // Refresh the sessions list
    } catch (error) {
      console.error('Error processing Strava data:', error);
      toast.error('Erro ao processar dados do Strava');
    } finally {
      setProcessingStravaData(false);
    }
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDistance = (meters: number | null): string => {
    if (!meters) return '-';
    const km = meters / 1000;
    return `${km.toFixed(1)}km`;
  };

  const formatPace = (secondsPerKm: number | null): string => {
    if (!secondsPerKm) return '-';
    const minutes = Math.floor(secondsPerKm / 60);
    const seconds = Math.round(secondsPerKm % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    fetchSessions();
  }, [user]);

  return {
    sessions,
    loading,
    processingStravaData,
    fetchSessions,
    processStravaData,
    formatDuration,
    formatDistance,
    formatPace
  };
}
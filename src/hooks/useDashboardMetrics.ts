import { useState, useEffect, useMemo } from 'react';
import { useTrainingSessions, TrainingSession } from '@/hooks/useTrainingSessions';
import { useGarminActivities, GarminActivity } from '@/hooks/useGarminActivities';
import { useLatestVo2Max } from '@/hooks/useGarminVo2Max';

interface DashboardMetrics {
  performancePeak: number;
  performanceChange: number;
  vo2Max: number;
  averageHeartRate: number;
  recoveryScore: number;
  weeklyData: number[];
  totalSessions: number;
  totalDistance: number;
  totalDuration: number;
  recentSessions: {
    date: string;
    type: string;
    duration: string;
    distance: string;
    score: number;
  }[];
}

export function useDashboardMetrics(): DashboardMetrics & { loading: boolean } {
  const { sessions, loading: sessionsLoading } = useTrainingSessions();
  const { activities, loading: activitiesLoading } = useGarminActivities();
  const { data: latestVo2Max, isLoading: vo2MaxLoading } = useLatestVo2Max();

  const loading = sessionsLoading || activitiesLoading || vo2MaxLoading;

  console.log('[useDashboardMetrics] Data:', { 
    sessionsCount: sessions.length, 
    activitiesCount: activities.length,
    loading, 
    activities: activities.slice(0, 3) 
  });

  const metrics = useMemo(() => {
    // Use Garmin activities if available, otherwise fall back to training sessions
    const dataSource = activities.length > 0 ? activities : sessions;
    const isGarminData = activities.length > 0;
    
    if (!dataSource.length) {
      return {
        performancePeak: 0,
        performanceChange: 0,
        vo2Max: 0,
        averageHeartRate: 0,
        recoveryScore: 0,
        weeklyData: [0, 0, 0, 0, 0, 0, 0],
        totalSessions: 0,
        totalDistance: 0,
        totalDuration: 0,
        recentSessions: []
      };
    }

    // Calculate performance metrics
    const recentData = dataSource.slice(0, 10);
    
    // For Garmin data, calculate performance score based on speed and heart rate
    const avgPerformanceScore = isGarminData ? 
      recentData.reduce((sum, activity) => {
        const garminActivity = activity as GarminActivity;
        // Simple performance score: combination of speed and heart rate efficiency
        const speed = garminActivity.average_speed || 0;
        const hr = garminActivity.average_heartrate || 0;
        const score = hr > 0 ? (speed * 100) / (hr * 0.01) : speed * 50;
        return sum + Math.min(score, 100);
      }, 0) / recentData.length :
      recentData.reduce((sum, session) => 
        sum + ((session as TrainingSession).performance_score || 0), 0) / recentData.length;

    // Calculate last week vs previous week performance
    const lastWeekData = dataSource.filter(item => {
      const itemDate = new Date(item.start_date);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return itemDate >= weekAgo;
    });

    const previousWeekData = dataSource.filter(item => {
      const itemDate = new Date(item.start_date);
      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return itemDate >= twoWeeksAgo && itemDate < weekAgo;
    });

    const calculateWeekAvg = (weekData: any[]) => {
      if (weekData.length === 0) return 0;
      if (isGarminData) {
        return weekData.reduce((sum, activity) => {
          const speed = activity.average_speed || 0;
          const hr = activity.average_heartrate || 0;
          const score = hr > 0 ? (speed * 100) / (hr * 0.01) : speed * 50;
          return sum + Math.min(score, 100);
        }, 0) / weekData.length;
      }
      return weekData.reduce((sum, s) => sum + (s.performance_score || 0), 0) / weekData.length;
    };

    const lastWeekAvg = calculateWeekAvg(lastWeekData);
    const previousWeekAvg = calculateWeekAvg(previousWeekData);

    const performanceChange = previousWeekAvg > 0 ? 
      ((lastWeekAvg - previousWeekAvg) / previousWeekAvg) * 100 : 0;

    // Filter data with heart rate for calculations
    const dataWithHR = dataSource.filter(item => {
      if (isGarminData) {
        const activity = item as GarminActivity;
        return activity.average_heartrate && activity.average_speed;
      }
      const session = item as TrainingSession;
      return session.average_heartrate && session.average_speed;
    });

    // Use real VO2 Max from Garmin if available, otherwise estimate from activities
    const estimatedVO2 = latestVo2Max || (dataWithHR.length > 0 ? 
      dataWithHR.reduce((sum, item) => {
        const speed = isGarminData ? 
          (item as GarminActivity).average_speed || 0 : 
          (item as TrainingSession).average_speed || 0;
        const hr = isGarminData ? 
          (item as GarminActivity).average_heartrate || 150 : 
          (item as TrainingSession).average_heartrate || 150;
        
        // Simple VO2 max estimation formula (only used as fallback)
        const speedKmh = speed * 3.6;
        const hrReserve = Math.max(0, 190 - hr);
        return sum + (speedKmh * 1.8 + hrReserve * 0.3);
      }, 0) / dataWithHR.length : 45);

    // Calculate average heart rate
    const avgHeartRate = dataWithHR.length > 0 ?
      dataWithHR.reduce((sum, item) => {
        const hr = isGarminData ? 
          (item as GarminActivity).average_heartrate || 0 : 
          (item as TrainingSession).average_heartrate || 0;
        return sum + hr;
      }, 0) / dataWithHR.length : 0;

    // Recovery score based on recent performance consistency
    const last5Data = dataSource.slice(0, 5);
    const performanceVariance = last5Data.length > 1 ? 
      last5Data.reduce((variance, item, index) => {
        if (index === 0) return 0;
        
        const getPerfScore = (dataItem: any) => {
          if (isGarminData) {
            const activity = dataItem as GarminActivity;
            const speed = activity.average_speed || 0;
            const hr = activity.average_heartrate || 0;
            return hr > 0 ? (speed * 100) / (hr * 0.01) : speed * 50;
          }
          return (dataItem as TrainingSession).performance_score || 0;
        };
        
        const prevScore = getPerfScore(last5Data[index - 1]);
        const currentScore = getPerfScore(item);
        return variance + Math.abs(currentScore - prevScore);
      }, 0) / (last5Data.length - 1) : 0;

    const recoveryScore = Math.max(0, 100 - (performanceVariance * 0.5));

    // Weekly performance data (last 7 days)
    const weeklyData = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      const dayStart = new Date(date.setHours(0, 0, 0, 0));
      const dayEnd = new Date(date.setHours(23, 59, 59, 999));
      
      const dayData = dataSource.filter(item => {
        const itemDate = new Date(item.start_date);
        return itemDate >= dayStart && itemDate <= dayEnd;
      });

      if (dayData.length === 0) return 0;
      
      if (isGarminData) {
        return dayData.reduce((sum, activity) => {
          const garminActivity = activity as GarminActivity;
          const speed = garminActivity.average_speed || 0;
          const hr = garminActivity.average_heartrate || 0;
          const score = hr > 0 ? (speed * 100) / (hr * 0.01) : speed * 50;
          return sum + Math.min(score, 100);
        }, 0) / dayData.length;
      }
      
      return dayData.reduce((sum, s) => sum + ((s as TrainingSession).performance_score || 0), 0) / dayData.length;
    });

    // Total metrics
    const totalDistance = dataSource.reduce((sum, item) => {
      const distance = isGarminData ? 
        (item as GarminActivity).distance || 0 : 
        (item as TrainingSession).distance || 0;
      return sum + distance;
    }, 0);
    
    const totalDuration = dataSource.reduce((sum, item) => {
      const duration = isGarminData ? 
        (item as GarminActivity).elapsed_time || 0 : 
        (item as TrainingSession).duration;
      return sum + duration;
    }, 0);

    // Format recent sessions for display
    const formatDuration = (seconds: number): string => {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      if (hours > 0) {
        return `${hours}h ${minutes}min`;
      }
      return `${minutes}min`;
    };

    const formatDistance = (meters: number): string => {
      return `${(meters / 1000).toFixed(1)}km`;
    };

    const formatDate = (dateString: string): string => {
      const date = new Date(dateString);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      if (date.toDateString() === today.toDateString()) return 'Hoje';
      if (date.toDateString() === yesterday.toDateString()) return 'Ontem';
      
      const diffDays = Math.ceil((today.getTime() - date.getTime()) / (1000 * 3600 * 24));
      return `${diffDays} dias`;
    };

    const recentSessionsFormatted = dataSource.slice(0, 3).map(item => {
      if (isGarminData) {
        const activity = item as GarminActivity;
        const speed = activity.average_speed || 0;
        const hr = activity.average_heartrate || 0;
        const score = hr > 0 ? (speed * 100) / (hr * 0.01) : speed * 50;
        
        return {
          date: formatDate(activity.start_date),
          type: activity.type,
          duration: formatDuration(activity.elapsed_time || 0),
          distance: activity.distance ? formatDistance(activity.distance) : '-',
          score: Math.round(Math.min(score, 100))
        };
      }
      
      const session = item as TrainingSession;
      return {
        date: formatDate(session.start_date),
        type: session.activity_type,
        duration: formatDuration(session.duration),
        distance: session.distance ? formatDistance(session.distance) : '-',
        score: Math.round(session.performance_score || 0)
      };
    });

    return {
      performancePeak: Math.round(avgPerformanceScore),
      performanceChange: Math.round(performanceChange),
      vo2Max: Math.round(estimatedVO2 * 10) / 10,
      averageHeartRate: Math.round(avgHeartRate),
      recoveryScore: Math.round(recoveryScore),
      weeklyData: weeklyData.map(val => Math.round(val)),
      totalSessions: dataSource.length,
      totalDistance: Math.round(totalDistance),
      totalDuration,
      recentSessions: recentSessionsFormatted
    };
  }, [sessions, activities, latestVo2Max]);

  return {
    ...metrics,
    loading
  };
}
import { useState, useEffect, useMemo } from 'react';
import { useTrainingSessions, TrainingSession } from './useTrainingSessions';

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
  const { sessions, loading } = useTrainingSessions();

  const metrics = useMemo(() => {
    if (!sessions.length) {
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
    const recentSessions = sessions.slice(0, 10);
    const avgPerformanceScore = recentSessions.reduce((sum, session) => 
      sum + (session.performance_score || 0), 0) / recentSessions.length;

    // Calculate last week vs previous week performance
    const lastWeekSessions = sessions.filter(session => {
      const sessionDate = new Date(session.start_date);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return sessionDate >= weekAgo;
    });

    const previousWeekSessions = sessions.filter(session => {
      const sessionDate = new Date(session.start_date);
      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return sessionDate >= twoWeeksAgo && sessionDate < weekAgo;
    });

    const lastWeekAvg = lastWeekSessions.length > 0 ? 
      lastWeekSessions.reduce((sum, s) => sum + (s.performance_score || 0), 0) / lastWeekSessions.length : 0;
    const previousWeekAvg = previousWeekSessions.length > 0 ? 
      previousWeekSessions.reduce((sum, s) => sum + (s.performance_score || 0), 0) / previousWeekSessions.length : 0;

    const performanceChange = previousWeekAvg > 0 ? 
      ((lastWeekAvg - previousWeekAvg) / previousWeekAvg) * 100 : 0;

    // Estimate VO2 Max from average speed and heart rate data
    const sessionsWithHR = sessions.filter(s => s.average_heartrate && s.average_speed);
    const estimatedVO2 = sessionsWithHR.length > 0 ? 
      sessionsWithHR.reduce((sum, s) => {
        // Simple VO2 max estimation formula
        const speedKmh = (s.average_speed || 0) * 3.6;
        const hrReserve = Math.max(0, 190 - (s.average_heartrate || 150));
        return sum + (speedKmh * 1.8 + hrReserve * 0.3);
      }, 0) / sessionsWithHR.length : 45;

    // Calculate average heart rate
    const avgHeartRate = sessionsWithHR.length > 0 ?
      sessionsWithHR.reduce((sum, s) => sum + (s.average_heartrate || 0), 0) / sessionsWithHR.length : 0;

    // Recovery score based on recent performance consistency
    const last5Sessions = sessions.slice(0, 5);
    const performanceVariance = last5Sessions.length > 1 ? 
      last5Sessions.reduce((variance, session, index) => {
        if (index === 0) return 0;
        const prevScore = last5Sessions[index - 1].performance_score || 0;
        const currentScore = session.performance_score || 0;
        return variance + Math.abs(currentScore - prevScore);
      }, 0) / (last5Sessions.length - 1) : 0;

    const recoveryScore = Math.max(0, 100 - performanceVariance);

    // Weekly performance data (last 7 days)
    const weeklyData = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      const dayStart = new Date(date.setHours(0, 0, 0, 0));
      const dayEnd = new Date(date.setHours(23, 59, 59, 999));
      
      const daySessions = sessions.filter(session => {
        const sessionDate = new Date(session.start_date);
        return sessionDate >= dayStart && sessionDate <= dayEnd;
      });

      return daySessions.length > 0 ? 
        daySessions.reduce((sum, s) => sum + (s.performance_score || 0), 0) / daySessions.length : 0;
    });

    // Total metrics
    const totalDistance = sessions.reduce((sum, s) => sum + (s.distance || 0), 0);
    const totalDuration = sessions.reduce((sum, s) => sum + s.duration, 0);

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

    const recentSessionsFormatted = sessions.slice(0, 3).map(session => ({
      date: formatDate(session.start_date),
      type: session.activity_type,
      duration: formatDuration(session.duration),
      distance: session.distance ? formatDistance(session.distance) : '-',
      score: Math.round(session.performance_score || 0)
    }));

    return {
      performancePeak: Math.round(avgPerformanceScore),
      performanceChange: Math.round(performanceChange),
      vo2Max: Math.round(estimatedVO2 * 10) / 10,
      averageHeartRate: Math.round(avgHeartRate),
      recoveryScore: Math.round(recoveryScore),
      weeklyData: weeklyData.map(val => Math.round(val)),
      totalSessions: sessions.length,
      totalDistance: Math.round(totalDistance),
      totalDuration,
      recentSessions: recentSessionsFormatted
    };
  }, [sessions]);

  return {
    ...metrics,
    loading
  };
}
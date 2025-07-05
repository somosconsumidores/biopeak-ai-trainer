import { useState } from 'react';
import { gpxParser } from 'gpx-parser-builder';

export interface GpxData {
  name: string;
  totalDistance: number;
  totalTime: number;
  averagePace: string;
  elevationGain: number;
  maxElevation: number;
  minElevation: number;
  averageHeartRate?: number;
  maxHeartRate?: number;
  calories?: number;
  trackPoints: Array<{
    lat: number;
    lon: number;
    time: Date;
    elevation?: number;
    heartRate?: number;
    pace?: number;
  }>;
}

export const useGpxParser = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parseGpxFile = async (file: File): Promise<GpxData | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const text = await file.text();
      const parsed = gpxParser.parse(text);
      
      if (!parsed.tracks || parsed.tracks.length === 0) {
        throw new Error('Nenhuma trilha encontrada no arquivo GPX');
      }

      const track = parsed.tracks[0];
      const segment = track.segments[0];
      const points = segment.points;

      if (!points || points.length === 0) {
        throw new Error('Nenhum ponto de trilha encontrado');
      }

      // Calculate metrics
      let totalDistance = 0;
      let elevationGain = 0;
      let maxElevation = -Infinity;
      let minElevation = Infinity;
      let heartRateSum = 0;
      let heartRateCount = 0;
      let maxHeartRate = 0;

      const trackPoints = points.map((point, index) => {
        const elevation = point.elevation || 0;
        const heartRate = point.extensions?.TrackPointExtension?.hr;
        
        if (elevation > maxElevation) maxElevation = elevation;
        if (elevation < minElevation) minElevation = elevation;
        
        if (heartRate) {
          heartRateSum += heartRate;
          heartRateCount++;
          if (heartRate > maxHeartRate) maxHeartRate = heartRate;
        }

        // Calculate distance from previous point
        if (index > 0) {
          const prevPoint = points[index - 1];
          const distance = calculateDistance(
            prevPoint.latitude,
            prevPoint.longitude,
            point.latitude,
            point.longitude
          );
          totalDistance += distance;
        }

        // Calculate elevation gain
        if (index > 0 && elevation > points[index - 1].elevation) {
          elevationGain += elevation - points[index - 1].elevation;
        }

        return {
          lat: point.latitude,
          lon: point.longitude,
          time: new Date(point.time),
          elevation,
          heartRate,
          pace: 0 // Will be calculated based on segment times
        };
      });

      // Calculate total time and average pace
      const startTime = new Date(points[0].time);
      const endTime = new Date(points[points.length - 1].time);
      const totalTimeMs = endTime.getTime() - startTime.getTime();
      const totalTimeMinutes = totalTimeMs / (1000 * 60);
      
      const averagePaceMinPerKm = totalTimeMinutes / (totalDistance / 1000);
      const paceMin = Math.floor(averagePaceMinPerKm);
      const paceSec = Math.round((averagePaceMinPerKm - paceMin) * 60);

      const gpxData: GpxData = {
        name: track.name || 'Treino Importado',
        totalDistance: Math.round(totalDistance),
        totalTime: Math.round(totalTimeMs / 1000),
        averagePace: `${paceMin}:${paceSec.toString().padStart(2, '0')}`,
        elevationGain: Math.round(elevationGain),
        maxElevation: Math.round(maxElevation),
        minElevation: Math.round(minElevation),
        averageHeartRate: heartRateCount > 0 ? Math.round(heartRateSum / heartRateCount) : undefined,
        maxHeartRate: maxHeartRate > 0 ? maxHeartRate : undefined,
        calories: estimateCalories(totalDistance, totalTimeMs, heartRateSum / heartRateCount),
        trackPoints
      };

      setIsLoading(false);
      return gpxData;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao processar arquivo GPX');
      setIsLoading(false);
      return null;
    }
  };

  return { parseGpxFile, isLoading, error };
};

// Haversine formula to calculate distance between two coordinates
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
}

// Simple calorie estimation based on distance, time and heart rate
function estimateCalories(distanceM: number, timeMs: number, avgHR?: number): number {
  if (!avgHR) return Math.round(distanceM * 0.05); // Basic estimation
  
  const timeMinutes = timeMs / (1000 * 60);
  const weight = 70; // Assume 70kg average weight
  const met = avgHR > 150 ? 12 : avgHR > 130 ? 10 : 8;
  
  return Math.round((met * weight * timeMinutes) / 60);
}
import { useState } from 'react';

// Custom GPX parser using DOMParser
const parseGpxString = (gpxString: string) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(gpxString, 'text/xml');
  
  // Check for parsing errors
  const parserError = doc.querySelector('parsererror');
  if (parserError) {
    throw new Error('Erro ao analisar arquivo GPX: formato inválido');
  }

  const tracks = Array.from(doc.querySelectorAll('trk')).map(track => {
    const name = track.querySelector('name')?.textContent || 'Trilha sem nome';
    const segments = Array.from(track.querySelectorAll('trkseg'));
    
    const points = segments.flatMap(segment => 
      Array.from(segment.querySelectorAll('trkpt')).map(point => {
        const lat = parseFloat(point.getAttribute('lat') || '0');
        const lon = parseFloat(point.getAttribute('lon') || '0');
        const timeElement = point.querySelector('time');
        const elevationElement = point.querySelector('ele');
        const heartRateElement = point.querySelector('extensions heartrate, extensions hr');
        
        return {
          lat,
          lon,
          time: timeElement ? timeElement.textContent : null,
          elevation: elevationElement ? parseFloat(elevationElement.textContent || '0') : undefined,
          heartRate: heartRateElement ? parseInt(heartRateElement.textContent || '0') : undefined
        };
      })
    );

    return { name, points };
  });

  return { tracks };
};

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
      const parsed = parseGpxString(text);
      
      if (!parsed.tracks || parsed.tracks.length === 0) {
        throw new Error('Nenhuma trilha encontrada no arquivo GPX');
      }

      const track = parsed.tracks[0];
      const points = track.points;

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
        const heartRate = point.heartRate;
        
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
            prevPoint.lat,
            prevPoint.lon,
            point.lat,
            point.lon
          );
          totalDistance += distance;
        }

        // Calculate elevation gain
        if (index > 0 && elevation > (points[index - 1].elevation || 0)) {
          elevationGain += elevation - (points[index - 1].elevation || 0);
        }

        return {
          lat: point.lat,
          lon: point.lon,
          time: point.time ? new Date(point.time) : new Date(),
          elevation,
          heartRate,
          pace: 0 // Will be calculated based on segment times
        };
      });

      // Calculate total time and average pace
      const validTimePoints = trackPoints.filter(p => p.time);
      let totalTimeMs = 0;
      
      if (validTimePoints.length >= 2) {
        const startTime = validTimePoints[0].time;
        const endTime = validTimePoints[validTimePoints.length - 1].time;
        totalTimeMs = endTime.getTime() - startTime.getTime();
      }
      
      const totalTimeMinutes = totalTimeMs / (1000 * 60);
      
      const averagePaceMinPerKm = totalDistance > 0 ? totalTimeMinutes / (totalDistance / 1000) : 0;
      const paceMin = Math.floor(averagePaceMinPerKm);
      const paceSec = Math.round((averagePaceMinPerKm - paceMin) * 60);

      const gpxData: GpxData = {
        name: track.name || 'Treino Importado',
        totalDistance: Math.round(totalDistance),
        totalTime: Math.round(totalTimeMs / 1000),
        averagePace: `${paceMin}:${paceSec.toString().padStart(2, '0')}`,
        elevationGain: Math.round(elevationGain),
        maxElevation: maxElevation !== -Infinity ? Math.round(maxElevation) : 0,
        minElevation: minElevation !== Infinity ? Math.round(minElevation) : 0,
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
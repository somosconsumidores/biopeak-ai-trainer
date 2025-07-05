import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Activity, Clock, TrendingUp, Heart, Zap, Map } from 'lucide-react';
import { type GpxData } from '@/hooks/useGpxParser';

interface GpxDataViewerProps {
  gpxData: GpxData;
  onClose: () => void;
}

const GpxDataViewer = ({ gpxData, onClose }: GpxDataViewerProps) => {
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatDistance = (meters: number) => {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(1)}km`;
    }
    return `${meters}m`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-1">{gpxData.name}</h2>
          <p className="text-muted-foreground">Dados importados do arquivo GPX</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
            Importado
          </Badge>
          <Button variant="glass" size="sm" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </div>

      {/* Main Stats */}
      <Card className="glass p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-primary mb-1">
              {formatTime(gpxData.totalTime)}
            </div>
            <p className="text-sm text-muted-foreground flex items-center justify-center">
              <Clock className="w-4 h-4 mr-1" />
              Duração
            </p>
          </div>
          
          <div className="text-center">
            <div className="text-3xl font-bold text-primary mb-1">
              {formatDistance(gpxData.totalDistance)}
            </div>
            <p className="text-sm text-muted-foreground">Distância</p>
          </div>
          
          <div className="text-center">
            <div className="text-3xl font-bold text-primary mb-1">
              {gpxData.averagePace}
            </div>
            <p className="text-sm text-muted-foreground">Pace Médio</p>
          </div>
          
          <div className="text-center">
            <div className="text-3xl font-bold text-primary mb-1">
              {gpxData.calories || 'N/A'}
            </div>
            <p className="text-sm text-muted-foreground">Calorias</p>
          </div>
        </div>
      </Card>

      {/* Detailed Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="glass p-6">
          <div className="flex items-center mb-4">
            <div className="p-2 bg-primary/20 rounded-lg mr-3">
              <TrendingUp className="w-5 h-5 text-primary" />
            </div>
            <h3 className="text-xl font-semibold text-foreground">Elevação</h3>
          </div>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Ganho de Elevação</span>
              <span className="text-primary font-semibold">{gpxData.elevationGain}m</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Elevação Máxima</span>
              <span className="text-primary font-semibold">{gpxData.maxElevation}m</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Elevação Mínima</span>
              <span className="text-primary font-semibold">{gpxData.minElevation}m</span>
            </div>
          </div>
        </Card>

        {gpxData.averageHeartRate && (
          <Card className="glass p-6">
            <div className="flex items-center mb-4">
              <div className="p-2 bg-primary/20 rounded-lg mr-3">
                <Heart className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-foreground">Frequência Cardíaca</h3>
            </div>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">FC Média</span>
                <span className="text-primary font-semibold">{gpxData.averageHeartRate} bpm</span>
              </div>
              
              {gpxData.maxHeartRate && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">FC Máxima</span>
                  <span className="text-primary font-semibold">{gpxData.maxHeartRate} bpm</span>
                </div>
              )}
              
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 rounded-full w-[75%]"></div>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Track Info */}
      <Card className="glass p-6">
        <div className="flex items-center mb-4">
          <div className="p-2 bg-primary/20 rounded-lg mr-3">
            <Map className="w-5 h-5 text-primary" />
          </div>
          <h3 className="text-xl font-semibold text-foreground">Detalhes da Trilha</h3>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div className="glass p-4">
            <div className="text-lg font-bold text-primary mb-1">
              {gpxData.trackPoints.length}
            </div>
            <p className="text-sm text-muted-foreground">Pontos GPS</p>
          </div>
          
          <div className="glass p-4">
            <div className="text-lg font-bold text-primary mb-1">
              {Math.round(gpxData.totalDistance / gpxData.trackPoints.length)}m
            </div>
            <p className="text-sm text-muted-foreground">Intervalo Médio</p>
          </div>
          
          <div className="glass p-4">
            <div className="text-lg font-bold text-primary mb-1">
              {gpxData.trackPoints.filter(p => p.heartRate).length}
            </div>
            <p className="text-sm text-muted-foreground">Pontos c/ FC</p>
          </div>
          
          <div className="glass p-4">
            <div className="text-lg font-bold text-primary mb-1">
              {gpxData.trackPoints.filter(p => p.elevation).length}
            </div>
            <p className="text-sm text-muted-foreground">Pontos c/ Elevação</p>
          </div>
        </div>
      </Card>

      {/* AI Analysis Simulation */}
      <Card className="glass p-6">
        <div className="flex items-center mb-4">
          <div className="p-2 bg-primary/20 rounded-lg mr-3">
            <Zap className="w-5 h-5 text-primary" />
          </div>
          <h3 className="text-xl font-semibold text-foreground">Análise da IA</h3>
        </div>
        
        <div className="space-y-4">
          <div className="glass p-4 border-l-4 border-blue-500">
            <h4 className="font-medium text-blue-400 mb-2">📊 Análise do Treino</h4>
            <p className="text-sm text-muted-foreground">
              Treino de {formatDistance(gpxData.totalDistance)} com pace médio de {gpxData.averagePace}.
              {gpxData.elevationGain > 100 && ` Percurso com ${gpxData.elevationGain}m de ganho de elevação - excelente para fortalecimento.`}
              {gpxData.averageHeartRate && ` FC média de ${gpxData.averageHeartRate} bpm indica esforço controlado.`}
            </p>
          </div>
          
          <div className="glass p-4 border-l-4 border-green-500">
            <h4 className="font-medium text-green-400 mb-2">✓ Pontos Fortes</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Dados completos de GPS com {gpxData.trackPoints.length} pontos</li>
              {gpxData.averageHeartRate && <li>• Monitoramento cardíaco durante todo o treino</li>}
              <li>• Pace consistente ao longo do percurso</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default GpxDataViewer;
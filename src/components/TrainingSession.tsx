import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, Clock, Calendar, ChartBar, Settings, Upload, RefreshCw, Zap } from "lucide-react";
import { useState } from "react";
import GpxUploader from "@/components/GpxUploader";
import GpxDataViewer from "@/components/GpxDataViewer";
import { type GpxData } from "@/hooks/useGpxParser";
import { useTrainingSessions } from "@/hooks/useTrainingSessions";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const TrainingSession = () => {
  const [showGpxUploader, setShowGpxUploader] = useState(false);
  const [gpxData, setGpxData] = useState<GpxData | null>(null);
  const { 
    sessions, 
    loading, 
    processingStravaData, 
    processStravaData, 
    formatDuration, 
    formatDistance, 
    formatPace 
  } = useTrainingSessions();

  const handleGpxParsed = (data: GpxData) => {
    setGpxData(data);
    setShowGpxUploader(false);
  };

  // Get the most recent session for display
  const currentSession = sessions[0];

  if (gpxData) {
    return (
      <div className="p-6">
        <GpxDataViewer 
          gpxData={gpxData} 
          onClose={() => setGpxData(null)} 
        />
      </div>
    );
  }

  if (showGpxUploader) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Importar Treino GPX</h1>
            <p className="text-muted-foreground">Importe dados reais do seu dispositivo Garmin ou Strava</p>
          </div>
          <Button variant="glass" onClick={() => setShowGpxUploader(false)}>
            Voltar
          </Button>
        </div>
        <GpxUploader onGpxParsed={handleGpxParsed} />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando sessões de treino...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Sessões de Treino</h1>
          <p className="text-muted-foreground">Análise detalhada dos seus treinos do Strava</p>
        </div>
        <div className="flex items-center space-x-3">
          {processingStravaData && (
            <div className="flex items-center text-sm text-primary">
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Processando dados automaticamente...
            </div>
          )}
          <Button 
            variant="glass" 
            size="sm"
            onClick={processStravaData}
            disabled={processingStravaData}
          >
            {processingStravaData ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Zap className="w-4 h-4 mr-2" />
            )}
            Processar Strava
          </Button>
          <Button variant="hero" size="sm" onClick={() => setShowGpxUploader(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Importar GPX
          </Button>
        </div>
      </div>

      {/* No Sessions State */}
      {sessions.length === 0 && (
        <Card className="glass p-8 text-center animate-fade-in">
          <Activity className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-foreground mb-2">Nenhuma sessão encontrada</h3>
          <p className="text-muted-foreground mb-6">
            Conecte-se ao Strava e processe seus dados para ver suas sessões de treino aqui.
          </p>
          <Button 
            variant="ai" 
            onClick={processStravaData}
            disabled={processingStravaData}
          >
            {processingStravaData ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Zap className="w-4 h-4 mr-2" />
            )}
            Processar Dados do Strava
          </Button>
        </Card>
      )}

      {/* Current Session Overview */}
      {currentSession && (
        <>
          <Card className="glass p-6 animate-fade-in">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-primary/20 rounded-lg">
                  <Activity className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-foreground">{currentSession.name}</h2>
                  <p className="text-muted-foreground">
                    {format(new Date(currentSession.start_date), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </div>
              {currentSession.performance_score && (
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-lg px-4 py-2">
                  {Math.round(currentSession.performance_score)}% Performance
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-primary mb-1">
                  {formatDuration(currentSession.duration)}
                </div>
                <p className="text-sm text-muted-foreground flex items-center justify-center">
                  <Clock className="w-4 h-4 mr-1" />
                  Duração
                </p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-primary mb-1">
                  {formatDistance(currentSession.distance)}
                </div>
                <p className="text-sm text-muted-foreground">Distância</p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-primary mb-1">
                  {formatPace(currentSession.average_pace)}
                </div>
                <p className="text-sm text-muted-foreground">Pace Médio</p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-primary mb-1">
                  {currentSession.calories ? Math.round(currentSession.calories) : '-'}
                </div>
                <p className="text-sm text-muted-foreground">Calorias</p>
              </div>
            </div>
          </Card>

          {/* Detailed Metrics */}
          <Card className="glass p-6 animate-slide-up">
            <div className="flex items-center mb-4">
              <div className="p-2 bg-primary/20 rounded-lg mr-3">
                <ChartBar className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-foreground">Métricas Detalhadas</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {currentSession.average_heartrate && (
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium text-foreground">Frequência Cardíaca</span>
                    <span className="text-sm text-primary">{currentSession.average_heartrate} bpm médio</span>
                  </div>
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 rounded-full w-[75%]"></div>
                  </div>
                </div>
              )}

              {currentSession.elevation_gain && (
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium text-foreground">Elevação</span>
                    <span className="text-sm text-primary">{Math.round(currentSession.elevation_gain)}m</span>
                  </div>
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full w-[60%] animate-fade-in"></div>
                  </div>
                </div>
              )}

              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium text-foreground">Tipo</span>
                  <span className="text-sm text-primary">{currentSession.activity_type}</span>
                </div>
                <Badge variant="outline">{currentSession.activity_type}</Badge>
              </div>

              {currentSession.recovery_metrics && (
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium text-foreground">Recuperação Prev.</span>
                    <span className="text-sm text-primary">
                      {currentSession.recovery_metrics.estimated_recovery_time}h
                    </span>
                  </div>
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                    {currentSession.recovery_metrics.hydration_status}
                  </Badge>
                </div>
              )}
            </div>
          </Card>

          {/* Recovery Feedback */}
          {currentSession.recovery_metrics && (
            <Card className="glass p-6 animate-slide-up">
              <div className="flex items-center mb-4">
                <div className="p-2 bg-primary/20 rounded-lg mr-3">
                  <Activity className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-foreground">Feedback de Recuperação</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="glass p-4 text-center">
                  <div className="text-2xl font-bold text-green-400 mb-2">
                    {currentSession.recovery_metrics.hydration_status}
                  </div>
                  <p className="text-sm text-muted-foreground">Hidratação</p>
                  <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full w-[85%]"></div>
                  </div>
                </div>
                
                <div className="glass p-4 text-center">
                  <div className="text-2xl font-bold text-yellow-400 mb-2">
                    {currentSession.recovery_metrics.muscle_fatigue}
                  </div>
                  <p className="text-sm text-muted-foreground">Fadiga Muscular</p>
                  <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-yellow-500 rounded-full w-[65%]"></div>
                  </div>
                </div>
                
                <div className="glass p-4 text-center">
                  <div className="text-2xl font-bold text-blue-400 mb-2">
                    {currentSession.recovery_metrics.stress_score}
                  </div>
                  <p className="text-sm text-muted-foreground">Score de Stress</p>
                  <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full w-[70%]"></div>
                  </div>
                </div>
              </div>
            </Card>
          )}
        </>
      )}

      {/* Recent Sessions List */}
      {sessions.length > 1 && (
        <Card className="glass p-6 animate-fade-in">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-foreground">Sessões Recentes</h3>
            <Badge variant="outline">{sessions.length} sessões</Badge>
          </div>
          
          <div className="space-y-3">
            {sessions.slice(1, 6).map((session, index) => (
              <div key={session.id} className="glass p-4 rounded-lg flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Activity className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground">{session.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(session.start_date), "dd/MM", { locale: ptBR })} • 
                      {formatDuration(session.duration)} • {formatDistance(session.distance)}
                    </p>
                  </div>
                </div>
                {session.performance_score && (
                  <Badge className="bg-primary/20 text-primary border-primary/30">
                    {Math.round(session.performance_score)}%
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

export default TrainingSession;
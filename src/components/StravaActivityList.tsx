import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, MapPin, Zap, Heart } from "lucide-react";
import { StravaActivity } from "@/types/strava";
import { HeartRateChart } from "./HeartRateChart";
import { useStravaStreams } from "@/hooks/useStravaStreams";
import { useState } from "react";

interface StravaActivityListProps {
  activities: StravaActivity[];
}

const StravaActivityList = ({ activities }: StravaActivityListProps) => {
  const [expandedActivity, setExpandedActivity] = useState<number | null>(null);
  const { getHeartRateStream, loadStreams, isLoading } = useStravaStreams();

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  const handleToggleHeartRate = async (activityId: number) => {
    if (expandedActivity === activityId) {
      setExpandedActivity(null);
    } else {
      setExpandedActivity(activityId);
      await loadStreams(activityId);
    }
  };

  const formatDistance = (meters: number) => {
    return `${(meters / 1000).toFixed(2)} km`;
  };

  const formatSpeed = (metersPerSecond: number) => {
    return `${(metersPerSecond * 3.6).toFixed(1)} km/h`;
  };

  if (activities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Atividades Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Nenhuma atividade encontrada</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-foreground">Atividades Recentes</h3>
      {activities.map((activity) => (
        <Card key={activity.id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{activity.name}</CardTitle>
              <Badge variant="outline">{activity.type}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span className="text-sm">
                  {new Date(activity.start_date).toLocaleDateString('pt-BR')}
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span className="text-sm">
                  {formatDuration(activity.moving_time)}
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <span className="text-sm">
                  {formatDistance(activity.distance)}
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                <span className="text-sm">
                  {activity.average_speed ? formatSpeed(activity.average_speed) : 'Velocidade não disponível'}
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                <span className="text-sm">
                  {activity.calories ? `${activity.calories} cal` : 'Calorias não disponíveis'}
                </span>
              </div>
              
              {activity.average_heartrate && (
                <div className="flex items-center gap-2">
                  <Heart className="h-4 w-4" />
                  <span className="text-sm">
                    {activity.average_heartrate} bpm (média)
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleToggleHeartRate(activity.strava_activity_id)}
                    disabled={isLoading}
                  >
                    {expandedActivity === activity.strava_activity_id ? 'Ocultar' : 'Ver'} Gráfico
                  </Button>
                </div>
              )}
            </div>
            
            {expandedActivity === activity.strava_activity_id && (
              <div className="mt-4">
                {(() => {
                  const heartRateData = getHeartRateStream(activity.strava_activity_id);
                  return heartRateData ? (
                    <HeartRateChart 
                      heartRateData={heartRateData} 
                      title={`Frequência Cardíaca - ${activity.name}`}
                    />
                  ) : (
                    <Card>
                      <CardContent className="pt-6">
                        <p className="text-muted-foreground">
                          Dados detalhados de frequência cardíaca não disponíveis para esta atividade.
                        </p>
                      </CardContent>
                    </Card>
                  );
                })()}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default StravaActivityList;
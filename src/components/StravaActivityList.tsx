import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDistance, formatTime } from "@/utils/stravaUtils";

interface StravaActivityListProps {
  activities: any[];
}

const StravaActivityList = ({ activities }: StravaActivityListProps) => {
  if (activities.length === 0) {
    return null;
  }

  return (
    <Card className="glass p-6">
      <h3 className="text-lg font-semibold text-foreground mb-4">Atividades Recentes</h3>
      <div className="space-y-3">
        {activities.map((activity) => (
          <div key={activity.id} className="glass p-4 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-foreground">{activity.name}</h4>
              <Badge variant="outline" className="text-xs">
                {activity.type}
              </Badge>
            </div>
            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
              <span>{formatDistance(activity.distance)}</span>
              <span>{formatTime(activity.moving_time)}</span>
              {activity.average_speed && (
                <span>{(activity.average_speed * 3.6).toFixed(1)} km/h</span>
              )}
              <span>{new Date(activity.start_date).toLocaleDateString('pt-BR')}</span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

export default StravaActivityList;
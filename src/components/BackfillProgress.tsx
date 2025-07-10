import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, Clock, AlertTriangle, RefreshCw, Calendar, TrendingUp } from "lucide-react";
import { useGarminBackfill } from "@/hooks/useGarminBackfill";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const BackfillProgress = () => {
  const { user } = useAuth();
  const { backfillStatus, summary, isLoading, loadBackfillStatus } = useGarminBackfill();
  const [garminActivityCount, setGarminActivityCount] = useState(0);

  useEffect(() => {
    loadGarminActivityCount();
  }, [user]);

  const loadGarminActivityCount = async () => {
    if (!user) return;
    
    try {
      const { count, error } = await supabase
        .from('garmin_activities')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);
      
      if (!error) {
        setGarminActivityCount(count || 0);
      }
    } catch (error) {
      console.error('Error loading Garmin activity count:', error);
    }
  };

  const getOverallProgress = () => {
    if (summary.total === 0) return 0;
    return Math.round((summary.completed / summary.total) * 100);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600';
      case 'in_progress': return 'text-blue-600';
      case 'pending': return 'text-yellow-600';
      case 'error': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      case 'in_progress': return <RefreshCw className="w-4 h-4 animate-spin" />;
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'error': return <AlertTriangle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  if (summary.total === 0) {
    return null; // Don't show if no backfill has been initiated
  }

  return (
    <Card className="glass p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">Status do Backfill</h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            loadBackfillStatus();
            loadGarminActivityCount();
          }}
          disabled={isLoading}
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Progress Overview */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Progresso Geral</span>
          <span className="text-sm font-medium">{getOverallProgress()}%</span>
        </div>
        <Progress value={getOverallProgress()} className="h-2" />
      </div>

      {/* Statistics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="text-center p-3 bg-muted/50 rounded-lg">
          <div className="text-lg font-bold text-primary">{summary.total}</div>
          <div className="text-xs text-muted-foreground">Períodos</div>
        </div>
        <div className="text-center p-3 bg-green-500/10 rounded-lg">
          <div className="text-lg font-bold text-green-600">{summary.completed}</div>
          <div className="text-xs text-muted-foreground">Completos</div>
        </div>
        <div className="text-center p-3 bg-blue-500/10 rounded-lg">
          <div className="text-lg font-bold text-blue-600">{summary.inProgress + summary.pending}</div>
          <div className="text-xs text-muted-foreground">Pendentes</div>
        </div>
        <div className="text-center p-3 bg-orange-500/10 rounded-lg">
          <div className="text-lg font-bold text-orange-600">{garminActivityCount}</div>
          <div className="text-xs text-muted-foreground">Atividades</div>
        </div>
      </div>

      {/* Status Details */}
      {backfillStatus.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">Detalhes dos Períodos</h4>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {backfillStatus.slice(0, 3).map((record) => (
              <div key={record.id} className="flex items-center justify-between p-2 bg-muted/30 rounded text-sm">
                <div className="flex items-center gap-2">
                  <span className={getStatusColor(record.status)}>
                    {getStatusIcon(record.status)}
                  </span>
                  <span className="text-foreground">
                    {new Date(record.period_start).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {record.activities_processed > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {record.activities_processed} atividades
                    </span>
                  )}
                  <Badge variant="outline" className="text-xs">
                    {record.status}
                  </Badge>
                </div>
              </div>
            ))}
            {backfillStatus.length > 3 && (
              <div className="text-center text-xs text-muted-foreground">
                +{backfillStatus.length - 3} mais períodos
              </div>
            )}
          </div>
        </div>
      )}

      {/* Success message */}
      {summary.completed > 0 && summary.inProgress === 0 && summary.pending === 0 && (
        <div className="flex items-center gap-2 p-3 bg-green-500/10 rounded-lg border border-green-500/20">
          <TrendingUp className="w-4 h-4 text-green-600" />
          <span className="text-sm text-green-600">
            Backfill concluído! {summary.totalActivitiesProcessed} atividades sincronizadas.
          </span>
        </div>
      )}
    </Card>
  );
};

export default BackfillProgress;
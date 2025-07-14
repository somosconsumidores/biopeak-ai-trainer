import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Clock, CheckCircle, AlertCircle, XCircle, RefreshCw, Calendar } from "lucide-react";
import { useGarminBackfill } from "@/hooks/useGarminBackfill";
import { format } from "date-fns";

import ManualBackfillDialog from "./ManualBackfillDialog";

interface GarminBackfillStatusProps {
  onInitiateBackfill?: () => void;
}

const GarminBackfillStatus: React.FC<GarminBackfillStatusProps> = ({
  onInitiateBackfill
}) => {
  const { backfillStatus, summary, isLoading, isInitiating, loadBackfillStatus } = useGarminBackfill();

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'in_progress':
        return <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      completed: 'default',
      in_progress: 'secondary',
      pending: 'outline',
      error: 'destructive'
    } as const;

    return (
      <Badge variant={variants[status as keyof typeof variants] || 'outline'}>
        {getStatusIcon(status)}
        <span className="ml-1 capitalize">{status.replace('_', ' ')}</span>
      </Badge>
    );
  };

  const calculateProgress = () => {
    if (summary.total === 0) return 0;
    return Math.round((summary.completed / summary.total) * 100);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Historical Data Backfill
            </CardTitle>
            <CardDescription>
              Status of historical data synchronization from Garmin
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadBackfillStatus}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-muted rounded-lg">
            <div className="text-2xl font-bold text-primary">{summary.total}</div>
            <div className="text-sm text-muted-foreground">Total Periods</div>
          </div>
          <div className="text-center p-3 bg-muted rounded-lg">
            <div className="text-2xl font-bold text-green-600">{summary.completed}</div>
            <div className="text-sm text-muted-foreground">Completed</div>
          </div>
          <div className="text-center p-3 bg-muted rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{summary.inProgress}</div>
            <div className="text-sm text-muted-foreground">In Progress</div>
          </div>
          <div className="text-center p-3 bg-muted rounded-lg">
            <div className="text-2xl font-bold text-orange-600">{summary.totalDataProcessed}</div>
            <div className="text-sm text-muted-foreground">Activities Synced</div>
          </div>
        </div>

        {/* Progress Bar */}
        {summary.total > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Overall Progress</span>
              <span>{calculateProgress()}%</span>
            </div>
            <Progress value={calculateProgress()} className="h-2" />
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 flex-wrap">
          {summary.total === 0 && (
            <Button
              onClick={onInitiateBackfill}
              disabled={isInitiating}
              className="flex-1 min-w-[200px]"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isInitiating ? 'animate-spin' : ''}`} />
              Initiate 6-Month Backfill
            </Button>
          )}
          
          <ManualBackfillDialog>
            <Button
              variant="outline"
              disabled={isLoading || isInitiating}
            >
              <Calendar className="h-4 w-4 mr-2" />
              Manual Backfill
            </Button>
          </ManualBackfillDialog>
        </div>

        {/* Backfill Records */}
        {backfillStatus.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium text-sm text-muted-foreground">Backfill Records</h4>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {backfillStatus.map((record) => (
                <div
                  key={record.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {getStatusBadge(record.status)}
                      {record.status === 'completed' && (
                        <span className="text-sm text-muted-foreground">
                          {record.activities_processed} activities
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {format(new Date(record.period_start), 'MMM dd, yyyy')} -{' '}
                      {format(new Date(record.period_end), 'MMM dd, yyyy')}
                    </div>
                    {record.error_message && (
                      <div className="text-sm text-red-600 mt-1">
                        {record.error_message}
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {format(new Date(record.requested_at), 'MMM dd, HH:mm')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {summary.total === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <h4 className="font-medium mb-2">No backfill records found</h4>
            <p className="text-sm">
              Initiate a backfill to sync your historical Garmin data
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default GarminBackfillStatus;
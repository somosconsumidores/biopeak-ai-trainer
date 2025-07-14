import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface BackfillStatus {
  id: string;
  period_start: string;
  period_end: string;
  summary_type: string;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  requested_at: string;
  completed_at?: string;
  error_message?: string;
  activities_processed: number;
  retry_count: number;
  max_retries: number;
  next_retry_at?: string;
  rate_limit_reset_at?: string;
  is_duplicate: boolean;
}

// Available Garmin summary types for backfill
export const SUMMARY_TYPES = {
  dailies: 'Daily Health Stats',
  epochs: 'Epoch Summaries', 
  sleeps: 'Sleep Data',
  bodyComps: 'Body Composition',
  stressDetails: 'Stress Details',
  userMetrics: 'User Metrics (VO2 Max)',
  pulseOx: 'Pulse Ox',
  respiration: 'Respiration',
  healthSnapshot: 'Health Snapshot',
  hrv: 'Heart Rate Variability',
  bloodPressures: 'Blood Pressure',
  skinTemp: 'Skin Temperature'
} as const;

export type SummaryType = keyof typeof SUMMARY_TYPES;

export const useGarminBackfill = () => {
  const { session } = useAuth();
  const { toast } = useToast();
  const [backfillStatus, setBackfillStatus] = useState<BackfillStatus[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitiating, setIsInitiating] = useState(false);
  const [isCleaningUp, setIsCleaningUp] = useState(false);

  // Load backfill status
  const loadBackfillStatus = async () => {
    if (!session) return;

    try {
      console.log('[loadBackfillStatus] Making request to garmin-backfill...');
      const { data, error } = await supabase.functions.invoke('garmin-backfill', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) {
        console.error('Error loading backfill status:', error);
        return;
      }

      console.log('[loadBackfillStatus] Response data:', data);
      
      if (data?.backfillStatus) {
        console.log('[loadBackfillStatus] Setting backfill status:', data.backfillStatus);
        setBackfillStatus(data.backfillStatus);
      } else {
        console.log('[loadBackfillStatus] No backfillStatus in response, setting empty array');
        setBackfillStatus([]);
      }
    } catch (error) {
      console.error('Error loading backfill status:', error);
    }
  };

  // Request manual backfill for a specific period with summary types
  const requestBackfill = async (
    periodStart: string, 
    periodEnd: string, 
    summaryTypes: string[] = ['dailies']
  ) => {
    if (!session) {
      toast({
        title: "Authentication required",
        description: "Please log in to request backfill",
        variant: "destructive",
      });
      return false;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('garmin-backfill', {
        body: {
          periodStart,
          periodEnd,
          summaryTypes
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) {
        console.error('Backfill request error:', error);
        toast({
          title: "Backfill request failed",
          description: error.message || "Failed to submit backfill request",
          variant: "destructive",
        });
        return false;
      }

      console.log('Backfill request result:', data);

      const hasRequested = data.results?.some((r: any) => r.status === 'requested');
      const hasExisting = data.results?.some((r: any) => r.status === 'existing');

      if (hasRequested) {
        toast({
          title: "Backfill requested",
          description: `Successfully requested backfill for ${data.results.filter((r: any) => r.status === 'requested').length} summary types. Data will be processed via webhooks.`,
        });
        
        // Refresh backfill status
        await loadBackfillStatus();
        return true;
      } else if (hasExisting) {
        toast({
          title: "Backfill info",
          description: "Some backfill requests already exist for this period",
        });
        return false;
      } else {
        toast({
          title: "Backfill failed",
          description: data.message || "Backfill request failed",
          variant: "destructive",
        });
        return false;
      }

    } catch (error) {
      console.error('Backfill request error:', error);
      toast({
        title: "Request failed",
        description: "Failed to submit backfill request",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Initiate automatic backfill for new users
  const initiateBackfill = async (monthsBack: number = 6) => {
    if (!session) {
      toast({
        title: "Authentication required",
        description: "Please log in to initiate backfill",
        variant: "destructive",
      });
      return false;
    }

    setIsInitiating(true);

    try {
      const { data, error } = await supabase.functions.invoke('garmin-initiate-backfill', {
        body: {
          monthsBack
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) {
        console.error('Initiate backfill error:', error);
        toast({
          title: "Backfill initiation failed",
          description: error.message || "Failed to initiate automatic backfill",
          variant: "destructive",
        });
        return false;
      }

      console.log('Initiate backfill result:', data);

      if (data.existing) {
        toast({
          title: "Backfill already exists",
          description: "User already has backfill records. Use manual backfill for additional periods.",
        });
        return false;
      }

      const successCount = data.successfulPeriods || 0;
      const totalCount = data.totalPeriods || 0;

      if (successCount > 0) {
        toast({
          title: "Backfill initiated",
          description: `Successfully initiated backfill for ${successCount}/${totalCount} periods. Historical data will be processed automatically.`,
        });
        
        // Refresh backfill status
        await loadBackfillStatus();
        return true;
      } else {
        toast({
          title: "Backfill failed",
          description: "No backfill periods could be initiated",
          variant: "destructive",
        });
        return false;
      }

    } catch (error) {
      console.error('Initiate backfill error:', error);
      toast({
        title: "Initiation failed",
        description: "Failed to initiate automatic backfill",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsInitiating(false);
    }
  };

  // Load backfill status on mount and when session changes
  useEffect(() => {
    if (session) {
      loadBackfillStatus();
    }
  }, [session]);

  // Calculate summary statistics
  const summary = {
    total: backfillStatus.length,
    completed: backfillStatus.filter(b => b.status === 'completed').length,
    inProgress: backfillStatus.filter(b => b.status === 'in_progress').length,
    pending: backfillStatus.filter(b => b.status === 'pending').length,
    errors: backfillStatus.filter(b => b.status === 'error').length,
    duplicates: backfillStatus.filter(b => b.is_duplicate).length,
    needingRetry: backfillStatus.filter(b => b.next_retry_at && new Date(b.next_retry_at) <= new Date()).length,
    totalDataProcessed: backfillStatus
      .filter(b => b.status === 'completed')
      .reduce((sum, b) => sum + (b.activities_processed || 0), 0),
    // Group by summary type for detailed view
    bySummaryType: backfillStatus.reduce((acc, b) => {
      if (!acc[b.summary_type]) {
        acc[b.summary_type] = { total: 0, completed: 0, pending: 0, errors: 0, inProgress: 0 };
      }
      acc[b.summary_type].total++;
      acc[b.summary_type][b.status.replace('_', '') as keyof typeof acc[string]]++;
      return acc;
    }, {} as Record<string, { total: number; completed: number; pending: number; errors: number; inProgress: number }>)
  };

  console.log('[useGarminBackfill] Summary calculated:', summary);
  console.log('[useGarminBackfill] Backfill status array:', backfillStatus);

  // Clean up stuck backfills
  const cleanupBackfills = async () => {
    if (!session) {
      toast({
        title: "Authentication required",
        description: "Please log in to run cleanup",
        variant: "destructive",
      });
      return false;
    }

    setIsCleaningUp(true);

    try {
      const { data, error } = await supabase.functions.invoke('garmin-backfill-cleanup');

      if (error) {
        console.error('Cleanup error:', error);
        toast({
          title: "Cleanup failed",
          description: error.message || "Failed to run cleanup",
          variant: "destructive",
        });
        return false;
      }

      console.log('Cleanup result:', data);

      toast({
        title: "Cleanup completed",
        description: data.message || "Backfill cleanup completed successfully",
      });
      
      // Refresh backfill status
      await loadBackfillStatus();
      return true;

    } catch (error) {
      console.error('Cleanup error:', error);
      toast({
        title: "Cleanup failed",
        description: "Failed to run cleanup process",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsCleaningUp(false);
    }
  };

  return {
    backfillStatus,
    summary,
    isLoading,
    isInitiating,
    isCleaningUp,
    requestBackfill,
    initiateBackfill,
    loadBackfillStatus,
    cleanupBackfills
  };
};
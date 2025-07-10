import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface BackfillStatus {
  id: string;
  period_start: string;
  period_end: string;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  requested_at: string;
  completed_at?: string;
  error_message?: string;
  activities_processed: number;
}

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

      if (data?.backfillStatus) {
        setBackfillStatus(data.backfillStatus);
      }
    } catch (error) {
      console.error('Error loading backfill status:', error);
    }
  };

  // Request manual backfill for a specific period
  const requestBackfill = async (periodStart: string, periodEnd: string) => {
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
          periodEnd
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

      if (data.status === 'in_progress') {
        toast({
          title: "Backfill requested",
          description: "Historical data request submitted successfully. Data will be processed via webhook.",
        });
        
        // Refresh backfill status
        await loadBackfillStatus();
        return true;
      } else {
        toast({
          title: "Backfill info",
          description: data.message || "Backfill request processed",
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
    totalActivitiesProcessed: backfillStatus
      .filter(b => b.status === 'completed')
      .reduce((sum, b) => sum + (b.activities_processed || 0), 0)
  };

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
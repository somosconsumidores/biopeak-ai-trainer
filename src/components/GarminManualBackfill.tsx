import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, Upload, AlertTriangle } from "lucide-react";
import { useGarminBackfill } from "@/hooks/useGarminBackfill";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface GarminManualBackfillProps {
  onClose?: () => void;
}

const GarminManualBackfill: React.FC<GarminManualBackfillProps> = ({ onClose }) => {
  const { requestBackfill, isLoading } = useGarminBackfill();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [errors, setErrors] = useState<string[]>([]);

  const validateDates = () => {
    const validationErrors = [];
    
    if (!startDate) {
      validationErrors.push("Start date is required");
    }
    
    if (!endDate) {
      validationErrors.push("End date is required");
    }
    
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const now = new Date();
      
      if (start >= end) {
        validationErrors.push("Start date must be before end date");
      }
      
      if (start > now) {
        validationErrors.push("Start date cannot be in the future");
      }
      
      if (end > now) {
        validationErrors.push("End date cannot be in the future");
      }
      
      // Check 90-day limit
      const daysDifference = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
      if (daysDifference > 90) {
        validationErrors.push("Period cannot exceed 90 days");
      }
      
      // Check 6-month limit
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      if (start < sixMonthsAgo) {
        validationErrors.push("Cannot backfill data older than 6 months");
      }
    }
    
    return validationErrors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validationErrors = validateDates();
    setErrors(validationErrors);
    
    if (validationErrors.length > 0) {
      return;
    }
    
    const success = await requestBackfill(
      new Date(startDate).toISOString(),
      new Date(endDate).toISOString()
    );
    
    if (success && onClose) {
      onClose();
    }
  };

  const setQuickPeriod = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    
    setEndDate(end.toISOString().split('T')[0]);
    setStartDate(start.toISOString().split('T')[0]);
    setErrors([]);
  };

  const maxDate = new Date().toISOString().split('T')[0];
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const minDate = sixMonthsAgo.toISOString().split('T')[0];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Manual Backfill Request
        </CardTitle>
        <CardDescription>
          Request historical data for a specific date range (up to 90 days)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Quick Period Buttons */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Quick Periods</Label>
            <div className="flex gap-2 flex-wrap">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setQuickPeriod(7)}
              >
                Last 7 days
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setQuickPeriod(30)}
              >
                Last 30 days
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setQuickPeriod(90)}
              >
                Last 90 days
              </Button>
            </div>
          </div>

          {/* Date Inputs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setErrors([]);
                }}
                min={minDate}
                max={maxDate}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setErrors([]);
                }}
                min={minDate}
                max={maxDate}
                required
              />
            </div>
          </div>

          {/* Validation Errors */}
          {errors.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <ul className="list-disc list-inside space-y-1">
                  {errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Information Alert */}
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Important:</strong> Backfill requests are processed asynchronously. 
              Historical data will be delivered via webhook and may take several minutes to appear. 
              Maximum period is 90 days, and you can only backfill data from the last 6 months.
            </AlertDescription>
          </Alert>

          {/* Action Buttons */}
          <div className="flex gap-2 justify-end">
            {onClose && (
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
            )}
            <Button
              type="submit"
              disabled={isLoading || errors.length > 0}
              className="min-w-[120px]"
            >
              <Upload className={`h-4 w-4 mr-2 ${isLoading ? 'animate-pulse' : ''}`} />
              {isLoading ? 'Requesting...' : 'Request Backfill'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default GarminManualBackfill;
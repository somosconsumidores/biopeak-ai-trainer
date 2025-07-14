import React, { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Calendar, Settings, Info, Clock } from "lucide-react";
import { useGarminBackfill, SUMMARY_TYPES, SummaryType } from "@/hooks/useGarminBackfill";
import { format, subDays } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface ManualBackfillDialogProps {
  children: React.ReactNode;
}

const ManualBackfillDialog: React.FC<ManualBackfillDialogProps> = ({ children }) => {
  const { requestBackfill, isLoading } = useGarminBackfill();
  const { toast } = useToast();
  
  const [open, setOpen] = useState(false);
  const [periodStart, setPeriodStart] = useState(format(subDays(new Date(), 90), 'yyyy-MM-dd'));
  const [periodEnd, setPeriodEnd] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedSummaryTypes, setSelectedSummaryTypes] = useState<SummaryType[]>(['dailies']);

  const handleSubmit = async () => {
    if (selectedSummaryTypes.length === 0) {
      toast({
        title: "Select summary types",
        description: "Please select at least one summary type to backfill",
        variant: "destructive",
      });
      return;
    }

    // Validate 90-day limit
    const startDate = new Date(periodStart);
    const endDate = new Date(periodEnd);
    const daysDifference = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysDifference > 90) {
      toast({
        title: "Period too long",
        description: "Backfill period cannot exceed 90 days. Please adjust your date range.",
        variant: "destructive",
      });
      return;
    }

    if (startDate >= endDate) {
      toast({
        title: "Invalid date range",
        description: "Start date must be before end date",
        variant: "destructive",
      });
      return;
    }

    const success = await requestBackfill(periodStart, periodEnd, selectedSummaryTypes);
    if (success) {
      setOpen(false);
      // Reset form
      setPeriodStart(format(subDays(new Date(), 90), 'yyyy-MM-dd'));
      setPeriodEnd(format(new Date(), 'yyyy-MM-dd'));
      setSelectedSummaryTypes(['dailies']);
    }
  };

  const handleSummaryTypeToggle = (summaryType: SummaryType, checked: boolean) => {
    if (checked) {
      setSelectedSummaryTypes(prev => [...prev, summaryType]);
    } else {
      setSelectedSummaryTypes(prev => prev.filter(type => type !== summaryType));
    }
  };

  const getSummaryTypeDescription = (type: SummaryType): string => {
    const descriptions = {
      dailies: 'Daily health stats including steps, heart rate, sleep, stress',
      epochs: 'Detailed epoch-level activity data (minute-by-minute)',
      sleeps: 'Sleep stages, duration, and quality metrics',
      bodyComps: 'Body composition including weight, body fat, muscle mass',
      stressDetails: 'Detailed stress level measurements and patterns',
      userMetrics: 'VO2 Max, fitness age, and performance metrics',
      pulseOx: 'Blood oxygen saturation measurements',
      respiration: 'Breathing rate and respiratory health data',
      healthSnapshot: 'Comprehensive health snapshots and measurements',
      hrv: 'Heart rate variability analysis',
      bloodPressures: 'Blood pressure readings and trends',
      skinTemp: 'Skin temperature measurements and patterns'
    };
    return descriptions[type];
  };

  const getPriorityBadge = (type: SummaryType) => {
    const highPriority = ['dailies', 'sleeps', 'userMetrics'];
    const mediumPriority = ['epochs', 'stressDetails', 'hrv'];
    
    if (highPriority.includes(type)) {
      return <Badge variant="default" className="text-xs">Essential</Badge>;
    } else if (mediumPriority.includes(type)) {
      return <Badge variant="secondary" className="text-xs">Important</Badge>;
    }
    return <Badge variant="outline" className="text-xs">Optional</Badge>;
  };

  const estimatedDays = Math.ceil((new Date(periodEnd).getTime() - new Date(periodStart).getTime()) / (1000 * 60 * 60 * 24));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Manual Backfill Configuration
          </DialogTitle>
          <DialogDescription>
            Request historical data backfill for specific summary types and date ranges.
            Maximum 90 days per request.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Date Range Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Date Range
              </CardTitle>
              <CardDescription>
                Select the period for data backfill (maximum 90 days)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Start Date</label>
                  <input
                    type="date"
                    value={periodStart}
                    onChange={(e) => setPeriodStart(e.target.value)}
                    max={format(new Date(), 'yyyy-MM-dd')}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">End Date</label>
                  <input
                    type="date"
                    value={periodEnd}
                    onChange={(e) => setPeriodEnd(e.target.value)}
                    max={format(new Date(), 'yyyy-MM-dd')}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>
              </div>
              
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>
                  {estimatedDays} days selected 
                  {estimatedDays > 90 && (
                    <span className="text-red-500 ml-2">⚠️ Exceeds 90-day limit</span>
                  )}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Summary Types Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Data Types to Backfill</CardTitle>
              <CardDescription>
                Select which types of health and activity data to request from Garmin
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(Object.entries(SUMMARY_TYPES) as [SummaryType, string][]).map(([type, label]) => (
                  <div
                    key={type}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedSummaryTypes.includes(type) 
                        ? 'border-primary bg-primary/5' 
                        : 'border-border hover:border-primary/50'
                    }`}
                    onClick={() => handleSummaryTypeToggle(type, !selectedSummaryTypes.includes(type))}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={selectedSummaryTypes.includes(type)}
                        onChange={() => {}} // Controlled by parent div click
                        className="mt-1"
                      />
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{label}</span>
                          {getPriorityBadge(type)}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {getSummaryTypeDescription(type)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                      Selected: {selectedSummaryTypes.length} data types
                    </p>
                    <p className="text-blue-700 dark:text-blue-300">
                      Each data type will be requested separately. Essential types (Daily Health Stats, Sleep, User Metrics) 
                      are recommended for comprehensive health tracking.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isLoading || selectedSummaryTypes.length === 0 || estimatedDays > 90}
            >
              {isLoading ? (
                <>
                  <Clock className="h-4 w-4 mr-2 animate-spin" />
                  Requesting...
                </>
              ) : (
                <>
                  <Calendar className="h-4 w-4 mr-2" />
                  Request Backfill
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ManualBackfillDialog;
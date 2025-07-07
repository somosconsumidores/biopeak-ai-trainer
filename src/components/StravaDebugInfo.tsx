import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Info, Eye, EyeOff } from "lucide-react";
const StravaDebugInfo = () => {
  const [showDebug, setShowDebug] = useState(false);
  const getDebugInfo = () => {
    const urlParams = new URLSearchParams(window.location.search);
    return {
      url: {
        full: window.location.href,
        pathname: window.location.pathname,
        search: window.location.search,
        params: Array.from(urlParams.entries())
      },
      localStorage: {
        connecting: localStorage.getItem('strava_connecting'),
        state: localStorage.getItem('strava_state'),
        connectTime: localStorage.getItem('strava_connect_time'),
        processedCode: localStorage.getItem('strava_processed_code')
      },
      browser: {
        userAgent: navigator.userAgent,
        origin: window.location.origin,
        hostname: window.location.hostname
      },
      timestamp: new Date().toISOString()
    };
  };
  if (!showDebug) {
    return;
  }
  return <Card className="glass p-4 mt-4">
      <div className="flex justify-between items-center mb-3">
        <h4 className="text-sm font-semibold text-foreground">Debug Info Strava</h4>
        <Button onClick={() => setShowDebug(false)} variant="ghost" size="sm" className="text-xs">
          <EyeOff className="w-3 h-3" />
        </Button>
      </div>
      
      <div className="bg-muted p-3 rounded text-xs font-mono overflow-auto max-h-60">
        <pre>{JSON.stringify(getDebugInfo(), null, 2)}</pre>
      </div>
    </Card>;
};
export default StravaDebugInfo;
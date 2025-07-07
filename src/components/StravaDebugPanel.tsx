import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Trash2, RefreshCw } from "lucide-react";
const StravaDebugPanel = () => {
  const [debugInfo, setDebugInfo] = useState<string>('');
  const clearAllStorage = () => {
    localStorage.clear();
    sessionStorage.clear();

    // Clean URL
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.delete('code');
    currentUrl.searchParams.delete('state');
    currentUrl.searchParams.delete('scope');
    currentUrl.searchParams.delete('error');
    currentUrl.searchParams.delete('error_description');
    window.history.replaceState({}, document.title, currentUrl.pathname);
    setDebugInfo('✅ Storage e URL limpos');
    setTimeout(() => setDebugInfo(''), 3000);
  };
  const showDebugInfo = () => {
    const info = {
      url: window.location.href,
      params: Array.from(new URLSearchParams(window.location.search).entries()),
      localStorage: {
        connecting: localStorage.getItem('strava_connecting'),
        state: localStorage.getItem('strava_state'),
        connectTime: localStorage.getItem('strava_connect_time'),
        processedCode: localStorage.getItem('strava_processed_code')
      },
      userAgent: navigator.userAgent,
      origin: window.location.origin,
      hostname: window.location.hostname
    };
    setDebugInfo(JSON.stringify(info, null, 2));
  };
  return (
    <Card className="glass p-4 mt-4">
      <div className="flex justify-between items-center mb-3">
        <h4 className="text-sm font-semibold text-foreground">Debug Panel</h4>
        <div className="flex space-x-2">
          <Button onClick={showDebugInfo} variant="ghost" size="sm" className="text-xs">
            <RefreshCw className="w-3 h-3 mr-1" />
            Info
          </Button>
          <Button onClick={clearAllStorage} variant="ghost" size="sm" className="text-xs">
            <Trash2 className="w-3 h-3 mr-1" />
            Clear
          </Button>
        </div>
      </div>
      
      {debugInfo && (
        <div className="bg-muted p-3 rounded text-xs font-mono overflow-auto max-h-40">
          <pre>{debugInfo}</pre>
        </div>
      )}
    </Card>
  );
};
export default StravaDebugPanel;
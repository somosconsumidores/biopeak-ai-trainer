import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Activity, RefreshCw, ExternalLink, CheckCircle } from "lucide-react";

interface StravaConnectionStatusProps {
  isConnected: boolean;
  isConnecting: boolean;
  isSyncing: boolean;
  stravaConfig: {clientId: string, redirectUri: string, fallback?: boolean} | null;
  syncStatus?: {
    lastSync: Date | null;
    totalSynced: number;
    isIncremental: boolean;
    status: 'completed' | 'in_progress' | 'error' | null;
    errorMessage?: string;
  };
  onConnect: () => void;
  onSync: () => void;
}

const StravaConnectionStatus = ({
  isConnected,
  isConnecting,
  isSyncing,
  stravaConfig,
  syncStatus,
  onConnect,
  onSync
}: StravaConnectionStatusProps) => {
  return (
    <Card className="glass p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-orange-500/20 rounded-lg">
            <Activity className="w-5 h-5 text-orange-500" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">Integração Strava</h3>
            <p className="text-sm text-muted-foreground">
              Sincronize suas atividades automaticamente
            </p>
          </div>
        </div>
        {isConnected ? (
          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
            <CheckCircle className="w-4 h-4 mr-1" />
            Conectado
          </Badge>
        ) : (
          <Badge variant="outline">Não conectado</Badge>
        )}
      </div>

      {/* Sync Status Information */}
      {isConnected && syncStatus && (
        <div className="mt-4 mb-4 p-3 bg-background/50 rounded-lg border border-border/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-foreground">Status da Sincronização</span>
            {syncStatus.status === 'completed' && (
              <Badge variant="outline" className="text-green-400 border-green-500/30">
                <CheckCircle className="w-3 h-3 mr-1" />
                Completa
              </Badge>
            )}
            {syncStatus.status === 'in_progress' && (
              <Badge variant="outline" className="text-blue-400 border-blue-500/30">
                <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                Em Progresso
              </Badge>
            )}
            {syncStatus.status === 'error' && (
              <Badge variant="outline" className="text-red-400 border-red-500/30">
                Erro
              </Badge>
            )}
          </div>
          <div className="space-y-1 text-xs text-muted-foreground">
            {syncStatus.totalSynced > 0 && (
              <div>Total sincronizado: {syncStatus.totalSynced} atividades</div>
            )}
            {syncStatus.lastSync && (
              <div>
                Última sincronização: {syncStatus.lastSync.toLocaleString('pt-BR')}
                {syncStatus.isIncremental && <span className="ml-1 text-blue-400">(incremental)</span>}
              </div>
            )}
            {syncStatus.errorMessage && (
              <div className="text-red-400 mt-1">{syncStatus.errorMessage}</div>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center space-x-3">
        {!isConnected ? (
          <>
            <Button 
              onClick={() => {
                console.log('[StravaConnectionStatus] ===== STRAVA CONNECTION ATTEMPT =====');
                console.log('[StravaConnectionStatus] Button clicked - calling onConnect');
                console.log('[StravaConnectionStatus] Button state:', { 
                  isConnected,
                  isConnecting, 
                  hasStravaConfig: !!stravaConfig,
                  stravaConfig,
                  currentUrl: window.location.href,
                  localStorage: {
                    connecting: localStorage.getItem('strava_connecting'),
                    state: localStorage.getItem('strava_state'),
                    processedCode: localStorage.getItem('strava_processed_code')
                  }
                });
                console.log('[StravaConnectionStatus] About to redirect to Strava auth...');
                
                // Clear any previous state before connecting
                localStorage.removeItem('strava_connecting');
                localStorage.removeItem('strava_state');
                localStorage.removeItem('strava_processed_code');
                localStorage.removeItem('strava_connect_time');
                
                // Clean URL parameters
                const currentUrl = new URL(window.location.href);
                currentUrl.searchParams.delete('code');
                currentUrl.searchParams.delete('state');
                currentUrl.searchParams.delete('scope');
                currentUrl.searchParams.delete('error');
                currentUrl.searchParams.delete('error_description');
                window.history.replaceState({}, document.title, currentUrl.pathname);
                
                console.log('[StravaConnectionStatus] Cleaned previous state, calling onConnect...');
                onConnect();
              }}
              disabled={isConnecting || !stravaConfig}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              {isConnecting ? 'Conectando...' : !stravaConfig ? 'Carregando configuração...' : 'Conectar ao Strava'}
            </Button>
            <Button 
              onClick={() => {
                console.log('[StravaConnectionStatus] Reset button clicked - clearing all state');
                // Force clean all OAuth state and URL
                localStorage.clear();
                sessionStorage.clear();
                window.history.replaceState({}, document.title, window.location.pathname);
                console.log('[StravaConnectionStatus] All state cleared, reloading page...');
                window.location.reload();
              }}
              variant="outline"
              size="sm"
            >
              Reset
            </Button>
          </>
        ) : (
          <Button 
            onClick={() => {
              console.log('[StravaConnectionStatus] ===== STRAVA SYNC ATTEMPT =====');
              console.log('[StravaConnectionStatus] Sync button clicked');
              console.log('[StravaConnectionStatus] Current state:', {
                isConnected,
                isSyncing,
                hasConfig: !!stravaConfig
              });
              onSync();
            }}
            disabled={isSyncing}
            variant="glass"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Sincronizando...' : 'Sincronizar Atividades'}
          </Button>
        )}
        
        {stravaConfig?.fallback && process.env.NODE_ENV === 'development' && (
          <div className="text-xs text-yellow-400 mt-2">
            ⚠️ Usando configuração de fallback - Edge function não disponível
          </div>
        )}
      </div>
    </Card>
  );
};

export default StravaConnectionStatus;
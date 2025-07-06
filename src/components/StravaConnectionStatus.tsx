import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Activity, RefreshCw, ExternalLink, CheckCircle } from "lucide-react";

interface StravaConnectionStatusProps {
  isConnected: boolean;
  isConnecting: boolean;
  isSyncing: boolean;
  stravaConfig: {clientId: string, redirectUri: string, fallback?: boolean} | null;
  onConnect: () => void;
  onSync: () => void;
}

const StravaConnectionStatus = ({
  isConnected,
  isConnecting,
  isSyncing,
  stravaConfig,
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

      <div className="flex items-center space-x-3">
        {!isConnected ? (
          <Button 
            onClick={onConnect}
            disabled={isConnecting || !stravaConfig}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            {isConnecting ? 'Conectando...' : !stravaConfig ? 'Configuração indisponível' : 'Conectar ao Strava'}
          </Button>
        ) : (
          <Button 
            onClick={onSync}
            disabled={isSyncing}
            variant="glass"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Sincronizando...' : 'Sincronizar Atividades'}
          </Button>
        )}
        
        {!stravaConfig && (
          <p className="text-sm text-muted-foreground">
            Carregando configuração...
          </p>
        )}
        
        {stravaConfig?.fallback && (
          <p className="text-sm text-yellow-400">
            ⚠️ Modo fallback ativo - funcionalidade limitada
          </p>
        )}
      </div>
    </Card>
  );
};

export default StravaConnectionStatus;

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Activity, RefreshCw, ExternalLink, CheckCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const StravaIntegration = () => {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stravaConfig, setStravaConfig] = useState<{clientId: string, redirectUri: string} | null>(null);

  useEffect(() => {
    if (user) {
      loadStravaConfig();
      checkStravaConnection();
      loadActivities();
    }
  }, [user]);

  const loadStravaConfig = async () => {
    try {
      console.log('Loading Strava config...');
      const { data, error } = await supabase.functions.invoke('strava-config');
      
      console.log('Strava config response:', { data, error });
      
      if (error) {
        console.error('Error loading Strava config:', error);
        toast.error(`Erro ao carregar configuração do Strava: ${error.message || 'Erro desconhecido'}`);
        return;
      }

      if (data?.clientId) {
        console.log('Strava config loaded successfully:', { clientId: data.clientId, redirectUri: data.redirectUri });
        setStravaConfig(data);
      } else {
        console.error('No client ID received from config:', data);
        toast.error(`Configuração do Strava inválida: ${JSON.stringify(data)}`);
      }
    } catch (error) {
      console.error('Error loading Strava config:', error);
      toast.error(`Erro ao carregar configuração do Strava: ${error.message || 'Erro de rede'}`);
    }
  };

  const checkStravaConnection = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('strava_tokens')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!error && data) {
        setIsConnected(true);
      }
    } catch (error) {
      console.error('Error checking Strava connection:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadActivities = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('strava_activities')
        .select('*')
        .eq('user_id', user.id)
        .order('start_date', { ascending: false })
        .limit(10);

      if (!error && data) {
        setActivities(data);
      }
    } catch (error) {
      console.error('Error loading activities:', error);
    }
  };

  const handleStravaConnect = () => {
    if (!stravaConfig) {
      toast.error('Configuração do Strava não carregada. Tente novamente.');
      return;
    }

    const scope = 'read,activity:read_all';
    const authUrl = `https://www.strava.com/oauth/authorize?client_id=${stravaConfig.clientId}&response_type=code&redirect_uri=${encodeURIComponent(stravaConfig.redirectUri)}&approval_prompt=force&scope=${scope}`;
    
    console.log('Redirecting to Strava auth:', authUrl);
    
    // Store connection state
    localStorage.setItem('strava_connecting', 'true');
    
    window.location.href = authUrl;
  };

  const handleStravaCallback = async (code: string) => {
    setIsConnecting(true);
    
    try {
      console.log('Processing Strava callback with code:', code);
      
      const { data, error } = await supabase.functions.invoke('strava-auth', {
        body: { code }
      });

      console.log('Strava auth response:', { data, error });

      if (error) {
        console.error('Strava auth error:', error);
        throw error;
      }

      if (data?.success) {
        setIsConnected(true);
        toast.success(`Conectado ao Strava com sucesso! Bem-vindo, ${data.athlete?.firstname || 'Atleta'}!`);
        localStorage.removeItem('strava_connecting');
        
        // Automatically sync activities after connection
        setTimeout(() => handleSync(), 1000);
      } else {
        console.error('Strava auth failed:', data);
        throw new Error(data?.error || 'Failed to connect to Strava');
      }
    } catch (error) {
      console.error('Error connecting to Strava:', error);
      toast.error(`Erro ao conectar com Strava: ${error.message || 'Tente novamente.'}`);
      localStorage.removeItem('strava_connecting');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSync = async () => {
    if (!isConnected) {
      toast.error('Conecte-se ao Strava primeiro.');
      return;
    }

    setIsSyncing(true);
    
    try {
      console.log('Starting Strava sync...');
      
      const { data, error } = await supabase.functions.invoke('strava-sync');

      console.log('Strava sync response:', { data, error });

      if (error) {
        console.error('Strava sync error:', error);
        throw error;
      }

      if (data?.success) {
        toast.success(`${data.synced} atividades sincronizadas com sucesso!`);
        loadActivities(); // Reload activities after sync
      } else {
        console.error('Strava sync failed:', data);
        throw new Error(data?.error || 'Failed to sync activities');
      }
    } catch (error) {
      console.error('Error syncing Strava activities:', error);
      toast.error(`Erro ao sincronizar atividades: ${error.message || 'Tente novamente.'}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Check for OAuth callback on component mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const isConnecting = localStorage.getItem('strava_connecting') === 'true';
    
    if (code && isConnecting) {
      handleStravaCallback(code);
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const formatDistance = (distance: number) => {
    return (distance / 1000).toFixed(1) + ' km';
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}min` : `${minutes}min`;
  };

  if (loading) {
    return (
      <Card className="glass p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-muted/50 rounded mb-4"></div>
          <div className="h-4 bg-muted/50 rounded mb-2"></div>
          <div className="h-4 bg-muted/50 rounded"></div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Connection Status */}
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
              onClick={handleStravaConnect}
              disabled={isConnecting || !stravaConfig}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              {isConnecting ? 'Conectando...' : !stravaConfig ? 'Carregando...' : 'Conectar ao Strava'}
            </Button>
          ) : (
            <Button 
              onClick={handleSync}
              disabled={isSyncing}
              variant="glass"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Sincronizando...' : 'Sincronizar Atividades'}
            </Button>
          )}
        </div>
      </Card>

      {/* Recent Activities */}
      {isConnected && activities.length > 0 && (
        <Card className="glass p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Atividades Recentes</h3>
          <div className="space-y-3">
            {activities.map((activity) => (
              <div key={activity.id} className="glass p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-foreground">{activity.name}</h4>
                  <Badge variant="outline" className="text-xs">
                    {activity.type}
                  </Badge>
                </div>
                <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                  <span>{formatDistance(activity.distance)}</span>
                  <span>{formatTime(activity.moving_time)}</span>
                  {activity.average_speed && (
                    <span>{(activity.average_speed * 3.6).toFixed(1)} km/h</span>
                  )}
                  <span>{new Date(activity.start_date).toLocaleDateString('pt-BR')}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

export default StravaIntegration;

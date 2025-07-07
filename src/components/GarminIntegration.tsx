import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Activity, RefreshCw, ExternalLink, CheckCircle, Webhook } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const GarminIntegration = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      checkGarminConnection();
    }
  }, [user]);

  const checkGarminConnection = async () => {
    try {
      const { data, error } = await supabase
        .from('garmin_tokens')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (data && !error) {
        setIsConnected(true);
        await fetchActivities();
      }
    } catch (error) {
      console.log('No Garmin connection found');
    } finally {
      setLoading(false);
    }
  };

  const connectGarmin = async () => {
    setIsConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('garmin-config');
      
      if (error) throw error;
      
      if (data?.authUrl) {
        // Redirect to Garmin OAuth
        window.location.href = data.authUrl;
      } else {
        throw new Error('No authorization URL received');
      }
    } catch (error) {
      console.error('Error connecting to Garmin:', error);
      toast({
        title: "Erro na conexão",
        description: error.message || "Não foi possível conectar com o Garmin Connect.",
        variant: "destructive",
      });
      setIsConnecting(false);
    }
  };

  const syncActivities = async () => {
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('garmin-sync');
      
      if (error) throw error;
      
      toast({
        title: "Sincronização manual iniciada",
        description: `${data.count || 0} atividades processadas. A maioria dos dados chegará via webhooks automaticamente.`,
      });
      
      await fetchActivities();
    } catch (error) {
      console.error('Error syncing activities:', error);
      toast({
        title: "Erro na sincronização",
        description: "Não foi possível sincronizar as atividades.",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const fetchActivities = async () => {
    try {
      const { data, error } = await supabase
        .from('garmin_activities')
        .select('*')
        .eq('user_id', user?.id)
        .order('start_date', { ascending: false })
        .limit(5);

      if (error) throw error;
      setActivities(data || []);
    } catch (error) {
      console.error('Error fetching activities:', error);
    }
  };

  const disconnectGarmin = async () => {
    try {
      const { error } = await supabase
        .from('garmin_tokens')
        .delete()
        .eq('user_id', user?.id);

      if (error) throw error;

      setIsConnected(false);
      setActivities([]);
      
      toast({
        title: "Garmin Connect desconectado",
        description: "Sua conta foi desconectada com sucesso.",
      });
    } catch (error) {
      console.error('Error disconnecting:', error);
      toast({
        title: "Erro",
        description: "Não foi possível desconectar do Garmin Connect.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <Card className="glass p-6">
        <div className="animate-pulse flex space-x-4">
          <div className="rounded-full bg-muted h-12 w-12"></div>
          <div className="flex-1 space-y-2 py-1">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="glass p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Activity className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">Integração Garmin</h3>
              <p className="text-sm text-muted-foreground">
                Sincronize suas atividades automaticamente via webhooks
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
              onClick={connectGarmin}
              disabled={isConnecting}
              className="bg-blue-500 hover:bg-blue-600 text-white"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              {isConnecting ? 'Conectando...' : 'Conectar ao Garmin'}
            </Button>
          ) : (
            <>
              <Button 
                onClick={syncActivities}
                disabled={isSyncing}
                variant="glass"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Sincronizando...' : 'Sincronização Manual'}
              </Button>
              <Button 
                onClick={disconnectGarmin}
                variant="outline"
                size="sm"
              >
                Desconectar
              </Button>
            </>
          )}
        </div>

        {isConnected && (
          <div className="mt-4 p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
            <div className="flex items-center space-x-2">
              <Webhook className="w-4 h-4 text-blue-400" />
              <span className="text-sm text-blue-400 font-medium">Webhook Ativo</span>
            </div>
            <p className="text-xs text-blue-300 mt-1">
              Os dados são sincronizados automaticamente quando você sincroniza seu dispositivo Garmin
            </p>
          </div>
        )}
      </Card>

      {isConnected && activities.length > 0 && (
        <Card className="glass p-6">
          <h4 className="text-lg font-semibold text-foreground mb-4">
            Atividades Recentes do Garmin
          </h4>
          <div className="space-y-3">
            {activities.map((activity: any) => (
              <div key={activity.id} className="glass p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h5 className="font-medium text-foreground">{activity.name}</h5>
                    <p className="text-sm text-muted-foreground">
                      {activity.type} • {new Date(activity.start_date).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-primary">
                      {activity.distance ? `${(activity.distance / 1000).toFixed(1)} km` : '-'}
                    </p>
                    {activity.moving_time && (
                      <p className="text-xs text-muted-foreground">
                        {Math.floor(activity.moving_time / 60)} min
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

export default GarminIntegration;
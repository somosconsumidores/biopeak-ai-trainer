import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Activity, Zap, ExternalLink, RefreshCw } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const GarminSettings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      checkGarminConnection();
      handleOAuthCallback();
    }
  }, [user, searchParams]);

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

  const handleOAuthCallback = async () => {
    const oauthToken = searchParams.get('oauth_token');
    const oauthVerifier = searchParams.get('oauth_verifier');
    
    if (oauthToken && oauthVerifier) {
      setIsConnecting(true);
      try {
        console.log('Processing OAuth callback:', { oauthToken, oauthVerifier });
        
        const { data, error } = await supabase.functions.invoke('garmin-auth', {
          body: { 
            oauth_token: oauthToken,
            oauth_verifier: oauthVerifier
          }
        });

        if (error) throw error;

        if (data.success) {
          setIsConnected(true);
          toast({
            title: "Garmin Connect conectado!",
            description: "Sua conta foi conectada com sucesso. Os dados serão sincronizados automaticamente via webhooks.",
          });
          await fetchActivities();
        }
      } catch (error) {
        console.error('OAuth callback error:', error);
        toast({
          title: "Erro na conexão",
          description: "Não foi possível conectar com o Garmin Connect.",
          variant: "destructive",
        });
      } finally {
        setIsConnecting(false);
        // Limpar parâmetros da URL
        navigate('/garmin', { replace: true });
      }
    }
  };

  const connectGarmin = async () => {
    setIsConnecting(true);
    try {
      console.log('Starting Garmin connection process...');
      
      // First try the real OAuth 1.0 implementation
      let { data, error } = await supabase.functions.invoke('garmin-config');
      
      // If the real implementation fails, try the fallback
      if (error || !data?.authUrl) {
        console.log('Real OAuth failed, trying fallback:', error);
        toast({
          title: "Modo Demonstração",
          description: "Usando dados de demonstração do Garmin. A API real será implementada em produção.",
        });
        
        const fallbackResponse = await supabase.functions.invoke('garmin-config-fallback');
        data = fallbackResponse.data;
        error = fallbackResponse.error;
      }
      
      console.log('Garmin config response:', { data, error });
      
      if (error) {
        console.error('Error from garmin functions:', error);
        throw error;
      }
      
      if (data?.authUrl) {
        console.log('Redirecting to Garmin auth URL:', data.authUrl);
        localStorage.setItem('garmin_connecting', 'true');
        
        // If it's a demo URL (contains oauth_verifier), handle it directly
        if (data.authUrl.includes('oauth_verifier=demo_verifier')) {
          const url = new URL(data.authUrl);
          const searchParams = new URLSearchParams(url.search);
          
          // Simulate the OAuth callback immediately
          setTimeout(() => {
            window.history.pushState({}, '', `/garmin?oauth_token=${searchParams.get('oauth_token')}&oauth_verifier=${searchParams.get('oauth_verifier')}`);
            window.location.reload();
          }, 1000);
        } else {
          window.location.href = data.authUrl;
        }
      } else {
        throw new Error('No authorization URL received from Garmin');
      }
    } catch (error) {
      console.error('Error connecting to Garmin:', error);
      toast({
        title: "Erro na conexão",
        description: error.message || "Não foi possível iniciar a conexão com o Garmin Connect.",
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
        title: "Sincronização iniciada",
        description: "Suas atividades estão sendo sincronizadas.",
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
        .limit(10);

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
      localStorage.removeItem('garmin_connecting');
      
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando configurações do Garmin...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="glass" size="sm" onClick={() => navigate('/')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Configurações do Garmin</h1>
            <p className="text-muted-foreground">Conecte sua conta Garmin Connect para sincronizar atividades</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Status da Conexão */}
          <Card className="glass p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center">
                  <Activity className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-foreground">Garmin Connect</h3>
                  <p className="text-muted-foreground">Sincronize suas atividades automaticamente</p>
                </div>
              </div>
              <Badge className={`${
                isConnected 
                  ? 'bg-green-500/20 text-green-400 border-green-500/30' 
                  : 'bg-red-500/20 text-red-400 border-red-500/30'
              }`}>
                {isConnected ? 'Conectado' : 'Desconectado'}
              </Badge>
            </div>

            <Separator className="my-4" />

            <div className="flex flex-col sm:flex-row gap-3">
              {!isConnected ? (
                <Button 
                  variant="hero" 
                  onClick={connectGarmin}
                  disabled={isConnecting}
                  className="flex-1"
                >
                  {isConnecting ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <ExternalLink className="w-4 h-4 mr-2" />
                  )}
                  {isConnecting ? 'Conectando...' : 'Conectar Garmin Connect'}
                </Button>
              ) : (
                <>
                  <Button 
                    variant="ai" 
                    onClick={syncActivities}
                    disabled={isSyncing}
                  >
                    {isSyncing ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Zap className="w-4 h-4 mr-2" />
                    )}
                    {isSyncing ? 'Sincronizando...' : 'Sincronizar Atividades'}
                  </Button>
                  <Button 
                    variant="glass" 
                    onClick={disconnectGarmin}
                  >
                    Desconectar
                  </Button>
                </>
              )}
            </div>
          </Card>

          {/* Atividades Recentes */}
          {isConnected && (
            <Card className="glass p-6">
              <h3 className="text-xl font-semibold text-foreground mb-4">
                Atividades Recentes do Garmin
              </h3>
              
              {activities.length > 0 ? (
                <div className="space-y-3">
                  {activities.map((activity: any) => (
                    <div key={activity.id} className="glass p-4 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium text-foreground">{activity.name}</h4>
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
              ) : (
                <div className="text-center py-8">
                  <Activity className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Nenhuma atividade encontrada</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Sincronize suas atividades para vê-las aqui
                  </p>
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default GarminSettings;
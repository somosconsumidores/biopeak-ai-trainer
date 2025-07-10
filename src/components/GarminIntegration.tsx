import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Activity, RefreshCw, ExternalLink, CheckCircle, Webhook, Calendar } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useGarminBackfill } from "@/hooks/useGarminBackfill";
import { supabase } from "@/integrations/supabase/client";
import GarminBackfillStatus from "./GarminBackfillStatus";
import GarminManualBackfill from "./GarminManualBackfill";
import BackfillProgress from "./BackfillProgress";

const GarminIntegration = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { initiateBackfill } = useGarminBackfill();
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [webhookStatus, setWebhookStatus] = useState([]);
  const [showWebhookUrls, setShowWebhookUrls] = useState(false);
  const [showManualBackfill, setShowManualBackfill] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (user && mounted) {
      checkGarminConnection();
    }
  }, [user, mounted]);

  const checkGarminConnection = async () => {
    console.log('[GarminIntegration] Checking Garmin connection for user:', user?.id);
    try {
      const { data, error } = await supabase
        .from('garmin_tokens')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      console.log('[GarminIntegration] Token check result:', { 
        hasData: !!data, 
        error: error?.message,
        tokenValid: data && !error,
        data: data ? { ...data, access_token: data.access_token.substring(0, 10) + '...' } : null
      });

      if (data && !error) {
        // For Garmin OAuth 2.0, we only need valid access_token and token_secret
        // The token_secret contains the refresh token data in JSON format
        const isValidToken = data.access_token && 
                           data.token_secret && 
                           data.access_token.length > 50; // OAuth 2.0 tokens are typically long
        
        console.log('[GarminIntegration] Token validation:', { 
          isValidToken, 
          tokenLength: data.access_token?.length,
          hasTokenSecret: !!data.token_secret,
          tokenSecretLength: data.token_secret?.length
        });
        
        if (isValidToken) {
          console.log('[GarminIntegration] Valid Garmin tokens found - setting connected state');
          setIsConnected(true);
          await fetchActivities();
          await checkWebhookStatus();
        } else {
          console.log('[GarminIntegration] Invalid token format detected - NOT cleaning up for debugging');
          // Don't clean up tokens for debugging purposes
          setIsConnected(false);
        }
      } else {
        console.log('[GarminIntegration] No valid tokens found - setting disconnected state');
        setIsConnected(false);
      }
    } catch (error) {
      console.log('[GarminIntegration] Error checking connection:', error);
      setIsConnected(false);
    } finally {
      console.log('[GarminIntegration] Connection check completed. isConnected:', isConnected);
      setLoading(false);
    }
  };

  const connectGarmin = async () => {
    console.log('[GarminIntegration] ===== GARMIN CONNECTION ATTEMPT =====');
    setIsConnecting(true);
    
    // Clear any previous toast
    toast({
      title: "Iniciando conexão",
      description: "Configurando autenticação OAuth 2.0 com Garmin...",
    });
    
    try {
      console.log('[GarminIntegration] ===== STARTING GARMIN CONNECTION =====');
      console.log('[GarminIntegration] User ID:', user?.id);
      console.log('[GarminIntegration] Current URL:', window.location.href);
      console.log('[GarminIntegration] Calling garmin-config function...');
      
      // Get current session for proper authorization
      const { data: { session } } = await supabase.auth.getSession();
      console.log('[GarminIntegration] Session check:', { 
        hasSession: !!session, 
        hasToken: !!session?.access_token,
        userId: session?.user?.id 
      });
      
      if (!session?.access_token) {
        throw new Error('Sessão não encontrada. Faça login novamente.');
      }
      
      console.log('[GarminIntegration] Making authenticated request to garmin-config...');
      console.log('[GarminIntegration] Request headers will include Authorization Bearer token');
      
      const { data, error } = await supabase.functions.invoke('garmin-config', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      
      console.log('[GarminIntegration] ===== RESPONSE FROM GARMIN-CONFIG =====');
      console.log('[GarminIntegration] Data:', JSON.stringify(data, null, 2));
      console.log('[GarminIntegration] Error:', JSON.stringify(error, null, 2));
      console.log('[GarminIntegration] ===========================================');
      
      if (error) {
        console.error('[GarminIntegration] ===== ERROR DETAILS =====');
        console.error('[GarminIntegration] Error message:', error.message);
        console.error('[GarminIntegration] Error details:', error.details);
        console.error('[GarminIntegration] Error hint:', error.hint);
        console.error('[GarminIntegration] Error code:', error.code);
        console.error('[GarminIntegration] ========================');
        throw error;
      }
      
      if (data?.success && data?.authUrl) {
        console.log('[GarminIntegration] ===== SUCCESS! REDIRECTING =====');
        console.log('[GarminIntegration] Auth URL:', data.authUrl);
        console.log('[GarminIntegration] Full response data:', JSON.stringify(data, null, 2));
        console.log('[GarminIntegration] ================================');
        toast({
          title: "Redirecionando...",
          description: "Abrindo página do Garmin Connect para autorização.",
        });
        // Small delay to show the toast
        setTimeout(() => {
          window.location.href = data.authUrl;
        }, 500);
      } else {
        console.error('[GarminIntegration] ===== UNEXPECTED RESPONSE =====');
        console.error('[GarminIntegration] Data received:', JSON.stringify(data, null, 2));
        console.error('[GarminIntegration] Expected: success=true and authUrl present');
        console.error('[GarminIntegration] ================================');
        throw new Error(data?.error || 'URL de autorização não recebida');
      }
    } catch (error) {
      console.error('[GarminIntegration] ===== FINAL ERROR HANDLER =====');
      console.error('[GarminIntegration] Caught error:', error);
      console.error('[GarminIntegration] Error message:', error.message);
      console.error('[GarminIntegration] Error stack:', error.stack);
      console.error('[GarminIntegration] ===============================');
      
      // Check if it's a credential error and provide helpful message
      const errorMessage = error.message || "Não foi possível conectar com o Garmin Connect.";
      const isCredentialError = errorMessage.includes('credenciais') || 
                               errorMessage.includes('CLIENT_ID') || 
                               errorMessage.includes('CLIENT_SECRET');
      
      toast({
        title: isCredentialError ? "Credenciais necessárias" : "Erro na conexão",
        description: isCredentialError 
          ? "Configure GARMIN_CLIENT_ID e GARMIN_CLIENT_SECRET nas configurações do Supabase."
          : errorMessage,
        variant: "destructive",
      });
      setIsConnecting(false);
    }
  };

  const syncActivities = async () => {
    console.log('[GarminIntegration] ===== GARMIN SYNC ATTEMPT =====');
    console.log('[GarminIntegration] Starting sync...');
    console.log('[GarminIntegration] Current state:', {
      isConnected,
      isSyncing,
      userId: user?.id,
      hasSession: !!user
    });

    setIsSyncing(true);
    try {
      // Get current session for proper authorization
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Sessão não encontrada. Faça login novamente.');
      }
      
      console.log('[GarminIntegration] Session token available, calling garmin-sync function...');
      
      const { data, error } = await supabase.functions.invoke('garmin-sync', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      
      console.log('[GarminIntegration] Garmin sync response:', { data, error });
      
      if (error) {
        console.error('[GarminIntegration] Garmin sync error:', error);
        throw error;
      }
      
      // Enhanced toast messages based on sync status
      if (data?.success) {
        const status = data.syncStatus || 'unknown';
        let title = "Sincronização concluída";
        let description = data.message || "Sincronização realizada com sucesso.";
        
        if (status === 'api_success') {
          title = "✅ Sincronização API bem-sucedida";
        } else if (status === 'webhook_data_available') {
          title = "ℹ️ Dados do webhook disponíveis";
        } else if (status === 'api_failed') {
          title = "⚠️ API falhou, webhook ativo";
        } else if (status === 'demo_fallback') {
          title = "🔧 Modo demonstração";
        }
        
        toast({
          title,
          description: `${description}${data.recommendation ? ' ' + data.recommendation : ''}`,
        });
      } else {
        // Check if it's a token-related error that requires reconnection
        const errorMessage = data?.error || 'Sync failed';
        if (errorMessage.includes('conecte novamente') || 
            errorMessage.includes('reconnect') || 
            errorMessage.includes('autorização')) {
          setIsConnected(false);
          await checkGarminConnection(); // Refresh connection status
        }
        throw new Error(errorMessage);
      }
      
      await fetchActivities();
    } catch (error) {
      console.error('Error syncing activities:', error);
      
      // Check if error indicates need to reconnect
      const errorMessage = error.message || "Não foi possível sincronizar as atividades.";
      const needsReconnection = errorMessage.includes('conecte novamente') || 
                               errorMessage.includes('reconnect') || 
                               errorMessage.includes('autorização') ||
                               errorMessage.includes('tokens');
      
      toast({
        title: needsReconnection ? "Reconexão necessária" : "Erro na sincronização",
        description: errorMessage + (needsReconnection ? " Use o botão 'Conectar ao Garmin' abaixo." : ""),
        variant: "destructive",
      });
      
      if (needsReconnection) {
        setIsConnected(false);
      }
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

  const checkWebhookStatus = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('garmin-webhook-registration', {
        body: { action: 'status' }
      });
      
      if (error) throw error;
      
      setWebhookStatus(data.webhooks || []);
    } catch (error) {
      console.error('Error checking webhook status:', error);
    }
  };

  const registerWebhooks = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('garmin-webhook-registration', {
        body: { action: 'register' }
      });
      
      if (error) throw error;
      
      toast({
        title: "Webhooks registrados",
        description: "Os webhooks foram configurados automaticamente. A sincronização deve funcionar agora.",
      });
      
      await checkWebhookStatus();
    } catch (error) {
      console.error('Error registering webhooks:', error);
      toast({
        title: "Erro ao registrar webhooks",
        description: "Não foi possível registrar os webhooks automaticamente. Configure manualmente no Garmin Developer Console.",
        variant: "destructive",
      });
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

  if (!mounted || loading) {
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
                {isConnected 
                  ? "Sincronize suas atividades automaticamente via webhooks" 
                  : "Conecte sua conta Garmin Connect para sincronizar atividades"
                }
              </p>
            </div>
          </div>
          {isConnected ? (
            <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
              <CheckCircle className="w-4 h-4 mr-1" />
              Conectado
            </Badge>
          ) : (
            <Badge variant="outline" className="border-orange-500/30 text-orange-400">
              Não conectado
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
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
                size="sm"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Sincronizando...' : 'Sync Manual'}
              </Button>
              <Button 
                onClick={registerWebhooks}
                variant="outline"
                size="sm"
              >
                <Webhook className="w-4 h-4 mr-2" />
                Configurar Webhooks
              </Button>
              <Button 
                onClick={() => setShowWebhookUrls(!showWebhookUrls)}
                variant="ghost"
                size="sm"
              >
                URLs de Webhook
              </Button>
              <Button 
                onClick={connectGarmin}
                variant="outline"
                size="sm"
                className="border-orange-500/30 text-orange-400 hover:bg-orange-500/10"
              >
                Reconectar
              </Button>
              <Button 
                onClick={disconnectGarmin}
                variant="outline"
                size="sm"
                className="border-red-500/30 text-red-400 hover:bg-red-500/10"
              >
                Desconectar
              </Button>
            </>
          )}
        </div>

        {isConnected && (
          <div className="mt-4 space-y-3">
            <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
              <div className="flex items-center space-x-2">
                <Webhook className="w-4 h-4 text-blue-400" />
                <span className="text-sm text-blue-400 font-medium">
                  Status Webhook: {webhookStatus.length > 0 ? 'Configurado' : 'Necessário'}
                </span>
              </div>
              <p className="text-xs text-blue-300 mt-1">
                {webhookStatus.length > 0 
                  ? 'Os dados são sincronizados automaticamente quando você sincroniza seu dispositivo Garmin'
                  : 'Configure os webhooks para sincronização automática de atividades'
                }
              </p>
              {webhookStatus.length > 0 && (
                <div className="mt-2 text-xs text-blue-300">
                  Webhooks ativos: {webhookStatus.map(w => w.summary_type).join(', ')}
                </div>
              )}
            </div>

            {showWebhookUrls && (
              <div className="p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                <h4 className="text-sm font-medium text-yellow-400 mb-2">URLs para configurar no Garmin Developer Console:</h4>
                <div className="space-y-1 text-xs text-yellow-300 font-mono">
                  <div>https://qytorkjmzxscyaefkhnk.supabase.co/functions/v1/garmin-webhook</div>
                </div>
                <p className="text-xs text-yellow-300 mt-2">
                  Configure esta URL para os tipos: Activities, Daily Summary, Sleep
                </p>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Backfill Status Component - Show always with different states */}
      <Card className="glass p-6">
        <h4 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Historical Data Backfill
        </h4>
        <p className="text-sm text-muted-foreground mb-4">
          {isConnected 
            ? "Sincronize dados históricos dos últimos 6 meses do Garmin"
            : "Erro na conexão com a Garmin. Tente reconectar ou use sincronização manual."
          }
        </p>
        <div className="flex gap-2">
          <Button
            onClick={() => initiateBackfill(6)}
            className="flex-1"
            disabled={!isConnected}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Iniciar Backfill (6 meses)
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowManualBackfill(true)}
          >
            <Calendar className="h-4 w-4 mr-2" />
            Backfill Manual
          </Button>
        </div>
        {!isConnected && (
          <p className="text-xs text-orange-400 mt-2">
            O backfill automático requer conexão ativa, mas o backfill manual permanece disponível.
          </p>
        )}
      </Card>

      {/* Manual Backfill Dialog */}
      <Dialog open={showManualBackfill} onOpenChange={setShowManualBackfill}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Manual Backfill Request</DialogTitle>
          </DialogHeader>
          <GarminManualBackfill onClose={() => setShowManualBackfill(false)} />
        </DialogContent>
      </Dialog>

      {/* Backfill Progress */}
      {isConnected && <BackfillProgress />}

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
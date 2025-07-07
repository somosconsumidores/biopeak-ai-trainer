import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Activity, Zap, CheckCircle, AlertCircle, Clock, Download } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ConnectionStep {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'completed' | 'error';
  description?: string;
}

const StreamlinedGarminConnection = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isConnected, setIsConnected] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activities, setActivities] = useState([]);
  const [connectionSteps, setConnectionSteps] = useState<ConnectionStep[]>([
    { id: 'oauth', label: 'Autorização Garmin', status: 'pending', description: 'Conectando com Garmin Connect' },
    { id: 'webhooks', label: 'Configurar Webhooks', status: 'pending', description: 'Configuração automática para sincronização contínua' },
    { id: 'download', label: 'Download Histórico', status: 'pending', description: 'Baixando todas as atividades históricas' },
    { id: 'complete', label: 'Finalização', status: 'pending', description: 'Configuração completa e pronta para uso' }
  ]);
  const oauthWindowRef = useRef<Window | null>(null);

  useEffect(() => {
    if (user) {
      checkGarminConnection();
      handleOAuthCallbackIfPresent();
    }
  }, [user]);

  const handleOAuthCallbackIfPresent = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const oauthToken = urlParams.get('oauth_token');
    const oauthVerifier = urlParams.get('oauth_verifier');
    
    if (oauthToken && oauthVerifier) {
      console.log('Processing OAuth callback in streamlined component');
      
      try {
        const { data, error } = await supabase.functions.invoke('garmin-auth', {
          body: { 
            oauth_token: oauthToken,
            oauth_verifier: oauthVerifier
          }
        });

        if (error) throw error;

        if (data?.success) {
          setIsConnected(true);
          toast({
            title: "Garmin Connect autorizado!",
            description: "Autorização bem-sucedida. Configurando sincronização automática...",
          });
          
          // Clean URL
          window.history.replaceState({}, document.title, window.location.pathname);
          
          // Continue with automatic setup
          if (!isProcessing) {
            setTimeout(async () => {
              await setupWebhooksAutomatically();
              await downloadAllHistoricalActivities();
              await fetchActivities();
            }, 1000);
          }
        }
      } catch (error) {
        console.error('OAuth callback error:', error);
        toast({
          title: "Erro na autorização",
          description: error.message || "Falha na autorização do Garmin Connect.",
          variant: "destructive",
        });
        
        // Clean URL even on error
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  };

  const checkGarminConnection = async () => {
    try {
      const { data } = await supabase
        .from('garmin_tokens')
        .select('*')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (data) {
        setIsConnected(true);
        await fetchActivities();
      }
    } catch (error) {
      console.log('No Garmin connection found');
    }
  };

  const fetchActivities = async () => {
    try {
      const { data } = await supabase
        .from('garmin_activities')
        .select('*')
        .eq('user_id', user?.id)
        .order('start_date', { ascending: false })
        .limit(10);

      setActivities(data || []);
    } catch (error) {
      console.error('Error fetching activities:', error);
    }
  };

  const updateStepStatus = (stepId: string, status: ConnectionStep['status'], description?: string) => {
    setConnectionSteps(prev => prev.map(step => 
      step.id === stepId 
        ? { ...step, status, ...(description && { description }) }
        : step
    ));
  };

  const startStreamlinedConnection = async () => {
    console.log('🚀 STARTING STREAMLINED GARMIN CONNECTION');
    console.log('User:', user?.id);
    console.log('Current URL:', window.location.href);
    
    setShowModal(true);
    setIsProcessing(true);
    setProgress(0);

    try {
      // Step 1: OAuth Authorization
      console.log('🔐 Starting OAuth authorization step');
      updateStepStatus('oauth', 'active');
      const authResult = await initiateOAuthFlow();
      console.log('🔐 OAuth result:', authResult);
      
      if (!authResult) {
        console.log('❌ OAuth authorization failed or cancelled');
        throw new Error('Autorização cancelada pelo usuário');
      }

      console.log('✅ OAuth completed successfully');
      updateStepStatus('oauth', 'completed');
      setProgress(25);

      // Step 2: Setup Webhooks
      console.log('🪝 Starting webhook setup');
      updateStepStatus('webhooks', 'active');
      await setupWebhooksAutomatically();
      console.log('✅ Webhooks setup completed');
      updateStepStatus('webhooks', 'completed');
      setProgress(50);

      // Step 3: Download Historical Activities
      console.log('📥 Starting historical activities download');
      updateStepStatus('download', 'active');
      await downloadAllHistoricalActivities();
      console.log('✅ Historical download completed');
      updateStepStatus('download', 'completed');
      setProgress(75);

      // Step 4: Finalize
      console.log('🏁 Finalizing setup');
      updateStepStatus('complete', 'active');
      await finalizeSetup();
      console.log('✅ Setup finalization completed');
      updateStepStatus('complete', 'completed');
      setProgress(100);

      console.log('🎉 STREAMLINED CONNECTION COMPLETED SUCCESSFULLY');
      setIsConnected(true);
      toast({
        title: "🎉 Garmin Connect configurado!",
        description: "Todas as suas atividades foram sincronizadas e a sincronização automática está ativa.",
      });

      setTimeout(() => {
        setShowModal(false);
        setIsProcessing(false);
      }, 2000);

    } catch (error) {
      console.error('❌ STREAMLINED CONNECTION ERROR:', error);
      console.error('Error details:', error.message);
      
      // Mark current active step as error
      const activeStep = connectionSteps.find(step => step.status === 'active');
      if (activeStep) {
        updateStepStatus(activeStep.id, 'error', error.message);
      }

      toast({
        title: "Erro na configuração",
        description: error.message || "Não foi possível completar a configuração do Garmin Connect.",
        variant: "destructive",
      });

      setIsProcessing(false);
    }
  };

  const initiateOAuthFlow = async (): Promise<boolean> => {
    console.log('🔐 Initiating OAuth flow...');
    return new Promise(async (resolve) => {
      try {
        console.log('📞 Calling garmin-config function...');
        const { data, error } = await supabase.functions.invoke('garmin-config');
        console.log('📞 Garmin-config response:', { data, error });
        
        if (error || !data?.authUrl) {
          console.error('❌ No auth URL received:', error);
          throw error || new Error('Não foi possível obter URL de autorização');
        }

        console.log('🌐 Opening OAuth window:', data.authUrl);

        // Open OAuth window
        const authWindow = window.open(
          data.authUrl,
          'garmin_auth',
          'width=600,height=700,scrollbars=yes,resizable=yes'
        );
        
        oauthWindowRef.current = authWindow;

        // Monitor window for completion
        const checkClosed = setInterval(() => {
          if (authWindow?.closed) {
            clearInterval(checkClosed);
            // Check if authorization was successful
            checkGarminConnection().then(() => {
              // Check again if connected after OAuth
              supabase
                .from('garmin_tokens')
                .select('*')
                .eq('user_id', user?.id)
                .maybeSingle()
                .then(({ data }) => {
                  resolve(!!data);
                });
            });
          }
        }, 1000);

        // Timeout after 5 minutes
        setTimeout(() => {
          clearInterval(checkClosed);
          if (authWindow && !authWindow.closed) {
            authWindow.close();
          }
          resolve(false);
        }, 300000);

      } catch (error) {
        console.error('OAuth initiation error:', error);
        resolve(false);
      }
    });
  };

  const setupWebhooksAutomatically = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('garmin-webhook-registration', {
        body: { action: 'register' }
      });
      
      if (error) throw error;
      
      console.log('Webhooks configured automatically:', data);
    } catch (error) {
      console.error('Webhook setup error:', error);
      // Don't throw - webhooks are optional
    }
  };

  const downloadAllHistoricalActivities = async () => {
    try {
      // Use the dedicated garmin-sync-all function for comprehensive download
      const { data, error } = await supabase.functions.invoke('garmin-sync-all');
      
      if (error) throw error;
      
      console.log('Historical activities download initiated:', data);
      await fetchActivities();
    } catch (error) {
      console.error('Historical download error:', error);
      throw new Error('Falha no download das atividades históricas');
    }
  };

  const finalizeSetup = async () => {
    // Final verification and cleanup
    await checkGarminConnection();
    
    // Clean up any temporary data
    localStorage.removeItem('garmin_connecting');
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

  const getStepIcon = (status: ConnectionStep['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'active':
        return <Clock className="w-5 h-5 text-blue-500 animate-pulse" />;
      default:
        return <div className="w-5 h-5 rounded-full border-2 border-muted" />;
    }
  };

  return (
    <div className="space-y-6">
      <Card className="glass p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-blue-500/20 rounded-lg">
              <Activity className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-foreground">Garmin Connect</h3>
              <p className="text-muted-foreground">
                Sincronização automática e completa das suas atividades
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

        <div className="space-y-4">
          {!isConnected ? (
            <div className="text-center py-8">
              <Activity className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h4 className="text-lg font-medium text-foreground mb-2">
                Configure sua conta Garmin Connect
              </h4>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Conecte sua conta do Garmin Connect para sincronizar automaticamente todas as suas atividades, 
                configurar webhooks e manter seus dados sempre atualizados.
              </p>
              <Button 
                onClick={startStreamlinedConnection}
                disabled={isProcessing}
                className="bg-blue-500 hover:bg-blue-600 text-white px-8 py-3 text-lg"
              >
                <Zap className="w-5 h-5 mr-2" />
                {isProcessing ? 'Configurando...' : 'Conectar e Configurar Tudo'}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-foreground">Status da Conexão</h4>
                  <p className="text-sm text-muted-foreground">
                    {activities.length} atividades sincronizadas
                  </p>
                </div>
                <Button 
                  onClick={disconnectGarmin}
                  variant="outline"
                  size="sm"
                >
                  Desconectar
                </Button>
              </div>
              
              {activities.length > 0 && (
                <div className="grid gap-2">
                  <h5 className="font-medium text-foreground">Atividades Recentes</h5>
                  {activities.slice(0, 3).map((activity: any) => (
                    <div key={activity.id} className="glass p-3 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-foreground">{activity.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {activity.type} • {new Date(activity.start_date).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-primary">
                            {activity.distance ? `${(activity.distance / 1000).toFixed(1)} km` : '-'}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Progress Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="glass max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Activity className="w-5 h-5 text-blue-500" />
              <span>Configurando Garmin Connect</span>
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Progresso</span>
                <span className="text-primary">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            <div className="space-y-4">
              {connectionSteps.map((step, index) => (
                <div key={step.id} className="flex items-start space-x-3">
                  {getStepIcon(step.status)}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${
                      step.status === 'completed' ? 'text-green-500' :
                      step.status === 'error' ? 'text-red-500' :
                      step.status === 'active' ? 'text-blue-500' :
                      'text-muted-foreground'
                    }`}>
                      {step.label}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {step.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {isProcessing && (
              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  Este processo pode levar alguns minutos...
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StreamlinedGarminConnection;
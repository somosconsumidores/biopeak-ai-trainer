import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, Clock, RefreshCw, Webhook } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface WebhookStatus {
  summary_type: string;
  webhook_url: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const GarminWebhookMonitor = () => {
  const { session } = useAuth();
  const { toast } = useToast();
  const [webhooks, setWebhooks] = useState<WebhookStatus[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastWebhookCall, setLastWebhookCall] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);

  useEffect(() => {
    if (session) {
      loadWebhookStatus();
      checkLastWebhookCall();
    }
  }, [session]);

  const loadWebhookStatus = async () => {
    if (!session) return;

    setIsLoading(true);
    try {
      const { data: webhookData, error } = await supabase
        .from('garmin_webhook_config')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading webhook status:', error);
        return;
      }

      setWebhooks(webhookData || []);
    } catch (error) {
      console.error('Error loading webhook status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const checkLastWebhookCall = async () => {
    try {
      // Check edge function logs for the last webhook call
      const { data } = await supabase.functions.invoke('garmin-webhook', {
        method: 'GET'
      });
      
      if (data?.timestamp) {
        setLastWebhookCall(data.timestamp);
      }
    } catch (error) {
      console.error('Error checking last webhook call:', error);
    }
  };

  const registerWebhooks = async () => {
    if (!session) return;

    setIsRegistering(true);
    try {
      const { data, error } = await supabase.functions.invoke('garmin-webhook-registration', {
        body: { action: 'register' },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Webhooks registrados",
        description: "Os webhooks foram configurados com sucesso.",
      });

      await loadWebhookStatus();
    } catch (error) {
      console.error('Error registering webhooks:', error);
      toast({
        title: "Erro ao registrar webhooks",
        description: error.message || "Falha ao registrar os webhooks.",
        variant: "destructive",
      });
    } finally {
      setIsRegistering(false);
    }
  };

  const runCleanup = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('garmin-backfill-cleanup');

      if (error) {
        throw error;
      }

      toast({
        title: "Limpeza executada",
        description: `${data.message}`,
      });
    } catch (error) {
      console.error('Error running cleanup:', error);
      toast({
        title: "Erro na limpeza",
        description: error.message || "Falha ao executar limpeza.",
        variant: "destructive",
      });
    }
  };

  const getWebhookStatusBadge = (isActive: boolean) => {
    if (isActive) {
      return (
        <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
          <CheckCircle className="w-3 h-3 mr-1" />
          Ativo
        </Badge>
      );
    } else {
      return (
        <Badge variant="outline" className="border-orange-500/30 text-orange-400">
          <AlertCircle className="w-3 h-3 mr-1" />
          Inativo
        </Badge>
      );
    }
  };

  const getLastCallStatus = () => {
    if (!lastWebhookCall) {
      return (
        <Badge variant="outline" className="border-gray-500/30 text-gray-400">
          <Clock className="w-3 h-3 mr-1" />
          Nunca
        </Badge>
      );
    }

    const lastCall = new Date(lastWebhookCall);
    const now = new Date();
    const diffHours = (now.getTime() - lastCall.getTime()) / (1000 * 60 * 60);

    if (diffHours < 1) {
      return (
        <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
          <CheckCircle className="w-3 h-3 mr-1" />
          Recente ({Math.round(diffHours * 60)}min)
        </Badge>
      );
    } else if (diffHours < 24) {
      return (
        <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
          <Clock className="w-3 h-3 mr-1" />
          {Math.round(diffHours)}h atrás
        </Badge>
      );
    } else {
      return (
        <Badge variant="outline" className="border-red-500/30 text-red-400">
          <AlertCircle className="w-3 h-3 mr-1" />
          {Math.round(diffHours / 24)}d atrás
        </Badge>
      );
    }
  };

  if (isLoading) {
    return (
      <Card className="glass p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-muted rounded w-1/3 mb-2"></div>
          <div className="h-3 bg-muted rounded w-1/2"></div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="glass p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Webhook className="w-5 h-5 text-blue-400" />
          <h3 className="text-lg font-semibold">Monitor de Webhooks</h3>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            onClick={loadWebhookStatus}
            variant="ghost"
            size="sm"
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            onClick={registerWebhooks}
            variant="outline"
            size="sm"
            disabled={isRegistering}
          >
            {isRegistering ? 'Registrando...' : 'Registrar Webhooks'}
          </Button>
          <Button
            onClick={runCleanup}
            variant="outline"
            size="sm"
          >
            Limpeza
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
          <span className="text-sm font-medium">Última chamada webhook:</span>
          {getLastCallStatus()}
        </div>

        <div className="grid gap-2">
          {webhooks.length > 0 ? (
            webhooks.map((webhook, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-muted/10 rounded-lg">
                <div>
                  <span className="text-sm font-medium capitalize">
                    {webhook.summary_type.toLowerCase().replace('_', ' ')}
                  </span>
                  <p className="text-xs text-muted-foreground">
                    {webhook.webhook_url}
                  </p>
                </div>
                {getWebhookStatusBadge(webhook.is_active)}
              </div>
            ))
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Nenhum webhook configurado</p>
              <p className="text-xs">Clique em "Registrar Webhooks" para configurar</p>
            </div>
          )}
        </div>

        <div className="mt-4 p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
          <h4 className="text-sm font-medium text-blue-400 mb-2">URLs de Webhook para configuração manual:</h4>
          <div className="space-y-1 text-xs text-muted-foreground">
            <p>• Activity: https://qytorkjmzxscyaefkhnk.supabase.co/functions/v1/garmin-webhook</p>
            <p>• Daily Summary: https://qytorkjmzxscyaefkhnk.supabase.co/functions/v1/garmin-webhook</p>
            <p>• Sleep: https://qytorkjmzxscyaefkhnk.supabase.co/functions/v1/garmin-webhook</p>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default GarminWebhookMonitor;
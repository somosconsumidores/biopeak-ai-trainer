import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { AlertCircle, CheckCircle, Clock, Play, Bug, Zap } from 'lucide-react';

const GarminDiagnostics = () => {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [callbackUrl, setCallbackUrl] = useState('');
  const { toast } = useToast();

  const runDiagnosis = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('garmin-test-callbacks', {
        body: { action: 'diagnose-user' }
      });

      if (error) throw error;

      setResults(data);
      toast({
        title: "Diagnóstico concluído",
        description: "Análise completa do sistema Garmin realizada",
      });
    } catch (error: any) {
      toast({
        title: "Erro no diagnóstico",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const testCallback = async () => {
    if (!callbackUrl) {
      toast({
        title: "URL obrigatória",
        description: "Informe uma callback URL para testar",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('garmin-test-callbacks', {
        body: { 
          action: 'test-callback',
          callbackURL: callbackUrl
        }
      });

      if (error) throw error;

      setResults({ callbackTest: data });
      toast({
        title: data.success ? "Teste bem-sucedido" : "Teste falhou",
        description: data.success ? 
          `Status: ${data.status} (${data.responseTime})` : 
          `Erro: ${data.error}`,
        variant: data.success ? "default" : "destructive",
      });
    } catch (error: any) {
      toast({
        title: "Erro no teste",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const testAllPending = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('garmin-test-callbacks', {
        body: { action: 'test-all-pending' }
      });

      if (error) throw error;

      setResults({ pendingTests: data });
      toast({
        title: "Testes concluídos",
        description: `${data.totalPending} backfills pendentes testados`,
      });
    } catch (error: any) {
      toast({
        title: "Erro nos testes",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const simulateWebhook = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('garmin-test-callbacks', {
        body: { action: 'simulate-webhook' }
      });

      if (error) throw error;

      setResults({ webhookSimulation: data });
      toast({
        title: "Simulação concluída",
        description: data.success ? "Webhook simulado com sucesso" : "Falha na simulação",
        variant: data.success ? "default" : "destructive",
      });
    } catch (error: any) {
      toast({
        title: "Erro na simulação",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "secondary",
      in_progress: "outline", 
      completed: "default",
      error: "destructive"
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  const getStatusIcon = (success: boolean) => {
    return success ? 
      <CheckCircle className="h-4 w-4 text-green-500" /> : 
      <AlertCircle className="h-4 w-4 text-red-500" />;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bug className="h-5 w-5" />
          Garmin Diagnostics
        </CardTitle>
        <CardDescription>
          Ferramentas de diagnóstico para debug do sistema Garmin
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="callback">Teste Callback</TabsTrigger>
            <TabsTrigger value="webhook">Webhook</TabsTrigger>
            <TabsTrigger value="results">Resultados</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="space-y-4">
              <Button 
                onClick={runDiagnosis} 
                disabled={loading}
                className="w-full"
              >
                {loading ? <Clock className="h-4 w-4 mr-2 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />}
                Executar Diagnóstico Completo
              </Button>

              {results?.userId && (
                <div className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Status do Token</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {results.tokenStatus?.connected ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(!results.tokenStatus.expired)}
                            <span>Token {results.tokenStatus.expired ? 'Expirado' : 'Válido'}</span>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Expira em: {results.tokenStatus.minutesUntilExpiry} minutos
                          </p>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-red-500" />
                          <span>Não conectado ao Garmin</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Status dos Backfills</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <p>Total: {results.backfillStatus?.total || 0}</p>
                        {Object.entries(results.backfillStatus?.byStatus || {}).map(([status, count]) => (
                          <div key={status} className="flex items-center gap-2">
                            {getStatusBadge(status)}
                            <span>{count as number}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {results.recommendations?.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Recomendações</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-1">
                          {results.recommendations.map((rec: string, idx: number) => (
                            <li key={idx} className="text-sm text-muted-foreground">
                              • {rec}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="callback">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="callback-url">Callback URL para Teste</Label>
                <Input
                  id="callback-url"
                  value={callbackUrl}
                  onChange={(e) => setCallbackUrl(e.target.value)}
                  placeholder="https://apis.garmin.com/wellness-api/rest/activities?..."
                />
              </div>
              
              <Button onClick={testCallback} disabled={loading || !callbackUrl}>
                {loading ? <Clock className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                Testar Callback URL
              </Button>

              <Button onClick={testAllPending} disabled={loading} variant="outline" className="w-full">
                {loading ? <Clock className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                Testar Todos os Backfills Pendentes
              </Button>

              {results?.callbackTest && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      {getStatusIcon(results.callbackTest.success)}
                      Resultado do Teste
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <p><strong>Status:</strong> {results.callbackTest.status}</p>
                      <p><strong>Tempo:</strong> {results.callbackTest.responseTime}</p>
                      <p><strong>Token expirado:</strong> {results.callbackTest.tokenStatus?.expired ? 'Sim' : 'Não'}</p>
                      {results.callbackTest.data && (
                        <div>
                          <strong>Dados:</strong>
                          <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-auto max-h-40">
                            {JSON.stringify(results.callbackTest.data, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="webhook">
            <div className="space-y-4">
              <Button onClick={simulateWebhook} disabled={loading} className="w-full">
                {loading ? <Clock className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                Simular Webhook
              </Button>

              {results?.webhookSimulation && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      {getStatusIcon(results.webhookSimulation.success)}
                      Simulação de Webhook
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <p><strong>Status:</strong> {results.webhookSimulation.status}</p>
                      <div>
                        <strong>Resposta do Webhook:</strong>
                        <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-auto max-h-40">
                          {JSON.stringify(results.webhookSimulation.webhookResponse, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="results">
            <div>
              {results ? (
                <Textarea
                  value={JSON.stringify(results, null, 2)}
                  readOnly
                  className="h-96 font-mono text-xs"
                />
              ) : (
                <p className="text-muted-foreground">Nenhum resultado ainda. Execute um diagnóstico primeiro.</p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default GarminDiagnostics;
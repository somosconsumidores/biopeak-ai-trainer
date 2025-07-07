
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { toast } from "sonner";
import StravaIntegration from "@/components/StravaIntegration";

const StravaSettings = () => {
  const navigate = useNavigate();

  console.log('StravaSettings component loaded');

  // Auto-redirect to preview URL if accessing from project URL
  useEffect(() => {
    const currentHost = window.location.hostname;
    const currentUrl = window.location.href;
    
    console.log('[StravaSettings] Current URL:', currentUrl);
    console.log('[StravaSettings] Current hostname:', currentHost);
    
    // If user is on the project URL, redirect to preview URL
    if (currentHost.includes('f57b9513-c7c3-4577-8f1c-9c357d60d4b2.lovableproject.com')) {
      const previewUrl = 'https://preview--biopeak-ai-trainer.lovable.app/strava' + window.location.search;
      console.log('[StravaSettings] Redirecting to preview URL:', previewUrl);
      
      toast.info('Redirecionando para URL de integração...', { duration: 2000 });
      
      // Use a small delay to show the toast, then redirect
      setTimeout(() => {
        window.location.href = previewUrl;
      }, 1000);
    }
  }, []);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-4 mb-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/')}
            className="p-2"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Configurações Strava</h1>
            <p className="text-muted-foreground">Gerencie sua integração com o Strava</p>
          </div>
        </div>

        {/* Strava Integration Component */}
        <StravaIntegration />

        {/* Instructions */}
        <Card className="glass p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Como funciona</h3>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              <strong>1. Conectar:</strong> Clique em "Conectar ao Strava" para autorizar o acesso às suas atividades.
            </p>
            <p>
              <strong>2. Sincronizar:</strong> Suas atividades serão sincronizadas automaticamente. Você pode sincronizar manualmente a qualquer momento.
            </p>
            <p>
              <strong>3. Análise:</strong> Os dados das suas atividades serão usados para gerar insights personalizados e melhorar suas recomendações de treino.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default StravaSettings;

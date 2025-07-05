
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import StravaIntegration from "@/components/StravaIntegration";

const StravaSettings = () => {
  const navigate = useNavigate();

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

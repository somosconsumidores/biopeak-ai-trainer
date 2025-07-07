import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import StreamlinedGarminConnection from "@/components/StreamlinedGarminConnection";

const GarminSettings = () => {
  const navigate = useNavigate();









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
          <StreamlinedGarminConnection />
        </div>
      </div>
    </div>
  );
};

export default GarminSettings;
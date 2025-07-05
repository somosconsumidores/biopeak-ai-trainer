import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, Clock, Calendar, ChartBar, Settings } from "lucide-react";

const TrainingSession = () => {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Sessão de Treino</h1>
          <p className="text-muted-foreground">Análise detalhada com insights de IA</p>
        </div>
        <div className="flex items-center space-x-3">
          <Button variant="glass" size="sm">
            <Calendar className="w-4 h-4 mr-2" />
            Histórico
          </Button>
          <Button variant="ai" size="sm">
            <Settings className="w-4 h-4 mr-2" />
            Analisar com IA
          </Button>
        </div>
      </div>

      {/* Session Overview */}
      <Card className="glass p-6 animate-fade-in">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-primary/20 rounded-lg">
              <Activity className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">Corrida Matinal</h2>
              <p className="text-muted-foreground">Hoje, 06:30 - 07:15</p>
            </div>
          </div>
          <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-lg px-4 py-2">
            94% Performance
          </Badge>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-primary mb-1">45:23</div>
            <p className="text-sm text-muted-foreground flex items-center justify-center">
              <Clock className="w-4 h-4 mr-1" />
              Duração
            </p>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-primary mb-1">8.2km</div>
            <p className="text-sm text-muted-foreground">Distância</p>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-primary mb-1">5:32</div>
            <p className="text-sm text-muted-foreground">Pace Médio</p>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-primary mb-1">420</div>
            <p className="text-sm text-muted-foreground">Calorias</p>
          </div>
        </div>
      </Card>

      {/* AI Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="glass p-6 animate-slide-up">
          <div className="flex items-center mb-4">
            <div className="p-2 bg-primary/20 rounded-lg mr-3">
              <Settings className="w-5 h-5 text-primary" />
            </div>
            <h3 className="text-xl font-semibold text-foreground">Análise da IA</h3>
          </div>
          
          <div className="space-y-4">
            <div className="glass p-4 border-l-4 border-green-500">
              <h4 className="font-medium text-green-400 mb-2">✓ O que funcionou bem</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Ritmo consistente nos primeiros 5km</li>
                <li>• Zona cardíaca otimizada (82% do tempo)</li>
                <li>• Cadência estável em 180 spm</li>
              </ul>
            </div>

            <div className="glass p-4 border-l-4 border-yellow-500">
              <h4 className="font-medium text-yellow-400 mb-2">⚡ Pontos de melhoria</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Queda de ritmo nos últimos 2km</li>
                <li>• FC subiu muito no km 6-7</li>
                <li>• Stride length pode ser otimizado</li>
              </ul>
            </div>

            <div className="glass p-4 border-l-4 border-blue-500">
              <h4 className="font-medium text-blue-400 mb-2">🎯 Próxima sessão</h4>
              <p className="text-sm text-muted-foreground">
                Treino intervalado: 5x 1km com 2min recuperação. 
                Foco na manutenção do ritmo em zona 4.
              </p>
            </div>
          </div>
        </Card>

        <Card className="glass p-6 animate-slide-up" style={{animationDelay: '0.2s'}}>
          <div className="flex items-center mb-4">
            <div className="p-2 bg-primary/20 rounded-lg mr-3">
              <ChartBar className="w-5 h-5 text-primary" />
            </div>
            <h3 className="text-xl font-semibold text-foreground">Métricas Detalhadas</h3>
          </div>

          <div className="space-y-6">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium text-foreground">Frequência Cardíaca</span>
                <span className="text-sm text-primary">158 bpm médio</span>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 rounded-full w-[75%]"></div>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>Zona 1-2</span>
                <span>Zona 3-4</span>
                <span>Zona 5</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium text-foreground">Cadência</span>
                <span className="text-sm text-primary">180 spm</span>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full w-[85%] animate-fade-in"></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium text-foreground">Eficiência</span>
                <span className="text-sm text-primary">92%</span>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full w-[92%] animate-fade-in"></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium text-foreground">Recuperação Prev.</span>
                <span className="text-sm text-primary">18 horas</span>
              </div>
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Rápida</Badge>
            </div>
          </div>
        </Card>
      </div>

      {/* Performance Chart */}
      <Card className="glass p-6 animate-fade-in">
        <h3 className="text-xl font-semibold text-foreground mb-4">Gráfico de Performance</h3>
        <div className="h-64 bg-gradient-to-t from-primary/5 to-transparent rounded-lg p-4 relative overflow-hidden">
          {/* Simulated Pace Chart */}
          <div className="absolute bottom-4 left-4 right-4">
            <div className="flex items-end justify-between h-40">
              {[85, 88, 92, 90, 87, 82, 78, 85].map((height, index) => (
                <div key={index} className="flex flex-col items-center">
                  <div 
                    className="w-6 bg-primary rounded-t-lg transition-all duration-1000 animate-slide-up"
                    style={{
                      height: `${height}%`,
                      animationDelay: `${index * 0.1}s`
                    }}
                  ></div>
                  <span className="text-xs text-muted-foreground mt-2">
                    {index + 1}km
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Recovery Feedback */}
      <Card className="glass p-6 animate-slide-up">
        <div className="flex items-center mb-4">
          <div className="p-2 bg-primary/20 rounded-lg mr-3">
            <Activity className="w-5 h-5 text-primary" />
          </div>
          <h3 className="text-xl font-semibold text-foreground">Feedback de Recuperação</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="glass p-4 text-center">
            <div className="text-2xl font-bold text-green-400 mb-2">Ótima</div>
            <p className="text-sm text-muted-foreground">Hidratação</p>
            <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-green-500 rounded-full w-[95%]"></div>
            </div>
          </div>
          
          <div className="glass p-4 text-center">
            <div className="text-2xl font-bold text-yellow-400 mb-2">Moderada</div>
            <p className="text-sm text-muted-foreground">Fadiga Muscular</p>
            <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-yellow-500 rounded-full w-[65%]"></div>
            </div>
          </div>
          
          <div className="glass p-4 text-center">
            <div className="text-2xl font-bold text-green-400 mb-2">Excelente</div>
            <p className="text-sm text-muted-foreground">FC Recuperação</p>
            <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-green-500 rounded-full w-[88%]"></div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default TrainingSession;
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, ChartBar, Settings, Bell } from "lucide-react";

const PersonalizedInsights = () => {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Insights Personalizados</h1>
          <p className="text-muted-foreground">Sugestões semanais de melhoria baseadas na sua evolução</p>
        </div>
        <div className="flex items-center space-x-3">
          <Badge className="glass border-primary/50">
            <Bell className="w-4 h-4 mr-2" />
            5 novos insights
          </Badge>
          <Button variant="ai" size="sm">
            <Settings className="w-4 h-4 mr-2" />
            Personalizar
          </Button>
        </div>
      </div>

      {/* Weekly Suggestions */}
      <Card className="glass p-6 animate-fade-in">
        <div className="flex items-center mb-6">
          <div className="p-2 bg-primary/20 rounded-lg mr-3">
            <Settings className="w-5 h-5 text-primary" />
          </div>
          <h3 className="text-xl font-semibold text-foreground">Sugestões da Semana</h3>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="glass p-4 border-l-4 border-green-500 hover:border-green-400 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="font-medium text-green-400 mb-1">🎯 Foco Principal</h4>
                  <p className="text-sm text-muted-foreground">Esta semana</p>
                </div>
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Alta</Badge>
              </div>
              <p className="text-foreground font-medium mb-2">Melhoria na Resistência Aeróbica</p>
              <p className="text-sm text-muted-foreground mb-3">
                Seus dados mostram que você tem potencial para melhorar 8-12% sua capacidade aeróbica 
                com treinos específicos de zona 2.
              </p>
              <Button variant="glass" size="sm">Ver Plano Detalhado</Button>
            </div>

            <div className="glass p-4 border-l-4 border-yellow-500 hover:border-yellow-400 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="font-medium text-yellow-400 mb-1">⚡ Otimização</h4>
                  <p className="text-sm text-muted-foreground">Próximos 3 treinos</p>
                </div>
                <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Média</Badge>
              </div>
              <p className="text-foreground font-medium mb-2">Ajuste na Cadência</p>
              <p className="text-sm text-muted-foreground mb-3">
                Aumente sua cadência para 185-190 spm. Seus últimos treinos mostram 
                eficiência 15% maior nessa faixa.
              </p>
              <Button variant="glass" size="sm">Aplicar Sugestão</Button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="glass p-4 border-l-4 border-blue-500 hover:border-blue-400 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="font-medium text-blue-400 mb-1">📊 Análise Avançada</h4>
                  <p className="text-sm text-muted-foreground">Baseado em 30 dias</p>
                </div>
                <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Info</Badge>
              </div>
              <p className="text-foreground font-medium mb-2">Padrão de Recuperação</p>
              <p className="text-sm text-muted-foreground mb-3">
                Sua recuperação é 22% mais rápida quando você treina pela manhã. 
                Considere ajustar seus horários de treino.
              </p>
              <Button variant="glass" size="sm">Ver Gráfico</Button>
            </div>

            <div className="glass p-4 border-l-4 border-purple-500 hover:border-purple-400 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="font-medium text-purple-400 mb-1">🔬 Insight Avançado</h4>
                  <p className="text-sm text-muted-foreground">IA identificou</p>
                </div>
                <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">IA</Badge>
              </div>
              <p className="text-foreground font-medium mb-2">Zona de Treino Ótima</p>
              <p className="text-sm text-muted-foreground mb-3">
                Distâncias de 5-8km são sua zona mais efetiva. Performance 18% superior 
                comparado a outras distâncias.
              </p>
              <Button variant="glass" size="sm">Personalizar Treinos</Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Interactive Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="glass p-6 animate-slide-up">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">Evolução Cardio</h3>
            <Badge className="bg-primary/20 text-primary border-primary/30">+8% este mês</Badge>
          </div>
          <div className="h-48 bg-gradient-to-t from-primary/10 to-transparent rounded-lg p-4 relative overflow-hidden">
            <div className="absolute bottom-4 left-4 right-4">
              <div className="flex items-end justify-between h-32">
                {[45, 52, 48, 58, 65, 62, 68, 72, 75, 78, 74, 82].map((height, index) => (
                  <div key={index} className="flex flex-col items-center">
                    <div 
                      className="w-4 bg-gradient-to-t from-primary to-primary/60 rounded-t-lg transition-all duration-1000 animate-slide-up"
                      style={{
                        height: `${height}%`,
                        animationDelay: `${index * 0.1}s`
                      }}
                    ></div>
                    <span className="text-xs text-muted-foreground mt-2">
                      {index % 3 === 0 ? `S${Math.floor(index/3) + 1}` : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Capacidade cardiovascular melhorou consistentemente
          </p>
        </Card>

        <Card className="glass p-6 animate-slide-up" style={{animationDelay: '0.2s'}}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">VO2 Max Progression</h3>
            <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Excelente</Badge>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Atual</span>
              <span className="text-2xl font-bold text-primary">52.1</span>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-green-500 to-primary rounded-full w-[85%] animate-fade-in"></div>
            </div>
            <div className="grid grid-cols-3 gap-4 text-center text-sm">
              <div>
                <div className="text-muted-foreground">Mínimo</div>
                <div className="font-medium text-foreground">45.2</div>
              </div>
              <div>
                <div className="text-muted-foreground">Média</div>
                <div className="font-medium text-foreground">48.8</div>
              </div>
              <div>
                <div className="text-muted-foreground">Máximo</div>
                <div className="font-medium text-primary">52.1</div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Training Zones Analysis */}
      <Card className="glass p-6 animate-fade-in">
        <div className="flex items-center mb-6">
          <div className="p-2 bg-primary/20 rounded-lg mr-3">
            <ChartBar className="w-5 h-5 text-primary" />
          </div>
          <h3 className="text-xl font-semibold text-foreground">Zona de Treinos Mais Efetiva</h3>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="glass p-6 text-center">
            <div className="p-4 bg-green-500/20 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <Activity className="w-8 h-8 text-green-400" />
            </div>
            <h4 className="text-lg font-semibold text-foreground mb-2">Zona 2-3</h4>
            <div className="text-3xl font-bold text-green-400 mb-2">85%</div>
            <p className="text-sm text-muted-foreground mb-4">Eficiência ótima para desenvolvimento aeróbico</p>
            <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Recomendada</Badge>
          </div>

          <div className="glass p-6 text-center">
            <div className="p-4 bg-yellow-500/20 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <Activity className="w-8 h-8 text-yellow-400" />
            </div>
            <h4 className="text-lg font-semibold text-foreground mb-2">Zona 4</h4>
            <div className="text-3xl font-bold text-yellow-400 mb-2">72%</div>
            <p className="text-sm text-muted-foreground mb-4">Boa para treinos intervalados</p>
            <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Moderada</Badge>
          </div>

          <div className="glass p-6 text-center">
            <div className="p-4 bg-red-500/20 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <Activity className="w-8 h-8 text-red-400" />
            </div>
            <h4 className="text-lg font-semibold text-foreground mb-2">Zona 5</h4>
            <div className="text-3xl font-bold text-red-400 mb-2">58%</div>
            <p className="text-sm text-muted-foreground mb-4">Use com moderação</p>
            <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Limitada</Badge>
          </div>
        </div>
      </Card>

      {/* Action Items */}
      <Card className="glass p-6 animate-slide-up">
        <h3 className="text-xl font-semibold text-foreground mb-4">Ações Recomendadas</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            {
              title: "Treino Long Run",
              description: "Próximo domingo, 12km em zona 2",
              priority: "Alta",
              color: "green"
            },
            {
              title: "Ajuste de Cadência",
              description: "Praticar 185 spm nos próximos 3 treinos",
              priority: "Média",
              color: "yellow"
            },
            {
              title: "Análise de Sono",
              description: "Correlacionar qualidade do sono com performance",
              priority: "Baixa",
              color: "blue"
            },
            {
              title: "Teste de Lactato",
              description: "Agendar para refinar zonas de treino",
              priority: "Média",
              color: "purple"
            }
          ].map((action, index) => (
            <div key={index} className={`glass p-4 border-l-4 border-${action.color}-500 animate-fade-in`} style={{animationDelay: `${index * 0.1}s`}}>
              <div className="flex items-start justify-between mb-2">
                <h4 className="font-medium text-foreground">{action.title}</h4>
                <Badge className={`bg-${action.color}-500/20 text-${action.color}-400 border-${action.color}-500/30`}>
                  {action.priority}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-3">{action.description}</p>
              <Button variant="glass" size="sm">Agendar</Button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default PersonalizedInsights;
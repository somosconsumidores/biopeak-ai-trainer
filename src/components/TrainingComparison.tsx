import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, ChartBar, Calendar, Settings } from "lucide-react";

const TrainingComparison = () => {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Comparativo de Treinos</h1>
          <p className="text-muted-foreground">Análise gráfica com destaque de progresso ou regressão</p>
        </div>
        <div className="flex items-center space-x-3">
          <Button variant="glass" size="sm">
            <Calendar className="w-4 h-4 mr-2" />
            Selecionar Período
          </Button>
          <Button variant="ai" size="sm">
            <Settings className="w-4 h-4 mr-2" />
            Configurar Análise
          </Button>
        </div>
      </div>

      {/* Session Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="glass p-6 animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">Sessão A</h3>
            <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Selecionada</Badge>
          </div>
          <div className="flex items-center space-x-4 mb-4">
            <div className="p-3 bg-primary/20 rounded-lg">
              <Activity className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h4 className="font-medium text-foreground">Corrida - Hoje</h4>
              <p className="text-muted-foreground text-sm">8.2km • 45:23 • 94% performance</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-primary">5:32</div>
              <p className="text-xs text-muted-foreground">Pace</p>
            </div>
            <div>
              <div className="text-2xl font-bold text-primary">158</div>
              <p className="text-xs text-muted-foreground">FC Média</p>
            </div>
            <div>
              <div className="text-2xl font-bold text-primary">420</div>
              <p className="text-xs text-muted-foreground">Calorias</p>
            </div>
          </div>
        </Card>

        <Card className="glass p-6 animate-fade-in" style={{animationDelay: '0.1s'}}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">Sessão B</h3>
            <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Selecionada</Badge>
          </div>
          <div className="flex items-center space-x-4 mb-4">
            <div className="p-3 bg-primary/20 rounded-lg">
              <Activity className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h4 className="font-medium text-foreground">Corrida - 1 Semana Atrás</h4>
              <p className="text-muted-foreground text-sm">8.0km • 47:12 • 82% performance</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-primary">5:54</div>
              <p className="text-xs text-muted-foreground">Pace</p>
            </div>
            <div>
              <div className="text-2xl font-bold text-primary">162</div>
              <p className="text-xs text-muted-foreground">FC Média</p>
            </div>
            <div>
              <div className="text-2xl font-bold text-primary">398</div>
              <p className="text-xs text-muted-foreground">Calorias</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Comparison Analysis */}
      <Card className="glass p-6 animate-slide-up">
        <div className="flex items-center mb-6">
          <div className="p-2 bg-primary/20 rounded-lg mr-3">
            <ChartBar className="w-5 h-5 text-primary" />
          </div>
          <h3 className="text-xl font-semibold text-foreground">Análise Comparativa</h3>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Progress Indicators */}
          <div className="space-y-4">
            <h4 className="font-medium text-foreground mb-4">Indicadores de Progresso</h4>
            
            <div className="glass p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">Pace</span>
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                  +22s melhor
                </Badge>
              </div>
              <div className="flex items-center space-x-4">
                <div className="flex-1">
                  <div className="text-xs text-muted-foreground mb-1">Antes: 5:54</div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-red-500 rounded-full w-[70%]"></div>
                  </div>
                </div>
                <div className="flex-1">
                  <div className="text-xs text-muted-foreground mb-1">Agora: 5:32</div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full w-[85%]"></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="glass p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">Performance</span>
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                  +12% melhor
                </Badge>
              </div>
              <div className="flex items-center space-x-4">
                <div className="flex-1">
                  <div className="text-xs text-muted-foreground mb-1">Antes: 82%</div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-yellow-500 rounded-full w-[82%]"></div>
                  </div>
                </div>
                <div className="flex-1">
                  <div className="text-xs text-muted-foreground mb-1">Agora: 94%</div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full w-[94%]"></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="glass p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">FC Média</span>
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                  -4 bpm melhor
                </Badge>
              </div>
              <div className="flex items-center space-x-4">
                <div className="flex-1">
                  <div className="text-xs text-muted-foreground mb-1">Antes: 162 bpm</div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-red-500 rounded-full w-[90%]"></div>
                  </div>
                </div>
                <div className="flex-1">
                  <div className="text-xs text-muted-foreground mb-1">Agora: 158 bpm</div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full w-[85%]"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Comparative Chart */}
          <div>
            <h4 className="font-medium text-foreground mb-4">Gráfico Comparativo de Pace</h4>
            <div className="h-64 bg-gradient-to-t from-primary/5 to-transparent rounded-lg p-4 relative overflow-hidden">
              <div className="absolute bottom-4 left-4 right-4">
                <div className="flex items-end justify-between h-40">
                  {[
                    {before: 70, after: 85},
                    {before: 68, after: 88},
                    {before: 72, after: 92},
                    {before: 69, after: 90},
                    {before: 65, after: 87},
                    {before: 62, after: 82},
                    {before: 58, after: 78},
                    {before: 60, after: 85}
                  ].map((data, index) => (
                    <div key={index} className="flex flex-col items-center space-y-1">
                      <div className="flex space-x-1">
                        <div 
                          className="w-3 bg-red-500/70 rounded-t-lg transition-all duration-1000 animate-slide-up"
                          style={{
                            height: `${data.before}%`,
                            animationDelay: `${index * 0.1}s`
                          }}
                        ></div>
                        <div 
                          className="w-3 bg-primary rounded-t-lg transition-all duration-1000 animate-slide-up"
                          style={{
                            height: `${data.after}%`,
                            animationDelay: `${index * 0.1 + 0.5}s`
                          }}
                        ></div>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {index + 1}km
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-center space-x-6 mt-4">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-red-500/70 rounded"></div>
                <span className="text-xs text-muted-foreground">Sessão Anterior</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-primary rounded"></div>
                <span className="text-xs text-muted-foreground">Sessão Atual</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* AI Insights */}
      <Card className="glass p-6 animate-fade-in">
        <div className="flex items-center mb-4">
          <div className="p-2 bg-primary/20 rounded-lg mr-3">
            <Settings className="w-5 h-5 text-primary" />
          </div>
          <h3 className="text-xl font-semibold text-foreground">Insights da IA</h3>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="glass p-4 border-l-4 border-green-500">
              <h4 className="font-medium text-green-400 mb-2">🎯 Principais Melhorias</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Consistência de ritmo aumentou 18%</li>
                <li>• Eficiência cardíaca melhorou significativamente</li>
                <li>• Tempo de recuperação otimizado</li>
              </ul>
            </div>

            <div className="glass p-4 border-l-4 border-blue-500">
              <h4 className="font-medium text-blue-400 mb-2">📊 Padrões Identificados</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Melhores performances em treinos matinais</li>
                <li>• Zona cardíaca 3-4 mais efetiva</li>
                <li>• Cadência ótima: 180-185 spm</li>
              </ul>
            </div>
          </div>

          <div className="space-y-4">
            <div className="glass p-4 border-l-4 border-yellow-500">
              <h4 className="font-medium text-yellow-400 mb-2">⚡ Próximos Objetivos</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Manter pace sub-5:30 por 10km</li>
                <li>• Reduzir variabilidade cardíaca</li>
                <li>• Aumentar volume semanal gradualmente</li>
              </ul>
            </div>

            <div className="glass p-4 border-l-4 border-purple-500">
              <h4 className="font-medium text-purple-400 mb-2">🔬 Recomendações</h4>
              <p className="text-sm text-muted-foreground">
                Continue com treinos intervalados 2x/semana. Adicione 1 treino longo 
                por semana mantendo FC na zona 2-3 para desenvolvimento aeróbico.
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-4 justify-center">
        <Button variant="hero">
          Adicionar Nova Comparação
        </Button>
        <Button variant="glass">
          Exportar Relatório
        </Button>
        <Button variant="ai">
          Análise Avançada
        </Button>
      </div>
    </div>
  );
};

export default TrainingComparison;
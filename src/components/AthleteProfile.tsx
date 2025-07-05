import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { User, Settings, Activity, ChartBar } from "lucide-react";

const AthleteProfile = () => {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Perfil do Atleta</h1>
          <p className="text-muted-foreground">Dados históricos e configuração de metas</p>
        </div>
        <div className="flex items-center space-x-3">
          <Button variant="glass" size="sm">
            <Settings className="w-4 h-4 mr-2" />
            Editar Perfil
          </Button>
          <Button variant="ai" size="sm">
            Configurar Metas
          </Button>
        </div>
      </div>

      {/* Profile Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="glass p-6 animate-fade-in">
          <div className="flex items-center space-x-4 mb-6">
            <div className="p-4 bg-primary/20 rounded-full">
              <User className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">João Silva</h2>
              <p className="text-muted-foreground">Corredor • Nível Avançado</p>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Idade</span>
              <span className="text-foreground font-medium">32 anos</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Peso</span>
              <span className="text-foreground font-medium">75 kg</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Altura</span>
              <span className="text-foreground font-medium">1.78 m</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">IMC</span>
              <span className="text-primary font-medium">23.7</span>
            </div>
          </div>
        </Card>

        <Card className="glass p-6 animate-fade-in" style={{animationDelay: '0.1s'}}>
          <div className="flex items-center mb-4">
            <div className="p-2 bg-primary/20 rounded-lg mr-3">
              <Activity className="w-5 h-5 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">Nível de Performance</h3>
          </div>
          
          <div className="text-center mb-4">
            <div className="text-4xl font-bold text-primary mb-2">8.5/10</div>
            <Badge className="bg-primary/20 text-primary border-primary/30 text-lg px-4 py-1">
              Avançado
            </Badge>
          </div>
          
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Resistência</span>
                <span className="text-primary">9.2</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full w-[92%] animate-fade-in"></div>
              </div>
            </div>
            
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Velocidade</span>
                <span className="text-primary">7.8</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full w-[78%] animate-fade-in"></div>
              </div>
            </div>
            
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Recuperação</span>
                <span className="text-primary">8.5</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full w-[85%] animate-fade-in"></div>
              </div>
            </div>
          </div>
        </Card>

        <Card className="glass p-6 animate-fade-in" style={{animationDelay: '0.2s'}}>
          <div className="flex items-center mb-4">
            <div className="p-2 bg-primary/20 rounded-lg mr-3">
              <ChartBar className="w-5 h-5 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">Metas Atuais</h3>
          </div>
          
          <div className="space-y-4">
            <div className="glass p-3">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-foreground">Sub-40 em 10K</span>
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                  75%
                </Badge>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full w-[75%] animate-fade-in"></div>
              </div>
            </div>
            
            <div className="glass p-3">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-foreground">VO2 Max 55+</span>
                <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                  94%
                </Badge>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-yellow-500 rounded-full w-[94%] animate-fade-in"></div>
              </div>
            </div>
            
            <div className="glass p-3">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-foreground">Meia Maratona</span>
                <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                  45%
                </Badge>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full w-[45%] animate-fade-in"></div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Historical Data */}
      <Card className="glass p-6 animate-slide-up">
        <div className="flex items-center mb-6">
          <div className="p-2 bg-primary/20 rounded-lg mr-3">
            <ChartBar className="w-5 h-5 text-primary" />
          </div>
          <h3 className="text-xl font-semibold text-foreground">Dados Históricos</h3>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
          <div className="text-center">
            <div className="text-3xl font-bold text-primary mb-1">247</div>
            <p className="text-sm text-muted-foreground">Total de Treinos</p>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-primary mb-1">1,847km</div>
            <p className="text-sm text-muted-foreground">Distância Total</p>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-primary mb-1">156h</div>
            <p className="text-sm text-muted-foreground">Tempo Total</p>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-primary mb-1">18,450</div>
            <p className="text-sm text-muted-foreground">Calorias Queimadas</p>
          </div>
        </div>

        {/* Performance Evolution Chart */}
        <div className="h-64 bg-gradient-to-t from-primary/5 to-transparent rounded-lg p-4 relative overflow-hidden mb-6">
          <div className="absolute top-4 left-4">
            <h4 className="text-sm font-medium text-foreground mb-1">Evolução de Performance (6 meses)</h4>
            <p className="text-xs text-muted-foreground">Média mensal de performance</p>
          </div>
          <div className="absolute bottom-4 left-4 right-4">
            <div className="flex items-end justify-between h-40">
              {[65, 68, 72, 78, 82, 85].map((height, index) => (
                <div key={index} className="flex flex-col items-center">
                  <div 
                    className="w-12 bg-gradient-to-t from-primary to-primary/60 rounded-t-lg transition-all duration-1000 animate-slide-up"
                    style={{
                      height: `${height}%`,
                      animationDelay: `${index * 0.2}s`
                    }}
                  ></div>
                  <span className="text-xs text-muted-foreground mt-2">
                    {['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'][index]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Benchmarks */}
      <Card className="glass p-6 animate-fade-in">
        <div className="flex items-center mb-6">
          <div className="p-2 bg-primary/20 rounded-lg mr-3">
            <Activity className="w-5 h-5 text-primary" />
          </div>
          <h3 className="text-xl font-semibold text-foreground">Benchmarks Pessoais</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { distance: "5K", time: "20:45", date: "15/Mai/2024", improvement: "+12s" },
            { distance: "10K", time: "42:18", date: "28/Abr/2024", improvement: "+45s" },
            { distance: "15K", time: "1:08:32", date: "10/Mar/2024", improvement: "+1:20" },
            { distance: "Meia", time: "1:35:42", date: "22/Jan/2024", improvement: "PB" },
            { distance: "Maratona", time: "-", date: "-", improvement: "Meta" },
          ].map((record, index) => (
            <Card key={index} className="glass glass-hover p-4 animate-slide-up" style={{animationDelay: `${index * 0.1}s`}}>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-lg font-bold text-primary">{record.distance}</h4>
                <Badge className={`${record.improvement === 'PB' ? 'bg-green-500/20 text-green-400 border-green-500/30' : 
                  record.improvement === 'Meta' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                  'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'}`}>
                  {record.improvement}
                </Badge>
              </div>
              <div className="text-2xl font-bold text-foreground mb-1">{record.time}</div>
              <p className="text-sm text-muted-foreground">{record.date}</p>
            </Card>
          ))}
        </div>
      </Card>

      {/* Device Integration */}
      <Card className="glass p-6 animate-slide-up">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <div className="p-2 bg-primary/20 rounded-lg mr-3">
              <Settings className="w-5 h-5 text-primary" />
            </div>
            <h3 className="text-xl font-semibold text-foreground">Dispositivos Conectados</h3>
          </div>
          <Button variant="glass" size="sm">Gerenciar</Button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="glass p-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center">
                <Activity className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h4 className="font-medium text-foreground">Garmin Forerunner 955</h4>
                <p className="text-sm text-muted-foreground">Conectado • Sincronizando</p>
              </div>
            </div>
            <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Ativo</Badge>
          </div>
          
          <div className="glass p-4 flex items-center justify-between opacity-50">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-muted/20 rounded-lg flex items-center justify-center">
                <Settings className="w-6 h-6 text-muted-foreground" />
              </div>
              <div>
                <h4 className="font-medium text-muted-foreground">Adicionar Dispositivo</h4>
                <p className="text-sm text-muted-foreground">Conectar novo dispositivo</p>
              </div>
            </div>
            <Button variant="glass" size="sm">Conectar</Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default AthleteProfile;

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, ChartBar, Bell, Settings, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useDashboardMetrics } from "@/hooks/useDashboardMetrics";

const Dashboard = () => {
  const navigate = useNavigate();
  const {
    performancePeak,
    performanceChange,
    vo2Max,
    averageHeartRate,
    recoveryScore,
    weeklyData,
    totalSessions,
    recentSessions,
    loading
  } = useDashboardMetrics();

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Dashboard</h1>
          <p className="text-muted-foreground">Seu resumo de performance inteligente</p>
        </div>
        <div className="flex items-center space-x-3">
          <Badge className="glass border-primary/50">
            <Bell className="w-4 h-4 mr-2" />
            3 novos insights
          </Badge>
          <Button 
            variant="glass" 
            size="sm"
            onClick={() => navigate('/strava')}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Strava
          </Button>
          <Button variant="ai" size="sm">
            <Settings className="w-4 h-4 mr-2" />
            Configurar
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="glass p-6 animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground">Pico de Performance</h3>
            <div className="p-2 bg-primary/20 rounded-lg">
              <Activity className="w-5 h-5 text-primary" />
            </div>
          </div>
          <div className="text-3xl font-bold text-primary mb-2">
            {loading ? '...' : `${performancePeak}%`}
          </div>
          <p className="text-muted-foreground text-sm">
            {loading ? 'Carregando...' : `${performanceChange >= 0 ? '+' : ''}${performanceChange}% vs semana anterior`}
          </p>
          <div className="mt-4 h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary rounded-full animate-fade-in transition-all duration-1000" 
              style={{ width: `${performancePeak}%` }}
            ></div>
          </div>
        </Card>

        <Card className="glass p-6 animate-fade-in" style={{animationDelay: '0.1s'}}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground">VO2 Max</h3>
            <div className="p-2 bg-primary/20 rounded-lg">
              <ChartBar className="w-5 h-5 text-primary" />
            </div>
          </div>
          <div className="text-3xl font-bold text-primary mb-2">
            {loading ? '...' : vo2Max.toFixed(1)}
          </div>
          <p className="text-muted-foreground text-sm">
            {loading ? 'Carregando...' : 
              vo2Max >= 50 ? 'Categoria: Excelente' :
              vo2Max >= 40 ? 'Categoria: Bom' :
              vo2Max >= 30 ? 'Categoria: Regular' : 'Categoria: Baixo'
            }
          </p>
          <div className="mt-4 h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary rounded-full animate-fade-in transition-all duration-1000" 
              style={{ width: `${Math.min(100, (vo2Max / 60) * 100)}%` }}
            ></div>
          </div>
        </Card>

        <Card className="glass p-6 animate-fade-in" style={{animationDelay: '0.2s'}}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground">FC Média</h3>
            <div className="p-2 bg-primary/20 rounded-lg">
              <Activity className="w-5 h-5 text-primary" />
            </div>
          </div>
          <div className="text-3xl font-bold text-primary mb-2">
            {loading ? '...' : `${averageHeartRate || 0} BPM`}
          </div>
          <p className="text-muted-foreground text-sm">
            {loading ? 'Carregando...' : 'Frequência cardíaca média'}
          </p>
          <Badge className="mt-3 bg-primary/20 text-primary border-primary/30">
            {averageHeartRate > 0 ? 'Ativo' : 'Sem dados'}
          </Badge>
        </Card>

        <Card className="glass p-6 animate-fade-in" style={{animationDelay: '0.3s'}}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground">Recuperação</h3>
            <div className="p-2 bg-primary/20 rounded-lg">
              <Settings className="w-5 h-5 text-primary" />
            </div>
          </div>
          <div className="text-3xl font-bold text-primary mb-2">
            {loading ? '...' : `${recoveryScore}%`}
          </div>
          <p className="text-muted-foreground text-sm">
            {loading ? 'Carregando...' : 
              recoveryScore >= 80 ? 'Status: Excelente' :
              recoveryScore >= 60 ? 'Status: Boa' :
              recoveryScore >= 40 ? 'Status: Regular' : 'Status: Baixa'
            }
          </p>
          <Badge className={`mt-3 ${
            recoveryScore >= 80 ? 'bg-green-500/20 text-green-400 border-green-500/30' :
            recoveryScore >= 60 ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
            recoveryScore >= 40 ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
            'bg-red-500/20 text-red-400 border-red-500/30'
          }`}>
            {recoveryScore >= 80 ? 'Pronto' :
             recoveryScore >= 60 ? 'Bom' :
             recoveryScore >= 40 ? 'Cuidado' : 'Descanso'}
          </Badge>
        </Card>
      </div>

      {/* Evolution Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="glass p-6 animate-slide-up">
          <h3 className="text-xl font-semibold text-foreground mb-4">Evolução Semanal</h3>
          <div className="h-64 bg-gradient-to-t from-primary/10 to-transparent rounded-lg p-4 relative overflow-hidden">
            {/* Performance Chart */}
            <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
              {weeklyData.map((height, index) => (
                <div key={index} className="flex flex-col items-center">
                  <div 
                    className="w-8 bg-primary rounded-t-lg transition-all duration-1000 animate-slide-up"
                    style={{
                      height: `${Math.max(5, height)}%`,
                      animationDelay: `${index * 0.1}s`
                    }}
                  ></div>
                  <span className="text-xs text-muted-foreground mt-2">
                    {['S', 'T', 'Q', 'Q', 'S', 'S', 'D'][index]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card className="glass p-6 animate-slide-up" style={{animationDelay: '0.2s'}}>
          <h3 className="text-xl font-semibold text-foreground mb-4">Alertas Inteligentes</h3>
          <div className="space-y-4">
            <div className="glass p-4 border-l-4 border-primary">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-medium text-foreground mb-1">Risco de Overtraining</h4>
                  <p className="text-sm text-muted-foreground">Considere reduzir intensidade por 2 dias</p>
                </div>
                <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Atenção</Badge>
              </div>
            </div>

            <div className="glass p-4 border-l-4 border-green-500">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-medium text-foreground mb-1">Zona Cardíaca Otimizada</h4>
                  <p className="text-sm text-muted-foreground">Mantenha 155-165 BPM nos próximos treinos</p>
                </div>
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Dica</Badge>
              </div>
            </div>

            <div className="glass p-4 border-l-4 border-blue-500">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-medium text-foreground mb-1">Melhoria no VO2</h4>
                  <p className="text-sm text-muted-foreground">+3.2% em relação ao mês passado</p>
                </div>
                <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Sucesso</Badge>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Recent Sessions */}
      <Card className="glass p-6 animate-fade-in">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-foreground">Últimas Sessões</h3>
          <Button variant="glass" size="sm">Ver Todas</Button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {loading ? (
            Array.from({ length: 3 }).map((_, index) => (
              <Card key={index} className="glass p-4 animate-pulse">
                <div className="h-4 bg-muted rounded mb-3"></div>
                <div className="h-6 bg-muted rounded mb-2"></div>
                <div className="h-4 bg-muted rounded"></div>
              </Card>
            ))
          ) : recentSessions.length > 0 ? (
            recentSessions.map((session, index) => (
              <Card key={index} className="glass glass-hover p-4 cursor-pointer animate-slide-up" style={{animationDelay: `${index * 0.1}s`}}>
                <div className="flex items-center justify-between mb-3">
                  <Badge variant="outline" className="text-xs">{session.date}</Badge>
                  <div className="text-2xl font-bold text-primary">{session.score}%</div>
                </div>
                <h4 className="font-medium text-foreground mb-2">{session.type}</h4>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>{session.duration}</span>
                  <span>{session.distance}</span>
                </div>
              </Card>
            ))
          ) : (
            <Card className="glass p-6 col-span-full text-center">
              <p className="text-muted-foreground">Nenhuma sessão encontrada. Conecte-se ao Strava para sincronizar suas atividades.</p>
              <Button 
                variant="glass" 
                className="mt-4"
                onClick={() => navigate('/strava')}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Conectar Strava
              </Button>
            </Card>
          )}
        </div>
      </Card>
    </div>
  );
};

export default Dashboard;

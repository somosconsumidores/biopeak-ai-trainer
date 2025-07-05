import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, Settings, User, ChartBar } from "lucide-react";

interface BioPeakLandingProps {
  onEnterApp: () => void;
}

const BioPeakLanding = ({ onEnterApp }: BioPeakLandingProps) => {
  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Particle Background Effect */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-20 left-20 w-2 h-2 bg-primary rounded-full animate-float"></div>
        <div className="absolute top-40 right-32 w-1 h-1 bg-primary/70 rounded-full animate-float" style={{animationDelay: '1s'}}></div>
        <div className="absolute bottom-40 left-16 w-1.5 h-1.5 bg-primary/50 rounded-full animate-float" style={{animationDelay: '2s'}}></div>
        <div className="absolute bottom-60 right-20 w-1 h-1 bg-primary/80 rounded-full animate-float" style={{animationDelay: '0.5s'}}></div>
      </div>

      {/* Header */}
      <header className="container mx-auto px-6 py-8">
        <nav className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <img src="/lovable-uploads/6dd7da64-0e29-4226-8bb4-99185306e197.png" alt="BioPeak" className="h-10 w-auto" />
            <span className="text-2xl font-bold text-foreground">BioPeak</span>
          </div>
          <div className="hidden md:flex items-center space-x-6">
            <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">Recursos</a>
            <a href="#how-it-works" className="text-muted-foreground hover:text-foreground transition-colors">Como Funciona</a>
            <Button variant="glass" size="sm">Entrar</Button>
            <Button variant="hero" size="sm">Começar Grátis</Button>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-6 py-20 text-center">
        <div className="max-w-4xl mx-auto animate-fade-in">
          <Badge className="mb-6 glass border-primary/50 text-primary">
            🚀 Powered by AI • Conecta com Garmin
          </Badge>
          <h1 className="text-5xl md:text-7xl font-black mb-6 bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">
            Transforme seus treinos em estratégia
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-3xl mx-auto leading-relaxed">
            BioPeak usa inteligência artificial para analisar seus dados de treino Garmin e entregar insights que realmente fazem você evoluir. Porque treino é físico, mas evolução é nos dados.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
            <Button variant="hero" size="lg" className="min-w-48" onClick={onEnterApp}>
              <Activity className="w-5 h-5 mr-2" />
              Começar Agora
            </Button>
            <Button variant="glass" size="lg" onClick={onEnterApp}>
              Ver Demo
            </Button>
          </div>
        </div>

        {/* Hero Dashboard Preview */}
        <div className="max-w-6xl mx-auto animate-slide-up" style={{animationDelay: '0.3s'}}>
          <Card className="glass p-1">
            <div className="bg-gradient-to-br from-muted/20 to-muted/5 rounded-lg p-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="glass p-6 text-left">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-foreground">Pico de Performance</h3>
                    <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center">
                      <Activity className="w-6 h-6 text-primary" />
                    </div>
                  </div>
                  <div className="text-3xl font-bold text-primary mb-2">94.2%</div>
                  <p className="text-muted-foreground text-sm">+12% vs semana anterior</p>
                </Card>
                
                <Card className="glass p-6 text-left">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-foreground">VO2 Max Trend</h3>
                    <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center">
                      <ChartBar className="w-6 h-6 text-primary" />
                    </div>
                  </div>
                  <div className="text-3xl font-bold text-primary mb-2">52.1</div>
                  <p className="text-muted-foreground text-sm">Melhor zona: 5k-10k</p>
                </Card>
                
                <Card className="glass p-6 text-left">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-foreground">AI Insight</h3>
                    <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center">
                      <Settings className="w-6 h-6 text-primary" />
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">Sua recuperação está 15% acima do ideal. Considere treinos de baixa intensidade.</p>
                </Card>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="container mx-auto px-6 py-20">
        <div className="text-center mb-16 animate-fade-in">
          <h2 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">
            Recursos Inteligentes
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Cada recurso foi pensado para maximizar seu potencial atlético através da ciência de dados
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              icon: Activity,
              title: "Análise AI de Treinos",
              description: "IA analisa cada sessão e identifica padrões de melhoria"
            },
            {
              icon: ChartBar,
              title: "Comparativo Inteligente",
              description: "Compare treinos e identifique progressos ou regressões"
            },
            {
              icon: Settings,
              title: "Insights Personalizados",
              description: "Sugestões semanais baseadas no seu perfil único"
            },
            {
              icon: User,
              title: "Perfil Completo",
              description: "Histórico detalhado e metas baseadas em benchmarks"
            }
          ].map((feature, index) => (
            <Card key={index} className="glass glass-hover p-6 text-center animate-slide-up" style={{animationDelay: `${index * 0.1 + 0.5}s`}}>
              <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <feature.icon className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-3">{feature.title}</h3>
              <p className="text-muted-foreground text-sm">{feature.description}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-6 py-20 text-center">
        <Card className="glass p-12 max-w-4xl mx-auto animate-fade-in">
          <h2 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">
            Pronto para evoluir?
          </h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Conecte seu Garmin e descubra insights que você nunca imaginou sobre seus treinos
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button variant="hero" size="lg" className="min-w-48" onClick={onEnterApp}>
              <Activity className="w-5 h-5 mr-2" />
              Conectar Garmin
            </Button>
            <Button variant="glass" size="lg" onClick={onEnterApp}>
              Saber Mais
            </Button>
          </div>
        </Card>
      </section>

      {/* Footer */}
      <footer className="container mx-auto px-6 py-12 border-t border-primary/20">
        <div className="flex flex-col md:flex-row items-center justify-between">
          <div className="flex items-center space-x-3 mb-4 md:mb-0">
            <img src="/lovable-uploads/6dd7da64-0e29-4226-8bb4-99185306e197.png" alt="BioPeak" className="h-8 w-auto" />
            <span className="text-lg font-bold text-foreground">BioPeak</span>
          </div>
          <p className="text-muted-foreground text-sm">
            © 2024 BioPeak. Transformando dados em performance.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default BioPeakLanding;
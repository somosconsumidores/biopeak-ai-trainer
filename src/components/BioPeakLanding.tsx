import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, Settings, User, ChartBar } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import ThemeToggle from "@/components/ui/theme-toggle";

interface BioPeakLandingProps {
  onEnterApp: () => void;
}

const BioPeakLanding = ({ onEnterApp }: BioPeakLandingProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
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
      <header className="container mx-auto px-4 sm:px-6 py-4 sm:py-8">
        <nav className="flex items-center justify-between">
          <div className="flex items-center space-x-2 sm:space-x-3">
            <img src="/lovable-uploads/6dd7da64-0e29-4226-8bb4-99185306e197.png" alt="BioPeak" className="h-8 sm:h-10 w-auto" />
            <span className="text-xl sm:text-2xl font-bold text-foreground">BioPeak</span>
          </div>
          
          {/* Mobile menu button for small screens */}
          <div className="md:hidden flex items-center space-x-2">
            <ThemeToggle />
            {user ? (
              <Button variant="hero" size="sm" onClick={onEnterApp} className="text-xs">App</Button>
            ) : (
              <Button variant="hero" size="sm" onClick={() => navigate('/auth')} className="text-xs">Entrar</Button>
            )}
          </div>
          
          {/* Desktop menu */}
          <div className="hidden md:flex items-center space-x-6">
            <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">Recursos</a>
            <a href="#how-it-works" className="text-muted-foreground hover:text-foreground transition-colors">Como Funciona</a>
            <ThemeToggle />
            {user ? (
              <Button variant="hero" size="sm" onClick={onEnterApp}>Dashboard</Button>
            ) : (
              <>
                <Button variant="glass" size="sm" onClick={() => navigate('/auth')}>Entrar</Button>
                <Button variant="hero" size="sm" onClick={() => navigate('/auth')}>Começar Grátis</Button>
              </>
            )}
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 sm:px-6 py-12 sm:py-20 text-center">
        <div className="max-w-4xl mx-auto animate-fade-in">
          <Badge className="mb-4 sm:mb-6 glass border-primary/50 text-primary text-xs sm:text-sm">
            🚀 Powered by AI • Conecta com Strava & Garmin
          </Badge>
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-black mb-4 sm:mb-6 bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent leading-tight">
            Transforme seus treinos em estratégia
          </h1>
          <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-muted-foreground mb-6 sm:mb-8 max-w-3xl mx-auto leading-relaxed px-2">
            BioPeak usa inteligência artificial para analisar seus dados de treino do Strava e Garmin Connect, entregando insights que realmente fazem você evoluir. Porque treino é físico, mas evolução é nos dados.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:gap-4 justify-center items-center mb-8 sm:mb-12 px-4">
            {user ? (
              <Button variant="hero" size="lg" className="w-full sm:min-w-48 sm:w-auto h-12 sm:h-auto" onClick={onEnterApp}>
                <Activity className="w-5 h-5 mr-2" />
                Acessar Dashboard
              </Button>
            ) : (
              <Button variant="hero" size="lg" className="w-full sm:min-w-48 sm:w-auto h-12 sm:h-auto" onClick={() => navigate('/auth')}>
                <Activity className="w-5 h-5 mr-2" />
                Começar Agora
              </Button>
            )}
            <Button variant="glass" size="lg" className="w-full sm:w-auto h-12 sm:h-auto" onClick={onEnterApp}>
              Ver Demo
            </Button>
          </div>
        </div>

        {/* Hero Dashboard Preview */}
        <div className="max-w-6xl mx-auto animate-slide-up px-2" style={{animationDelay: '0.3s'}}>
          <Card className="glass p-1">
            <div className="bg-gradient-to-br from-muted/20 to-muted/5 rounded-lg p-4 sm:p-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
                <Card className="glass p-4 sm:p-6 text-left">
                  <div className="flex items-center justify-between mb-3 sm:mb-4">
                    <h3 className="font-semibold text-foreground text-sm sm:text-base">Pico de Performance</h3>
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary/20 rounded-full flex items-center justify-center">
                      <Activity className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                    </div>
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold text-primary mb-1 sm:mb-2">94.2%</div>
                  <p className="text-muted-foreground text-xs sm:text-sm">+12% vs semana anterior</p>
                </Card>
                
                <Card className="glass p-4 sm:p-6 text-left">
                  <div className="flex items-center justify-between mb-3 sm:mb-4">
                    <h3 className="font-semibold text-foreground text-sm sm:text-base">VO2 Max Trend</h3>
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary/20 rounded-full flex items-center justify-center">
                      <ChartBar className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                    </div>
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold text-primary mb-1 sm:mb-2">52.1</div>
                  <p className="text-muted-foreground text-xs sm:text-sm">Melhor zona: 5k-10k</p>
                </Card>
                
                <Card className="glass p-4 sm:p-6 text-left sm:col-span-2 md:col-span-1">
                  <div className="flex items-center justify-between mb-3 sm:mb-4">
                    <h3 className="font-semibold text-foreground text-sm sm:text-base">AI Insight</h3>
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary/20 rounded-full flex items-center justify-center">
                      <Settings className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                    </div>
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Sua recuperação está 15% acima do ideal. Considere treinos de baixa intensidade.</p>
                </Card>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="container mx-auto px-4 sm:px-6 py-12 sm:py-20">
        <div className="text-center mb-12 sm:mb-16 animate-fade-in">
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-4 sm:mb-6 text-foreground">
            Recursos Inteligentes
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto px-4">
            Cada recurso foi pensado para maximizar seu potencial atlético através da ciência de dados
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
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
            <Card key={index} className="glass glass-hover p-4 sm:p-6 text-center animate-slide-up" style={{animationDelay: `${index * 0.1 + 0.5}s`}}>
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <feature.icon className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
              </div>
              <h3 className="text-base sm:text-lg font-semibold text-foreground mb-2 sm:mb-3">{feature.title}</h3>
              <p className="text-muted-foreground text-xs sm:text-sm">{feature.description}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 sm:px-6 py-12 sm:py-20 text-center">
        <Card className="glass p-6 sm:p-8 md:p-12 max-w-4xl mx-auto animate-fade-in">
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-4 sm:mb-6 text-foreground">
            Pronto para evoluir?
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-muted-foreground mb-6 sm:mb-8 max-w-2xl mx-auto px-2">
            Conecte seu Strava ou Garmin Connect e descubra insights que você nunca imaginou sobre seus treinos
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:gap-4 justify-center">
            {user ? (
              <Button variant="hero" size="lg" className="w-full sm:min-w-48 sm:w-auto h-12 sm:h-auto" onClick={onEnterApp}>
                <Activity className="w-5 h-5 mr-2" />
                Conectar Plataformas
              </Button>
            ) : (
              <Button variant="hero" size="lg" className="w-full sm:min-w-48 sm:w-auto h-12 sm:h-auto" onClick={() => navigate('/auth')}>
                <Activity className="w-5 h-5 mr-2" />
                Começar Agora
              </Button>
            )}
            <Button variant="glass" size="lg" className="w-full sm:w-auto h-12 sm:h-auto" onClick={onEnterApp}>
              Saber Mais
            </Button>
          </div>
        </Card>
      </section>

      {/* Footer */}
      <footer className="container mx-auto px-4 sm:px-6 py-8 sm:py-12 border-t border-primary/20">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <img src="/lovable-uploads/6dd7da64-0e29-4226-8bb4-99185306e197.png" alt="BioPeak" className="h-6 sm:h-8 w-auto" />
            <span className="text-base sm:text-lg font-bold text-foreground">BioPeak</span>
          </div>
          
          <div className="flex flex-col md:flex-row items-center gap-4">
            <Link 
              to="/privacy-policy" 
              className="text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Política de Privacidade
            </Link>
            <p className="text-muted-foreground text-xs sm:text-sm text-center">
              © 2024 BioPeak. Transformando dados em performance.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default BioPeakLanding;
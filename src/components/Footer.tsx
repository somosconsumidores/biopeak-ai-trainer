import { Link } from "react-router-dom";

const Footer = () => {
  console.log('[Footer] Footer component rendering');
  
  return (
    <footer className="border-t border-border/50 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 mt-auto">
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          <div className="text-sm text-muted-foreground">
            © 2024 BioPeak. Todos os direitos reservados.
          </div>
          
          <div className="flex items-center space-x-6">
            <Link 
              to="/privacy-policy" 
              className="text-sm text-muted-foreground hover:text-foreground transition-colors underline"
            >
              Política de Privacidade
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
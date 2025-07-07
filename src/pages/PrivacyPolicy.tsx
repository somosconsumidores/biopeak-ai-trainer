import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const PrivacyPolicy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
        </div>

        <Card className="glass p-8">
          <h1 className="text-3xl font-bold text-foreground mb-6">
            Política de Privacidade do BioPeak
          </h1>

          <div className="space-y-6 text-foreground">
            <section>
              <h2 className="text-2xl font-semibold mb-4">Introdução</h2>
              <p className="text-muted-foreground leading-relaxed">
                Esta Política de Privacidade descreve como o BioPeak coleta, utiliza, compartilha e protege suas informações pessoais. Também explica os seus direitos e as opções disponíveis para controlar a sua privacidade. Ao utilizar o BioPeak, você concorda com os termos aqui descritos. Recomendamos também a leitura dos nossos [Termos de Uso], que regulam o uso dos nossos serviços.
              </p>
              <p className="text-muted-foreground leading-relaxed mt-4">
                O BioPeak é um aplicativo voltado para o monitoramento e aprimoramento da performance esportiva com base em dados biométricos. Nós levamos a sua privacidade a sério e adotamos medidas para protegê-la.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">Resumo de Privacidade</h2>
              
              <h3 className="text-xl font-medium mb-3">Coleta, uso e compartilhamento de dados</h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-border rounded-lg">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="border border-border p-3 text-left font-medium">Declaração</th>
                      <th className="border border-border p-3 text-left font-medium">Resposta</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    <tr>
                      <td className="border border-border p-3">Vendemos suas informações pessoais por valor monetário?</td>
                      <td className="border border-border p-3 font-medium text-green-400">Não</td>
                    </tr>
                    <tr>
                      <td className="border border-border p-3">Vendemos informações agregadas por valor monetário?</td>
                      <td className="border border-border p-3 font-medium text-green-400">Não</td>
                    </tr>
                    <tr>
                      <td className="border border-border p-3">Compartilhamos suas informações pessoais com terceiros que não sejam prestadores de serviços?</td>
                      <td className="border border-border p-3 font-medium text-yellow-400">Sim, com o seu consentimento</td>
                    </tr>
                    <tr>
                      <td className="border border-border p-3">Compartilhamos suas informações pessoais para publicidade direcionada?</td>
                      <td className="border border-border p-3 font-medium text-yellow-400">Sim, com o seu consentimento</td>
                    </tr>
                    <tr>
                      <td className="border border-border p-3">Usamos categorias de dados confidenciais, como informações de saúde?</td>
                      <td className="border border-border p-3 font-medium text-yellow-400">Sim, com o seu consentimento</td>
                    </tr>
                    <tr>
                      <td className="border border-border p-3">Oferecemos proteções de privacidade adicionais para menores de idade (usuários menores de 18 anos)?</td>
                      <td className="border border-border p-3 font-medium text-green-400">Sim</td>
                    </tr>
                    <tr>
                      <td className="border border-border p-3">Usamos sua lista de contatos?</td>
                      <td className="border border-border p-3 font-medium text-yellow-400">Sim, com o seu consentimento</td>
                    </tr>
                    <tr>
                      <td className="border border-border p-3">Excluímos suas informações pessoais quando você solicita a exclusão da conta?</td>
                      <td className="border border-border p-3 font-medium text-green-400">Sim, a menos que necessário por lei</td>
                    </tr>
                    <tr>
                      <td className="border border-border p-3">Reteremos seus dados após a exclusão da conta?</td>
                      <td className="border border-border p-3 font-medium text-green-400">Não, exceto se exigido por lei</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h3 className="text-xl font-medium mb-3">Controles de Privacidade</h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-border rounded-lg">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="border border-border p-3 text-left font-medium">Declaração</th>
                      <th className="border border-border p-3 text-left font-medium">Resposta</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    <tr>
                      <td className="border border-border p-3">Você pode controlar quem vê sua atividade e conteúdo?</td>
                      <td className="border border-border p-3 font-medium text-green-400">Sim</td>
                    </tr>
                    <tr>
                      <td className="border border-border p-3">Você pode controlar quem vê sua atividade baseada em localização?</td>
                      <td className="border border-border p-3 font-medium text-green-400">Sim</td>
                    </tr>
                    <tr>
                      <td className="border border-border p-3">Seus controles de privacidade de atividade e perfil são públicos (definidos como "Todos") por padrão?</td>
                      <td className="border border-border p-3 font-medium text-yellow-400">Sim, se tiver 18 anos ou mais</td>
                    </tr>
                    <tr>
                      <td className="border border-border p-3">Você pode baixar e excluir suas informações pessoais?</td>
                      <td className="border border-border p-3 font-medium text-green-400">Sim</td>
                    </tr>
                    <tr>
                      <td className="border border-border p-3">Todos os usuários têm o mesmo conjunto de controles de privacidade?</td>
                      <td className="border border-border p-3 font-medium text-green-400">Sim</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h3 className="text-xl font-medium mb-3">Rastreamento e Cookies</h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-border rounded-lg">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="border border-border p-3 text-left font-medium">Declaração</th>
                      <th className="border border-border p-3 text-left font-medium">Resposta</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    <tr>
                      <td className="border border-border p-3">Rastrearemos a localização do seu dispositivo enquanto você não estiver usando o app?</td>
                      <td className="border border-border p-3 font-medium text-green-400">Não</td>
                    </tr>
                    <tr>
                      <td className="border border-border p-3">Rastrearemos a localização do seu dispositivo para oferecer os serviços do BioPeak?</td>
                      <td className="border border-border p-3 font-medium text-yellow-400">Sim, com o seu consentimento</td>
                    </tr>
                    <tr>
                      <td className="border border-border p-3">Usamos cookies e tecnologias semelhantes não essenciais?</td>
                      <td className="border border-border p-3 font-medium text-yellow-400">Sim, com o seu consentimento</td>
                    </tr>
                    <tr>
                      <td className="border border-border p-3">Rastrearemos suas atividades de navegação em outros sites?</td>
                      <td className="border border-border p-3 font-medium text-green-400">Não</td>
                    </tr>
                    <tr>
                      <td className="border border-border p-3">Ouvimos você usando o microfone do dispositivo?</td>
                      <td className="border border-border p-3 font-medium text-green-400">Não</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h3 className="text-xl font-medium mb-3">Comunicação com Usuários</h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-border rounded-lg">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="border border-border p-3 text-left font-medium">Declaração</th>
                      <th className="border border-border p-3 text-left font-medium">Resposta</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    <tr>
                      <td className="border border-border p-3">Avisaremos antes de fazer alterações importantes nesta Política de Privacidade?</td>
                      <td className="border border-border p-3 font-medium text-green-400">Sim</td>
                    </tr>
                    <tr>
                      <td className="border border-border p-3">Enviaremos comunicações de marketing para você?</td>
                      <td className="border border-border p-3 font-medium text-yellow-400">Sim, exceto se recusado ou mediante consentimento expresso</td>
                    </tr>
                    <tr>
                      <td className="border border-border p-3">Enviaremos notificações push em dispositivos móveis?</td>
                      <td className="border border-border p-3 font-medium text-yellow-400">Sim, com o seu consentimento</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">Contato</h2>
              <p className="text-muted-foreground leading-relaxed">
                Se você tiver dúvidas sobre esta Política de Privacidade ou quiser exercer seus direitos de privacidade, entre em contato com nossa equipe de suporte através do e-mail: relacionamento@consumo-inteligente.com
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">Atualizações</h2>
              <p className="text-muted-foreground leading-relaxed">
                Esta Política poderá ser atualizada periodicamente. Caso façamos mudanças significativas, você será informado por meio do aplicativo ou por outros meios apropriados.
              </p>
            </section>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
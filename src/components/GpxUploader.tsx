import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Upload, FileText, Loader2 } from 'lucide-react';
import { useGpxParser, type GpxData } from '@/hooks/useGpxParser';
import { useToast } from '@/hooks/use-toast';

interface GpxUploaderProps {
  onGpxParsed: (data: GpxData) => void;
}

const GpxUploader = ({ onGpxParsed }: GpxUploaderProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const { parseGpxFile, isLoading, error } = useGpxParser();
  const { toast } = useToast();

  const handleFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.gpx')) {
      toast({
        title: "Formato inválido",
        description: "Por favor, selecione um arquivo GPX válido.",
        variant: "destructive"
      });
      return;
    }

    const gpxData = await parseGpxFile(file);
    if (gpxData) {
      onGpxParsed(gpxData);
      toast({
        title: "Arquivo processado!",
        description: `Treino "${gpxData.name}" importado com sucesso.`,
      });
    } else if (error) {
      toast({
        title: "Erro no processamento",
        description: error,
        variant: "destructive"
      });
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  return (
    <Card className="glass p-6 border-2 border-dashed border-primary/30 hover:border-primary/50 transition-colors">
      <div
        className={`text-center ${dragActive ? 'bg-primary/5' : ''} rounded-lg p-4 transition-colors`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center space-y-4">
          <div className="p-4 bg-primary/20 rounded-full">
            {isLoading ? (
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            ) : (
              <Upload className="w-8 h-8 text-primary" />
            )}
          </div>
          
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Importar Arquivo GPX
            </h3>
            <p className="text-muted-foreground text-sm mb-4">
              Arraste seu arquivo GPX aqui ou clique para selecionar
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="hero"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="gap-2"
            >
              <FileText className="w-4 h-4" />
              Selecionar Arquivo
            </Button>
          </div>

          <Input
            ref={fileInputRef}
            type="file"
            accept=".gpx"
            onChange={handleInputChange}
            className="hidden"
          />

          <p className="text-xs text-muted-foreground">
            Suporte para arquivos GPX do Garmin, Strava, e outros dispositivos
          </p>
        </div>
      </div>
    </Card>
  );
};

export default GpxUploader;
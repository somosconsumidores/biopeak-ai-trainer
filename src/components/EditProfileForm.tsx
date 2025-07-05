import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { X, Save } from "lucide-react";

const profileSchema = z.object({
  display_name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  birth_date: z.string().optional(),
  height: z.string().optional(),
  weight: z.string().optional(),
  bio: z.string().optional(),
  sport_preferences: z.string().optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

interface EditProfileFormProps {
  onClose: () => void;
}

const EditProfileForm = ({ onClose }: EditProfileFormProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [calculatedAge, setCalculatedAge] = useState<number | null>(null);
  const [calculatedBMI, setCalculatedBMI] = useState<number | null>(null);

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      display_name: "",
      birth_date: "",
      height: "",
      weight: "",
      bio: "",
      sport_preferences: "",
    },
  });

  const { watch } = form;
  const watchedBirthDate = watch("birth_date");
  const watchedHeight = watch("height");
  const watchedWeight = watch("weight");

  // Calculate age automatically
  useEffect(() => {
    if (watchedBirthDate) {
      const birthDate = new Date(watchedBirthDate);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      
      setCalculatedAge(age > 0 ? age : null);
    } else {
      setCalculatedAge(null);
    }
  }, [watchedBirthDate]);

  // Calculate BMI automatically
  useEffect(() => {
    if (watchedHeight && watchedWeight) {
      const height = parseFloat(watchedHeight);
      const weight = parseFloat(watchedWeight);
      
      if (height > 0 && weight > 0) {
        const heightInMeters = height / 100;
        const bmi = weight / (heightInMeters * heightInMeters);
        setCalculatedBMI(Math.round(bmi * 10) / 10);
      } else {
        setCalculatedBMI(null);
      }
    } else {
      setCalculatedBMI(null);
    }
  }, [watchedHeight, watchedWeight]);

  // Load existing profile data
  useEffect(() => {
    const loadProfile = async () => {
      if (!user) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error loading profile:", error);
        return;
      }

      if (data) {
        form.reset({
          display_name: data.display_name || "",
          birth_date: data.birth_date || "",
          height: data.height?.toString() || "",
          weight: data.weight?.toString() || "",
          bio: data.bio || "",
          sport_preferences: data.sport_preferences?.join(", ") || "",
        });
      }
    };

    loadProfile();
  }, [user, form]);

  const onSubmit = async (data: ProfileFormData) => {
    if (!user) return;

    setLoading(true);
    try {
      const profileData = {
        user_id: user.id,
        display_name: data.display_name,
        birth_date: data.birth_date || null,
        height: data.height ? parseFloat(data.height) : null,
        weight: data.weight ? parseFloat(data.weight) : null,
        bio: data.bio || null,
        sport_preferences: data.sport_preferences 
          ? data.sport_preferences.split(",").map(s => s.trim()).filter(s => s.length > 0)
          : null,
      };

      const { error } = await supabase
        .from("profiles")
        .upsert(profileData, { onConflict: "user_id" });

      if (error) throw error;

      toast({
        title: "Perfil atualizado",
        description: "Suas informações foram salvas com sucesso.",
      });

      onClose();
    } catch (error) {
      console.error("Error updating profile:", error);
      toast({
        title: "Erro",
        description: "Erro ao salvar perfil. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="glass w-full max-w-lg max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between p-6 border-b border-border/50">
          <h2 className="text-xl font-semibold text-foreground">Editar Perfil</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="p-6 space-y-4">
            <FormField
              control={form.control}
              name="display_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl>
                    <Input placeholder="Seu nome completo" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="birth_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data de Nascimento</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  {calculatedAge && (
                    <p className="text-sm text-muted-foreground">
                      Idade: {calculatedAge} anos
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="height"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Altura (cm)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="175" 
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="weight"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Peso (kg)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="70" 
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {calculatedBMI && (
              <div className="glass p-3 rounded-lg">
                <p className="text-sm text-muted-foreground">IMC Calculado:</p>
                <p className="text-lg font-semibold text-primary">{calculatedBMI}</p>
                <p className="text-xs text-muted-foreground">
                  {calculatedBMI < 18.5 ? "Abaixo do peso" :
                   calculatedBMI < 25 ? "Peso normal" :
                   calculatedBMI < 30 ? "Sobrepeso" : "Obesidade"}
                </p>
              </div>
            )}

            <FormField
              control={form.control}
              name="sport_preferences"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Modalidades (separadas por vírgula)</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Corrida, Ciclismo, Natação" 
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="bio"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Biografia</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Conte um pouco sobre você e seus objetivos..."
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-3 pt-4">
              <Button 
                type="button" 
                variant="ghost" 
                onClick={onClose}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={loading}
                className="flex-1"
              >
                <Save className="w-4 h-4 mr-2" />
                {loading ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </form>
        </Form>
      </Card>
    </div>
  );
};

export default EditProfileForm;
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Vo2MaxRecord {
  id: string;
  user_id: string;
  vo2_max_value: number;
  measurement_date: string;
  created_at: string;
  updated_at: string;
}

export const useGarminVo2Max = () => {
  return useQuery({
    queryKey: ['garmin-vo2-max'],
    queryFn: async (): Promise<Vo2MaxRecord[]> => {
      console.log('[useGarminVo2Max] Fetching VO2 Max data...');
      
      const { data, error } = await supabase
        .from('garmin_vo2_max')
        .select('*')
        .order('measurement_date', { ascending: false });

      if (error) {
        console.error('[useGarminVo2Max] Error fetching VO2 Max data:', error);
        throw error;
      }

      console.log(`[useGarminVo2Max] Fetched ${data?.length || 0} VO2 Max records`);
      return data || [];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
  });
};

export const useLatestVo2Max = () => {
  const { data: vo2MaxRecords, ...rest } = useGarminVo2Max();
  
  const latestVo2Max = vo2MaxRecords?.[0]?.vo2_max_value || null;
  
  console.log('[useLatestVo2Max] Latest VO2 Max:', latestVo2Max);
  
  return {
    ...rest,
    data: latestVo2Max,
    vo2MaxRecords
  };
};
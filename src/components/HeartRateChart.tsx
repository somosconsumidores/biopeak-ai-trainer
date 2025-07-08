import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface HeartRateChartProps {
  heartRateData: number[];
  title?: string;
}

export const HeartRateChart = ({ heartRateData, title = "Frequência Cardíaca" }: HeartRateChartProps) => {
  // Convert heart rate array to chart data format
  const chartData = heartRateData.map((hr, index) => ({
    time: index, // Time in seconds or data points
    heartRate: hr
  }));

  if (!heartRateData || heartRateData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Dados de frequência cardíaca não disponíveis</p>
        </CardContent>
      </Card>
    );
  }

  const avgHeartRate = Math.round(heartRateData.reduce((a, b) => a + b, 0) / heartRateData.length);
  const maxHeartRate = Math.max(...heartRateData);
  const minHeartRate = Math.min(...heartRateData);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <div className="flex gap-4 text-sm text-muted-foreground">
          <span>Média: {avgHeartRate} bpm</span>
          <span>Máxima: {maxHeartRate} bpm</span>
          <span>Mínima: {minHeartRate} bpm</span>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="time" 
              type="number"
              scale="linear"
              domain={['dataMin', 'dataMax']}
              tickFormatter={(value) => `${Math.round(value / 60)}min`}
            />
            <YAxis 
              domain={['dataMin - 10', 'dataMax + 10']}
              label={{ value: 'BPM', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip 
              formatter={(value: number) => [`${value} bpm`, 'Frequência Cardíaca']}
              labelFormatter={(value: number) => `Tempo: ${Math.round(value / 60)}:${String(value % 60).padStart(2, '0')}`}
            />
            <Line 
              type="monotone" 
              dataKey="heartRate" 
              stroke="hsl(var(--primary))" 
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
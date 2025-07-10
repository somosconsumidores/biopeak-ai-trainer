import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calendar, Filter, Search, ChevronLeft, ChevronRight, Activity, Clock, MapPin, Heart, ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { formatDistance, formatTime } from "@/utils/stravaUtils";
import { useUnifiedActivities } from "@/hooks/useUnifiedActivities";

interface SessionFilters {
  activityType: string;
  dateFrom: string;
  dateTo: string;
  keyword: string;
  source: string;
}

const Sessions = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { activities, loading, totalCount, activityTypes, loadActivities } = useUnifiedActivities();
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState<SessionFilters>({
    activityType: 'all',
    dateFrom: '',
    dateTo: '',
    keyword: '',
    source: 'all'
  });

  const pageSize = 50;
  const totalPages = Math.ceil(totalCount / pageSize);

  const handleLoadActivities = (page = 1, currentFilters = filters) => {
    loadActivities(page, pageSize, currentFilters);
    setCurrentPage(page);
  };

  const applyFilters = () => {
    handleLoadActivities(1, filters);
  };

  const clearFilters = () => {
    const emptyFilters = {
      activityType: 'all',
      dateFrom: '',
      dateTo: '',
      keyword: '',
      source: 'all'
    };
    setFilters(emptyFilters);
    handleLoadActivities(1, emptyFilters);
  };

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      handleLoadActivities(page);
    }
  };

  useEffect(() => {
    if (user) {
      handleLoadActivities();
    }
  }, [user]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
              className="p-2"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Sessões de Treino</h1>
              <p className="text-muted-foreground">
                {totalCount > 0 ? `${totalCount} atividades encontradas` : 'Nenhuma atividade encontrada'}
              </p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <Card className="glass p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
            {/* Source Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Fonte</label>
              <Select value={filters.source} onValueChange={(value) => setFilters(prev => ({ ...prev, source: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas as fontes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as fontes</SelectItem>
                  <SelectItem value="strava">Strava</SelectItem>
                  <SelectItem value="garmin">Garmin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Activity Type Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Tipo de Atividade</label>
              <Select value={filters.activityType} onValueChange={(value) => setFilters(prev => ({ ...prev, activityType: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os tipos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  {activityTypes.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date From Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Data de Início</label>
              <Input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
              />
            </div>

            {/* Date To Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Data Final</label>
              <Input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
              />
            </div>

            {/* Keyword Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Palavra-chave</label>
              <Input
                placeholder="Buscar por nome..."
                value={filters.keyword}
                onChange={(e) => setFilters(prev => ({ ...prev, keyword: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={applyFilters} size="sm">
              <Filter className="w-4 h-4 mr-2" />
              Filtrar
            </Button>
            <Button variant="outline" onClick={clearFilters} size="sm">
              <Search className="w-4 h-4 mr-2" />
              Limpar Filtros
            </Button>
          </div>
        </Card>

        {/* Activities List */}
        {loading ? (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="space-y-4">
            {activities.map((activity) => (
              <Card key={activity.id} className="glass p-6 hover:border-primary/40 transition-colors">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Activity className="w-5 h-5 text-primary" />
                      <h3 className="text-lg font-semibold text-foreground">{activity.name}</h3>
                      <Badge variant="outline">{activity.type}</Badge>
                      <Badge 
                        variant={activity.source === 'strava' ? 'default' : 'secondary'}
                        className={activity.source === 'strava' ? 'bg-orange-500/20 text-orange-400' : 'bg-blue-500/20 text-blue-400'}
                      >
                        {activity.source === 'strava' ? 'Strava' : 'Garmin'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{formatDate(activity.start_date)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {activity.distance && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Distância</p>
                        <p className="font-medium text-foreground">{formatDistance(activity.distance)}</p>
                      </div>
                    </div>
                  )}

                  {activity.moving_time && (
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Tempo</p>
                        <p className="font-medium text-foreground">{formatTime(activity.moving_time)}</p>
                      </div>
                    </div>
                  )}

                  {activity.average_speed && (
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Vel. Média</p>
                        <p className="font-medium text-foreground">{(activity.average_speed * 3.6).toFixed(1)} km/h</p>
                      </div>
                    </div>
                  )}

                  {activity.average_heartrate && (
                    <div className="flex items-center gap-2">
                      <Heart className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">FC Média</p>
                        <p className="font-medium text-foreground">{activity.average_heartrate} bpm</p>
                      </div>
                    </div>
                  )}

                  {activity.total_elevation_gain && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Elevação</p>
                        <p className="font-medium text-foreground">{Math.round(activity.total_elevation_gain)}m</p>
                      </div>
                    </div>
                  )}

                  {activity.calories && (
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Calorias</p>
                        <p className="font-medium text-foreground">{Math.round(activity.calories)}</p>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            ))}

            {activities.length === 0 && !loading && (
              <Card className="glass p-8 text-center">
                <Activity className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">Nenhuma atividade encontrada</h3>
                <p className="text-muted-foreground">
                  {totalCount === 0 
                    ? "Sincronize suas atividades do Strava ou Garmin para vê-las aqui."
                    : "Tente ajustar os filtros para encontrar suas atividades."
                  }
                </p>
              </Card>
            )}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <Card className="glass p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Página {currentPage} de {totalPages} ({totalCount} atividades)
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Anterior
                </Button>
                
                {/* Page numbers */}
                <div className="flex gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const pageNumber = Math.max(1, currentPage - 2) + i;
                    if (pageNumber > totalPages) return null;
                    
                    return (
                      <Button
                        key={pageNumber}
                        variant={pageNumber === currentPage ? "default" : "outline"}
                        size="sm"
                        onClick={() => goToPage(pageNumber)}
                        className="w-8 h-8 p-0"
                      >
                        {pageNumber}
                      </Button>
                    );
                  })}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  Próxima
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Sessions;
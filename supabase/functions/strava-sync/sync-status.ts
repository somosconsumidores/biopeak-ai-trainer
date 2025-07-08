// Helper function to get last sync info for incremental sync
export async function getLastSyncInfo(supabaseClient: any, userId: string): Promise<{ lastSyncDate: Date | null, totalSynced: number }> {
  const { data: syncStatus } = await supabaseClient
    .from('strava_sync_status')
    .select('last_activity_date, total_activities_synced')
    .eq('user_id', userId)
    .maybeSingle()
  
  return {
    lastSyncDate: syncStatus?.last_activity_date ? new Date(syncStatus.last_activity_date) : null,
    totalSynced: syncStatus?.total_activities_synced || 0
  }
}

// Helper function to update sync status
export async function updateSyncStatus(supabaseClient: any, userId: string, status: string, lastActivityDate?: Date, syncedCount?: number, errorMessage?: string) {
  const updateData: any = {
    sync_status: status,
    last_sync_at: new Date().toISOString()
  }
  
  if (lastActivityDate) updateData.last_activity_date = lastActivityDate.toISOString()
  if (syncedCount !== undefined) updateData.total_activities_synced = syncedCount
  if (errorMessage) updateData.error_message = errorMessage
  
  await supabaseClient
    .from('strava_sync_status')
    .upsert({
      user_id: userId,
      ...updateData
    })
}
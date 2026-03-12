export interface PlatformAgentSyncArgs {
  /** Platform to sync: fuyao or agentcenter. */
  platform_type: "fuyao" | "agentcenter"
  /** If true, overwrite local version cache with current platform list and return "已刷新". */
  force_refresh?: boolean
}

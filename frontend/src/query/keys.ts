export const queryKeys = {
  applications: () => ["applications"] as const,
  investigations: {
    all: () => ["investigations"] as const,
    list: (appId?: string) =>
      ["investigations", appId ?? "global"] as const,
  },
  traces: {
    all: () => ["traces"] as const,
    list: () => ["traces", "list"] as const,
    detail: (traceFileId: string) => ["traces", "detail", traceFileId] as const,
  },
  memoryStatus: {
    byApp: (appId: string) => ["memory-status", appId] as const,
  },
  auth: {
    me: () => ["auth", "me"] as const,
  },
  users: {
    all: () => ["users"] as const,
  },
} as const;

// API configuration utility
export const API_BASE_URL = import.meta.env.VITE_API_URL || "/api/v1";

// Helper function to build API URLs
export const buildApiUrl = (endpoint: string): string => {
  // Remove leading slash from endpoint if present to avoid double slashes
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint.slice(1) : endpoint;
  return `${API_BASE_URL}/${cleanEndpoint}`;
};

// Cluster Info Types
export interface ClusterInfo {
  cluster_name: string;
  status: string;
  launched_at?: number;
  last_use?: string;
  autostop?: number;
  to_down?: boolean;
  resources_str?: string;
  user_info?: any;
}

export interface ClusterTypeInfo {
  cluster_name: string;
  cluster_type: string;
  is_ssh: boolean;
}

export interface JobRecord {
  job_id: number;
  job_name: string;
  username: string;
  submitted_at: number;
  start_at?: number;
  end_at?: number;
  resources: string;
  status: string;
  log_path: string;
}

export interface ClusterInfoResponse {
  cluster: ClusterInfo;
  cluster_type: ClusterTypeInfo;
  platform: any;
  template: any;
  jobs: JobRecord[];
  ssh_node_info?: any;
  cost_info?: {
    total_cost: number;
    duration: number;
    cost_per_hour: number;
    launched_at?: number;
    status?: string;
    cloud?: string;
    region?: string;
  };
}

// Consolidated cluster info API function
export const clusterInfoApi = {
  getClusterInfo: async (clusterName: string): Promise<ClusterInfoResponse> => {
    const response = await apiFetch(
      buildApiUrl(`instances/${clusterName}/info`),
      {
        credentials: "include",
      }
    );
    if (!response.ok) {
      throw new Error("Failed to fetch cluster info");
    }
    return response.json();
  },

  // Fast endpoint - basic cluster info without jobs or cost data
  getBasicInfo: async (
    clusterName: string
  ): Promise<{
    cluster: ClusterInfo;
    cluster_type: ClusterTypeInfo;
    platform: any;
    state: any;
    ssh_node_info?: any;
  }> => {
    const response = await apiFetch(
      buildApiUrl(`instances/${clusterName}/basic-info`),
      {
        credentials: "include",
      }
    );
    if (!response.ok) {
      throw new Error("Failed to fetch cluster basic info");
    }
    return response.json();
  },

  // Get jobs separately
  getJobs: async (clusterName: string): Promise<{ jobs: JobRecord[] }> => {
    const response = await apiFetch(
      buildApiUrl(`instances/${clusterName}/jobs`),
      {
        credentials: "include",
      }
    );
    if (!response.ok) {
      throw new Error("Failed to fetch cluster jobs");
    }
    return response.json();
  },

  // Get cost info separately
  getCostInfo: async (
    clusterName: string
  ): Promise<{
    cost_info?: {
      total_cost: number;
      duration: number;
      cost_per_hour: number;
      launched_at?: number;
      status?: string;
      cloud?: string;
      region?: string;
    };
  }> => {
    const response = await apiFetch(
      buildApiUrl(`instances/${clusterName}/cost-info`),
      {
        credentials: "include",
      }
    );
    if (!response.ok) {
      throw new Error("Failed to fetch cluster cost info");
    }
    return response.json();
  },
};

export const authApi = {
  getOrganizations: async (): Promise<{
    organizations: Array<{ id: string; name: string; object: string }>;
  }> => {
    const response = await apiFetch(buildApiUrl("admin/orgs"), {
      credentials: "include",
    });
    if (!response.ok) {
      throw new Error("Failed to fetch organizations");
    }
    return response.json();
  },

  createOrganization: async (
    name: string,
    domains?: string[]
  ): Promise<{
    id: string;
    name: string;
    domains?: string[];
    object: string;
  }> => {
    const response = await apiFetch(buildApiUrl("admin/orgs"), {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        domains,
      }),
    });
    if (!response.ok) {
      throw new Error("Failed to create organization");
    }
    return response.json();
  },
};

// Read a cookie by name
const getCookie = (name: string): string | null => {
  try {
    const cookies = document.cookie ? document.cookie.split(";") : [];
    for (const c of cookies) {
      const [k, v] = c.split("=");
      if (k && k.trim() === name) {
        return decodeURIComponent((v || "").trim());
      }
    }
  } catch (e) {
    // ignore
  }
  return null;
};

export const apiFetch = async (
  input: RequestInfo,
  init?: RequestInit
): Promise<Response> => {
  const method = (init?.method || "GET").toUpperCase();

  // Default to sending credentials unless explicitly overridden
  const nextInit: RequestInit = {
    ...init,
    credentials: init?.credentials ?? "include",
    headers: {
      ...(init?.headers as Record<string, string>),
    },
  };

  // For mutating requests, mirror CSRF token from cookie to header if present
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    const csrf = getCookie("wos_csrf");
    const headers = (nextInit.headers || {}) as Record<string, string>;
    if (csrf && !headers["x-csrf-token"]) {
      headers["x-csrf-token"] = csrf;
    }
    nextInit.headers = headers;
  }

  const response = await fetch(input, nextInit);
  if (response.status === 401) {
    window.dispatchEvent(new Event("auth-error"));
    throw new Error(`Authentication error: ${response.status}`);
  }
  return response;
};

// Teams API functions
export const teamsApi = {
  listTeams: async (): Promise<{
    teams: Array<{
      id: string;
      name: string;
      organization_id: string;
      created_by: string;
      created_at: string;
      updated_at: string;
      members: Array<{
        user_id: string;
        email?: string;
        first_name?: string;
        last_name?: string;
        profile_picture_url?: string;
      }>;
    }>;
    total_count: number;
  }> => {
    const res = await apiFetch(buildApiUrl("admin/teams/"), {
      credentials: "include",
    });
    if (!res.ok) throw new Error("Failed to fetch teams");
    return res.json();
  },

  updateTeam: async (teamId: string, name: string) => {
    const res = await apiFetch(buildApiUrl(`admin/teams/${teamId}`), {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Failed to update team");
    }
    return res.json();
  },

  createTeam: async (name: string) => {
    const res = await apiFetch(buildApiUrl("admin/teams/"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Failed to create team");
    }
    return res.json();
  },

  deleteTeam: async (teamId: string) => {
    const res = await apiFetch(buildApiUrl(`admin/teams/${teamId}`), {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Failed to delete team");
    }
    return res.json();
  },

  addMember: async (teamId: string, userId: string) => {
    const res = await apiFetch(buildApiUrl(`admin/teams/${teamId}/members`), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Failed to add member");
    }
    return res.json();
  },

  removeMember: async (teamId: string, userId: string) => {
    const res = await apiFetch(
      buildApiUrl(`admin/teams/${teamId}/members/${userId}`),
      {
        method: "DELETE",
        credentials: "include",
      }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Failed to remove member");
    }
    return res.json();
  },

  availableUsers: async (): Promise<{
    users: Array<{
      user_id: string;
      email?: string;
      first_name?: string;
      last_name?: string;
      profile_picture_url?: string;
      has_team?: boolean;
    }>;
  }> => {
    const res = await apiFetch(buildApiUrl("admin/teams/available-users"), {
      credentials: "include",
    });
    if (!res.ok) throw new Error("Failed to fetch users");
    return res.json();
  },

  getCurrentUserTeam: async () => {
    const res = await apiFetch(buildApiUrl("admin/teams/current-user/team"), {
      credentials: "include",
    });
    if (!res.ok) {
      if (res.status === 404) {
        return null; // User is not in any team
      }
      throw new Error("Failed to fetch current user team");
    }
    return res.json();
  },

  getUserTeam: async (userId: string) => {
    const res = await apiFetch(buildApiUrl(`admin/teams/user/${userId}/team`), {
      credentials: "include",
    });
    if (!res.ok) {
      if (res.status === 404) {
        return null; // User is not in any team
      }
      throw new Error("Failed to fetch user team");
    }
    return res.json();
  },
};

// Team Quotas API functions
export const teamsQuotaApi = {
  listTeamQuotas: async (
    organizationId: string
  ): Promise<{
    organization_id: string;
    teams: Array<{
      team_id: string;
      team_name: string;
      organization_id: string;
      monthly_credits_per_user: number;
      created_at: string;
      updated_at: string;
    }>;
    default_quota_per_user: number;
  }> => {
    const res = await apiFetch(
      buildApiUrl(`quota/organization/${organizationId}/teams/quotas`),
      { credentials: "include" }
    );
    if (!res.ok) throw new Error("Failed to fetch team quotas");
    return res.json();
  },

  getTeamQuota: async (
    organizationId: string,
    teamId: string
  ): Promise<{
    team_id: string;
    team_name: string;
    organization_id: string;
    monthly_credits_per_user: number;
    created_at: string;
    updated_at: string;
  }> => {
    const res = await apiFetch(
      buildApiUrl(`quota/organization/${organizationId}/teams/${teamId}/quota`),
      { credentials: "include" }
    );
    if (!res.ok) throw new Error("Failed to fetch team quota");
    return res.json();
  },

  updateTeamQuota: async (
    organizationId: string,
    teamId: string,
    monthlyCreditsPerUser: number
  ): Promise<{
    team_id: string;
    team_name: string;
    organization_id: string;
    monthly_credits_per_user: number;
    created_at: string;
    updated_at: string;
  }> => {
    const res = await apiFetch(
      buildApiUrl(`quota/organization/${organizationId}/teams/${teamId}/quota`),
      {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          monthly_credits_per_user: monthlyCreditsPerUser,
        }),
      }
    );
    if (!res.ok) throw new Error("Failed to update team quota");
    return res.json();
  },

  deleteTeamQuota: async (
    organizationId: string,
    teamId: string
  ): Promise<void> => {
    const res = await apiFetch(
      buildApiUrl(`quota/organization/${organizationId}/teams/${teamId}/quota`),
      {
        method: "DELETE",
        credentials: "include",
      }
    );
    if (!res.ok) throw new Error("Failed to delete team quota");
  },
};

// RunPod API functions
export const runpodApi = {
  setup: async (): Promise<{ message: string }> => {
    const response = await apiFetch(buildApiUrl("clouds/runpod/setup"), {
      credentials: "include",
    });
    if (!response.ok) {
      throw new Error("Failed to setup RunPod");
    }
    return response.json();
  },

  verify: async (): Promise<{ valid: boolean }> => {
    const response = await apiFetch(buildApiUrl("clouds/runpod/verify"), {
      credentials: "include",
    });
    if (!response.ok) {
      throw new Error("Failed to verify RunPod setup");
    }
    return response.json();
  },

  getGpuTypes: async (): Promise<{ gpu_types: string[] }> => {
    const response = await apiFetch(buildApiUrl("clouds/runpod/gpu-types"), {
      credentials: "include",
    });
    if (!response.ok) {
      throw new Error("Failed to get RunPod GPU types");
    }
    return response.json();
  },
};

// Job management API functions
export const jobApi = {
  cancelJob: async (
    clusterName: string,
    jobId: number
  ): Promise<{
    request_id: string;
    job_id: number;
    cluster_name: string;
    message: string;
    result: any;
  }> => {
    const response = await apiFetch(
      buildApiUrl(`jobs/${clusterName}/${jobId}/cancel`),
      {
        method: "POST",
        credentials: "include",
      }
    );
    if (!response.ok) {
      throw new Error(`Failed to cancel job: ${response.statusText}`);
    }
    return response.json();
  },
};

export const quotaApi = {
  getOrganizationQuota: async (
    organizationId: string
  ): Promise<{
    organization_quota: {
      id: string;
      organization_id: string;
      monthly_credits_per_user: number;
      created_at: string;
      updated_at: string;
    };
    usage: {
      current_period_limit: number;
      current_period_used: number;
      current_period_remaining: number;
      usage_percentage: number;
      period_start: string;
      period_end: string;
      total_usage_this_period: number;
    };
  }> => {
    const res = await apiFetch(
      buildApiUrl(`quota/organization/${organizationId}`),
      {
        credentials: "include",
      }
    );
    if (!res.ok) throw new Error("Failed to fetch organization quota");
    return res.json();
  },

  updateOrganizationQuota: async (
    organizationId: string,
    monthlyCreditsPerUser: number
  ): Promise<any> => {
    const res = await apiFetch(
      buildApiUrl(`quota/organization/${organizationId}`),
      {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          monthly_credits_per_user: monthlyCreditsPerUser,
        }),
      }
    );
    if (!res.ok) throw new Error("Failed to update organization quota");
    return res.json();
  },

  getUserQuota: async (
    organizationId: string,
    userId: string
  ): Promise<{
    user_id: string;
    user_email?: string;
    user_name?: string;
    organization_id: string;
    monthly_credits_per_user: number;
    custom_quota: boolean;
    created_at: string;
    updated_at: string;
    effective_quota_source: string;
  }> => {
    const res = await apiFetch(
      buildApiUrl(`quota/organization/${organizationId}/users/${userId}/quota`),
      { credentials: "include" }
    );
    if (!res.ok) throw new Error("Failed to fetch user quota");
    return res.json();
  },

  listUserQuotas: async (
    organizationId: string
  ): Promise<{
    organization_id: string;
    users: Array<{
      user_id: string;
      user_email?: string;
      user_name?: string;
      organization_id: string;
      monthly_credits_per_user: number;
      custom_quota: boolean;
      created_at: string;
      updated_at: string;
      effective_quota_source: string;
    }>;
    default_quota_per_user: number;
  }> => {
    const res = await apiFetch(
      buildApiUrl(`quota/organization/${organizationId}/users/quotas`),
      { credentials: "include" }
    );
    if (!res.ok) throw new Error("Failed to fetch user quotas");
    return res.json();
  },

  updateUserQuota: async (
    organizationId: string,
    userId: string,
    monthlyCreditsPerUser: number
  ): Promise<any> => {
    const res = await apiFetch(
      buildApiUrl(`quota/organization/${organizationId}/users/${userId}/quota`),
      {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          monthly_credits_per_user: monthlyCreditsPerUser,
        }),
      }
    );
    if (!res.ok) throw new Error("Failed to update user quota");
    return res.json();
  },

  deleteUserQuota: async (
    organizationId: string,
    userId: string
  ): Promise<void> => {
    const res = await apiFetch(
      buildApiUrl(`quota/organization/${organizationId}/users/${userId}/quota`),
      {
        method: "DELETE",
        credentials: "include",
      }
    );
    if (!res.ok) throw new Error("Failed to delete user quota");
  },

  refreshQuotaPeriods: async (
    organizationId: string
  ): Promise<{ message: string }> => {
    const res = await apiFetch(
      buildApiUrl(`quota/organization/${organizationId}/refresh-quota-periods`),
      {
        method: "POST",
        credentials: "include",
      }
    );
    if (!res.ok) throw new Error("Failed to refresh quota periods");
    return res.json();
  },
};

// GPU Orchestration API functions
export const gpuOrchestrationApi = {
  getServerConfig: async (): Promise<{
    message: string;
    tlab_server: string;
    tlab_server_port: string;
  }> => {
    const response = await apiFetch(buildApiUrl("healthz"), {
      credentials: "include",
    });
    if (!response.ok) {
      throw new Error("Failed to fetch GPU orchestration server config");
    }
    return response.json();
  },
};

// SSH Keys API functions
export const sshKeyApi = {
  list: async (): Promise<{
    ssh_keys: Array<{
      id: string;
      name: string;
      public_key: string;
      fingerprint: string;
      key_type: string;
      created_at: string;
      updated_at: string;
      last_used_at?: string;
      is_active: boolean;
    }>;
    total_count: number;
  }> => {
    const response = await apiFetch(buildApiUrl("ssh-config/ssh-keys"), {
      credentials: "include",
    });
    if (!response.ok) {
      throw new Error("Failed to fetch SSH keys");
    }
    return response.json();
  },

  create: async (
    name: string,
    publicKey: string
  ): Promise<{
    id: string;
    name: string;
    public_key: string;
    fingerprint: string;
    key_type: string;
    created_at: string;
    updated_at: string;
    last_used_at?: string;
    is_active: boolean;
  }> => {
    const response = await apiFetch(buildApiUrl("ssh-config/ssh-keys"), {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        public_key: publicKey,
      }),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || "Failed to create SSH key");
    }
    return response.json();
  },

  update: async (
    keyId: string,
    updates: {
      name?: string;
      is_active?: boolean;
    }
  ): Promise<{
    id: string;
    name: string;
    public_key: string;
    fingerprint: string;
    key_type: string;
    created_at: string;
    updated_at: string;
    last_used_at?: string;
    is_active: boolean;
  }> => {
    const response = await apiFetch(
      buildApiUrl(`ssh-config/ssh-keys/${keyId}`),
      {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updates),
      }
    );
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || "Failed to update SSH key");
    }
    return response.json();
  },

  delete: async (keyId: string): Promise<void> => {
    const response = await apiFetch(
      buildApiUrl(`ssh-config/ssh-keys/${keyId}`),
      {
        method: "DELETE",
        credentials: "include",
      }
    );
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || "Failed to delete SSH key");
    }
  },
};

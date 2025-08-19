// API configuration utility
export const API_BASE_URL = import.meta.env.VITE_API_URL || "/api/v1";

// Helper function to build API URLs
export const buildApiUrl = (endpoint: string): string => {
  // Remove leading slash from endpoint if present to avoid double slashes
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint.slice(1) : endpoint;
  return `${API_BASE_URL}/${cleanEndpoint}`;
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

export const apiFetch = async (
  input: RequestInfo,
  init?: RequestInit
): Promise<Response> => {
  const response = await fetch(input, init);
  if (response.status === 401) {
    window.dispatchEvent(new Event("auth-error"));
    throw new Error(`Authentication error: ${response.status}`);
  }
  return response;
};

// RunPod API functions
export const runpodApi = {
  setup: async (): Promise<{ message: string }> => {
    const response = await apiFetch(buildApiUrl("skypilot/runpod/setup"), {
      credentials: "include",
    });
    if (!response.ok) {
      throw new Error("Failed to setup RunPod");
    }
    return response.json();
  },

  verify: async (): Promise<{ valid: boolean }> => {
    const response = await apiFetch(buildApiUrl("skypilot/runpod/verify"), {
      credentials: "include",
    });
    if (!response.ok) {
      throw new Error("Failed to verify RunPod setup");
    }
    return response.json();
  },

  getGpuTypes: async (): Promise<{ gpu_types: string[] }> => {
    const response = await apiFetch(buildApiUrl("skypilot/runpod/gpu-types"), {
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
      buildApiUrl(`skypilot/jobs/${clusterName}/${jobId}/cancel`),
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

// SSH Key management API functions
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
    const response = await apiFetch(buildApiUrl("ssh-keys/"), {
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
    const response = await apiFetch(buildApiUrl("ssh-keys/"), {
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
    const response = await apiFetch(buildApiUrl(`ssh-keys/${keyId}`), {
      method: "PUT",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updates),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || "Failed to update SSH key");
    }
    return response.json();
  },

  delete: async (keyId: string): Promise<void> => {
    const response = await apiFetch(buildApiUrl(`ssh-keys/${keyId}`), {
      method: "DELETE",
      credentials: "include",
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || "Failed to delete SSH key");
    }
  },
};

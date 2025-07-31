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

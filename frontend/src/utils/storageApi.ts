import { apiFetch, buildApiUrl } from "./api";

// Storage Buckets API functions
export interface StorageBucketListItem {
  id: string;
  name: string;
  remote_path: string;
  source: string;
  store: string;
  persistent: boolean;
  mode: string;
  organization_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

export interface StorageBucketListResponse {
  buckets: StorageBucketListItem[];
  total_count: number;
}

export interface FileItem {
  name: string;
  size: number;
  type: string;
  last_modified: string | null;
}

export interface ListFilesResponse {
  items: FileItem[];
  path: string;
}

export interface FileOperationResponse {
  status: string;
  path: string;
}

export const storageBucketApi = {
  // Get all storage buckets
  list: async (): Promise<StorageBucketListResponse> => {
    const response = await apiFetch(buildApiUrl("storage-buckets/"), {
      credentials: "include",
    });
    if (!response.ok) {
      throw new Error("Failed to fetch storage buckets");
    }
    return response.json();
  },

  // Create a new storage bucket
  create: async (bucketData: {
    name: string;
    remote_path: string;
    source: string;
    store?: string;
    persistent?: boolean;
    mode: string;
  }): Promise<StorageBucketListItem> => {
    const response = await apiFetch(buildApiUrl("storage-buckets/"), {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(bucketData),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || "Failed to create storage bucket");
    }
    return response.json();
  },

  // Get a specific storage bucket
  get: async (bucketId: string): Promise<StorageBucketListItem> => {
    const response = await apiFetch(
      buildApiUrl(`storage-buckets/${bucketId}`),
      {
        credentials: "include",
      },
    );
    if (!response.ok) {
      throw new Error("Failed to fetch storage bucket");
    }
    return response.json();
  },

  // Update a storage bucket
  update: async (
    bucketId: string,
    updates: {
      name?: string;
      remote_path?: string;
      source?: string;
      store?: string;
      persistent?: boolean;
      mode?: string;
    },
  ): Promise<StorageBucketListItem> => {
    const response = await apiFetch(
      buildApiUrl(`storage-buckets/${bucketId}`),
      {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updates),
      },
    );
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || "Failed to update storage bucket");
    }
    return response.json();
  },

  // Delete a storage bucket
  delete: async (bucketId: string): Promise<{ message: string }> => {
    const response = await apiFetch(
      buildApiUrl(`storage-buckets/${bucketId}`),
      {
        method: "DELETE",
        credentials: "include",
      },
    );
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || "Failed to delete storage bucket");
    }
    return response.json();
  },

  // List files within a bucket
  listFiles: async (
    bucketId: string,
    path: string = "/",
    storageOptions: Record<string, any> = {},
  ): Promise<ListFilesResponse> => {
    const response = await apiFetch(
      buildApiUrl(`storage-buckets/${bucketId}/list`),
      {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          path,
          storage_options: storageOptions,
        }),
      },
    );
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || "Failed to list files");
    }
    return response.json();
  },

  // Get a file (returns a Response object for streaming)
  getFile: async (
    bucketId: string,
    path: string,
    storageOptions: Record<string, any> = {},
  ): Promise<Response> => {
    const response = await apiFetch(
      buildApiUrl(`storage-buckets/${bucketId}/get-file`),
      {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          path,
          storage_options: storageOptions,
        }),
      },
    );
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || "Failed to download file");
    }
    return response;
  },

  // Upload a file
  uploadFile: async (
    bucketId: string,
    file: File,
    path: string,
    storageOptions: Record<string, any> = {},
  ): Promise<FileOperationResponse> => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("path", path);
    formData.append("storage_options", JSON.stringify(storageOptions));

    const response = await apiFetch(
      buildApiUrl(`storage-buckets/${bucketId}/upload-file`),
      {
        method: "POST",
        credentials: "include",
        body: formData,
      },
    );
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || "Failed to upload file");
    }
    return response.json();
  },

  // Delete a file
  deleteFile: async (
    bucketId: string,
    path: string,
    storageOptions: Record<string, any> = {},
  ): Promise<FileOperationResponse> => {
    const response = await apiFetch(
      buildApiUrl(`storage-buckets/${bucketId}/delete-file`),
      {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          path,
          storage_options: storageOptions,
        }),
      },
    );
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || "Failed to delete file");
    }
    return response.json();
  },

  // Create a directory
  createDir: async (
    bucketId: string,
    path: string,
    storageOptions: Record<string, any> = {},
  ): Promise<FileOperationResponse> => {
    const response = await apiFetch(
      buildApiUrl(`storage-buckets/${bucketId}/create-dir`),
      {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          path,
          storage_options: storageOptions,
        }),
      },
    );
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || "Failed to create directory");
    }
    return response.json();
  },
};

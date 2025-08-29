import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Table,
  Chip,
  Button,
  Alert,
  CircularProgress,
  IconButton,
  Modal,
  ModalDialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  FormLabel,
  Input,
  Select,
  Option,
  Textarea,
  Card,
  CardContent,
  Stack,
} from "@mui/joy";
import {
  Plus,
  Trash2,
  Edit,
  Copy,
  RefreshCw,
  Key,
  Calendar,
  Clock,
  CheckCircle,
} from "lucide-react";
import PageWithTitle from "../templates/PageWithTitle";
import { useAuth } from "../../../context/AuthContext";
import { buildApiUrl, apiFetch } from "../../../utils/api";

interface APIKey {
  id: string;
  name: string;
  key_prefix: string;
  user_id: string;
  organization_id?: string;
  is_active: boolean;
  created_at: string;
  last_used_at?: string;
  expires_at?: string;
  scopes?: string[];
}

interface CreateAPIKeyRequest {
  name: string;
  expires_in_days?: number;
  scopes?: string[];
}

interface CreateAPIKeyResponse {
  api_key: string;
  key_info: APIKey;
}

interface UpdateAPIKeyRequest {
  name?: string;
  is_active?: boolean;
  expires_in_days?: number;
  scopes?: string[];
}

const APIKeys: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const FALLBACK_SCOPES = [
    "admin",
    "compute:write",
    "nodepools:write",
    "storage:write",
    "registries:write",
  ];
  const [allowedScopes, setAllowedScopes] = useState<string[]>(FALLBACK_SCOPES);
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isAdmin = user?.role === "admin";

  // Create API key modal state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState<CreateAPIKeyRequest>({
    name: "",
    expires_in_days: undefined,
    scopes: [],
  });
  const [createError, setCreateError] = useState<string | null>(null);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);

  // Update API key modal state
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [keyToUpdate, setKeyToUpdate] = useState<APIKey | null>(null);
  const [updateForm, setUpdateForm] = useState<UpdateAPIKeyRequest>({});
  const [updateScopesTouched, setUpdateScopesTouched] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  // Delete confirmation state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [keyToDelete, setKeyToDelete] = useState<APIKey | null>(null);

  // Regenerate confirmation state
  const [regenerateDialogOpen, setRegenerateDialogOpen] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [keyToRegenerate, setKeyToRegenerate] = useState<APIKey | null>(null);

  // Copy state for visual feedback
  const [copied, setCopied] = useState<"create" | "regenerate" | null>(null);

  useEffect(() => {
    const fetchApiKeys = async () => {
      if (!user) {
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const response = await apiFetch(buildApiUrl("api-keys"), {
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error("Failed to fetch API keys");
        }

        const data: APIKey[] = await response.json();
        setApiKeys(data);
      } catch (err) {
        console.error("Error fetching API keys:", err);
        setError(
          err instanceof Error ? err.message : "Failed to fetch API keys"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchApiKeys();
  }, [user]);

  useEffect(() => {
    const fetchScopes = async () => {
      try {
        const res = await apiFetch(buildApiUrl("auth/allowed-scopes"), {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.scopes)) {
            setAllowedScopes(data.scopes);
          }
        }
      } catch (e) {
        // Keep fallback scopes
      }
    };
    fetchScopes();
  }, []);

  const formatDate = (dateString?: string) => {
    if (!dateString) return "Never";
    return new Date(dateString).toLocaleDateString();
  };

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return "Never";
    return new Date(dateString).toLocaleString();
  };

  const isExpired = (expiresAt?: string) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  const handleCreateApiKey = async () => {
    if (!createForm.name.trim()) {
      setCreateError("Name is required");
      return;
    }

    try {
      setCreating(true);
      setCreateError(null);
      const payload: CreateAPIKeyRequest = {
        name: createForm.name,
        expires_in_days: createForm.expires_in_days,
        ...(createForm.scopes && createForm.scopes.length
          ? { scopes: createForm.scopes }
          : {}),
      };

      const response = await apiFetch(buildApiUrl("api-keys"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "Failed to create API key");
      }

      const data: CreateAPIKeyResponse = await response.json();
      setNewApiKey(data.api_key);
      setApiKeys([data.key_info, ...apiKeys]);

      // Reset form
      setCreateForm({
        name: "",
        expires_in_days: undefined,
        scopes: [],
      });
    } catch (err) {
      console.error("Error creating API key:", err);
      setCreateError(
        err instanceof Error ? err.message : "Failed to create API key"
      );
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateApiKey = async () => {
    if (!keyToUpdate) return;

    try {
      setUpdating(true);
      setUpdateError(null);
      // Build payload; include scopes only if touched
      const payload: UpdateAPIKeyRequest = {
        name: updateForm.name,
        is_active: updateForm.is_active,
        expires_in_days: updateForm.expires_in_days,
        ...(updateScopesTouched ? { scopes: updateForm.scopes } : {}),
      };

      const response = await apiFetch(
        buildApiUrl(`api-keys/${keyToUpdate.id}`),
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "Failed to update API key");
      }

      const updatedKey: APIKey = await response.json();
      setApiKeys(
        apiKeys.map((key) => (key.id === updatedKey.id ? updatedKey : key))
      );

      setUpdateDialogOpen(false);
      setKeyToUpdate(null);
      setUpdateForm({});
      setUpdateScopesTouched(false);
    } catch (err) {
      console.error("Error updating API key:", err);
      setUpdateError(
        err instanceof Error ? err.message : "Failed to update API key"
      );
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteApiKey = async () => {
    if (!keyToDelete) return;

    try {
      setDeleting(true);

      const response = await apiFetch(
        buildApiUrl(`api-keys/${keyToDelete.id}`),
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to delete API key");
      }

      setApiKeys(apiKeys.filter((key) => key.id !== keyToDelete.id));
      setDeleteDialogOpen(false);
      setKeyToDelete(null);
    } catch (err) {
      console.error("Error deleting API key:", err);
      setError(err instanceof Error ? err.message : "Failed to delete API key");
    } finally {
      setDeleting(false);
    }
  };

  const handleRegenerateApiKey = async () => {
    if (!keyToRegenerate) return;

    try {
      setRegenerating(true);

      const response = await apiFetch(
        buildApiUrl(`api-keys/${keyToRegenerate.id}/regenerate`),
        {
          method: "POST",
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to regenerate API key");
      }

      const data: CreateAPIKeyResponse = await response.json();
      setNewApiKey(data.api_key);
      setApiKeys(
        apiKeys.map((key) =>
          key.id === data.key_info.id ? data.key_info : key
        )
      );
    } catch (err) {
      console.error("Error regenerating API key:", err);
      setError(
        err instanceof Error ? err.message : "Failed to regenerate API key"
      );
    } finally {
      setRegenerating(false);
    }
  };

  const openCreateDialog = () => {
    setCreateDialogOpen(true);
    setCreateError(null);
    setNewApiKey(null);
    setCreateForm({
      name: "",
      expires_in_days: undefined,
      scopes: [],
    });
  };

  const openUpdateDialog = (key: APIKey) => {
    setKeyToUpdate(key);
    setUpdateForm({
      name: key.name,
      is_active: key.is_active,
      scopes: key.scopes || [],
    });
    setUpdateScopesTouched(false);
    setUpdateDialogOpen(true);
    setUpdateError(null);
  };

  const openDeleteDialog = (key: APIKey) => {
    setKeyToDelete(key);
    setDeleteDialogOpen(true);
  };

  const openRegenerateDialog = (key: APIKey) => {
    setKeyToRegenerate(key);
    setRegenerateDialogOpen(true);
    setNewApiKey(null); // Reset the new API key state
  };

  const copyToClipboard = async (
    text: string,
    type: "create" | "regenerate"
  ) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
    }
  };

  if (authLoading || loading) {
    return (
      <PageWithTitle
        title="API Keys"
        subtitle="Manage API keys for programmatic access"
        button={
          <Button
            variant="solid"
            color="primary"
            startDecorator={<Plus size={16} />}
            onClick={openCreateDialog}
          >
            Create API Key
          </Button>
        }
      >
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress />
        </Box>
      </PageWithTitle>
    );
  }

  if (error) {
    return (
      <PageWithTitle
        title="API Keys"
        subtitle="Manage API keys for programmatic access"
        button={
          <Button
            variant="solid"
            color="primary"
            startDecorator={<Plus size={16} />}
            onClick={openCreateDialog}
          >
            Create API Key
          </Button>
        }
      >
        <Alert color="danger" sx={{ mb: 2 }}>
          {error}
        </Alert>
      </PageWithTitle>
    );
  }

  return (
    <PageWithTitle
      title="API Keys"
      subtitle="Manage API keys for programmatic access"
      button={
        <Button
          variant="solid"
          color="primary"
          startDecorator={<Plus size={16} />}
          onClick={openCreateDialog}
        >
          Create API Key
        </Button>
      }
    >
      <Box sx={{ maxWidth: 1200, mx: "auto" }}>
        {apiKeys.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 4 }}>
            <Key size={48} style={{ opacity: 0.5, marginBottom: 16 }} />
            <Typography level="body-lg" sx={{ color: "text.secondary", mb: 2 }}>
              No API keys found
            </Typography>
            <Typography level="body-md" sx={{ color: "text.secondary" }}>
              Create your first API key to get started with programmatic access
            </Typography>
          </Box>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Key</th>
                <th>Status</th>
                <th>Scopes</th>
                <th>Created</th>
                <th>Last Used</th>
                <th>Expires</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {apiKeys.map((key) => (
                <tr key={key.id}>
                  <td>
                    <Typography level="body-md" fontWeight="md">
                      {key.name}
                    </Typography>
                  </td>
                  <td>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Typography level="body-sm" fontFamily="monospace">
                        {key.key_prefix}...
                      </Typography>
                    </Box>
                  </td>
                  <td>
                    <Chip
                      size="sm"
                      color={
                        !key.is_active
                          ? "neutral"
                          : isExpired(key.expires_at)
                          ? "danger"
                          : "success"
                      }
                    >
                      {!key.is_active
                        ? "Inactive"
                        : isExpired(key.expires_at)
                        ? "Expired"
                        : "Active"}
                    </Chip>
                  </td>
                  <td>
                    <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                      {key.scopes && key.scopes.length > 0 ? (
                        key.scopes.includes("admin") ? (
                          <Chip size="sm" color="warning">Admin</Chip>
                        ) : (
                          [...key.scopes].sort((a, b) => a.localeCompare(b)).map((s) => (
                            <Chip key={s} size="sm" variant="soft">
                              {s}
                            </Chip>
                          ))
                        )
                      ) : (
                        <Chip size="sm" variant="soft" color="neutral">
                          None
                        </Chip>
                      )}
                    </Box>
                  </td>
                  <td>
                    <Typography level="body-sm">
                      {formatDate(key.created_at)}
                    </Typography>
                  </td>
                  <td>
                    <Typography level="body-sm">
                      {formatDateTime(key.last_used_at)}
                    </Typography>
                  </td>
                  <td>
                    <Typography
                      level="body-sm"
                      color={isExpired(key.expires_at) ? "danger" : "neutral"}
                    >
                      {key.expires_at ? formatDate(key.expires_at) : "Never"}
                    </Typography>
                  </td>
                  <td>
                    <Box sx={{ display: "flex", gap: 0.5 }}>
                      <IconButton
                        size="sm"
                        color="primary"
                        variant="plain"
                        onClick={() => openUpdateDialog(key)}
                        title="Edit API key"
                      >
                        <Edit size={16} />
                      </IconButton>
                      <IconButton
                        size="sm"
                        color="neutral"
                        variant="plain"
                        onClick={() => openRegenerateDialog(key)}
                        title="Regenerate API key"
                      >
                        <RefreshCw size={16} />
                      </IconButton>
                      <IconButton
                        size="sm"
                        color="danger"
                        variant="plain"
                        onClick={() => openDeleteDialog(key)}
                        title="Delete API key"
                      >
                        <Trash2 size={16} />
                      </IconButton>
                    </Box>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Box>

      {/* Create API Key Dialog */}
      <Modal open={createDialogOpen} onClose={() => setCreateDialogOpen(false)}>
        <ModalDialog size="lg">
          <DialogTitle>Create New API Key</DialogTitle>
          <DialogContent>
            {newApiKey ? (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <Alert color="success">
                  API key created successfully! Make sure to copy it now as you
                  won't be able to see it again.
                </Alert>
                <Card>
                  <CardContent>
                    <Typography level="body-sm" sx={{ mb: 1 }}>
                      Your new API key:
                    </Typography>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Typography
                        level="body-sm"
                        fontFamily="monospace"
                        sx={{
                          wordBreak: "break-all",
                          backgroundColor: "background.level1",
                          p: 1,
                          borderRadius: "sm",
                          flex: 1,
                        }}
                      >
                        {newApiKey}
                      </Typography>
                      <Button
                        variant="outlined"
                        size="sm"
                        onClick={() => copyToClipboard(newApiKey, "create")}
                      >
                        {copied === "create" ? (
                          <>
                            <CheckCircle size={16} />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy size={16} />
                            Copy
                          </>
                        )}
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              </Box>
            ) : (
              <Box
                sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}
              >
              {createError && (
                <Alert color="danger" size="sm">
                  {createError}
                </Alert>
              )}

              <FormControl>
                <FormLabel>Name</FormLabel>
                <Input
                  placeholder="Enter a descriptive name"
                  value={createForm.name}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, name: e.target.value })
                  }
                  disabled={creating}
                />
              </FormControl>

              <FormControl>
                <FormLabel>Expires In (Days)</FormLabel>
                <Select
                  placeholder="Select expiration"
                  value={createForm.expires_in_days?.toString() || ""}
                  onChange={(_, value) =>
                    setCreateForm({
                      ...createForm,
                      expires_in_days: value ? parseInt(value) : undefined,
                    })
                  }
                  disabled={creating}
                >
                  <Option value="">Never expires</Option>
                  <Option value="7">7 days</Option>
                  <Option value="30">30 days</Option>
                  <Option value="90">90 days</Option>
                  <Option value="365">1 year</Option>
                </Select>
              </FormControl>

              <FormControl>
                <FormLabel>Scopes</FormLabel>
                <Select
                  multiple
                  placeholder="Select one or more scopes"
                  value={createForm.scopes || []}
                  onChange={(_, value) => {
                    let next = (value as string[] | null) || [];
                    if (next.includes("admin")) {
                      next = ["admin"]; // admin is exclusive
                    }
                    setCreateForm({ ...createForm, scopes: next });
                  }}
                  disabled={creating}
                >
                  {allowedScopes.map((s) => (
                    <Option key={s} value={s}>
                      {s === "admin" ? "admin (full access)" : s}
                    </Option>
                  ))}
                </Select>
                <Typography level="body-xs" color="neutral" sx={{ mt: 0.5 }}>
                  Selecting "admin" grants full access; other scopes are for specific write actions.
                </Typography>
              </FormControl>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button
              variant="plain"
              color="neutral"
              onClick={() => setCreateDialogOpen(false)}
              disabled={creating}
            >
              {newApiKey ? "Done" : "Cancel"}
            </Button>
            {!newApiKey && (
              <Button
                variant="solid"
                color="primary"
                onClick={handleCreateApiKey}
                loading={creating}
                disabled={!createForm.name.trim()}
              >
                Create API Key
              </Button>
            )}
          </DialogActions>
        </ModalDialog>
      </Modal>

      {/* Update API Key Dialog */}
      <Modal open={updateDialogOpen} onClose={() => setUpdateDialogOpen(false)}>
        <ModalDialog>
          <DialogTitle>Update API Key</DialogTitle>
          <DialogContent>
            <Box
              sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}
            >
              {updateError && (
                <Alert color="danger" size="sm">
                  {updateError}
                </Alert>
              )}

              <FormControl>
                <FormLabel>Name</FormLabel>
                <Input
                  value={updateForm.name || ""}
                  onChange={(e) =>
                    setUpdateForm({ ...updateForm, name: e.target.value })
                  }
                  disabled={updating}
                />
              </FormControl>

              <FormControl>
                <FormLabel>Status</FormLabel>
                <Select
                  value={updateForm.is_active?.toString() || "true"}
                  onChange={(_, value) =>
                    setUpdateForm({
                      ...updateForm,
                      is_active: value === "true",
                    })
                  }
                  disabled={updating}
                >
                  <Option value="true">Active</Option>
                  <Option value="false">Inactive</Option>
                </Select>
              </FormControl>

              <FormControl>
                <FormLabel>Scopes</FormLabel>
                <Select
                  multiple
                  placeholder="Select one or more scopes"
                  value={updateForm.scopes || []}
                  onChange={(_, value) => {
                    setUpdateScopesTouched(true);
                    let next = (value as string[] | null) || [];
                    if (next.includes("admin")) {
                      next = ["admin"]; // admin is exclusive
                    }
                    setUpdateForm({ ...updateForm, scopes: next });
                  }}
                  disabled={updating}
                >
                  {allowedScopes.map((s) => (
                    <Option key={s} value={s}>
                      {s === "admin" ? "admin (full access)" : s}
                    </Option>
                  ))}
                </Select>
                <Typography level="body-xs" color="neutral" sx={{ mt: 0.5 }}>
                  Selecting "admin" overrides and provides full access.
                </Typography>
              </FormControl>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button
              variant="plain"
              color="neutral"
              onClick={() => {
                setUpdateDialogOpen(false);
                setKeyToUpdate(null);
                setUpdateForm({});
                setUpdateScopesTouched(false);
              }}
              disabled={updating}
            >
              Cancel
            </Button>
            <Button
              variant="solid"
              color="primary"
              onClick={handleUpdateApiKey}
              loading={updating}
            >
              Update
            </Button>
          </DialogActions>
        </ModalDialog>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <Modal open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <ModalDialog>
          <DialogTitle>Delete API Key</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to delete the API key{" "}
              <strong>{keyToDelete?.name}</strong>? This action cannot be undone
              and will immediately revoke access for any applications using this
              key.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button
              variant="plain"
              color="neutral"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="solid"
              color="danger"
              onClick={handleDeleteApiKey}
              loading={deleting}
            >
              Delete API Key
            </Button>
          </DialogActions>
        </ModalDialog>
      </Modal>

      {/* Regenerate Confirmation Dialog */}
      <Modal
        open={regenerateDialogOpen}
        onClose={() => setRegenerateDialogOpen(false)}
      >
        <ModalDialog size="lg">
          <DialogTitle>Regenerate API Key</DialogTitle>
          <DialogContent>
            {newApiKey ? (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <Alert color="success">
                  API key regenerated successfully! Make sure to copy it now as
                  you won't be able to see it again.
                </Alert>
                <Card>
                  <CardContent>
                    <Typography level="body-sm" sx={{ mb: 1 }}>
                      Your regenerated API key:
                    </Typography>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Typography
                        level="body-sm"
                        fontFamily="monospace"
                        sx={{
                          wordBreak: "break-all",
                          backgroundColor: "background.level1",
                          p: 1,
                          borderRadius: "sm",
                          flex: 1,
                        }}
                      >
                        {newApiKey}
                      </Typography>
                      <Button
                        variant="outlined"
                        size="sm"
                        onClick={() => copyToClipboard(newApiKey, "regenerate")}
                      >
                        {copied === "regenerate" ? (
                          <>
                            <CheckCircle size={16} />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy size={16} />
                            Copy
                          </>
                        )}
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              </Box>
            ) : (
              <Typography>
                Are you sure you want to regenerate the API key{" "}
                <strong>{keyToRegenerate?.name}</strong>? The current key will
                be immediately invalidated and you'll need to update any
                applications using it with the new key value.
              </Typography>
            )}
          </DialogContent>
          <DialogActions>
            <Button
              variant="plain"
              color="neutral"
              onClick={() => {
                setRegenerateDialogOpen(false);
                setKeyToRegenerate(null);
                setNewApiKey(null);
              }}
              disabled={regenerating}
            >
              {newApiKey ? "Done" : "Cancel"}
            </Button>
            {!newApiKey && (
              <Button
                variant="solid"
                color="warning"
                onClick={handleRegenerateApiKey}
                loading={regenerating}
              >
                Regenerate Key
              </Button>
            )}
          </DialogActions>
        </ModalDialog>
      </Modal>
    </PageWithTitle>
  );
};

export default APIKeys;

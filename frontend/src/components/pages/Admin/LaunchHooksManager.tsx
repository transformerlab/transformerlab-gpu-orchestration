import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  Card,
  Typography,
  Input,
  FormControl,
  FormLabel,
  Modal,
  ModalDialog,
  ModalClose,
  Stack,
  Table,
  IconButton,
  Chip,
  Alert,
  Textarea,
  Divider,
  Badge,
} from "@mui/joy";
import { Plus, Trash2, Edit, Upload, Download, File } from "lucide-react";
import { buildApiUrl, apiFetch } from "../../../utils/api";
import PageWithTitle from "../templates/PageWithTitle";

interface LaunchHookFile {
  id: string;
  original_filename: string;
  file_size: number;
  created_at: string;
}

interface LaunchHook {
  id: string;
  name: string;
  description: string | null;
  setup_commands: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  files: LaunchHookFile[];
}

const LaunchHooksManager: React.FC = () => {
  const [launchHooks, setLaunchHooks] = useState<LaunchHook[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showFileUploadModal, setShowFileUploadModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedHook, setSelectedHook] = useState<LaunchHook | null>(null);

  // Form states
  const [hookName, setHookName] = useState("");
  const [hookDescription, setHookDescription] = useState("");
  const [hookSetupCommands, setHookSetupCommands] = useState("");
  const [hookIsActive, setHookIsActive] = useState(true);
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  useEffect(() => {
    fetchLaunchHooks();
  }, []);

  const fetchLaunchHooks = async () => {
    try {
      setLoading(true);
      const response = await apiFetch(buildApiUrl("admin/launch-hooks"), {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setLaunchHooks(data.hooks || []);
      } else {
        const errorData = await response.json();
        setError(errorData.detail || "Failed to fetch launch hooks");
      }
    } catch (err) {
      setError("Failed to fetch launch hooks");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateHook = async () => {
    if (!hookName.trim()) {
      setError("Hook name is required");
      return;
    }

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append("name", hookName);
      if (hookDescription) formData.append("description", hookDescription);
      if (hookSetupCommands)
        formData.append("setup_commands", hookSetupCommands);

      const response = await apiFetch(buildApiUrl("admin/launch-hooks"), {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (response.ok) {
        await fetchLaunchHooks();
        setShowCreateModal(false);
        resetForm();
      } else {
        const errorData = await response.json();
        setError(errorData.detail || "Failed to create launch hook");
      }
    } catch (err) {
      setError("Failed to create launch hook");
    } finally {
      setLoading(false);
    }
  };

  const handleEditHook = async () => {
    if (!selectedHook || !hookName.trim()) {
      setError("Hook name is required");
      return;
    }

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append("name", hookName);
      if (hookDescription) formData.append("description", hookDescription);
      if (hookSetupCommands)
        formData.append("setup_commands", hookSetupCommands);
      formData.append("is_active", hookIsActive.toString());

      const response = await apiFetch(
        buildApiUrl(`admin/launch-hooks/${selectedHook.id}`),
        {
          method: "PUT",
          credentials: "include",
          body: formData,
        }
      );

      if (response.ok) {
        await fetchLaunchHooks();
        setShowEditModal(false);
        resetForm();
      } else {
        const errorData = await response.json();
        setError(errorData.detail || "Failed to update launch hook");
      }
    } catch (err) {
      setError("Failed to update launch hook");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteHook = async (hookId: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this launch hook? This will also delete all associated files."
      )
    ) {
      return;
    }

    try {
      setLoading(true);
      const response = await apiFetch(
        buildApiUrl(`admin/launch-hooks/${hookId}`),
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      if (response.ok) {
        await fetchLaunchHooks();
      } else {
        const errorData = await response.json();
        setError(errorData.detail || "Failed to delete launch hook");
      }
    } catch (err) {
      setError("Failed to delete launch hook");
    } finally {
      setLoading(false);
    }
  };

  const handleUploadFile = async () => {
    if (!selectedHook || !uploadFile) {
      setError("Please select a file to upload");
      return;
    }

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append("file", uploadFile);

      const response = await apiFetch(
        buildApiUrl(`admin/launch-hooks/${selectedHook.id}/files`),
        {
          method: "POST",
          credentials: "include",
          body: formData,
        }
      );

      if (response.ok) {
        await fetchLaunchHooks();
        setShowFileUploadModal(false);
        setUploadFile(null);
      } else {
        const errorData = await response.json();
        setError(errorData.detail || "Failed to upload file");
      }
    } catch (err) {
      setError("Failed to upload file");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFile = async (hookId: string, fileId: string) => {
    if (!confirm("Are you sure you want to delete this file?")) {
      return;
    }

    try {
      setLoading(true);
      const response = await apiFetch(
        buildApiUrl(`admin/launch-hooks/${hookId}/files/${fileId}`),
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      if (response.ok) {
        await fetchLaunchHooks();
      } else {
        const errorData = await response.json();
        setError(errorData.detail || "Failed to delete file");
      }
    } catch (err) {
      setError("Failed to delete file");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadFile = async (
    hookId: string,
    fileId: string,
    filename: string
  ) => {
    try {
      const response = await apiFetch(
        buildApiUrl(`admin/launch-hooks/${hookId}/files/${fileId}/download`),
        {
          credentials: "include",
        }
      );

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        const errorData = await response.json();
        setError(errorData.detail || "Failed to download file");
      }
    } catch (err) {
      setError("Failed to download file");
    }
  };

  const resetForm = () => {
    setHookName("");
    setHookDescription("");
    setHookSetupCommands("");
    setHookIsActive(true);
    setSelectedHook(null);
    setError(null);
  };

  const openEditModal = (hook: LaunchHook) => {
    setSelectedHook(hook);
    setHookName(hook.name);
    setHookDescription(hook.description || "");
    setHookSetupCommands(hook.setup_commands || "");
    setHookIsActive(hook.is_active);
    setShowEditModal(true);
  };

  const openFileUploadModal = (hook: LaunchHook) => {
    setSelectedHook(hook);
    setShowFileUploadModal(true);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <PageWithTitle title="Launch Hooks">
      <Box sx={{ maxWidth: 1200, mx: "auto", p: 2 }}>
        {error && (
          <Alert color="danger" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 3,
          }}
        >
          <Typography level="h3">Launch Hooks</Typography>
          <Button
            startDecorator={<Plus />}
            onClick={() => setShowCreateModal(true)}
            disabled={loading}
          >
            Create Hook
          </Button>
        </Box>

        <Typography level="body-md" sx={{ mb: 3, color: "text.secondary" }}>
          Launch hooks allow you to automatically mount files and run setup
          commands when launching instances. Files will be mounted to ~/hooks/
          and setup commands will be prepended to your launch command.
        </Typography>

        {launchHooks.length === 0 ? (
          <Card sx={{ p: 4, textAlign: "center" }}>
            <Typography level="body-lg" color="neutral">
              No launch hooks configured. Create your first hook to get started.
            </Typography>
          </Card>
        ) : (
          <Stack spacing={2}>
            {launchHooks.map((hook) => (
              <Card key={hook.id} sx={{ p: 3 }}>
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    mb: 2,
                  }}
                >
                  <Box>
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        mb: 1,
                      }}
                    >
                      <Typography level="h4">{hook.name}</Typography>
                      <Chip
                        color={hook.is_active ? "success" : "neutral"}
                        size="sm"
                        variant="soft"
                      >
                        {hook.is_active ? "Active" : "Inactive"}
                      </Chip>
                    </Box>
                    {hook.description && (
                      <Typography
                        level="body-md"
                        color="neutral"
                        sx={{ mb: 1 }}
                      >
                        {hook.description}
                      </Typography>
                    )}
                    {hook.setup_commands && (
                      <Box sx={{ mb: 2 }}>
                        <Typography
                          level="body-sm"
                          fontWeight="lg"
                          sx={{ mb: 1 }}
                        >
                          Setup Commands:
                        </Typography>
                        <Box
                          component="pre"
                          sx={{
                            p: 2,
                            bgcolor: "neutral.100",
                            borderRadius: "sm",
                            fontSize: "sm",
                            overflow: "auto",
                            maxHeight: 200,
                          }}
                        >
                          {hook.setup_commands}
                        </Box>
                      </Box>
                    )}
                  </Box>
                  <Box sx={{ display: "flex", gap: 1 }}>
                    <IconButton
                      size="sm"
                      variant="outlined"
                      onClick={() => openFileUploadModal(hook)}
                      disabled={loading}
                    >
                      <Upload size={16} />
                    </IconButton>
                    <IconButton
                      size="sm"
                      variant="outlined"
                      onClick={() => openEditModal(hook)}
                      disabled={loading}
                    >
                      <Edit size={16} />
                    </IconButton>
                    <IconButton
                      size="sm"
                      variant="outlined"
                      color="danger"
                      onClick={() => handleDeleteHook(hook.id)}
                      disabled={loading}
                    >
                      <Trash2 size={16} />
                    </IconButton>
                  </Box>
                </Box>

                {hook.files.length > 0 && (
                  <>
                    <Divider sx={{ my: 2 }} />
                    <Typography level="body-sm" fontWeight="lg" sx={{ mb: 1 }}>
                      Files ({hook.files.length}):
                    </Typography>
                    <Table size="sm">
                      <thead>
                        <tr>
                          <th>Filename</th>
                          <th>Size</th>
                          <th>Uploaded</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {hook.files.map((file) => (
                          <tr key={file.id}>
                            <td>
                              <Box
                                sx={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 1,
                                }}
                              >
                                <File size={14} />
                                {file.original_filename}
                              </Box>
                            </td>
                            <td>{formatFileSize(file.file_size)}</td>
                            <td>
                              {new Date(file.created_at).toLocaleDateString()}
                            </td>
                            <td>
                              <Box sx={{ display: "flex", gap: 1 }}>
                                <IconButton
                                  size="sm"
                                  variant="plain"
                                  onClick={() =>
                                    handleDownloadFile(
                                      hook.id,
                                      file.id,
                                      file.original_filename
                                    )
                                  }
                                >
                                  <Download size={14} />
                                </IconButton>
                                <IconButton
                                  size="sm"
                                  variant="plain"
                                  color="danger"
                                  onClick={() =>
                                    handleDeleteFile(hook.id, file.id)
                                  }
                                >
                                  <Trash2 size={14} />
                                </IconButton>
                              </Box>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </>
                )}
              </Card>
            ))}
          </Stack>
        )}

        {/* Create Hook Modal */}
        <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)}>
          <ModalDialog sx={{ maxWidth: 600 }}>
            <ModalClose />
            <Typography level="h4" sx={{ mb: 2 }}>
              Create Launch Hook
            </Typography>
            <Stack spacing={2}>
              <FormControl required>
                <FormLabel>Hook Name</FormLabel>
                <Input
                  value={hookName}
                  onChange={(e) => setHookName(e.target.value)}
                  placeholder="Enter hook name"
                />
              </FormControl>
              <FormControl>
                <FormLabel>Description</FormLabel>
                <Input
                  value={hookDescription}
                  onChange={(e) => setHookDescription(e.target.value)}
                  placeholder="Optional description"
                />
              </FormControl>
              <FormControl>
                <FormLabel>Setup Commands</FormLabel>
                <Textarea
                  value={hookSetupCommands}
                  onChange={(e) => setHookSetupCommands(e.target.value)}
                  placeholder="Commands to run before the main command (e.g., pip install -r requirements.txt)"
                  minRows={4}
                />
              </FormControl>
              <Box sx={{ display: "flex", gap: 2, justifyContent: "flex-end" }}>
                <Button
                  variant="outlined"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleCreateHook} disabled={loading}>
                  Create Hook
                </Button>
              </Box>
            </Stack>
          </ModalDialog>
        </Modal>

        {/* Edit Hook Modal */}
        <Modal open={showEditModal} onClose={() => setShowEditModal(false)}>
          <ModalDialog sx={{ maxWidth: 600 }}>
            <ModalClose />
            <Typography level="h4" sx={{ mb: 2 }}>
              Edit Launch Hook
            </Typography>
            <Stack spacing={2}>
              <FormControl required>
                <FormLabel>Hook Name</FormLabel>
                <Input
                  value={hookName}
                  onChange={(e) => setHookName(e.target.value)}
                  placeholder="Enter hook name"
                />
              </FormControl>
              <FormControl>
                <FormLabel>Description</FormLabel>
                <Input
                  value={hookDescription}
                  onChange={(e) => setHookDescription(e.target.value)}
                  placeholder="Optional description"
                />
              </FormControl>
              <FormControl>
                <FormLabel>Setup Commands</FormLabel>
                <Textarea
                  value={hookSetupCommands}
                  onChange={(e) => setHookSetupCommands(e.target.value)}
                  placeholder="Commands to run before the main command (e.g., pip install -r requirements.txt)"
                  minRows={4}
                />
              </FormControl>
              <Box sx={{ display: "flex", gap: 2, justifyContent: "flex-end" }}>
                <Button
                  variant="outlined"
                  onClick={() => setShowEditModal(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleEditHook} disabled={loading}>
                  Update Hook
                </Button>
              </Box>
            </Stack>
          </ModalDialog>
        </Modal>

        {/* File Upload Modal */}
        <Modal
          open={showFileUploadModal}
          onClose={() => setShowFileUploadModal(false)}
        >
          <ModalDialog sx={{ maxWidth: 500 }}>
            <ModalClose />
            <Typography level="h4" sx={{ mb: 2 }}>
              Upload File to {selectedHook?.name}
            </Typography>
            <Stack spacing={2}>
              <FormControl required>
                <FormLabel>Select File</FormLabel>
                <Input
                  type="file"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                />
              </FormControl>
              <Typography level="body-sm" color="neutral">
                Files will be mounted to ~/hooks/ in launched instances.
              </Typography>
              <Box sx={{ display: "flex", gap: 2, justifyContent: "flex-end" }}>
                <Button
                  variant="outlined"
                  onClick={() => setShowFileUploadModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleUploadFile}
                  disabled={loading || !uploadFile}
                >
                  Upload File
                </Button>
              </Box>
            </Stack>
          </ModalDialog>
        </Modal>
      </Box>
    </PageWithTitle>
  );
};

export default LaunchHooksManager;

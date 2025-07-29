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
} from "@mui/joy";
import { Plus, Trash2, Edit, Key } from "lucide-react";
import { buildApiUrl, apiFetch } from "../../../utils/api";
import PageWithTitle from "../templates/PageWithTitle";

interface IdentityFile {
  path: string;
  display_name: string;
  original_filename: string;
  size: number;
  permissions: string;
  created: number;
}

const IdentityFileManager: React.FC = () => {
  const [identityFiles, setIdentityFiles] = useState<IdentityFile[]>([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<IdentityFile | null>(null);

  // Form states
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newIdentityFile, setNewIdentityFile] = useState<File | null>(null);
  const [renameDisplayName, setRenameDisplayName] = useState("");

  useEffect(() => {
    fetchIdentityFiles();
  }, []);

  const fetchIdentityFiles = async () => {
    try {
      setLoading(true);
      const response = await apiFetch(buildApiUrl("clusters/identity-files"), {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setIdentityFiles(data.identity_files);
      } else {
        setError("Failed to fetch identity files");
      }
    } catch (err) {
      setError("Error fetching identity files");
    } finally {
      setLoading(false);
    }
  };

  const uploadIdentityFile = async () => {
    if (!newIdentityFile || !newDisplayName.trim()) return;

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append("display_name", newDisplayName.trim());
      formData.append("identity_file", newIdentityFile);

      const response = await apiFetch(buildApiUrl("clusters/identity-files"), {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (response.ok) {
        setShowUploadModal(false);
        setNewDisplayName("");
        setNewIdentityFile(null);
        fetchIdentityFiles();
      } else {
        const errorData = await response.json();
        setError(errorData.detail || "Failed to upload identity file");
      }
    } catch (err) {
      setError("Error uploading identity file");
    } finally {
      setLoading(false);
    }
  };

  const deleteIdentityFile = async (filePath: string) => {
    if (
      !window.confirm("Are you sure you want to delete this identity file?")
    ) {
      return;
    }

    try {
      setLoading(true);
      const encodedPath = encodeURIComponent(filePath);
      const response = await apiFetch(
        buildApiUrl(`clusters/identity-files/${encodedPath}`),
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      if (response.ok) {
        fetchIdentityFiles();
      } else {
        const errorData = await response.json();
        setError(errorData.detail || "Failed to delete identity file");
      }
    } catch (err) {
      setError("Error deleting identity file");
    } finally {
      setLoading(false);
    }
  };

  const renameIdentityFile = async () => {
    if (!selectedFile || !renameDisplayName.trim()) return;

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append("new_display_name", renameDisplayName.trim());

      const encodedPath = encodeURIComponent(selectedFile.path);
      const response = await apiFetch(
        buildApiUrl(`clusters/identity-files/${encodedPath}`),
        {
          method: "PUT",
          credentials: "include",
          body: formData,
        }
      );

      if (response.ok) {
        setShowRenameModal(false);
        setSelectedFile(null);
        setRenameDisplayName("");
        fetchIdentityFiles();
      } else {
        const errorData = await response.json();
        setError(errorData.detail || "Failed to rename identity file");
      }
    } catch (err) {
      setError("Error renaming identity file");
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString();
  };

  return (
    <PageWithTitle
      title="Identity File Management"
      subtitle="Upload and manage SSH identity files for use with node pools."
    >
      {error && (
        <Card color="danger" variant="soft" sx={{ mb: 2 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
            <Typography color="danger">{error}</Typography>
            <Button
              variant="plain"
              size="sm"
              color="danger"
              onClick={() => setError(null)}
            >
              ×
            </Button>
          </Box>
        </Card>
      )}

      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 3 }}>
        <Typography level="h3">Identity Files</Typography>
        <Button
          startDecorator={<Plus size={16} />}
          onClick={() => setShowUploadModal(true)}
          disabled={loading}
        >
          Upload Identity File
        </Button>
      </Box>

      <Card>
        {identityFiles.length === 0 ? (
          <Typography level="body-md" sx={{ color: "text.secondary", p: 3 }}>
            No identity files found. Upload your first identity file to get
            started.
          </Typography>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Display Name</th>
                <th>Original Filename</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {identityFiles.map((file) => (
                <tr key={file.path}>
                  <td>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Key size={16} />
                      <Typography level="body-md">
                        {file.display_name}
                      </Typography>
                    </Box>
                  </td>
                  <td>
                    <Chip
                      size="sm"
                      variant="soft"
                      title={file.original_filename} // Show full name on hover
                      sx={{
                        maxWidth: 200,
                        "& .MuiChip-label": {
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        },
                      }}
                    >
                      {file.original_filename}
                    </Chip>
                  </td>
                  <td>{formatDate(file.created)}</td>
                  <td>
                    <Box sx={{ display: "flex", gap: 1 }}>
                      <IconButton
                        color="primary"
                        variant="plain"
                        size="sm"
                        onClick={() => {
                          setSelectedFile(file);
                          setRenameDisplayName(file.display_name);
                          setShowRenameModal(true);
                        }}
                      >
                        <Edit size={16} />
                      </IconButton>
                      <IconButton
                        color="danger"
                        variant="plain"
                        size="sm"
                        onClick={() => deleteIdentityFile(file.path)}
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
      </Card>

      {/* Upload Modal */}
      <Modal open={showUploadModal} onClose={() => setShowUploadModal(false)}>
        <ModalDialog>
          <ModalClose />
          <Typography level="h4" sx={{ mb: 2 }}>
            Upload Identity File
          </Typography>
          <Stack spacing={2}>
            <FormControl required>
              <FormLabel>Display Name</FormLabel>
              <Input
                value={newDisplayName}
                onChange={(e) => setNewDisplayName(e.target.value)}
                placeholder="My AWS Key"
              />
            </FormControl>
            <FormControl required>
              <FormLabel>Identity File</FormLabel>
              <Input
                type="file"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setNewIdentityFile(file);
                }}
              />
              {newIdentityFile && (
                <Typography
                  level="body-sm"
                  sx={{ mt: 0.5, color: "text.secondary" }}
                >
                  Selected: {newIdentityFile.name}
                </Typography>
              )}
              <Typography level="body-xs" color="neutral">
                Allowed: .pem, .key, .rsa, .pub, or files with no extension
                (e.g., id_rsa)
              </Typography>
            </FormControl>
            <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
              <Button variant="plain" onClick={() => setShowUploadModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={uploadIdentityFile}
                disabled={!newDisplayName.trim() || !newIdentityFile || loading}
              >
                Upload
              </Button>
            </Box>
          </Stack>
        </ModalDialog>
      </Modal>

      {/* Rename Modal */}
      <Modal open={showRenameModal} onClose={() => setShowRenameModal(false)}>
        <ModalDialog>
          <ModalClose />
          <Typography level="h4" sx={{ mb: 2 }}>
            Rename Identity File
          </Typography>
          <Stack spacing={2}>
            <FormControl required>
              <FormLabel>Display Name</FormLabel>
              <Input
                value={renameDisplayName}
                onChange={(e) => setRenameDisplayName(e.target.value)}
                placeholder="New display name"
              />
            </FormControl>
            <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
              <Button variant="plain" onClick={() => setShowRenameModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={renameIdentityFile}
                disabled={!renameDisplayName.trim() || loading}
              >
                Rename
              </Button>
            </Box>
          </Stack>
        </ModalDialog>
      </Modal>
    </PageWithTitle>
  );
};

export default IdentityFileManager;

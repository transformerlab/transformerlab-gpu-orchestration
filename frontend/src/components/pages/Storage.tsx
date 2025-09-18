import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Card,
  Typography,
  Stack,
  Chip,
  Button,
  IconButton,
  Table,
  Sheet,
  Divider,
  Input,
  FormControl,
  FormLabel,
  Avatar,
  CircularProgress,
  Alert,
} from "@mui/joy";
import PageWithTitle from "./templates/PageWithTitle";
import {
  storageBucketApi,
  StorageBucketListItem,
  FileItem,
} from "../../utils/storageApi";
import useSWR from "swr";
import {
  ArrowUp,
  FileIcon,
  FolderIcon,
  PlusIcon,
  RefreshCw,
  Trash2,
} from "lucide-react";

// Utility function to format file sizes
const formatBytes = (bytes: number, decimals = 2) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
};

// File browser component for a specific bucket
const BucketBrowser: React.FC<{
  bucket: StorageBucketListItem;
  onError: () => void;
}> = ({ bucket, onError }) => {
  const [currentPath, setCurrentPath] = useState("/");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [storageOptions, setStorageOptions] = useState<Record<string, any>>({});

  // Fetch files for current path
  const fetchFiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await storageBucketApi.listFiles(
        bucket.id,
        currentPath,
        storageOptions
      );
      setFiles(response.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      // Clear the selected bucket when list API fails
      onError();
    } finally {
      setLoading(false);
    }
  }, [bucket.id, currentPath, storageOptions, onError]);

  // Initialize storage options with the bucket info
  useEffect(() => {
    // Set storage options based on bucket settings
    setStorageOptions({
      source: bucket.source,
      mode: bucket.mode,
    });
  }, [bucket]);

  // Reset current path when bucket changes
  useEffect(() => {
    setCurrentPath("/");
  }, [bucket.id]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  // Navigate to folder
  const handleNavigateToFolder = (folderPath: string) => {
    let normalizedPath;

    // Check if it's just a folder name (no slashes)
    if (!folderPath.includes("/")) {
      // Simple folder name - add to current path
      normalizedPath = currentPath.endsWith("/")
        ? `${currentPath}${folderPath}/`
        : `${currentPath}/${folderPath}/`;
    } else if (folderPath.startsWith("/")) {
      // Absolute path - use as is
      normalizedPath = folderPath.endsWith("/") ? folderPath : `${folderPath}/`;
    } else {
      // Relative path with slashes - add to current path
      normalizedPath = currentPath.endsWith("/")
        ? `${currentPath}${folderPath}/`
        : `${currentPath}/${folderPath}/`;
    }

    // Remove any double slashes except at the beginning
    normalizedPath = normalizedPath.replace(/([^:])\/+/g, "$1/");

    setCurrentPath(normalizedPath);
  };

  // Navigate up
  const handleNavigateUp = () => {
    // Split by / and remove empty segments
    const segments = currentPath.split("/").filter((s) => s);
    if (segments.length > 0) {
      segments.pop(); // Remove last segment
      setCurrentPath(
        "/" + segments.join("/") + (segments.length > 0 ? "/" : "")
      );
    }
  };

  // Download a file
  const handleDownloadFile = async (filePath: string) => {
    try {
      // If filePath is just the name, append it to current path
      if (!filePath.startsWith("/")) {
        filePath = currentPath.endsWith("/")
          ? `${currentPath}${filePath}`
          : `${currentPath}/${filePath}`;
      }

      const response = await storageBucketApi.getFile(
        bucket.id,
        filePath,
        storageOptions
      );
      const blob = await response.blob();

      // Create a download link and trigger it
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filePath.split("/").pop() || "download";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  // Handle file click (folder navigation or file download)
  const handleFileClick = (item: FileItem) => {
    // Extract the actual name without the path prefix
    // If the current path is in the name (like "tonytestcontainer/alitest" when we're at "/tonytestcontainer/"),
    // we need to extract just the part after the current path
    const currentPathWithoutSlashes = currentPath.replace(/^\/+|\/+$/g, "");
    let actualName = item.name;

    // Remove the current path from the name if it exists
    if (
      currentPathWithoutSlashes &&
      item.name.startsWith(currentPathWithoutSlashes + "/")
    ) {
      actualName = item.name.substring(currentPathWithoutSlashes.length + 1);
    } else if (item.name.includes("/")) {
      // If there's still a path separator, take the last part
      actualName = item.name.split("/").pop() || item.name;
    }

    if (item.type === "directory") {
      handleNavigateToFolder(actualName);
    } else {
      handleDownloadFile(actualName);
    }
  };

  // Upload a file
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    const file = e.target.files[0];
    setLoading(true);
    setError(null);

    try {
      await storageBucketApi.uploadFile(
        bucket.id,
        file,
        currentPath,
        storageOptions
      );
      fetchFiles(); // Refresh the file list
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
      // Reset file input
      e.target.value = "";
    }
  };

  // Create new folder
  const handleCreateFolder = async () => {
    if (!newFolderName) return;

    setLoading(true);
    setError(null);

    try {
      const folderPath = currentPath.endsWith("/")
        ? `${currentPath}${newFolderName}/`
        : `${currentPath}/${newFolderName}/`;

      await storageBucketApi.createDir(bucket.id, folderPath, storageOptions);
      setShowNewFolderInput(false);
      setNewFolderName("");
      fetchFiles(); // Refresh the file list
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  // Delete file or folder
  const handleDeleteItem = async (item: FileItem) => {
    if (!confirm(`Are you sure you want to delete ${item.name}?`)) return;

    setLoading(true);
    setError(null);

    try {
      // For delete operations, we can use the full item.name directly
      // since the API already returns the full path
      await storageBucketApi.deleteFile(bucket.id, item.name, storageOptions);
      fetchFiles(); // Refresh the file list
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet
      variant="plain"
      sx={{
        mt: 2,
        p: 2,
        minHeight: "50vh",
        backgroundColor: "var(--background-color)",
      }}
    >
      <Box sx={{ mb: 2 }}>
        <Typography level="title-lg">{bucket.name}</Typography>
        <Typography level="body-sm" color="neutral">
          {bucket.remote_path} • {bucket.source} • {bucket.mode}
        </Typography>
      </Box>

      <Divider />

      {/* Path and action buttons */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mt: 2,
          mb: 2,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Button
            variant="outlined"
            color="neutral"
            startDecorator={<ArrowUp />}
            onClick={handleNavigateUp}
            disabled={currentPath === "/"}
            size="sm"
          >
            Up
          </Button>
          <Typography level="body-md">{currentPath}</Typography>
        </Box>

        <Box sx={{ display: "flex", gap: 1 }}>
          <Button
            variant="outlined"
            color="primary"
            startDecorator={<RefreshCw />}
            onClick={fetchFiles}
            size="sm"
          >
            Refresh
          </Button>

          <Button
            variant="outlined"
            color="success"
            startDecorator={<PlusIcon />}
            onClick={() => setShowNewFolderInput(true)}
            size="sm"
          >
            New Folder
          </Button>

          <Button
            component="label"
            variant="outlined"
            color="primary"
            startDecorator={<ArrowUp />}
            size="sm"
          >
            Upload
            <input type="file" hidden onChange={handleFileUpload} />
          </Button>
        </Box>
      </Box>

      {/* New folder input */}
      {showNewFolderInput && (
        <Box sx={{ display: "flex", gap: 1, mb: 2, alignItems: "center" }}>
          <FormControl sx={{ flexGrow: 1 }}>
            <Input
              placeholder="Enter folder name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              autoFocus
            />
          </FormControl>
          <Button onClick={handleCreateFolder} size="sm">
            Create
          </Button>
          <Button
            variant="plain"
            color="neutral"
            onClick={() => {
              setShowNewFolderInput(false);
              setNewFolderName("");
            }}
            size="sm"
          >
            Cancel
          </Button>
        </Box>
      )}

      {/* Error message */}
      {error && (
        <Alert color="danger" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* File list */}
      <Sheet variant="outlined">
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
            <CircularProgress />
          </Box>
        ) : files.length === 0 ? (
          <Box sx={{ p: 4, textAlign: "center" }}>
            <Typography level="body-lg" color="neutral">
              This folder is empty
            </Typography>
          </Box>
        ) : (
          <Table hoverRow>
            <thead>
              <tr>
                <th style={{ width: "60%" }}>Name</th>
                <th>Size</th>
                <th>Last Modified</th>
                <th style={{ width: "60px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {files.map((item) => (
                <tr key={item.name}>
                  <td>
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        cursor: "pointer",
                      }}
                      onClick={() => handleFileClick(item)}
                    >
                      <Avatar variant="plain" size="sm">
                        {item.type === "directory" ? (
                          <FolderIcon />
                        ) : (
                          <FileIcon />
                        )}
                      </Avatar>
                      <Typography level="body-md">{item.name}</Typography>
                    </Box>
                  </td>
                  <td>
                    {item.type === "directory" ? "—" : formatBytes(item.size)}
                  </td>
                  <td>
                    {item.last_modified
                      ? new Date(item.last_modified).toLocaleDateString()
                      : "—"}
                  </td>
                  <td>
                    <IconButton
                      variant="plain"
                      color="danger"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteItem(item);
                      }}
                    >
                      <Trash2 size={14} />
                    </IconButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Sheet>
    </Sheet>
  );
};

const StoragePage: React.FC = () => {
  const { data, error, isLoading } = useSWR(
    "storage-buckets",
    async () => await storageBucketApi.list()
  );

  const [selectedBucket, setSelectedBucket] =
    useState<StorageBucketListItem | null>(null);

  // When buckets are loaded, select the first one by default
  useEffect(() => {
    if (data?.buckets && data.buckets.length > 0 && !selectedBucket) {
      setSelectedBucket(data.buckets[0]);
    }
  }, [data, selectedBucket]);

  // Handle bucket error - clear selection when list API fails
  const handleBucketError = () => {
    setSelectedBucket(null);
  };

  return (
    <PageWithTitle
      title="Storage"
      subtitle="Manage and browse your storage buckets"
    >
      {isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert color="danger">Failed to load storage buckets</Alert>
      ) : (
        <Box>
          {/* Bucket selection */}
          <Card variant="outlined" sx={{ p: 2 }}>
            <Typography level="title-md" sx={{ mb: 2 }}>
              Select a storage bucket
            </Typography>
            <Stack
              direction="row"
              spacing={1}
              sx={{ flexWrap: "wrap", gap: 1 }}
            >
              {data?.buckets.map((bucket) => (
                <Chip
                  key={bucket.id}
                  variant={selectedBucket?.id === bucket.id ? "solid" : "soft"}
                  color={
                    selectedBucket?.id === bucket.id ? "primary" : "neutral"
                  }
                  onClick={() => setSelectedBucket(bucket)}
                  sx={{ cursor: "pointer" }}
                >
                  {bucket.name}
                </Chip>
              ))}
              {data?.buckets.length === 0 && (
                <Typography level="body-md" color="neutral">
                  No storage buckets found. Create one first.
                </Typography>
              )}
            </Stack>
          </Card>

          {/* Bucket browser */}
          {selectedBucket && (
            <BucketBrowser
              bucket={selectedBucket}
              onError={handleBucketError}
            />
          )}
        </Box>
      )}
    </PageWithTitle>
  );
};

export default StoragePage;

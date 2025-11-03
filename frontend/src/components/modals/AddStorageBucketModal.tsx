import React, { useState } from "react";
import {
  Button,
  Input,
  Modal,
  ModalDialog,
  Stack,
  Select,
  Option,
  Switch,
  Typography,
  FormControl,
  FormLabel,
  Box,
  Divider,
  IconButton,
  Tooltip,
  Link,
} from "@mui/joy";
import { Info } from "lucide-react";
import { apiFetch, buildApiUrl } from "../../utils/api";

interface CreateStorageBucketRequest {
  name: string;
  remote_path: string;
  source?: string;
  store?: string;
  persistent: boolean;
  mode: string;
}

interface AddStorageBucketModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onError: (error: string) => void;
}

const AddStorageBucketModal: React.FC<AddStorageBucketModalProps> = ({
  open,
  onClose,
  onSuccess,
  onError,
}) => {
  // Form state
  const [formData, setFormData] = useState<CreateStorageBucketRequest>({
    name: "",
    remote_path: "",
    source: "",
    store: "",
    persistent: true,
    mode: "MOUNT",
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isExistingBucket, setIsExistingBucket] = useState(true);

  // Create bucket
  const createBucket = async () => {
    try {
      setFormErrors({});

      // Validation
      const errors: Record<string, string> = {};
      if (!formData.name.trim()) errors.name = "Name is required";
      if (!formData.remote_path.trim())
        errors.remote_path = "Remote path is required";
      if (!formData.store) errors.store = "Please select a cloud provider";
      if (isExistingBucket && !formData.source?.trim())
        errors.source = "Source is required when using an existing bucket";

      if (Object.keys(errors).length > 0) {
        setFormErrors(errors);
        return;
      }

      // If not using existing bucket, send empty source
      const requestData = {
        ...formData,
        source: isExistingBucket ? formData.source : "",
      };

      const response = await apiFetch(buildApiUrl("storage-buckets/"), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to create storage bucket");
      }

      handleClose();
      onSuccess();
    } catch (err: any) {
      console.error("Failed to create storage bucket:", err);
      onError(err.message || "Failed to create storage bucket");
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      name: "",
      remote_path: "",
      source: "",
      store: "",
      persistent: true,
      mode: "MOUNT",
    });
    setFormErrors({});
  };

  // Handle close
  const handleClose = () => {
    resetForm();
    onClose();
  };

  // Handle form input changes
  const handleInputChange = (
    field: keyof CreateStorageBucketRequest,
    value: any,
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field]) {
      setFormErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  return (
    <Modal open={open} onClose={handleClose}>
      <ModalDialog size="lg">
        <Typography level="h4">Add Storage Bucket</Typography>

        {/* 
        <Box sx={{ mt: 2, mb: 1 }}>
          <FormControl>
            <FormLabel sx={{ mb: 1, fontSize: "sm", fontWeight: "md" }}>
              Bucket Type
            </FormLabel>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                p: 2,
                border: "1px solid",
                borderColor: "divider",
                borderRadius: "md",
                bgcolor: "background.level1",
              }}
            >
              <Box>
                <Typography level="body-sm" sx={{ fontWeight: "md" }}>
                  {isExistingBucket
                    ? "Use Existing Bucket"
                    : "Create New Bucket"}
                </Typography>
                <Typography level="body-xs" color="neutral">
                  {isExistingBucket
                    ? "Reference an existing storage bucket or local directory"
                    : "Create a new empty storage bucket"}
                </Typography>
              </Box>
              <Switch
                checked={isExistingBucket}
                onChange={(e) => {
                  setIsExistingBucket(e.target.checked);
                  if (!e.target.checked) {
                    // Clear source when switching to new bucket
                    handleInputChange("source", "");
                  }
                }}
                size="lg"
                color={isExistingBucket ? "primary" : "neutral"}
              />
            </Box>
          </FormControl>
        </Box>

        <Divider sx={{ my: 2 }} /> */}

        {/* Basic Configuration */}
        <Box sx={{ mb: 3 }}>
          <Typography level="title-sm" sx={{ mb: 2, color: "text.primary" }}>
            Basic Configuration
          </Typography>
          <Stack spacing={2}>
            <FormControl>
              <FormLabel>Store *</FormLabel>
              <Select
                name="store"
                value={formData.store}
                onChange={(_, value) => handleInputChange("store", value)}
                placeholder="Select cloud provider"
                required
              >
                <Option value="auto">Auto-detect</Option>
                <Option value="azure">Azure Blob Storage</Option>
                <Option value="s3">AWS S3</Option>
                <Option value="gcs">Google Cloud Storage</Option>
                <Option value="r2">Cloudflare R2</Option>
              </Select>
              <Typography level="body-xs" color="neutral">
                Choose the cloud provider where your storage bucket will be
                hosted. If you select "Auto-detect", Transformer Lab GPU
                Orchestration will choose automatically based on the configured
                cloud providers.
              </Typography>
              {formErrors.store && (
                <Typography color="danger" level="body-xs">
                  {formErrors.store}
                </Typography>
              )}
            </FormControl>

            <FormControl>
              <FormLabel>Name *</FormLabel>
              <Input
                name="name"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                placeholder="my-sky-bucket"
                required
              />
              {formErrors.name && (
                <Typography color="danger" level="body-xs">
                  {formErrors.name}
                </Typography>
              )}
            </FormControl>

            <FormControl>
              <FormLabel>Mount Path *</FormLabel>
              <Input
                name="remote_path"
                value={formData.remote_path}
                onChange={(e) =>
                  handleInputChange("remote_path", e.target.value)
                }
                placeholder="/my_data"
                required
              />
              <Typography level="body-xs" color="neutral">
                Local path on the remote VM where the bucket will be mounted
                (e.g., /my_data, /datasets).
              </Typography>
              {formErrors.remote_path && (
                <Typography color="danger" level="body-xs">
                  {formErrors.remote_path}
                </Typography>
              )}
            </FormControl>
          </Stack>
        </Box>

        {/* Source Configuration (only for existing buckets) */}
        <Box sx={{ mb: 3 }}>
          <Typography level="title-sm" sx={{ mb: 2, color: "text.primary" }}>
            Source Configuration
          </Typography>
          <FormControl>
            <FormLabel>Bucket URI *</FormLabel>
            <Input
              name="source"
              value={formData.source}
              onChange={(e) => handleInputChange("source", e.target.value)}
              placeholder="s3://my-bucket/ or ~/local_dataset"
              required
            />
            <Typography level="body-xs" color="neutral">
              Existing bucket URI (s3://, gs://, r2://, cos://) or local path to
              upload.
            </Typography>
            {formErrors.source && (
              <Typography color="danger" level="body-xs">
                {formErrors.source}
              </Typography>
            )}
          </FormControl>
        </Box>

        {/* Storage & Access Configuration */}
        <Box sx={{ mb: 3 }}>
          <Typography level="title-sm" sx={{ mb: 2, color: "text.primary" }}>
            Storage & Access Configuration
          </Typography>
          <Stack spacing={2}>
            <FormControl>
              <Box
                sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 1 }}
              >
                <FormLabel>Mode</FormLabel>
                <Tooltip
                  title={
                    <Box sx={{ p: 1, maxWidth: 350 }}>
                      <Typography level="title-sm" sx={{ mb: 1 }}>
                        Storage Mount Modes
                      </Typography>
                      <Stack spacing={1}>
                        <Box>
                          <Typography level="body-sm" sx={{ fontWeight: "md" }}>
                            MOUNT (Recommended)
                          </Typography>
                          <Typography level="body-xs" color="neutral">
                            Streamed access to files with writes replicated to
                            cloud storage. Best for most use cases with
                            immediate cloud backup.
                          </Typography>
                        </Box>
                        <Box>
                          <Typography level="body-sm" sx={{ fontWeight: "md" }}>
                            COPY
                          </Typography>
                          <Typography level="body-xs" color="neutral">
                            Downloads all files locally before task starts.
                            Faster access but no cloud sync during execution.
                          </Typography>
                        </Box>
                        <Box>
                          <Typography level="body-sm" sx={{ fontWeight: "md" }}>
                            MOUNT_CACHED
                          </Typography>
                          <Typography level="body-xs" color="neutral">
                            Cached mount with async synchronization. Balance
                            between performance and cloud sync.
                          </Typography>
                        </Box>
                        <Box
                          sx={{
                            mt: 1,
                            pt: 1,
                            borderTop: "1px solid",
                            borderColor: "divider",
                          }}
                        >
                          <Link
                            href="https://skypilot.readthedocs.io/en/latest/reference/storage.html#storage-modes"
                            target="_blank"
                            level="body-xs"
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 0.5,
                            }}
                          >
                            📚 View Documentation
                          </Link>
                        </Box>
                      </Stack>
                    </Box>
                  }
                  variant="outlined"
                  placement="right"
                  arrow
                >
                  <IconButton
                    size="sm"
                    variant="plain"
                    color="neutral"
                    sx={{
                      minHeight: "auto",
                      minWidth: "auto",
                      p: 0.25,
                      "--IconButton-size": "20px",
                    }}
                  >
                    <Info size={12} />
                  </IconButton>
                </Tooltip>
              </Box>
              <Select
                name="mode"
                value={formData.mode}
                onChange={(_, value) => handleInputChange("mode", value)}
              >
                <Option value="MOUNT">MOUNT (Default)</Option>
                <Option value="COPY">COPY</Option>
                <Option value="MOUNT_CACHED">MOUNT_CACHED</Option>
              </Select>
              {formErrors.mode && (
                <Typography color="danger" level="body-xs">
                  {formErrors.mode}
                </Typography>
              )}
            </FormControl>

            <FormControl>
              <FormLabel>Persistent Storage</FormLabel>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  p: 2,
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: "md",
                  bgcolor: "background.level1",
                }}
              >
                <Box>
                  <Typography level="body-sm" sx={{ fontWeight: "md" }}>
                    {formData.persistent
                      ? "Keep after completion"
                      : "Delete after completion"}
                  </Typography>
                  <Typography level="body-xs" color="neutral">
                    {formData.persistent
                      ? "Bucket will persist after task completion"
                      : "Bucket will be deleted when task completes"}
                  </Typography>
                </Box>
                <Switch
                  checked={formData.persistent}
                  onChange={(e) =>
                    handleInputChange("persistent", e.target.checked)
                  }
                  size="lg"
                  color={formData.persistent ? "success" : "neutral"}
                />
              </Box>
              {formErrors.persistent && (
                <Typography color="danger" level="body-xs">
                  {formErrors.persistent}
                </Typography>
              )}
            </FormControl>
          </Stack>
        </Box>

        <Divider sx={{ my: 2 }} />

        <Stack
          direction="row"
          spacing={2}
          sx={{ justifyContent: "flex-end", pt: 1 }}
        >
          <Button onClick={handleClose} variant="outlined" size="md">
            Cancel
          </Button>
          <Button onClick={createBucket} variant="solid" size="md">
            Add Bucket
          </Button>
        </Stack>
      </ModalDialog>
    </Modal>
  );
};

export default AddStorageBucketModal;

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
} from "@mui/joy";
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

  // Create bucket
  const createBucket = async () => {
    try {
      setFormErrors({});

      // Validation
      const errors: Record<string, string> = {};
      if (!formData.name.trim()) errors.name = "Name is required";
      if (!formData.remote_path.trim())
        errors.remote_path = "Remote path is required";

      if (Object.keys(errors).length > 0) {
        setFormErrors(errors);
        return;
      }

      const response = await apiFetch(buildApiUrl("storage-buckets/"), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
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
    value: any
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
        <Stack spacing={2} sx={{ mt: 1 }}>
          <FormControl>
            <FormLabel>Name *</FormLabel>
            <Input
              name="name"
              value={formData.name}
              onChange={(e) => handleInputChange("name", e.target.value)}
              placeholder="my-sky-bucket"
              required
            />
            <Typography level="body-xs" color="neutral">
              Unique identifier for the storage bucket. Used when creating a new
              bucket or referencing an existing one.
            </Typography>
            {formErrors.name && (
              <Typography color="danger" level="body-xs">
                {formErrors.name}
              </Typography>
            )}
          </FormControl>

          <FormControl>
            <FormLabel>Remote Path *</FormLabel>
            <Input
              name="remote_path"
              value={formData.remote_path}
              onChange={(e) => handleInputChange("remote_path", e.target.value)}
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

          <FormControl>
            <FormLabel>Source (Optional)</FormLabel>
            <Input
              name="source"
              value={formData.source}
              onChange={(e) => handleInputChange("source", e.target.value)}
              placeholder="s3://my-bucket/ or ~/local_dataset"
            />
            <Typography level="body-xs" color="neutral">
              Local path to upload or existing bucket URI (s3://, gs://, r2://,
              cos://). Leave empty to create an empty bucket.
            </Typography>
            {formErrors.source && (
              <Typography color="danger" level="body-xs">
                {formErrors.source}
              </Typography>
            )}
          </FormControl>

          <FormControl>
            <FormLabel>Store (Optional)</FormLabel>
            <Select
              name="store"
              value={formData.store}
              onChange={(_, value) => handleInputChange("store", value)}
              placeholder="Auto-detect"
            >
              <Option value="auto">Auto-detect</Option>
              <Option value="azure">Azure Blob Storage</Option>
              <Option value="s3">AWS S3</Option>
              <Option value="gcs">Google Cloud Storage</Option>
              <Option value="r2">Cloudflare R2</Option>
            </Select>
            <Typography level="body-xs" color="neutral">
              Cloud provider for the bucket. If not specified, SkyPilot will
              choose based on the source path and task's cloud provider.
            </Typography>
            {formErrors.store && (
              <Typography color="danger" level="body-xs">
                {formErrors.store}
              </Typography>
            )}
          </FormControl>

          <FormControl>
            <FormLabel>Mode</FormLabel>
            <Select
              name="mode"
              value={formData.mode}
              onChange={(_, value) => handleInputChange("mode", value)}
            >
              <Option value="MOUNT">MOUNT (Default)</Option>
              <Option value="COPY">COPY</Option>
              <Option value="MOUNT_CACHED">MOUNT_CACHED</Option>
            </Select>
            <Typography level="body-xs" color="neutral">
              MOUNT: Streamed access, writes replicated. COPY: Pre-fetched,
              local writes only. MOUNT_CACHED: Cached with async sync.
            </Typography>
            {formErrors.mode && (
              <Typography color="danger" level="body-xs">
                {formErrors.mode}
              </Typography>
            )}
          </FormControl>

          <FormControl>
            <FormLabel>Persistent</FormLabel>
            <Switch
              checked={formData.persistent}
              onChange={(e) =>
                handleInputChange("persistent", e.target.checked)
              }
            />
            <Typography level="body-xs" color="neutral">
              Keep the bucket after task completion. Set to true to avoid
              re-uploading data in subsequent runs.
            </Typography>
            {formErrors.persistent && (
              <Typography color="danger" level="body-xs">
                {formErrors.persistent}
              </Typography>
            )}
          </FormControl>
          <Stack direction="row" spacing={1}>
            <Button onClick={handleClose} variant="outlined">
              Cancel
            </Button>
            <Button onClick={createBucket} variant="solid">
              Create Bucket
            </Button>
          </Stack>
        </Stack>
      </ModalDialog>
    </Modal>
  );
};

export default AddStorageBucketModal;

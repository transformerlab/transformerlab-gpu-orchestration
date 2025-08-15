import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Table,
  Button,
  Chip,
  Input,
  Modal,
  ModalDialog,
  Stack,
  Select,
  Option,
  Checkbox,
  Alert,
  IconButton,
  Tooltip,
  FormControl,
  FormLabel,
  Switch,
} from "@mui/joy";
import { Plus, Edit, Trash2, Eye } from "lucide-react";
import PageWithTitle from "../templates/PageWithTitle";
import { apiFetch, buildApiUrl } from "../../../utils/api";

interface StorageBucket {
  id: string;
  name: string;
  remote_path: string;
  source?: string;
  store?: string;
  persistent: boolean;
  mode: string;
  organization_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

interface CreateStorageBucketRequest {
  name: string;
  remote_path: string;
  source?: string;
  store?: string;
  persistent: boolean;
  mode: string;
}

const ObjectStorage: React.FC = () => {
  const [openAdd, setOpenAdd] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);
  const [openView, setOpenView] = useState(false);
  const [selectedBucket, setSelectedBucket] = useState<StorageBucket | null>(
    null
  );
  const [buckets, setBuckets] = useState<StorageBucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  // Fetch buckets
  const fetchBuckets = async () => {
    try {
      setLoading(true);
      const response = await apiFetch(buildApiUrl("storage-buckets/"), {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch storage buckets");
      }
      const data = await response.json();
      setBuckets(data.buckets);
      setError(null);
    } catch (err: any) {
      console.error("Failed to fetch storage buckets:", err);
      setError(err.message || "Failed to fetch storage buckets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBuckets();
  }, []);

  // Create bucket
  const createBucket = async () => {
    try {
      setFormErrors({});

      // Validation
      const errors: Record<string, string> = {};
      if (!formData.name.trim()) errors.name = "Name is required";
      if (!formData.remote_path.trim())
        errors.remote_path = "Remote path is required";
      // if (!formData.remote_path.startsWith("/"))
      //   errors.remote_path = "Remote path must start with /";

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

      setOpenAdd(false);
      resetForm();
      fetchBuckets();
    } catch (err: any) {
      console.error("Failed to create storage bucket:", err);
      setError(err.message || "Failed to create storage bucket");
    }
  };

  // Update bucket
  const updateBucket = async () => {
    if (!selectedBucket) return;

    try {
      setFormErrors({});

      // Validation
      const errors: Record<string, string> = {};
      if (!formData.name.trim()) errors.name = "Name is required";
      if (!formData.remote_path.trim())
        errors.remote_path = "Remote path is required";
      if (!formData.remote_path.startsWith("/"))
        errors.remote_path = "Remote path must start with /";

      if (Object.keys(errors).length > 0) {
        setFormErrors(errors);
        return;
      }

      const response = await apiFetch(
        buildApiUrl(`storage-buckets/${selectedBucket.id}`),
        {
          method: "PUT",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(formData),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to update storage bucket");
      }

      setOpenEdit(false);
      resetForm();
      fetchBuckets();
    } catch (err: any) {
      console.error("Failed to update storage bucket:", err);
      setError(err.message || "Failed to update storage bucket");
    }
  };

  // Delete bucket
  const deleteBucket = async () => {
    if (!selectedBucket) return;

    try {
      const response = await apiFetch(
        buildApiUrl(`storage-buckets/${selectedBucket.id}`),
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to delete storage bucket");
      }

      setOpenDelete(false);
      setSelectedBucket(null);
      fetchBuckets();
    } catch (err: any) {
      console.error("Failed to delete storage bucket:", err);
      setError(err.message || "Failed to delete storage bucket");
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
    setError(null);
  };

  // Open edit modal
  const handleEdit = (bucket: StorageBucket) => {
    setSelectedBucket(bucket);
    setFormData({
      name: bucket.name,
      remote_path: bucket.remote_path,
      source: bucket.source || "",
      store: bucket.store || "",
      persistent: bucket.persistent,
      mode: bucket.mode,
    });
    setOpenEdit(true);
  };

  // Open delete modal
  const handleDelete = (bucket: StorageBucket) => {
    setSelectedBucket(bucket);
    setOpenDelete(true);
  };

  // Open view modal
  const handleView = (bucket: StorageBucket) => {
    setSelectedBucket(bucket);
    setOpenView(true);
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
    <PageWithTitle
      title="Object Storage Locations"
      subtitle="Add and manage object storage locations (S3, GCS, Azure, etc)."
      button={
        <Button
          variant="solid"
          color="primary"
          startDecorator={<Plus size={16} />}
          onClick={() => setOpenAdd(true)}
        >
          Add Storage Bucket
        </Button>
      }
    >
      {error && (
        <Alert color="danger" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Alert color="neutral" sx={{ mb: 2 }}>
          Loading storage buckets...
        </Alert>
      ) : buckets.length === 0 ? (
        <Alert color="neutral" sx={{ mb: 2 }}>
          No storage buckets found. Create your first storage bucket to get
          started.
        </Alert>
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Remote Path</th>
              <th>Source</th>
              <th>Store</th>
              <th>Mode</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {buckets.map((bucket) => (
              <tr key={bucket.id}>
                <td>{bucket.name}</td>
                <td>{bucket.remote_path}</td>
                <td>{bucket.source || "—"}</td>
                <td>
                  {bucket.store ? (
                    <Chip size="sm" variant="soft">
                      {bucket.store.toUpperCase()}
                    </Chip>
                  ) : (
                    "Auto"
                  )}
                </td>
                <td>
                  <Chip size="sm" variant="outlined">
                    {bucket.mode}
                  </Chip>
                </td>
                <td>
                  <Stack direction="row" spacing={1}>
                    <Tooltip title="View details">
                      <IconButton
                        size="sm"
                        variant="plain"
                        onClick={() => handleView(bucket)}
                      >
                        <Eye size={16} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Edit">
                      <IconButton
                        size="sm"
                        variant="plain"
                        onClick={() => handleEdit(bucket)}
                      >
                        <Edit size={16} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton
                        size="sm"
                        variant="plain"
                        color="danger"
                        onClick={() => handleDelete(bucket)}
                      >
                        <Trash2 size={16} />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      {/* Add Storage Modal */}
      <Modal open={openAdd} onClose={() => setOpenAdd(false)}>
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
                Unique identifier for the storage bucket. Used when creating a
                new bucket or referencing an existing one.
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

            <FormControl>
              <FormLabel>Source (Optional)</FormLabel>
              <Input
                name="source"
                value={formData.source}
                onChange={(e) => handleInputChange("source", e.target.value)}
                placeholder="s3://my-bucket/ or ~/local_dataset"
              />
              <Typography level="body-xs" color="neutral">
                Local path to upload or existing bucket URI (s3://, gs://,
                r2://, cos://). Leave empty to create an empty bucket.
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
                <Option value="">Auto-detect</Option>
                <Option value="s3">AWS S3</Option>
                <Option value="gcs">Google Cloud Storage</Option>
                <Option value="r2">Cloudflare R2</Option>
                <Option value="ibm">IBM Cloud Object Storage</Option>
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
              <Button onClick={() => setOpenAdd(false)} variant="outlined">
                Cancel
              </Button>
              <Button onClick={createBucket} variant="solid">
                Create Bucket
              </Button>
            </Stack>
          </Stack>
        </ModalDialog>
      </Modal>

      {/* Edit Storage Modal */}
      <Modal open={openEdit} onClose={() => setOpenEdit(false)}>
        <ModalDialog size="lg">
          <Typography level="h4">Edit Storage Bucket</Typography>
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
                Unique identifier for the storage bucket. Used when creating a
                new bucket or referencing an existing one.
              </Typography>
              {formErrors.name && (
                <Typography color="danger" level="body-xs">
                  {formErrors.name}
                </Typography>
              )}
            </FormControl>

            <FormControl>
              <FormLabel>Remote Path (e.g., /mnt/data)</FormLabel>
              <Input
                value={formData.remote_path}
                onChange={(e) =>
                  handleInputChange("remote_path", e.target.value)
                }
                error={!!formErrors.remote_path}
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
              <FormLabel>
                Source (optional: local path or bucket URI like s3://bucket)
              </FormLabel>
              <Input
                value={formData.source}
                onChange={(e) => handleInputChange("source", e.target.value)}
              />
              <Typography level="body-xs" color="neutral">
                Local path to upload or existing bucket URI (s3://, gs://,
                r2://, cos://). Leave empty to create an empty bucket.
              </Typography>
              {formErrors.source && (
                <Typography color="danger" level="body-xs">
                  {formErrors.source}
                </Typography>
              )}
            </FormControl>

            <FormControl>
              <FormLabel>Store (auto-detect if not specified)</FormLabel>
              <Select
                value={formData.store}
                onChange={(_, value) => handleInputChange("store", value)}
              >
                <Option value="">Auto-detect</Option>
                <Option value="s3">S3</Option>
                <Option value="gcs">Google Cloud Storage</Option>
                <Option value="azure">Azure Blob Storage</Option>
                <Option value="r2">Cloudflare R2</Option>
                <Option value="ibm">IBM Cloud Object Storage</Option>
                <Option value="oci">Oracle Cloud Infrastructure</Option>
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
                value={formData.mode}
                onChange={(_, value) => handleInputChange("mode", value)}
              >
                <Option value="MOUNT">
                  MOUNT (streamed access, writes replicated)
                </Option>
                <Option value="COPY">
                  COPY (pre-fetched, local writes only)
                </Option>
                <Option value="MOUNT_CACHED">
                  MOUNT_CACHED (cached with async sync)
                </Option>
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
              <FormLabel>
                Persistent (keep bucket after task completion)
              </FormLabel>
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
              <Button onClick={() => setOpenEdit(false)} variant="outlined">
                Cancel
              </Button>
              <Button onClick={updateBucket} variant="solid">
                Update Bucket
              </Button>
            </Stack>
          </Stack>
        </ModalDialog>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal open={openDelete} onClose={() => setOpenDelete(false)}>
        <ModalDialog>
          <Typography level="h4">Delete Storage Bucket</Typography>
          <Typography sx={{ mt: 1 }}>
            Are you sure you want to delete the storage bucket "
            {selectedBucket?.name}"? This action cannot be undone.
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
            <Button onClick={() => setOpenDelete(false)} variant="outlined">
              Cancel
            </Button>
            <Button onClick={deleteBucket} color="danger" variant="solid">
              Delete
            </Button>
          </Stack>
        </ModalDialog>
      </Modal>

      {/* View Details Modal */}
      <Modal open={openView} onClose={() => setOpenView(false)}>
        <ModalDialog size="lg">
          <Typography level="h4">Storage Bucket Details</Typography>
          {selectedBucket && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Box>
                <Typography level="body-sm" color="neutral">
                  Name
                </Typography>
                <Typography level="body-lg">{selectedBucket.name}</Typography>
              </Box>
              <Box>
                <Typography level="body-sm" color="neutral">
                  Remote Path
                </Typography>
                <Typography level="body-lg">
                  {selectedBucket.remote_path}
                </Typography>
              </Box>
              <Box>
                <Typography level="body-sm" color="neutral">
                  Source
                </Typography>
                <Typography level="body-lg">
                  {selectedBucket.source || "—"}
                </Typography>
              </Box>
              <Box>
                <Typography level="body-sm" color="neutral">
                  Store
                </Typography>
                <Typography level="body-lg">
                  {selectedBucket.store
                    ? selectedBucket.store.toUpperCase()
                    : "Auto-detect"}
                </Typography>
              </Box>
              <Box>
                <Typography level="body-sm" color="neutral">
                  Mode
                </Typography>
                <Typography level="body-lg">{selectedBucket.mode}</Typography>
              </Box>
              <Box>
                <Typography level="body-sm" color="neutral">
                  Persistent
                </Typography>
                <Typography level="body-lg">
                  {selectedBucket.persistent ? "Yes" : "No"}
                </Typography>
              </Box>
              <Box>
                <Typography level="body-sm" color="neutral">
                  Created
                </Typography>
                <Typography level="body-lg">
                  {new Date(selectedBucket.created_at).toLocaleString()}
                </Typography>
              </Box>
              <Box>
                <Typography level="body-sm" color="neutral">
                  Last Updated
                </Typography>
                <Typography level="body-lg">
                  {new Date(selectedBucket.updated_at).toLocaleString()}
                </Typography>
              </Box>
              <Button onClick={() => setOpenView(false)} variant="outlined">
                Close
              </Button>
            </Stack>
          )}
        </ModalDialog>
      </Modal>
    </PageWithTitle>
  );
};

export default ObjectStorage;

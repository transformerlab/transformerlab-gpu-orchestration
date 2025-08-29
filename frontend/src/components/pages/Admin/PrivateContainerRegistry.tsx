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
  Alert,
  IconButton,
  Tooltip,
  FormControl,
  FormLabel,
  ModalClose,
  Divider,
} from "@mui/joy";
import { Plus, Edit, Trash2, Eye, EyeOff, Image } from "lucide-react";
import PageWithTitle from "../templates/PageWithTitle";
import { apiFetch, buildApiUrl } from "../../../utils/api";

interface ContainerRegistry {
  id: string;
  name: string;
  docker_username: string;
  docker_server: string;
  organization_id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

interface CreateContainerRegistryRequest {
  name: string;
  docker_username: string;
  docker_password: string;
  docker_server: string;
}

interface DockerImage {
  id: string;
  name: string;
  image_tag: string;
  description?: string;
  container_registry_id: string | null;
  organization_id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

interface CreateDockerImageRequest {
  name: string;
  image_tag: string;
  description?: string;
  container_registry_id?: string | null;
}

const PrivateContainerRegistry: React.FC = () => {
  const [openAdd, setOpenAdd] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);
  const [openView, setOpenView] = useState(false);
  const [openAddImage, setOpenAddImage] = useState(false);
  const [openEditImage, setOpenEditImage] = useState(false);
  const [openDeleteImage, setOpenDeleteImage] = useState(false);
  const [selectedRegistry, setSelectedRegistry] =
    useState<ContainerRegistry | null>(null);
  const [selectedImage, setSelectedImage] = useState<DockerImage | null>(null);
  const [registries, setRegistries] = useState<ContainerRegistry[]>([]);
  const [images, setImages] = useState<DockerImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Form state
  const [formData, setFormData] = useState<CreateContainerRegistryRequest>({
    name: "",
    docker_username: "",
    docker_password: "",
    docker_server: "",
  });

  const [imageFormData, setImageFormData] = useState<CreateDockerImageRequest>({
    name: "",
    image_tag: "",
    description: "",
    container_registry_id: "",
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [imageFormErrors, setImageFormErrors] = useState<
    Record<string, string>
  >({});

  // Fetch registries
  const fetchRegistries = async () => {
    try {
      setLoading(true);
      const response = await apiFetch(buildApiUrl("container-registries/"), {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch container registries");
      }
      const data = await response.json();
      setRegistries(data.registries);
      setError(null);
    } catch (err: any) {
      console.error("Failed to fetch container registries:", err);
      setError(err.message || "Failed to fetch container registries");
    } finally {
      setLoading(false);
    }
  };

  // Fetch images
  const fetchImages = async () => {
    try {
      const response = await apiFetch(
        buildApiUrl("container-registries/images/available"),
        {
          credentials: "include",
        }
      );
      if (!response.ok) {
        throw new Error("Failed to fetch docker images");
      }
      const data = await response.json();
      setImages(data);
    } catch (err: any) {
      console.error("Failed to fetch docker images:", err);
    }
  };

  useEffect(() => {
    fetchRegistries();
    fetchImages();
  }, []);

  // Create registry
  const createRegistry = async () => {
    try {
      setFormErrors({});

      // Basic validation
      const errors: Record<string, string> = {};
      if (!formData.name.trim()) errors.name = "Registry name is required";
      if (!formData.docker_username.trim())
        errors.docker_username = "Username is required";
      if (!formData.docker_password.trim())
        errors.docker_password = "Password is required";
      if (!formData.docker_server.trim())
        errors.docker_server = "Server URL is required";

      if (Object.keys(errors).length > 0) {
        setFormErrors(errors);
        return;
      }

      const response = await apiFetch(buildApiUrl("container-registries/"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.detail || "Failed to create container registry"
        );
      }

      // Reset form and close modal
      setFormData({
        name: "",
        docker_username: "",
        docker_password: "",
        docker_server: "",
      });
      setOpenAdd(false);
      fetchRegistries();
    } catch (err: any) {
      console.error("Failed to create container registry:", err);
      setError(err.message || "Failed to create container registry");
    }
  };

  // Create docker image
  const createDockerImage = async () => {
    try {
      setImageFormErrors({});

      // Basic validation
      const errors: Record<string, string> = {};
      if (!imageFormData.name.trim()) errors.name = "Image name is required";
      if (!imageFormData.image_tag.trim())
        errors.image_tag = "Image tag is required";

      if (Object.keys(errors).length > 0) {
        setImageFormErrors(errors);
        return;
      }

      // If container_registry_id is provided, create image in that registry
      // Otherwise, create a standalone image (this would need backend support)
      const endpoint = imageFormData.container_registry_id
        ? `container-registries/${imageFormData.container_registry_id}/images`
        : "container-registries/images";

      const response = await apiFetch(buildApiUrl(endpoint), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(imageFormData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to create docker image");
      }

      // Reset form and close modal
      setImageFormData({
        name: "",
        image_tag: "",
        description: "",
        container_registry_id: "",
      });
      setOpenAddImage(false);
      fetchImages();
    } catch (err: any) {
      console.error("Failed to create docker image:", err);
      setError(err.message || "Failed to create docker image");
    }
  };

  // Update registry
  const updateRegistry = async () => {
    if (!selectedRegistry) return;

    try {
      setFormErrors({});

      // Basic validation
      const errors: Record<string, string> = {};
      if (!formData.name.trim()) errors.name = "Registry name is required";
      if (!formData.docker_username.trim())
        errors.docker_username = "Username is required";
      if (!formData.docker_server.trim())
        errors.docker_server = "Server URL is required";

      if (Object.keys(errors).length > 0) {
        setFormErrors(errors);
        return;
      }

      const updateData: any = {
        name: formData.name,
        docker_username: formData.docker_username,
        docker_server: formData.docker_server,
      };

      // Only include password if it was changed
      if (formData.docker_password.trim()) {
        updateData.docker_password = formData.docker_password;
      }

      const response = await apiFetch(
        buildApiUrl(`container-registries/${selectedRegistry.id}`),
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify(updateData),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.detail || "Failed to update container registry"
        );
      }

      setOpenEdit(false);
      setSelectedRegistry(null);
      fetchRegistries();
    } catch (err: any) {
      console.error("Failed to update container registry:", err);
      setError(err.message || "Failed to update container registry");
    }
  };

  // Delete registry
  const deleteRegistry = async () => {
    if (!selectedRegistry) return;

    try {
      const response = await apiFetch(
        buildApiUrl(`container-registries/${selectedRegistry.id}`),
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.detail || "Failed to delete container registry"
        );
      }

      setOpenDelete(false);
      setSelectedRegistry(null);
      fetchRegistries();
      fetchImages(); // Refresh images as they might be affected
    } catch (err: any) {
      console.error("Failed to delete container registry:", err);
      setError(err.message || "Failed to delete container registry");
    }
  };

  // Update docker image
  const updateDockerImage = async () => {
    if (!selectedImage) return;

    try {
      setImageFormErrors({});

      // Basic validation
      const errors: Record<string, string> = {};
      if (!imageFormData.name.trim()) errors.name = "Image name is required";
      if (!imageFormData.image_tag.trim())
        errors.image_tag = "Image tag is required";

      if (Object.keys(errors).length > 0) {
        setImageFormErrors(errors);
        return;
      }

      const response = await apiFetch(
        buildApiUrl(`container-registries/images/${selectedImage.id}`),
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify(imageFormData),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to update docker image");
      }

      setOpenEditImage(false);
      setSelectedImage(null);
      fetchImages();
    } catch (err: any) {
      console.error("Failed to update docker image:", err);
      setError(err.message || "Failed to update docker image");
    }
  };

  // Delete docker image
  const deleteDockerImage = async () => {
    if (!selectedImage) return;

    try {
      const response = await apiFetch(
        buildApiUrl(`container-registries/images/${selectedImage.id}`),
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to delete docker image");
      }

      setOpenDeleteImage(false);
      setSelectedImage(null);
      fetchImages();
    } catch (err: any) {
      console.error("Failed to delete docker image:", err);
      setError(err.message || "Failed to delete docker image");
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      name: "",
      docker_username: "",
      docker_password: "",
      docker_server: "",
    });
    setFormErrors({});
    setShowPassword(false);
  };

  const resetImageForm = () => {
    setImageFormData({
      name: "",
      image_tag: "",
      description: "",
      container_registry_id: "",
    });
    setImageFormErrors({});
  };

  // Open add modal
  const handleOpenAdd = () => {
    resetForm();
    setOpenAdd(true);
  };

  // Open add image modal
  const handleOpenAddImage = () => {
    resetImageForm();
    setOpenAddImage(true);
  };

  // Open edit modal
  const handleOpenEdit = (registry: ContainerRegistry) => {
    setSelectedRegistry(registry);
    setFormData({
      name: registry.name,
      docker_username: registry.docker_username,
      docker_password: "", // Don't populate password for security
      docker_server: registry.docker_server,
    });
    setFormErrors({});
    setShowPassword(false);
    setOpenEdit(true);
  };

  // Open view modal
  const handleOpenView = (registry: ContainerRegistry) => {
    setSelectedRegistry(registry);
    setOpenView(true);
  };

  // Open delete modal
  const handleOpenDelete = (registry: ContainerRegistry) => {
    setSelectedRegistry(registry);
    setOpenDelete(true);
  };

  // Open edit image modal
  const handleOpenEditImage = (image: DockerImage) => {
    setSelectedImage(image);
    setImageFormData({
      name: image.name,
      image_tag: image.image_tag,
      description: image.description || "",
      container_registry_id: image.container_registry_id,
    });
    setImageFormErrors({});
    setOpenEditImage(true);
  };

  // Open delete image modal
  const handleOpenDeleteImage = (image: DockerImage) => {
    setSelectedImage(image);
    setOpenDeleteImage(true);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getServerDisplayName = (server: string) => {
    // Map common registry server patterns to friendly names
    const serverPatterns = [
      { pattern: "docker.io", name: "Docker Hub" },
      { pattern: "nvcr.io", name: "NVIDIA NGC" },
      { pattern: "us.gcr.io", name: "Google Container Registry (US)" },
      { pattern: "eu.gcr.io", name: "Google Container Registry (EU)" },
      { pattern: "asia.gcr.io", name: "Google Container Registry (Asia)" },
      { pattern: "gcr.io", name: "Google Container Registry" },
      { pattern: "dkr.ecr", name: "AWS ECR" },
      { pattern: "amazonaws.com", name: "AWS ECR" },
      { pattern: "azurecr.io", name: "Azure Container Registry" },
      { pattern: "pkg.dev", name: "Google Artifact Registry" },
    ];

    // Find the first pattern that matches
    for (const { pattern, name } of serverPatterns) {
      if (server.includes(pattern)) {
        return name;
      }
    }

    // Return the original server if no pattern matches
    return server;
  };

  const getRegistryName = (registryId: string | null) => {
    if (!registryId) return "No Registry";
    const registry = registries.find((r) => r.id === registryId);
    return registry ? registry.name : "Unknown Registry";
  };

  return (
    <PageWithTitle title="Private Container Registries">
      <Box
        sx={{
          mb: 3,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Typography level="body-md" sx={{ color: "text.secondary" }}>
          Manage private Docker registry credentials for your organization.
          These can be used when launching clusters with private container
          images.
        </Typography>
        <Button startDecorator={<Plus size={20} />} onClick={handleOpenAdd}>
          Add Registry
        </Button>
      </Box>

      {error && (
        <Alert color="danger" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Server</th>
            <th>Username</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={5}>
                <Typography sx={{ textAlign: "center", py: 2 }}>
                  Loading...
                </Typography>
              </td>
            </tr>
          ) : registries.length === 0 ? (
            <tr>
              <td colSpan={5}>
                <Typography
                  sx={{ textAlign: "center", py: 2, color: "text.secondary" }}
                >
                  No container registries configured. Add one to get started.
                </Typography>
              </td>
            </tr>
          ) : (
            registries.map((registry) => (
              <tr key={registry.id}>
                <td>
                  <Typography level="body-sm" fontWeight="md">
                    {registry.name}
                  </Typography>
                </td>
                <td>
                  <Chip size="sm" variant="soft">
                    {getServerDisplayName(registry.docker_server)}
                  </Chip>
                </td>
                <td>
                  <Typography level="body-sm">
                    {registry.docker_username}
                  </Typography>
                </td>
                <td>
                  <Typography level="body-sm">
                    {formatDate(registry.created_at)}
                  </Typography>
                </td>
                <td>
                  <Box sx={{ display: "flex", gap: 1 }}>
                    <Tooltip title="View Details">
                      <IconButton
                        size="sm"
                        variant="soft"
                        onClick={() => handleOpenView(registry)}
                      >
                        <Eye size={16} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Edit">
                      <IconButton
                        size="sm"
                        variant="soft"
                        color="primary"
                        onClick={() => handleOpenEdit(registry)}
                      >
                        <Edit size={16} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton
                        size="sm"
                        variant="soft"
                        color="danger"
                        onClick={() => handleOpenDelete(registry)}
                      >
                        <Trash2 size={16} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </Table>

      {/* Docker Images Section */}
      <Box sx={{ mt: 4, mb: 3 }}>
        <Divider sx={{ mb: 3 }} />
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 3,
          }}
        >
          <Typography level="h4">Docker Images</Typography>
          <Button
            startDecorator={<Image size={20} />}
            onClick={handleOpenAddImage}
          >
            Add Image
          </Button>
        </Box>
        <Typography level="body-md" sx={{ color: "text.secondary", mb: 3 }}>
          Manage Docker images that can be used when launching clusters. You can
          optionally attach them to a container registry.
        </Typography>

        <Table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Image Tag</th>
              <th>Registry</th>
              <th>Description</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {images.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <Typography
                    sx={{ textAlign: "center", py: 2, color: "text.secondary" }}
                  >
                    No docker images configured. Add one to get started.
                  </Typography>
                </td>
              </tr>
            ) : (
              images.map((image) => (
                <tr key={image.id}>
                  <td>
                    <Typography level="body-sm" fontWeight="md">
                      {image.name}
                    </Typography>
                  </td>
                  <td>
                    <Chip size="sm" variant="soft" color="primary">
                      {image.image_tag}
                    </Chip>
                  </td>
                  <td>
                    <Typography level="body-sm">
                      {getRegistryName(image.container_registry_id)}
                    </Typography>
                  </td>
                  <td>
                    <Typography level="body-sm" sx={{ maxWidth: 200 }}>
                      {image.description || "-"}
                    </Typography>
                  </td>
                  <td>
                    <Typography level="body-sm">
                      {formatDate(image.created_at)}
                    </Typography>
                  </td>
                  <td>
                    <Box sx={{ display: "flex", gap: 1 }}>
                      <Tooltip title="Edit">
                        <IconButton
                          size="sm"
                          variant="soft"
                          color="primary"
                          onClick={() => handleOpenEditImage(image)}
                        >
                          <Edit size={16} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton
                          size="sm"
                          variant="soft"
                          color="danger"
                          onClick={() => handleOpenDeleteImage(image)}
                        >
                          <Trash2 size={16} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </Box>

      {/* Add Registry Modal */}
      <Modal open={openAdd} onClose={() => setOpenAdd(false)}>
        <ModalDialog sx={{ minWidth: 500 }}>
          <ModalClose />
          <Typography level="h4" sx={{ mb: 2 }}>
            Add Container Registry
          </Typography>
          <Stack spacing={2}>
            <FormControl error={!!formErrors.name}>
              <FormLabel>Registry Name</FormLabel>
              <Input
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g., My Private Registry"
              />
              {formErrors.name && (
                <Typography level="body-xs" color="danger">
                  {formErrors.name}
                </Typography>
              )}
            </FormControl>

            <FormControl error={!!formErrors.docker_server}>
              <FormLabel>Registry Server URL</FormLabel>
              <Input
                value={formData.docker_server}
                onChange={(e) =>
                  setFormData({ ...formData, docker_server: e.target.value })
                }
                placeholder="e.g., docker.io, nvcr.io, gcr.io"
              />
              {formErrors.docker_server && (
                <Typography level="body-xs" color="danger">
                  {formErrors.docker_server}
                </Typography>
              )}
              <Typography level="body-xs" sx={{ color: "text.secondary" }}>
                Leave empty for Docker Hub, otherwise enter the full URL (e.g.,
                your-registry.com)
              </Typography>
            </FormControl>

            <FormControl error={!!formErrors.docker_username}>
              <FormLabel>Username</FormLabel>
              <Input
                value={formData.docker_username}
                onChange={(e) =>
                  setFormData({ ...formData, docker_username: e.target.value })
                }
                placeholder="Registry username"
              />
              {formErrors.docker_username && (
                <Typography level="body-xs" color="danger">
                  {formErrors.docker_username}
                </Typography>
              )}
            </FormControl>

            <FormControl error={!!formErrors.docker_password}>
              <FormLabel>Password / Token</FormLabel>
              <Input
                type={showPassword ? "text" : "password"}
                value={formData.docker_password}
                onChange={(e) =>
                  setFormData({ ...formData, docker_password: e.target.value })
                }
                placeholder="Registry password or API token"
                endDecorator={
                  <IconButton
                    variant="plain"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </IconButton>
                }
              />
              {formErrors.docker_password && (
                <Typography level="body-xs" color="danger">
                  {formErrors.docker_password}
                </Typography>
              )}
            </FormControl>

            <Box
              sx={{
                display: "flex",
                gap: 1,
                justifyContent: "flex-end",
                mt: 2,
              }}
            >
              <Button variant="plain" onClick={() => setOpenAdd(false)}>
                Cancel
              </Button>
              <Button onClick={createRegistry}>Add Registry</Button>
            </Box>
          </Stack>
        </ModalDialog>
      </Modal>

      {/* Edit Registry Modal */}
      <Modal open={openEdit} onClose={() => setOpenEdit(false)}>
        <ModalDialog sx={{ minWidth: 500 }}>
          <ModalClose />
          <Typography level="h4" sx={{ mb: 2 }}>
            Edit Container Registry
          </Typography>
          <Stack spacing={2}>
            <FormControl error={!!formErrors.name}>
              <FormLabel>Registry Name</FormLabel>
              <Input
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g., My Private Registry"
              />
              {formErrors.name && (
                <Typography level="body-xs" color="danger">
                  {formErrors.name}
                </Typography>
              )}
            </FormControl>

            <FormControl error={!!formErrors.docker_server}>
              <FormLabel>Registry Server URL</FormLabel>
              <Input
                value={formData.docker_server}
                onChange={(e) =>
                  setFormData({ ...formData, docker_server: e.target.value })
                }
                placeholder="e.g., docker.io, nvcr.io, gcr.io"
              />
              {formErrors.docker_server && (
                <Typography level="body-xs" color="danger">
                  {formErrors.docker_server}
                </Typography>
              )}
            </FormControl>

            <FormControl error={!!formErrors.docker_username}>
              <FormLabel>Username</FormLabel>
              <Input
                value={formData.docker_username}
                onChange={(e) =>
                  setFormData({ ...formData, docker_username: e.target.value })
                }
                placeholder="Registry username"
              />
              {formErrors.docker_username && (
                <Typography level="body-xs" color="danger">
                  {formErrors.docker_username}
                </Typography>
              )}
            </FormControl>

            <FormControl>
              <FormLabel>Password / Token</FormLabel>
              <Input
                type={showPassword ? "text" : "password"}
                value={formData.docker_password}
                onChange={(e) =>
                  setFormData({ ...formData, docker_password: e.target.value })
                }
                placeholder="Leave empty to keep current password"
                endDecorator={
                  <IconButton
                    variant="plain"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </IconButton>
                }
              />
              <Typography level="body-xs" sx={{ color: "text.secondary" }}>
                Leave empty to keep the current password
              </Typography>
            </FormControl>

            <Box
              sx={{
                display: "flex",
                gap: 1,
                justifyContent: "flex-end",
                mt: 2,
              }}
            >
              <Button variant="plain" onClick={() => setOpenEdit(false)}>
                Cancel
              </Button>
              <Button onClick={updateRegistry}>Update Registry</Button>
            </Box>
          </Stack>
        </ModalDialog>
      </Modal>

      {/* View Registry Modal */}
      <Modal open={openView} onClose={() => setOpenView(false)}>
        <ModalDialog sx={{ minWidth: 400 }}>
          <ModalClose />
          <Typography level="h4" sx={{ mb: 2 }}>
            Registry Details
          </Typography>
          {selectedRegistry && (
            <Stack spacing={2}>
              <Box>
                <Typography level="body-sm" fontWeight="bold">
                  Name:
                </Typography>
                <Typography level="body-sm">{selectedRegistry.name}</Typography>
              </Box>
              <Box>
                <Typography level="body-sm" fontWeight="bold">
                  Server:
                </Typography>
                <Typography level="body-sm">
                  {getServerDisplayName(selectedRegistry.docker_server)}
                </Typography>
              </Box>
              <Box>
                <Typography level="body-sm" fontWeight="bold">
                  Username:
                </Typography>
                <Typography level="body-sm">
                  {selectedRegistry.docker_username}
                </Typography>
              </Box>
              <Box>
                <Typography level="body-sm" fontWeight="bold">
                  Created:
                </Typography>
                <Typography level="body-sm">
                  {formatDate(selectedRegistry.created_at)}
                </Typography>
              </Box>
              <Box>
                <Typography level="body-sm" fontWeight="bold">
                  Last Updated:
                </Typography>
                <Typography level="body-sm">
                  {formatDate(selectedRegistry.updated_at)}
                </Typography>
              </Box>
            </Stack>
          )}
        </ModalDialog>
      </Modal>

      {/* Delete Registry Modal */}
      <Modal open={openDelete} onClose={() => setOpenDelete(false)}>
        <ModalDialog>
          <ModalClose />
          <Typography level="h4" sx={{ mb: 2 }}>
            Delete Registry
          </Typography>
          <Typography sx={{ mb: 3 }}>
            Are you sure you want to delete the registry "
            {selectedRegistry?.name}"? This action cannot be undone.
          </Typography>
          <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
            <Button variant="plain" onClick={() => setOpenDelete(false)}>
              Cancel
            </Button>
            <Button color="danger" onClick={deleteRegistry}>
              Delete
            </Button>
          </Box>
        </ModalDialog>
      </Modal>

      {/* Add Docker Image Modal */}
      <Modal open={openAddImage} onClose={() => setOpenAddImage(false)}>
        <ModalDialog sx={{ minWidth: 500 }}>
          <ModalClose />
          <Typography level="h4" sx={{ mb: 2 }}>
            Add Docker Image
          </Typography>
          <Stack spacing={2}>
            <FormControl error={!!imageFormErrors.name}>
              <FormLabel>Image Name</FormLabel>
              <Input
                value={imageFormData.name}
                onChange={(e) =>
                  setImageFormData({ ...imageFormData, name: e.target.value })
                }
                placeholder="e.g., My Custom Image"
              />
              {imageFormErrors.name && (
                <Typography level="body-xs" color="danger">
                  {imageFormErrors.name}
                </Typography>
              )}
            </FormControl>

            <FormControl error={!!imageFormErrors.image_tag}>
              <FormLabel>Image Tag</FormLabel>
              <Input
                value={imageFormData.image_tag}
                onChange={(e) =>
                  setImageFormData({
                    ...imageFormData,
                    image_tag: e.target.value,
                  })
                }
                placeholder="e.g., myapp:latest, nvidia/cuda:11.8-base"
              />
              {imageFormErrors.image_tag && (
                <Typography level="body-xs" color="danger">
                  {imageFormErrors.image_tag}
                </Typography>
              )}
            </FormControl>

            <FormControl>
              <FormLabel>Container Registry (optional)</FormLabel>
              <select
                value={imageFormData.container_registry_id || ""}
                onChange={(e) =>
                  setImageFormData({
                    ...imageFormData,
                    container_registry_id: e.target.value || undefined,
                  })
                }
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid #ccc",
                  borderRadius: "6px",
                  fontSize: "14px",
                }}
              >
                <option value="">No Registry (Public Image)</option>
                {registries.map((registry) => (
                  <option key={registry.id} value={registry.id}>
                    {registry.name} (
                    {getServerDisplayName(registry.docker_server)})
                  </option>
                ))}
              </select>
              <Typography level="body-xs" sx={{ color: "text.secondary" }}>
                Leave empty for public images. Select a registry for private
                images.
              </Typography>
            </FormControl>

            <FormControl>
              <FormLabel>Description (optional)</FormLabel>
              <Input
                value={imageFormData.description || ""}
                onChange={(e) =>
                  setImageFormData({
                    ...imageFormData,
                    description: e.target.value,
                  })
                }
                placeholder="Brief description of this image"
              />
            </FormControl>

            <Box
              sx={{
                display: "flex",
                gap: 1,
                justifyContent: "flex-end",
                mt: 2,
              }}
            >
              <Button variant="plain" onClick={() => setOpenAddImage(false)}>
                Cancel
              </Button>
              <Button onClick={createDockerImage}>Add Image</Button>
            </Box>
          </Stack>
        </ModalDialog>
      </Modal>

      {/* Edit Docker Image Modal */}
      <Modal open={openEditImage} onClose={() => setOpenEditImage(false)}>
        <ModalDialog sx={{ minWidth: 500 }}>
          <ModalClose />
          <Typography level="h4" sx={{ mb: 2 }}>
            Edit Docker Image
          </Typography>
          <Stack spacing={2}>
            <FormControl error={!!imageFormErrors.name}>
              <FormLabel>Image Name</FormLabel>
              <Input
                value={imageFormData.name}
                onChange={(e) =>
                  setImageFormData({ ...imageFormData, name: e.target.value })
                }
                placeholder="e.g., My Custom Image"
              />
              {imageFormErrors.name && (
                <Typography level="body-xs" color="danger">
                  {imageFormErrors.name}
                </Typography>
              )}
            </FormControl>

            <FormControl error={!!imageFormErrors.image_tag}>
              <FormLabel>Image Tag</FormLabel>
              <Input
                value={imageFormData.image_tag}
                onChange={(e) =>
                  setImageFormData({
                    ...imageFormData,
                    image_tag: e.target.value,
                  })
                }
                placeholder="e.g., myapp:latest, nvidia/cuda:11.8-base"
              />
              {imageFormErrors.image_tag && (
                <Typography level="body-xs" color="danger">
                  {imageFormErrors.image_tag}
                </Typography>
              )}
            </FormControl>

            <FormControl>
              <FormLabel>Description (optional)</FormLabel>
              <Input
                value={imageFormData.description || ""}
                onChange={(e) =>
                  setImageFormData({
                    ...imageFormData,
                    description: e.target.value,
                  })
                }
                placeholder="Brief description of this image"
              />
            </FormControl>

            <Box
              sx={{
                display: "flex",
                gap: 1,
                justifyContent: "flex-end",
                mt: 2,
              }}
            >
              <Button variant="plain" onClick={() => setOpenEditImage(false)}>
                Cancel
              </Button>
              <Button onClick={updateDockerImage}>Update Image</Button>
            </Box>
          </Stack>
        </ModalDialog>
      </Modal>

      {/* Delete Docker Image Modal */}
      <Modal open={openDeleteImage} onClose={() => setOpenDeleteImage(false)}>
        <ModalDialog>
          <ModalClose />
          <Typography level="h4" sx={{ mb: 2 }}>
            Delete Docker Image
          </Typography>
          <Typography sx={{ mb: 3 }}>
            Are you sure you want to delete the docker image "
            {selectedImage?.name}"? This action cannot be undone.
          </Typography>
          <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
            <Button variant="plain" onClick={() => setOpenDeleteImage(false)}>
              Cancel
            </Button>
            <Button color="danger" onClick={deleteDockerImage}>
              Delete
            </Button>
          </Box>
        </ModalDialog>
      </Modal>
    </PageWithTitle>
  );
};

export default PrivateContainerRegistry;

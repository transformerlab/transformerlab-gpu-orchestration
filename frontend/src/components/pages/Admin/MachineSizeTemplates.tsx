import React from "react";
import useSWR from "swr";
import {
  Box,
  Button,
  Card,
  Typography,
  Stack,
  FormControl,
  FormLabel,
  Input,
  Textarea,
  Select,
  Option,
  Table,
  Modal,
  ModalDialog,
  ModalClose,
} from "@mui/joy";
import Switch from "@mui/joy/Switch";
import { buildApiUrl, apiFetch } from "../../../utils/api";
import { useNotification } from "../../NotificationSystem";
import PageWithTitle from "../templates/PageWithTitle";

const fetcher = (url: string) =>
  apiFetch(url, { credentials: "include" }).then((r) => r.json());

const MachineSizeTemplates: React.FC = () => {
  const { addNotification } = useNotification();
  const { data, mutate, isLoading } = useSWR(
    buildApiUrl("admin/machine-size-templates"),
    fetcher
  );

  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [cloudType, setCloudType] = React.useState<string>("runpod");
  const [cloudIdentifier, setCloudIdentifier] = React.useState<string>("");
  // RunPod fields
  const [rpAccelerators, setRpAccelerators] = React.useState<string>("");
  const [rpDiskSpace, setRpDiskSpace] = React.useState<string>("");
  const [rpDockerImageId, setRpDockerImageId] = React.useState<string>("");
  const [rpGpuTypes, setRpGpuTypes] = React.useState<any[]>([]);
  // Azure fields
  const [azInstanceType, setAzInstanceType] = React.useState<string>("");
  const [azRegion, setAzRegion] = React.useState<string>("");
  const [azDiskSpace, setAzDiskSpace] = React.useState<string>("");
  const [azUseSpot, setAzUseSpot] = React.useState<boolean>(false);
  const [azIdleAutostop, setAzIdleAutostop] = React.useState<string>("");
  const [azDockerImageId, setAzDockerImageId] = React.useState<string>("");
  const [azBucketIds, setAzBucketIds] = React.useState<string[]>([]);
  const [azInstanceTypes, setAzInstanceTypes] = React.useState<string[]>([]);
  const [azRegions, setAzRegions] = React.useState<string[]>([]);
  // SSH fields
  const [sshNodePoolName, setSshNodePoolName] = React.useState<string>("");
  const [sshCpus, setSshCpus] = React.useState<string>("");
  const [sshMemory, setSshMemory] = React.useState<string>("");
  const [sshAccelerators, setSshAccelerators] = React.useState<string>("");
  const [sshDiskSpace, setSshDiskSpace] = React.useState<string>("");
  const [sshDockerImageId, setSshDockerImageId] = React.useState<string>("");
  // Shared metadata
  const [dockerImages, setDockerImages] = React.useState<any[]>([]);
  const [storageBuckets, setStorageBuckets] = React.useState<any[]>([]);

  const [createOpen, setCreateOpen] = React.useState(false);

  React.useEffect(() => {
    // Docker images
    apiFetch(buildApiUrl("container-registries/images/available"), {
      credentials: "include",
    })
      .then(async (r) => (r.ok ? r.json() : []))
      .then(setDockerImages)
      .catch(() => setDockerImages([]));
    // Storage buckets
    apiFetch(buildApiUrl("storage-buckets/available"), {
      credentials: "include",
    })
      .then(async (r) => (r.ok ? r.json() : []))
      .then(setStorageBuckets)
      .catch(() => setStorageBuckets([]));
    // RunPod GPU list
    apiFetch(buildApiUrl("clouds/runpod/info"), { credentials: "include" })
      .then(async (r) => (r.ok ? r.json() : null))
      .then((data) => setRpGpuTypes(data?.display_options_with_pricing || []))
      .catch(() => setRpGpuTypes([]));
    // Azure info
    apiFetch(buildApiUrl("clouds/azure/info"), { credentials: "include" })
      .then(async (r) => (r.ok ? r.json() : null))
      .then((data) => {
        setAzInstanceTypes(data?.instance_types || []);
        setAzRegions(data?.regions || []);
      })
      .catch(() => {
        setAzInstanceTypes([]);
        setAzRegions([]);
      });
  }, []);

  const onCreate = async () => {
    try {
      // Build resources_json from cloud-specific fields
      let parsed: any = {};
      if (cloudType === "runpod") {
        parsed = {
          accelerators: rpAccelerators || undefined,
          disk_space: rpDiskSpace ? Number(rpDiskSpace) : undefined,
          docker_image_id: rpDockerImageId || undefined,
        };
      } else if (cloudType === "azure") {
        parsed = {
          instance_type: azInstanceType || undefined,
          region: azRegion || undefined,
          disk_space: azDiskSpace ? Number(azDiskSpace) : undefined,
          use_spot: Boolean(azUseSpot),
          idle_minutes_to_autostop: azIdleAutostop
            ? Number(azIdleAutostop)
            : undefined,
          storage_bucket_ids:
            azBucketIds && azBucketIds.length > 0 ? azBucketIds : undefined,
          docker_image_id: azDockerImageId || undefined,
        };
      } else if (cloudType === "ssh") {
        parsed = {
          cpus: sshCpus || undefined,
          memory: sshMemory || undefined,
          accelerators: sshAccelerators || undefined,
          disk_space: sshDiskSpace ? Number(sshDiskSpace) : undefined,
          docker_image_id: sshDockerImageId || undefined,
        };
      }
      const body = {
        name: name || undefined,
        description: description || undefined,
        cloud_type: cloudType,
        cloud_identifier:
          cloudType === "ssh"
            ? sshNodePoolName || cloudIdentifier || undefined
            : undefined,
        resources_json: parsed,
      };
      const res = await apiFetch(buildApiUrl("admin/machine-size-templates"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to create template");
      }
      addNotification({ type: "success", message: "Template created" });
      setName("");
      setDescription("");
      setCloudType("runpod");
      setCloudIdentifier("");
      // reset cloud-specific fields
      setRpAccelerators("");
      setRpDiskSpace("");
      setRpDockerImageId("");
      setAzInstanceType("");
      setAzRegion("");
      setAzDiskSpace("");
      setAzUseSpot(false);
      setAzIdleAutostop("");
      setAzDockerImageId("");
      setAzBucketIds([]);
      setSshNodePoolName("");
      setSshCpus("");
      setSshMemory("");
      setSshAccelerators("");
      setSshDiskSpace("");
      setSshDockerImageId("");
      mutate();
      setCreateOpen(false);
    } catch (e: any) {
      addNotification({ type: "danger", message: String(e.message || e) });
    }
  };

  const onDelete = async (id: string) => {
    try {
      const res = await apiFetch(
        buildApiUrl(`admin/machine-size-templates/${id}`),
        { method: "DELETE", credentials: "include" }
      );
      if (!res.ok) throw new Error("Delete failed");
      addNotification({ type: "success", message: "Template deleted" });
      mutate();
    } catch (e: any) {
      addNotification({ type: "danger", message: String(e.message || e) });
    }
  };

  const templates = data?.templates || [];

  return (
    <PageWithTitle
      title="Machine Size Templates"
      button={<Button onClick={() => setCreateOpen(true)}>New Template</Button>}
      sticky
    >
      <Modal open={createOpen} onClose={() => setCreateOpen(false)}>
        <ModalDialog
          sx={{
            maxWidth: 700,
            width: "90%",
            maxHeight: "85vh",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <ModalClose />
          <Typography level="h4" sx={{ mb: 1 }}>
            New Machine Size Template
          </Typography>
          <Box sx={{ overflowY: "auto", pr: 1 }}>
            <Stack direction="column" spacing={2}>
              <FormControl>
                <FormLabel>Name</FormLabel>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </FormControl>
              <FormControl>
                <FormLabel>Description</FormLabel>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </FormControl>
              <FormControl>
                <FormLabel>Cloud Type</FormLabel>
                <Select
                  value={cloudType}
                  onChange={(_, v) => setCloudType(v || "runpod")}
                >
                  <Option value="runpod">RunPod</Option>
                  <Option value="azure">Azure</Option>
                  <Option value="ssh">SSH</Option>
                </Select>
              </FormControl>
              {/* Field-based forms per cloud */}
              {cloudType === "runpod" && (
                <>
                  <FormControl>
                    <FormLabel>Accelerators</FormLabel>
                    <Select
                      value={rpAccelerators}
                      onChange={(_, v) => setRpAccelerators(v || "")}
                      placeholder="Select accelerator"
                    >
                      {(rpGpuTypes || []).map((gpu: any) => (
                        <Option key={gpu.name} value={gpu.name}>
                          {gpu.display_name}
                        </Option>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl>
                    <FormLabel>Disk Space (GB) - Optional</FormLabel>
                    <Input
                      value={rpDiskSpace}
                      onChange={(e) => setRpDiskSpace(e.target.value)}
                      placeholder="e.g. 100"
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Docker Image (optional)</FormLabel>
                    <Select
                      value={rpDockerImageId}
                      onChange={(_, v) => setRpDockerImageId(v || "")}
                      placeholder="Select docker image"
                    >
                      {(dockerImages || []).map((img: any) => (
                        <Option key={img.id} value={img.id}>
                          {img.name} ({img.image_tag})
                        </Option>
                      ))}
                    </Select>
                  </FormControl>
                </>
              )}
              {cloudType === "azure" && (
                <>
                  <FormControl>
                    <FormLabel>Instance Type</FormLabel>
                    <Select
                      value={azInstanceType}
                      onChange={(_, v) => setAzInstanceType(v || "")}
                      placeholder="Select instance type"
                    >
                      {(azInstanceTypes || []).map((t) => (
                        <Option key={t} value={t}>
                          {t}
                        </Option>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl>
                    <FormLabel>Region</FormLabel>
                    <Select
                      value={azRegion}
                      onChange={(_, v) => setAzRegion(v || "")}
                      placeholder="Select region"
                    >
                      {(azRegions || []).map((r) => (
                        <Option key={r} value={r}>
                          {r}
                        </Option>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl>
                    <FormLabel>Disk Space (GB) - Optional</FormLabel>
                    <Input
                      value={azDiskSpace}
                      onChange={(e) => setAzDiskSpace(e.target.value)}
                      placeholder="e.g. 100"
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Use Spot Instances</FormLabel>
                    <Switch
                      checked={azUseSpot}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setAzUseSpot(e.target.checked)
                      }
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Auto-stop after idle (minutes)</FormLabel>
                    <Input
                      value={azIdleAutostop}
                      onChange={(e) => setAzIdleAutostop(e.target.value)}
                      placeholder="e.g. 30"
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Docker Image (optional)</FormLabel>
                    <Select
                      value={azDockerImageId}
                      onChange={(_, v) => setAzDockerImageId(v || "")}
                      placeholder="Select docker image"
                    >
                      {(dockerImages || []).map((img: any) => (
                        <Option key={img.id} value={img.id}>
                          {img.name} ({img.image_tag})
                        </Option>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl>
                    <FormLabel>Storage Buckets (optional)</FormLabel>
                    <Select
                      multiple
                      value={azBucketIds}
                      onChange={(_, v) => setAzBucketIds(v || [])}
                      placeholder="Select buckets"
                    >
                      {(storageBuckets || []).map((b: any) => (
                        <Option key={b.id} value={b.id}>
                          {b.name} ({b.remote_path}) - {b.mode}
                        </Option>
                      ))}
                    </Select>
                  </FormControl>
                </>
              )}
              {cloudType === "ssh" && (
                <>
                  <FormControl>
                    <FormLabel>Node Pool Name</FormLabel>
                    <Input
                      value={sshNodePoolName}
                      onChange={(e) => setSshNodePoolName(e.target.value)}
                      placeholder="ssh node pool name"
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel>CPUs</FormLabel>
                    <Input
                      value={sshCpus}
                      onChange={(e) => setSshCpus(e.target.value)}
                      placeholder="e.g. 4"
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Memory (GB)</FormLabel>
                    <Input
                      value={sshMemory}
                      onChange={(e) => setSshMemory(e.target.value)}
                      placeholder="e.g. 16"
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Accelerators</FormLabel>
                    <Input
                      value={sshAccelerators}
                      onChange={(e) => setSshAccelerators(e.target.value)}
                      placeholder="e.g. V100:2"
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Disk Space (GB) - Optional</FormLabel>
                    <Input
                      value={sshDiskSpace}
                      onChange={(e) => setSshDiskSpace(e.target.value)}
                      placeholder="e.g. 100"
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Docker Image (optional)</FormLabel>
                    <Select
                      value={sshDockerImageId}
                      onChange={(_, v) => setSshDockerImageId(v || "")}
                      placeholder="Select docker image"
                    >
                      {(dockerImages || []).map((img: any) => (
                        <Option key={img.id} value={img.id}>
                          {img.name} ({img.image_tag})
                        </Option>
                      ))}
                    </Select>
                  </FormControl>
                </>
              )}
            </Stack>
          </Box>
          <Box
            sx={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 1,
              pt: 2,
              borderTop: "1px solid",
              borderColor: "divider",
            }}
          >
            <Button variant="plain" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={onCreate}>Create Template</Button>
          </Box>
        </ModalDialog>
      </Modal>

      <Card sx={{ p: 2 }}>
        <Typography level="title-md" sx={{ mb: 2 }}>
          Existing Templates
        </Typography>
        {isLoading ? (
          <Typography>Loading...</Typography>
        ) : templates.length === 0 ? (
          <Typography>No templates found.</Typography>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Cloud</th>
                <th>Description</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t: any) => (
                <tr key={t.id}>
                  <td>{t.name || t.id}</td>
                  <td>
                    {t.cloud_type}
                    {t.cloud_identifier ? `/${t.cloud_identifier}` : ""}
                  </td>
                  <td>{t.description || ""}</td>
                  <td>
                    <Button
                      size="sm"
                      color="danger"
                      onClick={() => onDelete(t.id)}
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </PageWithTitle>
  );
};

export default MachineSizeTemplates;

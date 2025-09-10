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
  // Cloud-agnostic fields (cpus, memory, accelerators, disk_space)
  const [cpus, setCpus] = React.useState<string>("");
  const [memory, setMemory] = React.useState<string>("");
  const [accelerators, setAccelerators] = React.useState<string>("");
  const [diskSpace, setDiskSpace] = React.useState<string>("");

  const [createOpen, setCreateOpen] = React.useState(false);

  // No need for cloud-specific data fetching since templates are now cloud-agnostic

  const onCreate = async () => {
    try {
      // Build resources_json with cloud-agnostic fields
      const parsed: any = {};
      if (cpus) parsed.cpus = cpus;
      if (memory) parsed.memory = memory;
      if (accelerators) parsed.accelerators = accelerators;
      if (diskSpace) parsed.disk_space = diskSpace;

      const body = {
        name: name || undefined,
        description: description || undefined,
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
      setCpus("");
      setMemory("");
      setAccelerators("");
      setDiskSpace("");
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
                <FormLabel>CPUs</FormLabel>
                <Input
                  value={cpus}
                  onChange={(e) => setCpus(e.target.value)}
                  placeholder="e.g. 4"
                />
              </FormControl>
              <FormControl>
                <FormLabel>Memory (GB)</FormLabel>
                <Input
                  value={memory}
                  onChange={(e) => setMemory(e.target.value)}
                  placeholder="e.g. 16"
                />
              </FormControl>
              <FormControl>
                <FormLabel>Accelerators</FormLabel>
                <Input
                  value={accelerators}
                  onChange={(e) => setAccelerators(e.target.value)}
                  placeholder="e.g. V100:2, A100:1"
                />
              </FormControl>
              <FormControl>
                <FormLabel>Disk Space (GB)</FormLabel>
                <Input
                  value={diskSpace}
                  onChange={(e) => setDiskSpace(e.target.value)}
                  placeholder="e.g. 100"
                />
              </FormControl>
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
                <th>Description</th>
                <th>Resources</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t: any) => (
                <tr key={t.id}>
                  <td>{t.name || t.id}</td>
                  <td>{t.description || ""}</td>
                  <td>
                    {Object.entries(t.resources_json || {}).map(
                      ([key, value]) => (
                        <div key={key}>
                          <strong>{key}:</strong> {String(value)}
                        </div>
                      )
                    )}
                  </td>
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

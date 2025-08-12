import React from "react";
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
  Textarea,
  FormControl,
  FormLabel,
} from "@mui/joy";
import { Plus, Edit, Trash2 } from "lucide-react";
import PageWithTitle from "../templates/PageWithTitle";
import { useFakeData } from "../../../context/FakeDataContext";

// Fake placeholder data for volumes
const fakeVolumes = [
  {
    name: "data-volume",
    infra: "kubernetes",
    status: "available",
    size: "10Gi",
    user: "admin",
    lastUse: "2023-10-15",
    type: "k8s-pvc",
    usedBy: ["job-123", "job-456"],
  },
  {
    name: "ml-datasets",
    infra: "k8s/prod-cluster",
    status: "in-use",
    size: "100Gi",
    user: "data-scientist",
    lastUse: "2023-10-17",
    type: "network",
    usedBy: ["job-789"],
  },
  {
    name: "temp-storage",
    infra: "kubernetes",
    status: "available",
    size: "50Gi",
    user: "system",
    lastUse: "2023-10-10",
    type: "instance",
    usedBy: [],
  },
];

const yamlTemplate = `# volume.yaml
name: new-volume
type: k8s-pvc
infra: kubernetes  # or k8s or k8s/context
size: 10Gi
config:
  namespace: default  # optional
  storage_class_name: csi-mounted-fs-path-sc  # optional
  access_mode: ReadWriteMany  # optional`;

const Volumes: React.FC = () => {
  const [openAdd, setOpenAdd] = React.useState(false);
  const { showFakeData } = useFakeData();
  const [volumeConfig, setVolumeConfig] = React.useState(yamlTemplate);

  return (
    <PageWithTitle
      title="Volumes"
      subtitle="Create and manage volumes for your workloads."
      button={
        <Button
          variant="solid"
          color="primary"
          startDecorator={<Plus size={16} />}
          onClick={() => setOpenAdd(true)}
        >
          Add
        </Button>
      }
    >
      <style>{`
        .volumes-table td {
          word-break: normal;
          max-width: 200px;
          overflow-wrap: anywhere;
        }
      `}</style>
      {showFakeData ? (
        <>
          <Table className="volumes-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Infra</th>
                <th>Status</th>
                <th>Size</th>
                <th>User</th>
                <th>Last Use</th>
                <th>Type</th>
                <th>Used By</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {fakeVolumes.map((volume) => (
                <tr key={volume.name}>
                  <td>{volume.name}</td>
                  <td>{volume.infra}</td>
                  <td>
                    <Chip
                      size="sm"
                      color={
                        volume.status === "available" ? "success" : "warning"
                      }
                    >
                      {volume.status}
                    </Chip>
                  </td>
                  <td>{volume.size}</td>
                  <td>{volume.user}</td>
                  <td>{volume.lastUse}</td>
                  <td>
                    <Chip size="sm" variant="soft">
                      {volume.type}
                    </Chip>
                  </td>
                  <td>
                    {volume.usedBy.length > 0 ? volume.usedBy.join(", ") : "-"}
                  </td>
                  <td>
                    <Box sx={{ display: "flex", gap: 1 }}>
                      <Button size="sm" variant="plain" color="neutral">
                        <Edit size={16} />
                      </Button>
                      <Button size="sm" variant="plain" color="danger">
                        <Trash2 size={16} />
                      </Button>
                    </Box>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </>
      ) : (
        <Alert color="info" sx={{ mb: 2 }}>
          Volumes management functionality is not yet implemented. Enable fake
          data in Settings to see sample data.
        </Alert>
      )}

      {/* Add Volume Modal (Fake) */}
      <Modal open={openAdd} onClose={() => setOpenAdd(false)}>
        <ModalDialog sx={{ width: 500, maxWidth: "100%" }}>
          <Typography level="h4">Add Volume</Typography>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {/* <FormControl>
              <FormLabel>Volume Configuration (YAML)</FormLabel>
              <Textarea
                minRows={10}
                value={volumeConfig}
                onChange={(e) => setVolumeConfig(e.target.value)}
                sx={{ fontFamily: "monospace" }}
              />
            </FormControl> */}

            <Input placeholder="Name (e.g. data-volume)" />

            <Select defaultValue="k8s-pvc">
              <Option value="k8s-pvc">k8s-pvc</Option>
              <Option value="network">network</Option>
              <Option value="instance">instance</Option>
            </Select>

            <Input placeholder="Infrastructure (e.g. kubernetes, k8s/context)" />
            <Input placeholder="Size (e.g. 10Gi)" />

            <FormControl>
              <FormLabel>Advanced Configuration</FormLabel>
              <Checkbox>Persistent</Checkbox>
            </FormControl>

            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button
                variant="plain"
                color="neutral"
                onClick={() => setOpenAdd(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  setOpenAdd(false);
                  // In a real app, this would create the volume
                }}
              >
                Create Volume
              </Button>
            </Stack>
          </Stack>
        </ModalDialog>
      </Modal>
    </PageWithTitle>
  );
};

export default Volumes;

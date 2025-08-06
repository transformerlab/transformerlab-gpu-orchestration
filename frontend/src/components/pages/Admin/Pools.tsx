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
} from "@mui/joy";
import { Plus } from "lucide-react";
import PageWithTitle from "../templates/PageWithTitle";
import { useFakeData } from "../../../context/FakeDataContext";

// Fake placeholder data
const fakeNodePools = [
  {
    name: "Azure Production Training",
    platform: "azure",
    numberOfNodes: 128,
    status: "enabled",
    access: ["Research Team", "Admin"],
  },
  {
    name: "Azure Staging",
    platform: "azure",
    numberOfNodes: 10,
    status: "disabled",
    access: ["Admin", "Search ML Team"],
  },
  {
    name: "Vector Institute Pool",
    platform: "direct",
    numberOfNodes: 205,
    status: "enabled",
    access: ["Research Team", "Post-Training Team"],
  },
  {
    name: "On Premises Pool",
    platform: "gcp",
    numberOfNodes: 10,
    status: "enabled",
    access: ["Admin", "Search ML Team", "Post-Training Team"],
  },
];

const ObjectStorage: React.FC = () => {
  const [openAdd, setOpenAdd] = React.useState(false);
  const { showFakeData } = useFakeData();

  return (
    <PageWithTitle
      title="Node Pools"
      subtitle="Add and manage object storage locations (S3, GCS, Azure, etc)."
      button={
        <Button
          variant="solid"
          color="primary"
          startDecorator={<Plus size={16} />}
          onClick={() => setOpenAdd(true)}
        >
          Add Node Pool
        </Button>
      }
    >
      {showFakeData ? (
        <>
          <Table className="object-storage-table">
            <thead>
              <tr>
                <th>Pool Name</th>
                <th>Platform</th>
                <th>Nodes</th>
                <th>Status</th>
                <th>Access</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {fakeNodePools.map((pool) => (
                <tr key={pool.name}>
                  <td>
                    <Typography level="title-sm">{pool.name}</Typography>
                  </td>
                  <td>
                    <Chip size="sm" variant="soft">
                      {pool.platform}
                    </Chip>
                  </td>
                  <td>
                    <Typography level="body-sm" fontWeight="lg">
                      {pool.numberOfNodes}
                    </Typography>
                  </td>
                  <td>
                    <Chip
                      size="sm"
                      color={pool.status === "enabled" ? "success" : "warning"}
                    >
                      {pool.status}
                    </Chip>
                  </td>
                  <td>
                    <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                      {pool.access.map((team) => (
                        <Chip
                          key={team}
                          size="sm"
                          variant="soft"
                          color={
                            team === "Admin"
                              ? "success"
                              : team === "Research Team"
                              ? "primary"
                              : team === "Search ML Team"
                              ? "warning"
                              : "success"
                          }
                        >
                          {team}
                        </Chip>
                      ))}
                    </Box>
                  </td>
                  <td>
                    <Button size="sm" variant="outlined">
                      Configure
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </>
      ) : (
        <Alert color="primary" sx={{ mb: 2 }}>
          Node pool management functionality is not yet implemented. Enable fake
          data in Settings to see sample data.
        </Alert>
      )}

      {/* Add Node Pool Modal (Fake) */}
      <Modal open={openAdd} onClose={() => setOpenAdd(false)}>
        <ModalDialog>
          <Typography level="h4">Add Node Pool</Typography>
          <Stack spacing={2} direction="column" sx={{ mt: 1 }}>
            <Typography level="body-md">Choose a platform:</Typography>
            <Stack direction="column" spacing={1}>
              <Button variant="outlined">Azure</Button>
              <Button variant="outlined">GCP</Button>
              <Button variant="outlined">Runpod</Button>
              <Button variant="outlined">Direct Connect</Button>
            </Stack>
            <Button onClick={() => setOpenAdd(false)}>Cancel</Button>
          </Stack>
        </ModalDialog>
      </Modal>
    </PageWithTitle>
  );
};

export default ObjectStorage;

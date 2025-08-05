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
  Alert,
} from "@mui/joy";
import { Plus, UserPlus } from "lucide-react";
import PageWithTitle from "../templates/PageWithTitle";
import { useFakeData } from "../../../context/FakeDataContext";
import { useAuth } from "../../../context/AuthContext";

// Fake placeholder data
const fakeTeams = [
  {
    name: "DevOps",
    users: ["Alice Johnson", "Bob Smith"],
  },
  {
    name: "Backend",
    users: ["Carol Lee"],
  },
];

const fakeAllUsers = ["Alice Johnson", "Bob Smith", "Carol Lee", "David Kim"];

const Teams: React.FC = () => {
  const { user } = useAuth();
  const [openCreate, setOpenCreate] = React.useState(false);
  const [openAddUser, setOpenAddUser] = React.useState(false);
  const [selectedTeam, setSelectedTeam] = React.useState<string | null>(null);
  const { showFakeData } = useFakeData();
  const isAdmin = user?.role === "admin";

  return (
    <PageWithTitle
      title="Teams"
      subtitle="Manage teams and add users to teams."
      button={
        isAdmin ? (
          <Button
            variant="solid"
            color="primary"
            startDecorator={<Plus size={16} />}
            onClick={() => setOpenCreate(true)}
          >
            Create Team
          </Button>
        ) : undefined
      }
    >
      {showFakeData ? (
        <>
          <Alert color="warning" sx={{ mb: 2 }}>
            This page is showing sample data. Real team management functionality
            will be implemented soon.
          </Alert>
          <Table>
            <thead>
              <tr>
                <th>Team</th>
                <th>Users</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {fakeTeams.map((team) => (
                <tr key={team.name}>
                  <td>{team.name}</td>
                  <td>
                    <Stack direction="row" spacing={1}>
                      {team.users.map((user) => (
                        <Chip key={user} size="sm">
                          {user}
                        </Chip>
                      ))}
                    </Stack>
                  </td>
                  <td>
                    {isAdmin ? (
                      <Button
                        size="sm"
                        variant="outlined"
                        startDecorator={<UserPlus size={14} />}
                        onClick={() => {
                          setSelectedTeam(team.name);
                          setOpenAddUser(true);
                        }}
                      >
                        Add User
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </>
      ) : (
        <Alert color="primary" sx={{ mb: 2 }}>
          Team management functionality is not yet implemented. Enable fake data
          in Settings to see sample data.
        </Alert>
      )}

      {/* Create Team Modal (Fake) */}
      <Modal open={openCreate} onClose={() => setOpenCreate(false)}>
        <ModalDialog>
          <Typography level="h4">Create Team</Typography>
          <Input placeholder="Team name" sx={{ my: 2 }} disabled value="" />
          <Button onClick={() => setOpenCreate(false)} disabled>
            Create (Fake)
          </Button>
        </ModalDialog>
      </Modal>

      {/* Add User to Team Modal (Fake) */}
      <Modal open={openAddUser} onClose={() => setOpenAddUser(false)}>
        <ModalDialog>
          <Typography level="h4">Add User to {selectedTeam}</Typography>
          <Input placeholder="Search users" sx={{ my: 2 }} disabled value="" />
          <Button onClick={() => setOpenAddUser(false)} disabled>
            Add (Fake)
          </Button>
        </ModalDialog>
      </Modal>
    </PageWithTitle>
  );
};

export default Teams;

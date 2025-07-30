import React from "react";
import { Box, Typography, Table, Avatar, Chip, Button, Alert } from "@mui/joy";
import { Plus } from "lucide-react";
import PageWithTitle from "../templates/PageWithTitle";
import { useAuth } from "../../../context/AuthContext";
import { useFakeData } from "../../../context/FakeDataContext";

const fakeUsers = [
  {
    name: "Alice Johnson",
    avatar: "https://i.pravatar.cc/150?img=9",
    email: "alice.johnson@example.com",
    groups: ["Admin", "DevOps"],
  },
  {
    name: "Bob Smith",
    avatar: "https://i.pravatar.cc/150?img=7",
    email: "bob.smith@example.com",
    groups: ["User"],
  },
  {
    name: "Carol Lee",
    avatar: "https://i.pravatar.cc/150?img=3",
    email: "carol.lee@example.com",
    groups: ["Admin", "User"],
  },
];

const Users: React.FC = () => {
  const { user } = useAuth();
  const { showFakeData } = useFakeData();
  return (
    <PageWithTitle
      title="Users"
      subtitle={`All users at ${user?.organization_name}`}
      button={
        <Button
          variant="solid"
          color="primary"
          startDecorator={<Plus size={16} />}
        >
          Add User
        </Button>
      }
    >
      {showFakeData ? (
        <>
          <Alert color="warning" sx={{ mb: 2 }}>
            This page is showing sample data. Real user management functionality
            will be implemented soon.
          </Alert>
          <Box
            sx={{
              maxWidth: 1000,
              mx: "auto",
            }}
          >
            <Table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Groups</th>
                </tr>
              </thead>
              <tbody>
                {fakeUsers.map((user) => (
                  <tr key={user.email}>
                    <td>
                      <Box
                        sx={{ display: "flex", alignItems: "center", gap: 1 }}
                      >
                        <Avatar src={user.avatar} alt={user.name} size="sm" />
                        <Box>
                          <Typography level="body-md">{user.name}</Typography>
                          <Typography
                            level="body-sm"
                            sx={{ color: "text.secondary" }}
                          >
                            {user.email}
                          </Typography>
                        </Box>
                      </Box>
                    </td>
                    <td>
                      {user.groups.map((group) => (
                        <Chip key={group} size="sm" sx={{ mr: 0.5 }}>
                          {group}
                        </Chip>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Box>
        </>
      ) : (
        <Alert color="info" sx={{ mb: 2 }}>
          User management functionality is not yet implemented. Enable fake data
          in Settings to see sample data.
        </Alert>
      )}
    </PageWithTitle>
  );
};

export default Users;

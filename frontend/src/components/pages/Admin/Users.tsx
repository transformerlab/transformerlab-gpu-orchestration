import React from "react";
import { Box, Typography, Table, Avatar, Chip, Button } from "@mui/joy";
import { Plus } from "lucide-react";
import PageWithTitle from "../templates/PageWithTitle";

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
  return (
    <PageWithTitle
      title="Users"
      subtitle="All users at Square Bank"
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
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
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
    </PageWithTitle>
  );
};

export default Users;

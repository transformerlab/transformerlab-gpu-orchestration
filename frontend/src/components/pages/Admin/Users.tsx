import React from "react";
import { Box, Typography, Table, Avatar, Chip, Button } from "@mui/joy";

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
    <Box
      sx={{
        maxWidth: 1000,
        mx: "auto",
        p: 2,
      }}
    >
      <Box sx={{ mb: 4 }}>
        <Typography level="h2" sx={{ mb: 1 }}>
          Users
        </Typography>
        <Typography level="body-lg" sx={{ color: "text.secondary" }}>
          All users at Square Bank
        </Typography>
      </Box>
      <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
        <Button variant="solid" color="primary">
          Add User
        </Button>
      </Box>
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
  );
};

export default Users;

import React from 'react';
import { Box, Button, Card, Typography, Avatar, Chip } from '@mui/joy';
import { useAuth } from '../context/AuthContext';

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();

  if (!user) {
    return null; // Should be handled by routing
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.surface', p: 3 }}>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 4,
          p: 2,
          bgcolor: 'background.body',
          borderRadius: 'md',
          boxShadow: 'sm',
        }}
      >
        <Typography level="h1" sx={{ color: 'primary.500' }}>
          Lattice
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Chip variant="soft" color="success">
            Authenticated
          </Chip>
          <Button variant="outlined" color="neutral" onClick={logout}>
            Logout
          </Button>
        </Box>
      </Box>

      {/* Welcome Section */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <Avatar size="lg">
            {user.first_name ? user.first_name[0] : user.email[0].toUpperCase()}
          </Avatar>
          <Box>
            <Typography level="h3">
              Welcome, {user.first_name || user.email}!
            </Typography>
            <Typography level="body-md" sx={{ color: 'text.secondary' }}>
              {user.email}
            </Typography>
          </Box>
        </Box>
        <Typography level="body-md">
          You are successfully authenticated with WorkOS. This is your dashboard where you can access all features of Lattice.
        </Typography>
      </Card>

      {/* User Info Card */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <Typography level="h4" sx={{ mb: 2 }}>
          User Information
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Typography level="body-sm" sx={{ fontWeight: 'bold', minWidth: 80 }}>
              ID:
            </Typography>
            <Typography level="body-sm" sx={{ fontFamily: 'monospace' }}>
              {user.id}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Typography level="body-sm" sx={{ fontWeight: 'bold', minWidth: 80 }}>
              Email:
            </Typography>
            <Typography level="body-sm">{user.email}</Typography>
          </Box>
          {user.first_name && (
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Typography level="body-sm" sx={{ fontWeight: 'bold', minWidth: 80 }}>
                First Name:
              </Typography>
              <Typography level="body-sm">{user.first_name}</Typography>
            </Box>
          )}
          {user.last_name && (
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Typography level="body-sm" sx={{ fontWeight: 'bold', minWidth: 80 }}>
                Last Name:
              </Typography>
              <Typography level="body-sm">{user.last_name}</Typography>
            </Box>
          )}
        </Box>
      </Card>

      {/* Features Placeholder */}
      <Card variant="outlined">
        <Typography level="h4" sx={{ mb: 2 }}>
          Features
        </Typography>
        <Typography level="body-md" sx={{ color: 'text.secondary' }}>
          Your application features will be available here. The authentication system is now set up and ready for you to build upon.
        </Typography>
      </Card>
    </Box>
  );
};

export default Dashboard;

import React from "react";
import {
  Modal,
  ModalDialog,
  ModalClose,
  Typography,
  Box,
  Button,
  FormControl,
  FormLabel,
  Input,
  Stack,
  Alert,
  List,
  ListItem,
  CircularProgress,
} from "@mui/joy";
import { useAuth } from "../context/AuthContext";
import { Settings, User, Save, Building2 } from "lucide-react";
import { authApi } from "../utils/api";

interface UserSettingsModalProps {
  open: boolean;
  onClose: () => void;
}

const UserSettingsModal: React.FC<UserSettingsModalProps> = ({
  open,
  onClose,
}) => {
  const { user } = useAuth();
  const [isSaving, setIsSaving] = React.useState(false);
  const [showSuccess, setShowSuccess] = React.useState(false);
  const [organizations, setOrganizations] = React.useState<
    Array<{ id: string; name: string; object: string }>
  >([]);
  const [loadingOrgs, setLoadingOrgs] = React.useState(false);
  const [orgError, setOrgError] = React.useState<string | null>(null);

  const fetchOrganizations = async () => {
    setLoadingOrgs(true);
    setOrgError(null);
    try {
      const response = await authApi.getOrganizations();
      setOrganizations(response.organizations);
    } catch (err) {
      setOrgError(
        err instanceof Error ? err.message : "Failed to fetch organizations"
      );
    } finally {
      setLoadingOrgs(false);
    }
  };

  React.useEffect(() => {
    if (open) {
      fetchOrganizations();
    }
  }, [open]);

  const handleSave = async () => {
    setIsSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsSaving(false);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  if (!user) return null;

  return (
    <Modal open={open} onClose={onClose}>
      <ModalDialog
        aria-labelledby="user-settings-modal"
        size="md"
        sx={{
          maxWidth: 600,
          width: "100%",
        }}
      >
        <ModalClose />
        <Typography
          component="h2"
          level="h4"
          textColor="inherit"
          fontWeight="lg"
          mb={1}
          startDecorator={<Settings size="24px" />}
        >
          User Profile
        </Typography>

        {showSuccess && (
          <Alert color="success" sx={{ mb: 2 }}>
            Settings saved successfully!
          </Alert>
        )}

        <Box sx={{ mt: 2 }}>
          {/* Profile Section */}
          <Typography
            level="title-md"
            sx={{ mb: 2, display: "flex", alignItems: "center", gap: 1 }}
          >
            <User size="18px" />
            Profile Information
          </Typography>

          <Stack spacing={2} sx={{ mb: 3 }}>
            <FormControl>
              <FormLabel>First Name</FormLabel>
              <Input defaultValue={user.first_name || ""} />
            </FormControl>

            <FormControl>
              <FormLabel>Last Name</FormLabel>
              <Input defaultValue={user.last_name || ""} />
            </FormControl>

            <FormControl>
              <FormLabel>Email</FormLabel>
              <Input defaultValue={user.email} disabled />
            </FormControl>
          </Stack>

          {/* Organizations Section */}
          <Typography
            level="title-md"
            sx={{ mb: 1, display: "flex", alignItems: "center", gap: 1 }}
          >
            <Building2 size="18px" />
            Organizations
          </Typography>
          <Typography level="body-sm" color="neutral" sx={{ mb: 2 }}>
            To switch organizations, logout and log back in to select a
            different organization.
          </Typography>

          {loadingOrgs && (
            <Box sx={{ display: "flex", justifyContent: "center", mb: 2 }}>
              <CircularProgress />
            </Box>
          )}

          {orgError && (
            <Alert color="danger" sx={{ mb: 2 }}>
              {orgError}
            </Alert>
          )}

          {organizations.length > 0 ? (
            <Box sx={{ mb: 3 }}>
              <List>
                {organizations.map((org) => (
                  <ListItem key={org.id}>
                    <Box>
                      <Typography level="title-md">{org.name}</Typography>
                      <Typography level="body-sm" color="neutral">
                        ID: {org.id}
                      </Typography>
                    </Box>
                  </ListItem>
                ))}
              </List>
            </Box>
          ) : (
            !loadingOrgs &&
            !orgError && (
              <Box sx={{ mb: 3 }}>
                <Typography level="body-sm" color="neutral">
                  No organizations found
                </Typography>
              </Box>
            )
          )}
        </Box>

        <Box
          sx={{ display: "flex", gap: 1, justifyContent: "flex-end", mt: 3 }}
        >
          <Button variant="outlined" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            loading={isSaving}
            startDecorator={<Save size="16px" />}
          >
            Save
          </Button>
        </Box>
      </ModalDialog>
    </Modal>
  );
};

export default UserSettingsModal;

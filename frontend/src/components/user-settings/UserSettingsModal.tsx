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
  Divider,
} from "@mui/joy";
import { useAuth } from "../../context/AuthContext";
import { Settings, User, Building2, Plus, UserCog2Icon } from "lucide-react";
import { authApi } from "../../utils/api";
import CreateOrganizationModal from "./CreateOrganizationModal";

interface UserSettingsModalProps {
  open: boolean;
  onClose: () => void;
}

const UserSettingsModal: React.FC<UserSettingsModalProps> = ({
  open,
  onClose,
}) => {
  const { user } = useAuth();
  const [organizations, setOrganizations] = React.useState<
    Array<{ id: string; name: string; object: string }>
  >([]);
  const [loadingOrgs, setLoadingOrgs] = React.useState(false);
  const [orgError, setOrgError] = React.useState<string | null>(null);

  const [showCreateModal, setShowCreateModal] = React.useState(false);

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

  const handleOrganizationCreated = async () => {
    await fetchOrganizations();
  };

  React.useEffect(() => {
    if (open) {
      fetchOrganizations();
    }
  }, [open]);

  if (!user) return null;

  return (
    <>
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
            startDecorator={<UserCog2Icon size="24px" />}
          >
            User Profile
          </Typography>

          <Typography level="body-md" color="neutral" sx={{ mb: 2 }}>
            {user.id}
          </Typography>

          <Box>
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
                <Input defaultValue={user.first_name || ""} disabled />
              </FormControl>

              <FormControl>
                <FormLabel>Last Name</FormLabel>
                <Input defaultValue={user.last_name || ""} disabled />
              </FormControl>

              <FormControl>
                <FormLabel>Email</FormLabel>
                <Input defaultValue={user.email} disabled />
              </FormControl>
            </Stack>

            <Divider sx={{ my: 3 }} />

            {/* Organizations Section */}
            <Typography
              level="title-md"
              sx={{ mb: 1, display: "flex", alignItems: "center", gap: 1 }}
            >
              <Building2 size="18px" />
              Organizations
            </Typography>
            <Typography level="body-sm" color="neutral" sx={{ mb: 2 }}>
              To switch organizations, log out and log back in to select a
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

            {/* Create Organization Button */}
            <Box sx={{ mt: 3 }}>
              <Button
                variant="outlined"
                startDecorator={<Plus size="16px" />}
                onClick={() => setShowCreateModal(true)}
                fullWidth
              >
                Create New Organization
              </Button>
            </Box>
          </Box>
        </ModalDialog>
      </Modal>

      {/* Create Organization Modal */}
      <CreateOrganizationModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onOrganizationCreated={handleOrganizationCreated}
      />
    </>
  );
};

export default UserSettingsModal;

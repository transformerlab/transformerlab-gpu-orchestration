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
  Chip,
} from "@mui/joy";
import { useAuth } from "../../context/AuthContext";
import {
  Settings,
  User,
  Building2,
  Plus,
  UserCog2Icon,
  Key,
  Trash2,
  Edit3,
  Copy,
  Clock,
} from "lucide-react";
import { authApi, sshKeyApi } from "../../utils/api";
import CreateOrganizationModal from "./CreateOrganizationModal";

interface UserSettingsModalProps {
  open: boolean;
  onClose: () => void;
}

interface SSHKey {
  id: string;
  name: string;
  public_key: string;
  fingerprint: string;
  key_type: string;
  created_at: string;
  updated_at: string;
  last_used_at?: string;
  is_active: boolean;
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

  // SSH Key state
  const [sshKeys, setSshKeys] = React.useState<SSHKey[]>([]);
  const [loadingSshKeys, setLoadingSshKeys] = React.useState(false);
  const [sshKeyError, setSshKeyError] = React.useState<string | null>(null);
  const [showAddSshKey, setShowAddSshKey] = React.useState(false);
  const [newSshKeyName, setNewSshKeyName] = React.useState("");
  const [newSshKeyContent, setNewSshKeyContent] = React.useState("");
  const [addingSshKey, setAddingSshKey] = React.useState(false);

  const fetchOrganizations = async () => {
    setLoadingOrgs(true);
    setOrgError(null);
    try {
      const response = await authApi.getOrganizations();
      setOrganizations(response.organizations);
    } catch (err) {
      setOrgError(
        err instanceof Error ? err.message : "Failed to fetch organizations",
      );
    } finally {
      setLoadingOrgs(false);
    }
  };

  const handleOrganizationCreated = async () => {
    await fetchOrganizations();
  };

  const fetchSshKeys = async () => {
    setLoadingSshKeys(true);
    setSshKeyError(null);
    try {
      const response = await sshKeyApi.list();
      setSshKeys(response.ssh_keys);
    } catch (err) {
      setSshKeyError(
        err instanceof Error ? err.message : "Failed to fetch SSH keys",
      );
    } finally {
      setLoadingSshKeys(false);
    }
  };

  const handleAddSshKey = async () => {
    if (!newSshKeyName.trim() || !newSshKeyContent.trim()) {
      setSshKeyError("Please provide both a name and public key");
      return;
    }

    setAddingSshKey(true);
    setSshKeyError(null);
    try {
      await sshKeyApi.create(newSshKeyName.trim(), newSshKeyContent.trim());
      setNewSshKeyName("");
      setNewSshKeyContent("");
      setShowAddSshKey(false);
      await fetchSshKeys(); // Refresh the list
    } catch (err) {
      setSshKeyError(
        err instanceof Error ? err.message : "Failed to add SSH key",
      );
    } finally {
      setAddingSshKey(false);
    }
  };

  const handleDeleteSshKey = async (keyId: string) => {
    if (!confirm("Are you sure you want to delete this SSH key?")) {
      return;
    }

    try {
      await sshKeyApi.delete(keyId);
      await fetchSshKeys(); // Refresh the list
    } catch (err) {
      setSshKeyError(
        err instanceof Error ? err.message : "Failed to delete SSH key",
      );
    }
  };

  const formatKeyFingerprint = (fingerprint: string) => {
    if (fingerprint.startsWith("SHA256:")) {
      return fingerprint.substring(7, 20) + "...";
    }
    return fingerprint.substring(0, 13) + "...";
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  React.useEffect(() => {
    if (open) {
      fetchOrganizations();
      fetchSshKeys();
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
            overflow: "auto",
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
              To switch organizations, log out and log back in.
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
                        <Typography
                          level="title-md"
                          sx={{ display: "flex", gap: 1 }}
                        >
                          {org.name}
                          {user?.organization_id === org.id && (
                            <Chip color="primary">current</Chip>
                          )}
                        </Typography>
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

            <Divider sx={{ my: 3 }} />

            {/* SSH Keys Section */}
            <Typography
              level="title-md"
              sx={{ mb: 1, display: "flex", alignItems: "center", gap: 1 }}
            >
              <Key size="18px" />
              SSH Keys
            </Typography>
            <Typography level="body-sm" color="neutral" sx={{ mb: 2 }}>
              Add your SSH public keys to connect to your clusters via SSH
              proxy.
            </Typography>

            <Alert color="warning" variant="soft" sx={{ mb: 2 }}>
              <div>
                Do not upload your <b>private</b> key. Upload your <b>public</b>{" "}
                key only. e.g. id_rsa.pub or id_ed25519.pub.
              </div>
            </Alert>

            {loadingSshKeys && (
              <Box sx={{ display: "flex", justifyContent: "center", mb: 2 }}>
                <CircularProgress />
              </Box>
            )}

            {sshKeyError && (
              <Alert color="danger" sx={{ mb: 2 }}>
                {sshKeyError}
              </Alert>
            )}

            {/* SSH Keys List */}
            {sshKeys.length > 0 ? (
              <Box sx={{ mb: 3 }}>
                <List>
                  {sshKeys.map((key) => (
                    <ListItem
                      key={key.id}
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        py: 2,
                      }}
                    >
                      <Box sx={{ flex: 1 }}>
                        <Typography
                          level="title-sm"
                          sx={{ fontWeight: "bold" }}
                        >
                          {key.name}
                        </Typography>
                        <Typography level="body-xs" color="neutral">
                          {key.key_type} •{" "}
                          {formatKeyFingerprint(key.fingerprint)}
                        </Typography>
                        <Typography level="body-xs" color="neutral">
                          Added {formatDate(key.created_at)}
                          {key.last_used_at && (
                            <> • Last used {formatDate(key.last_used_at)}</>
                          )}
                        </Typography>
                      </Box>
                      <Button
                        variant="plain"
                        color="danger"
                        size="sm"
                        onClick={() => handleDeleteSshKey(key.id)}
                        startDecorator={<Trash2 size="14px" />}
                      >
                        Delete
                      </Button>
                    </ListItem>
                  ))}
                </List>
              </Box>
            ) : (
              !loadingSshKeys &&
              !sshKeyError && (
                <Box sx={{ mb: 3 }}>
                  <Typography level="body-sm" color="neutral">
                    No SSH keys found. Add one to get started.
                  </Typography>
                </Box>
              )
            )}

            {/* Add SSH Key Form */}
            {showAddSshKey ? (
              <Box
                sx={{
                  mb: 3,
                  p: 2,
                  border: "1px solid",
                  borderColor: "neutral.300",
                  borderRadius: "sm",
                }}
              >
                <Typography level="title-sm" sx={{ mb: 2 }}>
                  Add New SSH Key
                </Typography>
                <Stack spacing={2}>
                  <FormControl>
                    <FormLabel>Key Name</FormLabel>
                    <Input
                      placeholder="e.g., My Laptop"
                      value={newSshKeyName}
                      onChange={(e) => setNewSshKeyName(e.target.value)}
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Public Key</FormLabel>
                    <Input
                      placeholder="ssh-rsa AAAAB3... or ssh-ed25519 AAAAC3..."
                      value={newSshKeyContent}
                      onChange={(e) => setNewSshKeyContent(e.target.value)}
                      sx={{ fontFamily: "monospace", fontSize: "sm" }}
                    />
                  </FormControl>
                  <Box sx={{ display: "flex", gap: 1 }}>
                    <Button
                      onClick={handleAddSshKey}
                      loading={addingSshKey}
                      startDecorator={<Plus size="16px" />}
                    >
                      Add Key
                    </Button>
                    <Button
                      variant="plain"
                      onClick={() => {
                        setShowAddSshKey(false);
                        setNewSshKeyName("");
                        setNewSshKeyContent("");
                        setSshKeyError(null);
                      }}
                    >
                      Cancel
                    </Button>
                  </Box>
                </Stack>
              </Box>
            ) : (
              <Box sx={{ mb: 3 }}>
                <Button
                  variant="outlined"
                  startDecorator={<Plus size="16px" />}
                  onClick={() => setShowAddSshKey(true)}
                  fullWidth
                >
                  Add SSH Key
                </Button>
              </Box>
            )}
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

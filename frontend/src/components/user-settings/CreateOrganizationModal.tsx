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
  Textarea,
} from "@mui/joy";
import { Building2, Plus } from "lucide-react";
import { authApi } from "../../utils/api";

interface CreateOrganizationModalProps {
  open: boolean;
  onClose: () => void;
  onOrganizationCreated: () => void;
}

const CreateOrganizationModal: React.FC<CreateOrganizationModalProps> = ({
  open,
  onClose,
  onOrganizationCreated,
}) => {
  const [newOrgName, setNewOrgName] = React.useState("");
  const [newOrgDomains, setNewOrgDomains] = React.useState("");
  const [creatingOrg, setCreatingOrg] = React.useState(false);
  const [createOrgError, setCreateOrgError] = React.useState<string | null>(
    null
  );
  const [createOrgSuccess, setCreateOrgSuccess] = React.useState(false);

  const handleCreateOrganization = async () => {
    if (!newOrgName.trim()) {
      setCreateOrgError("Organization name is required");
      return;
    }

    setCreatingOrg(true);
    setCreateOrgError(null);

    try {
      const domains = newOrgDomains.trim()
        ? newOrgDomains
            .split(",")
            .map((d) => d.trim())
            .filter((d) => d)
        : undefined;

      await authApi.createOrganization(newOrgName.trim(), domains);

      setCreateOrgSuccess(true);
      setNewOrgName("");
      setNewOrgDomains("");

      // Notify parent component
      onOrganizationCreated();

      // Close modal after a short delay to show success message
      setTimeout(() => {
        setCreateOrgSuccess(false);
        onClose();
      }, 1500);
    } catch (err) {
      setCreateOrgError(
        err instanceof Error ? err.message : "Failed to create organization"
      );
    } finally {
      setCreatingOrg(false);
    }
  };

  const handleClose = () => {
    setNewOrgName("");
    setNewOrgDomains("");
    setCreateOrgError(null);
    setCreateOrgSuccess(false);
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose}>
      <ModalDialog
        aria-labelledby="create-organization-modal"
        size="md"
        sx={{
          maxWidth: 500,
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
          startDecorator={<Building2 size="24px" />}
        >
          Create New Organization
        </Typography>

        {createOrgSuccess && (
          <Alert color="success" sx={{ mb: 2 }}>
            Organization created successfully!
          </Alert>
        )}

        {createOrgError && (
          <Alert color="danger" sx={{ mb: 2 }}>
            {createOrgError}
          </Alert>
        )}

        <Box sx={{ mt: 2 }}>
          <Stack spacing={3}>
            <FormControl>
              <FormLabel>Organization Name *</FormLabel>
              <Input
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                placeholder="Enter organization name"
                disabled={creatingOrg}
              />
            </FormControl>

            <FormControl>
              <FormLabel>Domains (Optional)</FormLabel>
              <Textarea
                value={newOrgDomains}
                onChange={(e) => setNewOrgDomains(e.target.value)}
                placeholder="Enter domains separated by commas (e.g., example.com, test.com)"
                minRows={2}
                disabled={creatingOrg}
              />
              <Typography level="body-xs" color="neutral" sx={{ mt: 0.5 }}>
                Separate multiple domains with commas
              </Typography>
            </FormControl>
          </Stack>
        </Box>

        <Box
          sx={{ display: "flex", gap: 1, justifyContent: "flex-end", mt: 3 }}
        >
          <Button
            variant="outlined"
            onClick={handleClose}
            disabled={creatingOrg}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreateOrganization}
            loading={creatingOrg}
            startDecorator={<Plus size="16px" />}
          >
            Create Organization
          </Button>
        </Box>
      </ModalDialog>
    </Modal>
  );
};

export default CreateOrganizationModal;

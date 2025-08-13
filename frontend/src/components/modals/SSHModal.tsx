import React from "react";
import { Modal, ModalDialog, ModalClose, Typography } from "@mui/joy";
import { buildApiUrl } from "../../utils/api";

interface SSHModalProps {
  open: boolean;
  onClose: () => void;
  clusterName: string | null;
}

const SSHModal: React.FC<SSHModalProps> = ({ open, onClose, clusterName }) => {
  return (
    <Modal open={open} onClose={onClose}>
      <ModalDialog
        size="lg"
        sx={{
          maxWidth: "90vw",
          maxHeight: "90vh",
          width: "100%",
          height: "100%",
        }}
      >
        <ModalClose onClick={onClose} />
        <Typography level="h4" sx={{ mb: 2 }}>
          SSH Terminal
        </Typography>
        <iframe
          src={buildApiUrl(`/terminal?cluster_name=${clusterName}`)}
          style={{ width: "100%", height: "70vh", border: "none" }}
        />
      </ModalDialog>
    </Modal>
  );
};

export default SSHModal;

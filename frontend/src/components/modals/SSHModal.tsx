import React from "react";
import { Modal, ModalDialog, ModalClose, Typography } from "@mui/joy";

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
        <ModalClose />
        <Typography level="h4" sx={{ mb: 2 }}>
          SSH Terminal
        </Typography>
        <iframe
          id="sshIframe"
          name="sshIframe"
          style={{
            width: "100%",
            height: "100%",
            border: "none",
          }}
          src={
            clusterName
              ? `http://localhost:8000/api/v1/terminal?cluster_name=${encodeURIComponent(
                  clusterName
                )}`
              : undefined
          }
        />
      </ModalDialog>
    </Modal>
  );
};

export default SSHModal;

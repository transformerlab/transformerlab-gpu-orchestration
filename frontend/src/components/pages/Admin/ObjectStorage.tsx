import React from "react";
import {
  Box,
  Typography,
  Table,
  Button,
  Chip,
  Input,
  Modal,
  ModalDialog,
  Stack,
  Select,
  Option,
  Checkbox,
} from "@mui/joy";
import { Plus } from "lucide-react";
import PageWithTitle from "../templates/PageWithTitle";

// Fake placeholder data
const fakeObjectStorages = [
  {
    name: "Main S3 Bucket",
    remotePath: "/mnt/data",
    source: "s3://my-bucket",
    store: "s3",
    persistent: true,
    mode: "MOUNT",
  },
  {
    name: "Azure Blob",
    remotePath: "/mnt/azure",
    source: "https://myaccount.blob.core.windows.net/container",
    store: "azure",
    persistent: false,
    mode: "COPY",
  },
];

const ObjectStorage: React.FC = () => {
  const [openAdd, setOpenAdd] = React.useState(false);

  return (
    <PageWithTitle
      title="Object Storage Locations"
      subtitle="Add and manage object storage locations (S3, GCS, Azure, etc)."
      button={
        <Button
          variant="solid"
          color="primary"
          startDecorator={<Plus size={16} />}
          onClick={() => setOpenAdd(true)}
        >
          Add
        </Button>
      }
    >
      <style>{`
        .object-storage-table td {
          word-break: break-all;
          max-width: 200px;
          overflow-wrap: anywhere;
        }
      `}</style>
      <Table className="object-storage-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Location</th>
            <th>Store</th>
          </tr>
        </thead>
        <tbody>
          {fakeObjectStorages.map((storage) => (
            <tr key={storage.remotePath}>
              <td>{storage.name}</td>
              <td>{storage.source}</td>
              <td>
                <Chip size="sm">{storage.store}</Chip>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>

      {/* Add Storage Modal (Fake) */}
      <Modal open={openAdd} onClose={() => setOpenAdd(false)}>
        <ModalDialog>
          <Typography level="h4">Add Object Storage</Typography>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Input placeholder="Name (optional)" disabled value="" />
            <Input
              placeholder="Remote Path (e.g. /mnt/data)"
              disabled
              value=""
            />
            <Input
              placeholder="Source (e.g. s3://bucket, gs://bucket, ... )"
              disabled
              value=""
            />
            <Select disabled value="">
              <Option value="">Store (auto)</Option>
              <Option value="s3">s3</Option>
              <Option value="gcs">gcs</Option>
              <Option value="azure">azure</Option>
              <Option value="r2">r2</Option>
              <Option value="ibm">ibm</Option>
              <Option value="oci">oci</Option>
            </Select>
            <Checkbox disabled checked>
              Persistent
            </Checkbox>
            <Select disabled value="MOUNT">
              <Option value="MOUNT">MOUNT</Option>
              <Option value="COPY">COPY</Option>
            </Select>
            <Button onClick={() => setOpenAdd(false)} disabled>
              Add (Fake)
            </Button>
          </Stack>
        </ModalDialog>
      </Modal>
    </PageWithTitle>
  );
};

export default ObjectStorage;

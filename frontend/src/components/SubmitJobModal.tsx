import React, { useState } from "react";
import {
  Modal,
  ModalDialog,
  ModalClose,
  Typography,
  Card,
  CardContent,
  Button,
  Box,
  FormControl,
  FormLabel,
  Textarea,
  Input,
  CircularProgress,
  Alert,
} from "@mui/joy";
import { buildApiUrl, apiFetch } from "../utils/api";
import { useNotification } from "./NotificationSystem";

interface SubmitJobModalProps {
  open: boolean;
  onClose: () => void;
  clusterName: string;
  onJobSubmitted?: () => void;
  isClusterLaunching?: boolean;
  isSshCluster?: boolean;
}

const SubmitJobModal: React.FC<SubmitJobModalProps> = ({
  open,
  onClose,
  clusterName,
  onJobSubmitted,
  isClusterLaunching = false,
  isSshCluster = false,
}) => {
  const [command, setCommand] = useState("");
  const [setup, setSetup] = useState("");
  const [pythonFile, setPythonFile] = useState<File | null>(null);
  const [cpus, setCpus] = useState("");
  const [memory, setMemory] = useState("");
  const [accelerators, setAccelerators] = useState("");
  const [region, setRegion] = useState("");
  const [zone, setZone] = useState("");
  const [jobName, setJobName] = useState("");
  const [loading, setLoading] = useState(false);
  const [jobType, setJobType] = useState<string>("custom");
  const [jupyterPort, setJupyterPort] = useState("8888");
  const { addNotification } = useNotification();

  const resetForm = () => {
    setCommand("");
    setSetup("");
    setPythonFile(null);
    setCpus("");
    setMemory("");
    setAccelerators("");
    setRegion("");
    setZone("");
    setJobName("");
    setJobType("custom");
    setJupyterPort("8888");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const formData = new FormData();

      // Set up command and setup based on job type
      let finalCommand = command;
      let finalSetup = setup;

      if (jobType === "jupyter") {
        finalCommand = `jupyter notebook --port ${jupyterPort} --ip=0.0.0.0 --NotebookApp.token='' --NotebookApp.password='' --allow-root --no-browser`;
        finalSetup = `pip install jupyter
# Create jupyter config to allow external connections
jupyter notebook --generate-config
echo "c.NotebookApp.ip = '0.0.0.0'" >> ~/.jupyter/jupyter_notebook_config.py
echo "c.NotebookApp.allow_root = True" >> ~/.jupyter/jupyter_notebook_config.py
echo "c.NotebookApp.open_browser = False" >> ~/.jupyter/jupyter_notebook_config.py
echo "c.NotebookApp.password = ''" >> ~/.jupyter/jupyter_notebook_config.py
echo "c.NotebookApp.token = ''" >> ~/.jupyter/jupyter_notebook_config.py
echo "Jupyter notebook will be available at http://localhost:${jupyterPort}"`;
      }

      formData.append("command", finalCommand);
      if (finalSetup) formData.append("setup", finalSetup);
      if (pythonFile) formData.append("python_file", pythonFile);
      if (cpus) formData.append("cpus", cpus);
      if (memory) formData.append("memory", memory);
      if (accelerators) formData.append("accelerators", accelerators);
      if (region) formData.append("region", region);
      if (zone) formData.append("zone", zone);
      if (jobName) formData.append("job_name", jobName);
      if (jobType !== "custom") formData.append("job_type", jobType);
      if (jobType === "jupyter") formData.append("jupyter_port", jupyterPort);

      const response = await apiFetch(
        buildApiUrl(`skypilot/jobs/${clusterName}/submit`),
        {
          method: "POST",
          credentials: "include",
          body: formData,
        }
      );
      if (response.ok) {
        const data = await response.json();
        addNotification({
          type: "success",
          message: data.message || "Job submitted successfully",
        });
        resetForm();
        if (onJobSubmitted) onJobSubmitted();
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        const errorData = await response.json();
        addNotification({
          type: "danger",
          message: errorData.detail || "Failed to submit job",
        });
      }
    } catch (err) {
      addNotification({
        type: "danger",
        message: "Error submitting job",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose}>
      <ModalDialog sx={{ maxWidth: 500 }}>
        <ModalClose />
        <Typography level="h4" sx={{ mb: 2 }}>
          Submit Job to {clusterName}
        </Typography>
        <form onSubmit={handleSubmit}>
          <Card variant="outlined">
            <CardContent>
              {isClusterLaunching && (
                <Alert color="warning" sx={{ mb: 2 }}>
                  Cluster is launching. Please wait until it is ready to submit
                  jobs.
                </Alert>
              )}
              <FormControl required sx={{ mb: 2 }}>
                <FormLabel>Run Command</FormLabel>
                <Textarea
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  placeholder={
                    jobType === "jupyter"
                      ? "Jupyter command will be automatically configured"
                      : "python my_script.py"
                  }
                  minRows={2}
                  required
                  disabled={isClusterLaunching || jobType === "jupyter"}
                />
                {jobType === "jupyter" && (
                  <Typography level="body-xs" color="neutral" sx={{ mt: 0.5 }}>
                    Jupyter will be automatically configured to run on port{" "}
                    {jupyterPort}
                  </Typography>
                )}
              </FormControl>
              <FormControl sx={{ mb: 2 }}>
                <FormLabel>Setup Command (optional)</FormLabel>
                <Textarea
                  value={setup}
                  onChange={(e) => setSetup(e.target.value)}
                  placeholder={
                    jobType === "jupyter"
                      ? "Jupyter setup will be automatically configured"
                      : "pip install -r requirements.txt"
                  }
                  minRows={2}
                  disabled={isClusterLaunching || jobType === "jupyter"}
                />
                {jobType === "jupyter" && (
                  <Typography level="body-xs" color="neutral" sx={{ mt: 0.5 }}>
                    Jupyter and its dependencies will be automatically installed
                    and configured
                  </Typography>
                )}
              </FormControl>
              <FormControl sx={{ mb: 2 }}>
                <FormLabel>Attach Python file (optional)</FormLabel>
                <input
                  type="file"
                  accept=".py"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      setPythonFile(e.target.files[0]);
                    } else {
                      setPythonFile(null);
                    }
                  }}
                  style={{ marginTop: 8 }}
                  disabled={isClusterLaunching}
                />
                {pythonFile && (
                  <Typography level="body-xs" color="primary">
                    Selected: {pythonFile.name}
                  </Typography>
                )}
              </FormControl>
              <FormControl sx={{ mb: 2 }}>
                <FormLabel>Job Name (optional)</FormLabel>
                <Input
                  value={jobName}
                  onChange={(e) => setJobName(e.target.value)}
                  placeholder="e.g., My Training Job"
                  disabled={isClusterLaunching}
                />
              </FormControl>

              {/* Job Type Selection */}
              <FormControl sx={{ mb: 2 }}>
                <FormLabel>Job Type</FormLabel>
                <select
                  value={jobType}
                  onChange={(e) => setJobType(e.target.value)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "1px solid #ccc",
                    fontSize: "14px",
                    width: "100%",
                  }}
                  disabled={isClusterLaunching}
                >
                  <option value="custom">Custom Command</option>
                  <option value="jupyter">Jupyter Notebook</option>
                </select>
              </FormControl>

              {/* Jupyter Port Configuration */}
              {jobType === "jupyter" && (
                <FormControl sx={{ mb: 2 }}>
                  <FormLabel>Jupyter Port</FormLabel>
                  <Input
                    value={jupyterPort}
                    onChange={(e) => setJupyterPort(e.target.value)}
                    placeholder="8888"
                    disabled={isClusterLaunching}
                  />
                </FormControl>
              )}
              {/* Resource Configuration */}
              <Card variant="soft" sx={{ mb: 2, mt: 2 }}>
                <Typography level="title-sm" sx={{ mb: 1 }}>
                  Resource Configuration
                </Typography>
                <FormControl sx={{ mb: 1 }}>
                  <FormLabel>CPUs</FormLabel>
                  <Input
                    value={cpus}
                    onChange={(e) => setCpus(e.target.value)}
                    placeholder="e.g., 4, 8+"
                    disabled={isClusterLaunching}
                  />
                </FormControl>
                <FormControl sx={{ mb: 1 }}>
                  <FormLabel>Memory (GB)</FormLabel>
                  <Input
                    value={memory}
                    onChange={(e) => setMemory(e.target.value)}
                    placeholder="e.g., 16, 32+"
                    disabled={isClusterLaunching}
                  />
                </FormControl>
                <FormControl sx={{ mb: 1 }}>
                  <FormLabel>Accelerators</FormLabel>
                  <Input
                    value={accelerators}
                    onChange={(e) => setAccelerators(e.target.value)}
                    placeholder="e.g., V100, V100:2, A100:4"
                    disabled={isClusterLaunching}
                  />
                </FormControl>
                {!isSshCluster && (
                  <>
                    <FormControl sx={{ mb: 1 }}>
                      <FormLabel>Region</FormLabel>
                      <Input
                        value={region}
                        onChange={(e) => setRegion(e.target.value)}
                        placeholder="e.g., us-west-2, us-central1"
                        disabled={isClusterLaunching}
                      />
                    </FormControl>
                    <FormControl sx={{ mb: 1 }}>
                      <FormLabel>Zone</FormLabel>
                      <Input
                        value={zone}
                        onChange={(e) => setZone(e.target.value)}
                        placeholder="e.g., us-west-2a, us-central1-a"
                        disabled={isClusterLaunching}
                      />
                    </FormControl>
                  </>
                )}
              </Card>
              <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
                <Button
                  variant="plain"
                  onClick={onClose}
                  disabled={loading || isClusterLaunching}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  loading={loading}
                  disabled={!command || loading || isClusterLaunching}
                  color="success"
                >
                  Submit Job
                </Button>
              </Box>
            </CardContent>
          </Card>
        </form>
      </ModalDialog>
    </Modal>
  );
};

export default SubmitJobModal;

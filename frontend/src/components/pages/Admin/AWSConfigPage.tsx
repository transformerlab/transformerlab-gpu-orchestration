import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  Card,
  Typography,
  Input,
  FormControl,
  FormLabel,
  Stack,
  Chip,
  Switch,
  Alert,
  CircularProgress,
  Autocomplete,
} from "@mui/joy";
import { Save, Key, Server, Settings, ArrowLeft, Cloud } from "lucide-react";
import { buildApiUrl, apiFetch } from "../../../utils/api";
import PageWithTitle from "../templates/PageWithTitle";
import { useNotification } from "../../../components/NotificationSystem";
import { useNavigate, useSearchParams } from "react-router-dom";

interface TeamOption {
  id: string;
  name: string;
}

interface AWSConfig {
  access_key_id: string;
  secret_access_key: string;
  region: string;
  allowed_instance_types: string[];
  allowed_regions: string[];
  is_configured: boolean;
  max_instances: number;
}

const AWSConfigPage: React.FC = () => {
  const { addNotification } = useNotification();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Check if this is for configuring an existing pool or adding a new one
  const isConfigureMode = searchParams.get("mode") === "configure";
  const initialPoolName = searchParams.get("poolName") || "AWS Pool";
  const configKey = searchParams.get("configKey");

  const [config, setConfig] = useState<AWSConfig>({
    access_key_id: "",
    secret_access_key: "",
    region: "us-east-1",
    allowed_instance_types: [],
    allowed_regions: [],
    is_configured: false,
    max_instances: 1,
  });
  const [poolName, setPoolName] = useState(initialPoolName);
  const [availableInstanceTypes, setAvailableInstanceTypes] = useState<
    string[]
  >([]);
  const [availableRegions, setAvailableRegions] = useState<string[]>([]);
  const [availableTeams, setAvailableTeams] = useState<TeamOption[]>([]);
  const [allowedTeamIds, setAllowedTeamIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showCredentials, setShowCredentials] = useState(false);
  const [actualCredentials, setActualCredentials] = useState<AWSConfig | null>(
    null
  );
  const [existingConfigs, setExistingConfigs] = useState<any>(null);

  useEffect(() => {
    const loadData = async () => {
      // Always fetch available instance types and regions first
      await Promise.all([
        fetchAvailableInstanceTypes(),
        fetchAvailableRegions(),
        fetchExistingConfigs(),
        fetchAvailableTeams(),
      ]);

      // Then fetch existing config if in configure mode
      if (isConfigureMode) {
        await fetchAWSConfig();
      }
    };

    loadData();
  }, [isConfigureMode]);

  const fetchExistingConfigs = async () => {
    try {
      const response = await apiFetch(buildApiUrl("clouds/aws/config"), {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setExistingConfigs(data);
      }
    } catch (err) {
      console.error("Error fetching existing AWS configs:", err);
    }
  };

  const fetchAWSConfig = async () => {
    try {
      setLoading(true);
      const response = await apiFetch(buildApiUrl("clouds/aws/config"), {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        if (data.configs && data.configs.length > 0) {
          const configData = data.configs[0]; // Use first config for now
          setConfig({
            access_key_id: configData.access_key_id || "",
            secret_access_key: configData.secret_access_key || "",
            region: configData.region || "us-east-1",
            allowed_instance_types: configData.allowed_instance_types || [],
            allowed_regions: configData.allowed_regions || [],
            is_configured: configData.is_configured || false,
            max_instances: configData.max_instances || 1,
          });
          setPoolName(configData.name || initialPoolName);
          setAllowedTeamIds(configData.allowed_team_ids || []);
        }
      }
    } catch (err) {
      console.error("Error fetching AWS config:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableInstanceTypes = async () => {
    try {
      const response = await apiFetch(buildApiUrl("clouds/aws/info"), {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setAvailableInstanceTypes(data.instance_types || []);
      }
    } catch (err) {
      console.error("Error fetching AWS instance types:", err);
    }
  };

  const fetchAvailableRegions = async () => {
    try {
      const response = await apiFetch(buildApiUrl("clouds/aws/info"), {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setAvailableRegions(data.regions || []);
      }
    } catch (err) {
      console.error("Error fetching AWS regions:", err);
    }
  };

  const fetchAvailableTeams = async () => {
    try {
      const response = await apiFetch(buildApiUrl("admin/teams"), {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setAvailableTeams(data.teams || []);
      }
    } catch (err) {
      console.error("Error fetching teams:", err);
    }
  };

  const fetchActualCredentials = async () => {
    try {
      const response = await apiFetch(buildApiUrl("clouds/aws/credentials"), {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setActualCredentials(data);
      }
    } catch (err) {
      console.error("Error fetching actual AWS credentials:", err);
    }
  };

  const saveConfig = async () => {
    try {
      setSaving(true);

      const response = await apiFetch(buildApiUrl("clouds/aws/config"), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: poolName,
          access_key_id: config.access_key_id,
          secret_access_key: config.secret_access_key,
          region: config.region,
          allowed_instance_types: config.allowed_instance_types,
          allowed_regions: config.allowed_regions,
          max_instances: config.max_instances,
          config_key: configKey,
          allowed_team_ids: allowedTeamIds,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setConfig(data);
        addNotification({
          type: "success",
          message: "AWS configuration saved successfully",
        });
        navigate("/dashboard/admin/pools");
      } else {
        const errorData = await response.json();
        addNotification({
          type: "danger",
          message: errorData.detail || "Failed to save AWS configuration",
        });
      }
    } catch (err) {
      addNotification({
        type: "danger",
        message: "Error saving AWS configuration",
      });
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    try {
      const response = await apiFetch(buildApiUrl("clouds/aws/test"), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          access_key_id: config.access_key_id,
          secret_access_key: config.secret_access_key,
          region: config.region,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        addNotification({
          type: "success",
          message: data.message || "AWS connection test successful",
        });
      } else {
        const errorData = await response.json();
        addNotification({
          type: "danger",
          message: errorData.detail || "AWS connection test failed",
        });
      }
    } catch (err) {
      addNotification({
        type: "danger",
        message: "Error testing AWS connection",
      });
    }
  };

  const handleInstanceTypeChange = (event: any, newValue: string[]) => {
    setConfig({ ...config, allowed_instance_types: newValue });
  };

  const handleRegionChange = (event: any, newValue: string[]) => {
    setConfig({ ...config, allowed_regions: newValue });
  };

  const handleTeamChange = (event: any, newValue: TeamOption[]) => {
    setAllowedTeamIds(newValue.map((team) => team.id));
  };

  if (loading) {
    return (
      <PageWithTitle title="AWS Configuration" subtitle="Loading...">
        <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
          <CircularProgress />
        </Box>
      </PageWithTitle>
    );
  }

  return (
    <PageWithTitle
      title="AWS Configuration"
      subtitle="Configure AWS credentials and settings for your organization"
    >
      <Box sx={{ maxWidth: 800, mx: "auto" }}>
        <Card sx={{ p: 3, mb: 3 }}>
          <Stack spacing={3}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
              <Button
                variant="outlined"
                startDecorator={<ArrowLeft />}
                onClick={() => navigate("/dashboard/admin/pools")}
              >
                Back to Pools
              </Button>
              <Typography level="h3" sx={{ flex: 1 }}>
                {isConfigureMode ? "Configure AWS Pool" : "Add AWS Pool"}
              </Typography>
            </Box>

            <FormControl>
              <FormLabel>Pool Name</FormLabel>
              <Input
                value={poolName}
                onChange={(e) => setPoolName(e.target.value)}
                placeholder="Enter pool name"
                disabled={saving}
              />
            </FormControl>

            <FormControl>
              <FormLabel>Max Instances</FormLabel>
              <Input
                type="number"
                value={config.max_instances}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    max_instances: parseInt(e.target.value) || 0,
                  })
                }
                placeholder="0 for unlimited"
                disabled={saving}
              />
            </FormControl>

            <Box>
              <Typography
                level="h4"
                sx={{ mb: 2, display: "flex", alignItems: "center", gap: 1 }}
              >
                <Key size={20} />
                AWS Credentials
              </Typography>

              <Stack spacing={2}>
                <FormControl>
                  <FormLabel>Access Key ID</FormLabel>
                  <Input
                    type={showCredentials ? "text" : "password"}
                    value={config.access_key_id}
                    onChange={(e) =>
                      setConfig({ ...config, access_key_id: e.target.value })
                    }
                    placeholder="Enter AWS Access Key ID"
                    disabled={saving}
                  />
                </FormControl>

                <FormControl>
                  <FormLabel>Secret Access Key</FormLabel>
                  <Input
                    type={showCredentials ? "text" : "password"}
                    value={config.secret_access_key}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        secret_access_key: e.target.value,
                      })
                    }
                    placeholder="Enter AWS Secret Access Key"
                    disabled={saving}
                  />
                </FormControl>

                <FormControl>
                  <FormLabel>Region</FormLabel>
                  <Input
                    value={config.region}
                    onChange={(e) =>
                      setConfig({ ...config, region: e.target.value })
                    }
                    placeholder="us-east-1"
                    disabled={saving}
                  />
                </FormControl>

                <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <Switch
                    checked={showCredentials}
                    onChange={(e) => setShowCredentials(e.target.checked)}
                    disabled={saving}
                  />
                  <Typography level="body-sm">Show credentials</Typography>
                </Box>

                <Button
                  variant="outlined"
                  onClick={testConnection}
                  disabled={
                    saving || !config.access_key_id || !config.secret_access_key
                  }
                  startDecorator={<Server />}
                >
                  Test Connection
                </Button>
              </Stack>
            </Box>

            <Box>
              <Typography
                level="h4"
                sx={{ mb: 2, display: "flex", alignItems: "center", gap: 1 }}
              >
                <Settings size={20} />
                Instance Configuration
              </Typography>

              <Stack spacing={2}>
                <FormControl>
                  <FormLabel>Allowed Instance Types</FormLabel>
                  <Autocomplete
                    multiple
                    options={availableInstanceTypes}
                    value={config.allowed_instance_types}
                    onChange={handleInstanceTypeChange}
                    placeholder="Select instance types"
                    disabled={saving}
                    renderTags={(tags, getTagProps) =>
                      tags.map((item, index) => (
                        <Chip
                          {...getTagProps({ index })}
                          key={item}
                          variant="soft"
                          color="primary"
                        >
                          {item}
                        </Chip>
                      ))
                    }
                  />
                </FormControl>

                <FormControl>
                  <FormLabel>Allowed Regions</FormLabel>
                  <Autocomplete
                    multiple
                    options={availableRegions}
                    value={config.allowed_regions}
                    onChange={handleRegionChange}
                    placeholder="Select regions"
                    disabled={saving}
                    renderTags={(tags, getTagProps) =>
                      tags.map((item, index) => (
                        <Chip
                          {...getTagProps({ index })}
                          key={item}
                          variant="soft"
                          color="primary"
                        >
                          {item}
                        </Chip>
                      ))
                    }
                  />
                </FormControl>
              </Stack>
            </Box>

            <Box>
              <Typography level="h4" sx={{ mb: 2 }}>
                Team Access
              </Typography>

              <FormControl>
                <FormLabel>Allowed Teams</FormLabel>
                <Autocomplete
                  multiple
                  options={availableTeams}
                  getOptionLabel={(option) => option.name}
                  value={availableTeams.filter((team) =>
                    allowedTeamIds.includes(team.id)
                  )}
                  onChange={handleTeamChange}
                  placeholder="Select teams (leave empty for all teams)"
                  disabled={saving}
                  renderTags={(tags, getTagProps) =>
                    tags.map((item, index) => (
                      <Chip
                        {...getTagProps({ index })}
                        key={item.id}
                        variant="soft"
                        color="success"
                      >
                        {item.name}
                      </Chip>
                    ))
                  }
                />
              </FormControl>
            </Box>

            <Box sx={{ display: "flex", gap: 2, pt: 2 }}>
              <Button
                variant="solid"
                color="primary"
                onClick={saveConfig}
                disabled={
                  saving || !config.access_key_id || !config.secret_access_key
                }
                startDecorator={
                  saving ? <CircularProgress size="sm" /> : <Save />
                }
                sx={{ flex: 1 }}
              >
                {saving ? "Saving..." : "Save Configuration"}
              </Button>
            </Box>
          </Stack>
        </Card>
      </Box>
    </PageWithTitle>
  );
};

export default AWSConfigPage;

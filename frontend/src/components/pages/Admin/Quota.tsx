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
  Alert,
  Tabs,
  TabList,
  Tab,
  TabPanel,
  Card,
  Grid,
  Divider,
  CircularProgress,
  LinearProgress,
} from "@mui/joy";
import { Plus, Edit2, Settings } from "lucide-react";
import PageWithTitle from "../templates/PageWithTitle";
import { useFakeData } from "../../../context/FakeDataContext";

// Fake placeholder data
const fakeOrgQuota = {
  name: "Square Bank Default User Quota",
  monthly_quota_credits: 10000,
  credits_used: 6350,
  quota_period_end: "2025-08-31 23:59:59",
};

const fakeTeams = [
  {
    id: "team-001",
    name: "ML Research",
    monthly_quota_credits: 5000, // Override from org default
    credits_used: 3200,
    quota_period_end: "2025-08-31 23:59:59",
  },
  {
    id: "team-002",
    name: "Data Science",
    monthly_quota_credits: null, // Uses org default
    credits_used: 1850,
    quota_period_end: "2025-08-31 23:59:59",
  },
  {
    id: "team-003",
    name: "Computer Vision",
    monthly_quota_credits: 3000, // Override from org default
    credits_used: 1300,
    quota_period_end: "2025-08-31 23:59:59",
  },
];

const fakeUsers = [
  {
    id: "user-001",
    email: "researcher_a@uni.edu",
    name: "Alex Researcher",
    team_id: "team-001",
    monthly_quota_credits: 2000, // Override from team
    credits_used: 540,
    quota_period_end: "2025-08-31 23:59:59",
  },
  {
    id: "user-002",
    email: "researcher_b@uni.edu",
    name: "Bailey Scientist",
    team_id: "team-001",
    monthly_quota_credits: 1500, // Override from team
    credits_used: 1480,
    quota_period_end: "2025-08-31 23:59:59",
  },
  {
    id: "user-003",
    email: "researcher_c@uni.edu",
    name: "Casey Analyst",
    team_id: "team-002",
    monthly_quota_credits: null, // Uses team/org default
    credits_used: 920,
    quota_period_end: "2025-08-31 23:59:59",
  },
  {
    id: "user-004",
    email: "researcher_d@uni.edu",
    name: "Drew Developer",
    team_id: "team-003",
    monthly_quota_credits: 1200, // Override from team
    credits_used: 1150,
    quota_period_end: "2025-08-31 23:59:59",
  },
];

const Quota: React.FC = () => {
  const [activeTab, setActiveTab] = React.useState(0);
  const [openOrgModal, setOpenOrgModal] = React.useState(false);
  const [openTeamModal, setOpenTeamModal] = React.useState(false);
  const [openUserModal, setOpenUserModal] = React.useState(false);
  const [selectedTeam, setSelectedTeam] = React.useState<any>(null);
  const [selectedUser, setSelectedUser] = React.useState<any>(null);
  const { showFakeData } = useFakeData();

  const handleEditOrg = () => {
    setOpenOrgModal(true);
  };

  const handleEditTeam = (team: any) => {
    setSelectedTeam(team);
    setOpenTeamModal(true);
  };

  const handleEditUser = (user: any) => {
    setSelectedUser(user);
    setOpenUserModal(true);
  };

  const formatCredits = (credits: number) => {
    return new Intl.NumberFormat().format(credits);
  };

  const getTeamName = (teamId: string) => {
    const team = fakeTeams.find((t) => t.id === teamId);
    return team ? team.name : "Unknown Team";
  };

  const getQuotaUsagePercent = (used: number, total: number) => {
    return Math.min(100, Math.round((used / total) * 100));
  };

  const getQuotaUsageColor = (used: number, total: number) => {
    const percent = getQuotaUsagePercent(used, total);
    if (percent < 50) return "success";
    if (percent < 80) return "warning";
    return "danger";
  };

  return (
    <PageWithTitle
      title="Quota Management"
      subtitle="Set and manage compute quota for organization, teams, and individual users."
    >
      {showFakeData ? (
        <>
          <Tabs
            value={activeTab}
            onChange={(_, val) => setActiveTab(val as number)}
          >
            <TabList>
              <Tab>Organization</Tab>
              <Tab>Teams</Tab>
              <Tab>Users</Tab>
            </TabList>

            <TabPanel value={0}>
              <Grid container spacing={2} alignItems="center">
                <Grid xs={12} md={6}>
                  <Typography level="h4">{fakeOrgQuota.name}</Typography>
                  <Typography level="body-md" color="neutral">
                    Organization-wide monthly GPU credit allocation
                  </Typography>
                </Grid>
                <Grid xs={12} md={6} display="flex" justifyContent="flex-end">
                  <Button
                    startDecorator={<Edit2 size={16} />}
                    onClick={handleEditOrg}
                  >
                    Edit Org Quota
                  </Button>
                </Grid>
              </Grid>
            </TabPanel>

            <TabPanel value={1}>
              <Box sx={{ mb: 2 }}>
                <Typography level="body-lg">
                  Teams can have custom quota overrides or inherit from the
                  organization-wide settings.
                </Typography>
              </Box>

              <Table>
                <thead>
                  <tr>
                    <th>Team Name</th>
                    <th>Monthly Quota</th>
                    <th>Usage</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {fakeTeams.map((team) => (
                    <tr key={team.id}>
                      <td>{team.name}</td>
                      <td>
                        {team.monthly_quota_credits ? (
                          <>
                            {formatCredits(team.monthly_quota_credits)} credits
                          </>
                        ) : (
                          <Typography color="neutral" fontSize="sm">
                            Using org default (
                            {formatCredits(fakeOrgQuota.monthly_quota_credits)}{" "}
                            credits)
                          </Typography>
                        )}
                      </td>
                      <td>
                        {formatCredits(team.credits_used)} /{" "}
                        {formatCredits(
                          team.monthly_quota_credits ||
                            fakeOrgQuota.monthly_quota_credits
                        )}{" "}
                        credits
                      </td>
                      <td>
                        <Chip
                          color={getQuotaUsageColor(
                            team.credits_used,
                            team.monthly_quota_credits ||
                              fakeOrgQuota.monthly_quota_credits
                          )}
                          size="sm"
                        >
                          {getQuotaUsagePercent(
                            team.credits_used,
                            team.monthly_quota_credits ||
                              fakeOrgQuota.monthly_quota_credits
                          )}
                          %
                        </Chip>
                      </td>
                      <td>
                        <Button
                          size="sm"
                          variant="outlined"
                          color="neutral"
                          onClick={() => handleEditTeam(team)}
                        >
                          Edit
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TabPanel>

            <TabPanel value={2}>
              <Box sx={{ mb: 2 }}>
                <Typography level="body-lg">
                  Individual users can have custom quota overrides or inherit
                  from their team or organization settings.
                </Typography>
              </Box>

              <Table>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Email</th>
                    <th>Team</th>
                    <th>Monthly Quota</th>
                    <th>Usage</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {fakeUsers.map((user) => {
                    const team = fakeTeams.find((t) => t.id === user.team_id);
                    const effectiveQuota =
                      user.monthly_quota_credits ||
                      team?.monthly_quota_credits ||
                      fakeOrgQuota.monthly_quota_credits;

                    return (
                      <tr key={user.id}>
                        <td>{user.name}</td>
                        <td>{user.email}</td>
                        <td>{getTeamName(user.team_id)}</td>
                        <td>
                          {user.monthly_quota_credits ? (
                            <>
                              {formatCredits(user.monthly_quota_credits)}{" "}
                              credits
                            </>
                          ) : (
                            <Typography color="neutral" fontSize="sm">
                              Using team/org default (
                              {formatCredits(effectiveQuota)} credits)
                            </Typography>
                          )}
                        </td>
                        <td>
                          {formatCredits(user.credits_used)} /{" "}
                          {formatCredits(effectiveQuota)} credits
                        </td>
                        <td>
                          <LinearProgress
                            determinate
                            value={getQuotaUsagePercent(
                              user.credits_used,
                              effectiveQuota
                            )}
                          />
                          <Chip
                            color={getQuotaUsageColor(
                              user.credits_used,
                              effectiveQuota
                            )}
                            size="sm"
                          >
                            {getQuotaUsagePercent(
                              user.credits_used,
                              effectiveQuota
                            )}
                            %
                          </Chip>
                        </td>
                        <td>
                          <Button
                            size="sm"
                            variant="outlined"
                            color="neutral"
                            onClick={() => handleEditUser(user)}
                          >
                            Edit
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </TabPanel>
          </Tabs>
        </>
      ) : (
        <Alert color="info" sx={{ mb: 2 }}>
          Quota management functionality is not yet implemented. Enable fake
          data in Settings to see sample data.
        </Alert>
      )}

      {/* Organization Quota Modal */}
      <Modal open={openOrgModal} onClose={() => setOpenOrgModal(false)}>
        <ModalDialog>
          <Typography level="h4">Edit Organization Quota</Typography>
          <Typography level="body-sm" mb={2}>
            Set the base monthly GPU credit quota for the entire organization
          </Typography>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Input
              placeholder="Monthly Credits"
              defaultValue={fakeOrgQuota.monthly_quota_credits.toString()}
              slotProps={{
                input: {
                  type: "number",
                },
              }}
            />
            <Typography level="body-sm">
              Current period ends: {fakeOrgQuota.quota_period_end}
            </Typography>
            <Button onClick={() => setOpenOrgModal(false)}>Save Changes</Button>
          </Stack>
        </ModalDialog>
      </Modal>

      {/* Team Quota Modal */}
      <Modal open={openTeamModal} onClose={() => setOpenTeamModal(false)}>
        <ModalDialog>
          <Typography level="h4">Edit Team Quota</Typography>
          {selectedTeam && (
            <>
              <Typography level="body-sm" mb={2}>
                Set a custom monthly quota for team: {selectedTeam.name}
              </Typography>
              <Stack spacing={2} sx={{ mt: 1 }}>
                <Input
                  placeholder="Monthly Credits (leave empty for org default)"
                  defaultValue={
                    selectedTeam.monthly_quota_credits?.toString() || ""
                  }
                  slotProps={{
                    input: {
                      type: "number",
                    },
                  }}
                />
                <Checkbox
                  label="Use organization default"
                  defaultChecked={!selectedTeam.monthly_quota_credits}
                />
                <Typography level="body-sm">
                  Current period ends: {selectedTeam.quota_period_end}
                </Typography>
                <Button onClick={() => setOpenTeamModal(false)}>
                  Save Changes
                </Button>
              </Stack>
            </>
          )}
        </ModalDialog>
      </Modal>

      {/* User Quota Modal */}
      <Modal open={openUserModal} onClose={() => setOpenUserModal(false)}>
        <ModalDialog>
          <Typography level="h4">Edit User Quota</Typography>
          {selectedUser && (
            <>
              <Typography level="body-sm" mb={2}>
                Set a custom monthly quota for: {selectedUser.name} (
                {selectedUser.email})
              </Typography>
              <Stack spacing={2} sx={{ mt: 1 }}>
                <Input
                  placeholder="Monthly Credits (leave empty for team/org default)"
                  defaultValue={
                    selectedUser.monthly_quota_credits?.toString() || ""
                  }
                  slotProps={{
                    input: {
                      type: "number",
                    },
                  }}
                />
                <Checkbox
                  label="Use team/organization default"
                  defaultChecked={!selectedUser.monthly_quota_credits}
                />
                <Typography level="body-sm">
                  Current usage: {formatCredits(selectedUser.credits_used)}{" "}
                  credits
                </Typography>
                <Typography level="body-sm">
                  Current period ends: {selectedUser.quota_period_end}
                </Typography>
                <Button onClick={() => setOpenUserModal(false)}>
                  Save Changes
                </Button>
              </Stack>
            </>
          )}
        </ModalDialog>
      </Modal>
    </PageWithTitle>
  );
};

export default Quota;

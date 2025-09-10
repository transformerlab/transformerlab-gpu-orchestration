import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import PageWithTitle from "./templates/PageWithTitle";
import OrgOverview from "./OrgOverview";

const OrgOverviewPage: React.FC = () => {
  const { clusterName } = useParams<{ clusterName: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleBack = () => {
    navigate(-1);
  };

  if (!user?.organization_id) {
    return (
      <PageWithTitle
        title="Access Denied"
        backButton={true}
        onBack={handleBack}
      >
        <div>You don't have access to organization overview.</div>
      </PageWithTitle>
    );
  }

  if (!clusterName) {
    return (
      <PageWithTitle title="Error" backButton={true} onBack={handleBack}>
        <div>Cluster name is required.</div>
      </PageWithTitle>
    );
  }

  return (
    <PageWithTitle
      title={`Organization Overview - ${clusterName}`}
      backButton={true}
      onBack={handleBack}
    >
      <OrgOverview
        clusterName={clusterName}
        organizationId={user.organization_id}
      />
    </PageWithTitle>
  );
};

export default OrgOverviewPage;

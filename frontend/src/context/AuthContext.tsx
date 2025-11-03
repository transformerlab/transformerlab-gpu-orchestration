import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import axios from "axios";

interface Organization {
  id: string;
  name: string;
  object: string;
}

interface User {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  profile_picture_url?: string;
  organization_id?: string;
  organization_name?: string;
  role?: string;
}

interface AuthContextType {
  user: User | null;
  logout: () => void;
  loading: boolean;
  checkAuth: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Use relative API base URL - this will work regardless of host/port
const API_BASE_URL = import.meta.env.VITE_API_URL || "/api/v1";

// Configure axios to include cookies
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // Important: this sends cookies with requests
});

export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleAuthError = () => {
      console.log(
        "Event Listener: Auth error from fetch, clearing user session.",
      );
      setUser(null);
    };
    window.addEventListener("auth-error", handleAuthError);

    return () => {
      window.removeEventListener("auth-error", handleAuthError);
    };
  }, []);

  const fetchOrganizations = async (userId: string) => {
    try {
      const response = await api.get("/admin/orgs");
      const { organizations, current_organization_id } = response.data;

      const currentOrg = current_organization_id
        ? organizations.find(
            (org: Organization) => org.id === current_organization_id,
          )
        : organizations.length > 0
          ? organizations[0]
          : null;

      return {
        organization_id: currentOrg?.id || current_organization_id,
        organization_name: currentOrg?.name || "Default Organization",
      };
    } catch (error) {
      console.error("Failed to fetch organizations:", error);
      return {
        organization_id: undefined,
        organization_name: "Default Organization",
      };
    }
  };

  const checkAuth = async () => {
    try {
      console.log("AuthContext: Checking authentication...");
      const response = await api.get("/auth/check");
      console.log("AuthContext: Auth check response:", response.data);
      if (response.data.authenticated) {
        const userData = response.data.user;
        const orgInfo = await fetchOrganizations(userData.id);
        const userWithOrgs = {
          ...userData,
          ...orgInfo,
        };
        setUser(userWithOrgs);
        console.log("AuthContext: User authenticated with orgs:", userWithOrgs);
      } else {
        setUser(null);
        console.log("AuthContext: User not authenticated");
      }
    } catch (error) {
      console.error("Auth check failed:", error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const refreshSession = async () => {
    try {
      console.log("AuthContext: Refreshing session...");
      const response = await api.post("/auth/refresh");
      console.log("AuthContext: Session refresh response:", response.data);
      if (response.data.authenticated) {
        const userData = response.data.user;
        const orgInfo = await fetchOrganizations(userData.id);
        const userWithOrgs = {
          ...userData,
          ...orgInfo,
        };
        setUser(userWithOrgs);
        console.log("AuthContext: Session refreshed with orgs:", userWithOrgs);
      } else {
        setUser(null);
        console.log("AuthContext: Session refresh failed");
      }
    } catch (error) {
      console.error("Session refresh failed:", error);
      setUser(null);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  // Also check auth when the page becomes visible (handles OAuth redirects)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log("AuthContext: Page became visible, rechecking auth...");
        checkAuth();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  const logout = () => {
    // Redirect to backend logout endpoint which will handle logout
    window.location.href = `${API_BASE_URL}/auth/logout`;
  };

  const value: AuthContextType = {
    user,
    logout,
    loading,
    checkAuth,
    refreshSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

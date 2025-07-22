import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import axios from "axios";

interface User {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
}

interface AuthContextType {
  user: User | null;
  logout: () => void;
  loading: boolean;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Use relative API base URL - this will work regardless of host/port
const API_BASE_URL = process.env.REACT_APP_BASE_URL || "/api/v1";

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

  const checkAuth = async () => {
    try {
      console.log("AuthContext: Checking authentication...");
      const response = await api.get("/auth/check");
      console.log("AuthContext: Auth check response:", response.data);
      if (response.data.authenticated) {
        setUser(response.data.user);
        console.log("AuthContext: User authenticated:", response.data.user);
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
    // Redirect to backend logout endpoint which will handle WorkOS logout
    window.location.href = `${API_BASE_URL}/auth/logout`;
  };

  const value: AuthContextType = {
    user,
    logout,
    loading,
    checkAuth,
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

import { createContext, useContext, useCallback, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "./queryClient";
import { useLocation } from "wouter";

interface User {
  id: number;
  email: string;
  phoneVerified: boolean;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  logout: () => Promise<void>;
  refetchUser: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery<{ authenticated: boolean; user?: User }>({
    queryKey: ["/api/auth/me"],
    retry: false,
    staleTime: 30000,
  });

  const logout = useCallback(async () => {
    try {
      await apiRequest("POST", "/api/auth/logout");
      queryClient.setQueryData(["/api/auth/me"], { authenticated: false });
      setLocation("/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  }, [queryClient, setLocation]);

  const value: AuthContextType = {
    user: data?.authenticated ? data.user ?? null : null,
    isLoading,
    isAuthenticated: !!data?.authenticated,
    logout,
    refetchUser: refetch,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

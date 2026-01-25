import { useAuth } from "@/lib/auth-context";
import type { UserRole } from "@/lib/ui/tokens";

interface RoleGateProps {
  allowedRoles: UserRole[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function RoleGate({ allowedRoles, children, fallback = null }: RoleGateProps) {
  const { user } = useAuth();
  
  if (!user) return <>{fallback}</>;
  
  const userRole = (user.role?.toUpperCase() || 'STAFF') as UserRole;
  
  if (!allowedRoles.includes(userRole)) {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
}

export function useUserRole(): UserRole {
  const { user } = useAuth();
  return (user?.role?.toUpperCase() || 'STAFF') as UserRole;
}

import * as React from "react"
import { useAuth } from "@/lib/auth-context"
import { WebAppShell, WebAppShellProps } from "./app-shell"

export interface AuthenticatedWebAppShellProps extends Omit<WebAppShellProps, 'userRole' | 'userName' | 'userEmail'> {
  children: React.ReactNode
  pageTitle?: string
  className?: string
}

export function AuthenticatedWebAppShell({
  children,
  pageTitle,
  className,
  ...props
}: AuthenticatedWebAppShellProps) {
  const { user, logout } = useAuth()

  return (
    <WebAppShell
      pageTitle={pageTitle}
      userRole={user?.role?.toUpperCase() || "USER"}
      userName={user?.email?.split("@")[0]}
      userEmail={user?.email}
      className={className}
      {...props}
    >
      {children}
    </WebAppShell>
  )
}

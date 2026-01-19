import * as React from "react"

// Simple client-side routing context
interface RouterContextType {
  currentPath: string
  navigate: (path: string) => void
}

const RouterContext = React.createContext<RouterContextType | null>(null)

export function RouterProvider({ children }: { children: React.ReactNode }) {
  const [currentPath, setCurrentPath] = React.useState(() => {
    // Get initial path from URL hash or default to /home
    const hash = window.location.hash.slice(1)
    return hash || "/home"
  })

  const navigate = React.useCallback((path: string) => {
    setCurrentPath(path)
    window.location.hash = path
  }, [])

  // Listen for hash changes (back/forward navigation)
  React.useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1)
      if (hash && hash !== currentPath) {
        setCurrentPath(hash)
      }
    }

    window.addEventListener("hashchange", handleHashChange)
    return () => window.removeEventListener("hashchange", handleHashChange)
  }, [currentPath])

  return (
    <RouterContext.Provider value={{ currentPath, navigate }}>
      {children}
    </RouterContext.Provider>
  )
}

export function useRouter() {
  const context = React.useContext(RouterContext)
  if (!context) {
    throw new Error("useRouter must be used within RouterProvider")
  }
  return context
}

// Link component for navigation
interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string
  children: React.ReactNode
}

export function Link({ href, children, onClick, ...props }: LinkProps) {
  const { navigate } = useRouter()

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    navigate(href)
    onClick?.(e)
  }

  return (
    <a href={`#${href}`} onClick={handleClick} {...props}>
      {children}
    </a>
  )
}

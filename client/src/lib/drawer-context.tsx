import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

type DrawerContent = ReactNode | null;

interface DrawerContextValue {
  content: DrawerContent;
  isOpen: boolean;
  title: string;
  openDrawer: (content: ReactNode, title?: string) => void;
  closeDrawer: () => void;
}

const DrawerContext = createContext<DrawerContextValue | undefined>(undefined);

export function DrawerProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<DrawerContent>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");

  const openDrawer = useCallback((newContent: ReactNode, newTitle = "") => {
    setContent(newContent);
    setTitle(newTitle);
    setIsOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setIsOpen(false);
    setTimeout(() => {
      setContent(null);
      setTitle("");
    }, 200);
  }, []);

  return (
    <DrawerContext.Provider value={{ content, isOpen, title, openDrawer, closeDrawer }}>
      {children}
    </DrawerContext.Provider>
  );
}

export function useDrawer() {
  const context = useContext(DrawerContext);
  if (!context) {
    throw new Error("useDrawer must be used within a DrawerProvider");
  }
  return context;
}

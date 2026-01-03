import { useEffect, useCallback, useRef, useMemo } from "react";
import { useLocation } from "wouter";
import { getKeyboardShortcutsForRole, type UserRole } from "@/lib/ui/nav";

interface ShortcutHandler {
  navigate?: (path: string) => void;
  search?: () => void;
  close?: () => void;
}

interface UseKeyboardShortcutsOptions extends ShortcutHandler {
  userRole?: UserRole;
}

export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions) {
  const [, setLocation] = useLocation();
  const { navigate, search, close, userRole } = options;
  const keySequence = useRef<string[]>([]);
  const sequenceTimeout = useRef<NodeJS.Timeout | null>(null);

  const roleBasedShortcuts = useMemo(
    () => getKeyboardShortcutsForRole(userRole),
    [userRole]
  );

  const handleNavigate = useCallback((path: string) => {
    if (navigate) {
      navigate(path);
    } else {
      setLocation(path);
    }
  }, [navigate, setLocation]);

  const handleSearch = useCallback(() => {
    search?.();
  }, [search]);

  const handleClose = useCallback(() => {
    close?.();
  }, [close]);

  const resetSequence = useCallback(() => {
    keySequence.current = [];
    if (sequenceTimeout.current) {
      clearTimeout(sequenceTimeout.current);
      sequenceTimeout.current = null;
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInputFocused = 
        target.tagName === 'INPUT' || 
        target.tagName === 'TEXTAREA' || 
        target.isContentEditable;

      if (e.key === '/' && !isInputFocused) {
        e.preventDefault();
        handleSearch();
        resetSequence();
        return;
      }

      if (e.key === 'Escape') {
        handleClose();
        resetSequence();
        return;
      }

      if (isInputFocused) {
        resetSequence();
        return;
      }

      if (sequenceTimeout.current) {
        clearTimeout(sequenceTimeout.current);
      }

      keySequence.current.push(e.key.toLowerCase());

      sequenceTimeout.current = setTimeout(() => {
        keySequence.current = [];
      }, 500);

      const sequence = keySequence.current.join(' ');

      const matchingShortcut = roleBasedShortcuts.find(s => s.keys === sequence);
      if (matchingShortcut) {
        e.preventDefault();
        handleNavigate(matchingShortcut.target);
        resetSequence();
        return;
      }

      if (keySequence.current.length > 2) {
        resetSequence();
      }
    };

    const handleBlur = () => {
      resetSequence();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('blur', handleBlur);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('blur', handleBlur);
      if (sequenceTimeout.current) {
        clearTimeout(sequenceTimeout.current);
      }
    };
  }, [handleNavigate, handleSearch, handleClose, resetSequence, roleBasedShortcuts]);
}

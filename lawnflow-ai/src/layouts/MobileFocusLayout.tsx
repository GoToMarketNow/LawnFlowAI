
import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Home, Map, User, Clock } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

const userRole = 'crew-member'; 

const navItems = [
  { to: '/my-route', labelKey: 'myRoute', icon: Map, roles: ['crew-leader', 'crew-member'] },
  { to: '/profile', labelKey: 'profile', icon: User, roles: ['crew-member'] },
  { to: '/clock', labelKey: 'clock', icon: Clock, roles: ['crew-member'] },
];

export function MobileFocusLayout() {
  const { t, i18n } = useTranslation();

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  const filteredNavItems = navItems.filter(item => item.roles.includes(userRole));

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <header className="flex items-center justify-between h-14 px-4 border-b bg-white">
        <div className="flex items-center gap-2 font-semibold">
          <NavLink to="/">
            <Home className="h-6 w-6" />
            <span className="sr-only">LawnFlow.AI</span>
          </NavLink>
        </div>
        <div className="flex items-center gap-4">
        <Select onValueChange={changeLanguage} defaultValue={i18n.language}>
            <SelectTrigger className="w-[80px]">
              <SelectValue placeholder="Language" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">EN</SelectItem>
              <SelectItem value="es">ES</SelectItem>
            </SelectContent>
          </Select>
          <img src="https://github.com/shadcn.png" alt="user avatar" className="rounded-full w-8 h-8" />
        </div>
      </header>

      <main className="flex-1 p-4">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t">
        <div className="grid h-16 grid-cols-3">
          {filteredNavItems.map(item => (
            <NavLink
              key={item.labelKey}
              to={item.to}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors ${
                  isActive ? 'text-primary' : 'text-muted-foreground'
                }`
              }
            >
              <item.icon className="h-6 w-6" />
              <span>{t(item.labelKey as any)}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

import { Outlet } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { useAuth } from "./features/auth/AuthProvider";
import { LoginPage } from "./features/auth/LoginPage";
import { ChangePasswordPage } from "./features/auth/ChangePasswordPage";

export function App() {
  const {user,loading}=useAuth();
  if(loading)return null;
  if(!user)return <LoginPage/>;
  if(user.mustChangePassword)return <ChangePasswordPage/>;
  return <AppShell role={user.role}><Outlet /></AppShell>;
}

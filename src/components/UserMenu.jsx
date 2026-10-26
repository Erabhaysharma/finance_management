import { LogOut, UserCircle } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import "./auth.css";

// Put inside the sidebar <aside>, after </nav>:  <UserMenu active={active} onSelect={onSelect} />
export default function UserMenu({ active, onSelect }) {
  const { user, signOut } = useAuth();
  if (!user) return null;
  const name = user.user_metadata?.name || user.email;
  return (
    <div className="user-menu">
      <div className="um-who"><span className="um-avatar">{name[0].toUpperCase()}</span><span className="um-text"><b>{name}</b><small>{user.email}</small></span></div>
      <button className={"nav-item" + (active === "account" ? " active" : "")} onClick={() => onSelect("account")}><UserCircle size={18} /><span>My account</span></button>
      <button className="nav-item" onClick={signOut}><LogOut size={18} /><span>Sign out</span></button>
    </div>
  );
}
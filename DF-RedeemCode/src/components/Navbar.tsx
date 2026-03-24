import React from "react";
import { Zap, Settings, LogOut, CircleUser } from "lucide-react";
import type { User } from "firebase/auth";

interface NavbarProps {
  user: User | null;
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
  handleLogin: () => void;
  handleLogout: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ 
  user, 
  showSettings, 
  setShowSettings, 
  handleLogin, 
  handleLogout 
}) => {
  return (
    <nav className="nav-floating glass-effect flex items-center justify-between rounded-full border-white/10!">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
          <Zap size={20} className="text-white fill-white" />
        </div>
        <span className="font-bold text-xl tracking-tight hidden sm:block">
          Delta Force <span className="text-blue-400">Redeem</span>
        </span>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={() => setShowSettings(!showSettings)}
          className={`p-2 rounded-full transition-all ${
            showSettings ? 'bg-blue-500/20 text-blue-400 rotate-90!' : 'hover:bg-white/10 text-slate-400'
          }`}
        >
          <Settings size={20} />
        </button>

        {user && !user.isAnonymous ? (
          <div className="flex items-center gap-3 bg-white/10 pl-1 pr-3 py-1 rounded-full border border-white/10">
            <img 
              src={user.photoURL || ""} 
              alt="avatar" 
              className="w-8 h-8 rounded-full border border-white/20" 
            />
            <span className="text-sm font-bold leading-none hidden sm:block">
              {user.displayName}
            </span>
            <button 
              onClick={handleLogout} 
              className="ml-2 p-1 hover:bg-red-500/20 rounded-full text-slate-400 hover:text-red-400"
            >
              <LogOut size={16} />
            </button>
          </div>
        ) : (
          <button 
            onClick={handleLogin} 
            className="btn-nordic-glass py-2! px-5!"
          >
            <CircleUser size={18} />
            <span>Đăng nhập</span>
          </button>
        )}
      </div>
    </nav>
  );
};

export default Navbar;

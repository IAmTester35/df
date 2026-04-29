import React from "react";
import { Zap, Settings, LogOut, CircleUser, Search } from "lucide-react";
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
  const [showSearch, setShowSearch] = React.useState(false);

  const searchKeywords = [
    { lang: "English", keywords: ["Delta Force redeem code 2024", "Delta Force mobile gift code", "Delta Force cdkey"] },
    { lang: "Tiếng Việt", keywords: ["code Delta Force mới nhất", "nhận giftcode Delta Force", "tổng hợp code Delta Force"] },
    { lang: "中文 (Chinese)", keywords: ["三角洲行动 礼包码", "三角洲行动 兑换码", "三角洲行动 CDKey"] },
    { lang: "ไทย (Thai)", keywords: ["Delta Force โค้ดล่าสุด", "Delta Force รหัสของขวัญ", "Delta Force Gift Code"] }
  ];

  const handleSearch = (keyword: string) => {
    window.open(`https://www.google.com/search?q=${encodeURIComponent(keyword)}`, '_blank');
  };

  return (
    <nav className="nav-floating glass-effect backdrop-blur-xs flex items-center justify-between rounded-full overflow-visible!">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
          <Zap size={20} className="text-white fill-white" />
        </div>
        <span className="font-bold text-xl tracking-tight hidden sm:block">
          Delta Force <span className="text-blue-400">Redeem</span>
        </span>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative">
          <button
            onClick={() => setShowSearch(!showSearch)}
            className={`p-2 rounded-full transition-all cursor-pointer ${showSearch ? 'bg-blue-500/20 text-blue-400' : 'hover:bg-white/10 text-slate-400'
              }`}
          >
            <Search size={20} />
          </button>

          {showSearch && (
            <div className="absolute top-full right-0 mt-4 w-72 bg-slate-900/95 backdrop-blur-xl rounded-2xl p-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-1001 border border-white/20 ring-1 ring-white/10">
              <h3 className="text-sm font-bold text-slate-400 mb-3 px-2">Tìm kiếm CDKey</h3>
              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                {searchKeywords.map((group) => (
                  <div key={group.lang}>
                    <p className="text-[10px] uppercase tracking-wider text-blue-400 font-bold mb-2 px-2">{group.lang}</p>
                    <div className="flex flex-col gap-1">
                      {group.keywords.map((kw) => (
                        <button
                          key={kw}
                          onClick={() => handleSearch(kw)}
                          className="cursor-pointer text-left text-sm py-2 px-3 rounded-lg hover:bg-white/10 transition-colors text-slate-200 hover:text-white truncate"
                        >
                          {kw}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={() => setShowSettings(!showSettings)}
          className={`p-2 rounded-full transition-all cursor-pointer ${showSettings ? 'bg-blue-500/20 text-blue-400 rotate-90!' : 'hover:bg-white/10 text-slate-400'
            }`}
        >
          <Settings size={20} />
        </button>

        {user && !user.isAnonymous ? (
          <div className="flex items-center gap-3 bg-white/10 backdrop-blur-[6px] pl-1 pr-3 py-1 rounded-full border border-white/10">
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

export default React.memo(Navbar);

import { useState, useEffect } from "react";
import { useRedeem } from "./hooks/useRedeem";
import Navbar from "./components/Navbar";
import SettingsPanel from "./components/SettingsPanel";
import RedeemInput from "./components/RedeemInput";
import RedeemHistoryTable from "./components/RedeemHistoryTable";
import PendingRedeemTable from "./components/PendingRedeemTable";
import { motion, AnimatePresence } from "motion/react";
import { ChevronUp } from "lucide-react";

const Github = ({ size = 24 }: { size?: number }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
  >
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);

const App = () => {
  const {
    user,
    inputValue,
    setInputValue,
    history,
    pending,
    hasNewCodes,
    isSyncing,
    masterUrl,
    showSettings,
    setShowSettings,
    handleLogin,
    handleLogout,
    saveMasterUrl,
    handleSync,
    handleRedeem,
    handleRetryPending,
    handleDeletePending,
    handleDeleteHistory,
    handleClearAll
  } = useRedeem();

  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 300) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  };

  return (
    <div className="min-h-screen flex flex-col items-center p-6 md:p-12 overflow-x-hidden">
      <Navbar 
        user={user} 
        showSettings={showSettings} 
        setShowSettings={setShowSettings} 
        handleLogin={handleLogin} 
        handleLogout={handleLogout} 
      />

      <main className="w-full max-w-[1200px] mt-24 md:mt-32 space-y-12">
        <SettingsPanel 
          showSettings={showSettings} 
          setShowSettings={setShowSettings}
          masterUrl={masterUrl} 
          saveMasterUrl={saveMasterUrl} 
          handleClearAll={handleClearAll}
        />

        <RedeemInput 
          inputValue={inputValue} 
          setInputValue={setInputValue} 
          isSyncing={isSyncing} 
          hasNewCodes={hasNewCodes} 
          handleSync={handleSync} 
          handleRedeem={handleRedeem} 
          history={history}
        />

        <PendingRedeemTable 
          pending={pending} 
          onDelete={handleDeletePending} 
          onRetry={handleRetryPending} 
          isSyncing={isSyncing} 
        />
        <RedeemHistoryTable history={history} onDelete={handleDeleteHistory} />
      </main>

      <footer className="mt-24 w-full max-w-[1200px] py-12 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6 opacity-40 hover:opacity-100 transition-opacity duration-500">
        <div className="flex flex-col items-center md:items-start gap-2">
          <p className="text-xs font-bold tracking-[0.2em] uppercase text-white">DF Auto-Redeem</p>
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-2 gap-y-1">
            <p className="text-[10px] text-slate-400 font-medium">© 2026 IAmTester35</p>
            <span className="hidden md:block w-1 h-1 rounded-full bg-slate-600" />
            <p className="text-[10px] text-slate-500 font-medium tracking-tight uppercase">MIT License</p>
            <span className="hidden md:block w-1 h-1 rounded-full bg-slate-600" />
            <p className="text-[10px] text-slate-500 font-medium tracking-tight">Nordic Arctic Edition | GAS Hybrid</p>
          </div>
        </div>

        <motion.a
          whileHover={{ y: -2, scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          href="https://github.com/IAmTester35/df"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 transition-all duration-300"
        >
          <Github size={16} />
          <span className="text-[11px] font-semibold tracking-wider">SOURCE CODE</span>
        </motion.a>
      </footer>

      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.5, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.5, y: 20 }}
            whileHover={{ scale: 1.1, backgroundColor: "rgba(255, 255, 255, 0.15)" }}
            whileTap={{ scale: 0.9 }}
            onClick={scrollToTop}
            className="fixed bottom-8 right-8 z-50 p-3 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white shadow-2xl transition-colors"
            aria-label="Back to top"
          >
            <ChevronUp size={24} />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;
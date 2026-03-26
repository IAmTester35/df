import { useRedeem } from "./hooks/useRedeem";
import Navbar from "./components/Navbar";
import SettingsPanel from "./components/SettingsPanel";
import RedeemInput from "./components/RedeemInput";
import RedeemHistoryTable from "./components/RedeemHistoryTable";

const App = () => {
  const {
    user,
    inputValue,
    setInputValue,
    history,
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
    handleDeleteHistory
  } = useRedeem();

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
          masterUrl={masterUrl} 
          saveMasterUrl={saveMasterUrl} 
        />

        <RedeemInput 
          inputValue={inputValue} 
          setInputValue={setInputValue} 
          isSyncing={isSyncing} 
          hasNewCodes={hasNewCodes} 
          handleSync={handleSync} 
          handleRedeem={handleRedeem} 
        />

        <RedeemHistoryTable history={history} onDelete={handleDeleteHistory} />
      </main>

      <footer className="mt-auto py-12 text-center space-y-2 opacity-30">
        <p className="text-xs font-bold tracking-widest uppercase text-white">Delta Force Auto-Redeem</p>
        <p className="text-[10px] text-slate-400">© 2026 Nordic Arctic Edition | Centralized GAS Hybrid</p>
      </footer>
    </div>
  );
};

export default App;
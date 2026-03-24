import { useEffect, useState } from "react";
import { auth, db } from "./lib/firebase";
import { signInAnonymously, onAuthStateChanged } from "firebase/auth";
import type { User } from "firebase/auth";
import { ref, onValue, set } from "firebase/database";


const App = () => {
  const [user, setUser] = useState<User | null>(null);
  const [count, setCount] = useState(0);

  useEffect(() => {
    // 1. Setup Auth Listener
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        signInAnonymously(auth);
      }
    });

    // 2. Setup RTDB Listener for a 'counter' node
    const counterRef = ref(db, "counter");
    const unsubscribeCounter = onValue(counterRef, (snapshot) => {
      const data = snapshot.val();
      if (data !== null) {
        setCount(data);
      }
    });

    return () => {
      unsubscribeAuth();
      unsubscribeCounter();
    };
  }, []);

  const handleIncrement = () => {
    const counterRef = ref(db, "counter");
    set(counterRef, count + 1);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4">
      <div className="bg-slate-900/50 p-8 rounded-2xl border border-slate-800 shadow-2xl backdrop-blur-xl max-w-md w-full text-center">
        <h1 className="text-3xl font-bold mb-2 bg-linear-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
          Firebase Ready
        </h1>
        <p className="text-slate-400 mb-8">Setup successful. Authentication and RTDB are live.</p>

        {user && (
          <div className="space-y-6">
            <div className="flex flex-col items-center gap-2 p-4 bg-slate-800/30 rounded-xl">
              <span className="text-xs uppercase tracking-widest text-slate-500 font-semibold">User UID</span>
              <code className="bg-slate-950 px-3 py-1 rounded border border-slate-700 text-emerald-400 font-mono text-sm">
                {user.uid}
              </code>
            </div>

            <div className="flex flex-col items-center gap-6 py-4">
              <div className="text-6xl font-black text-white tabular-nums drop-shadow-glow">
                {count}
              </div>

              <button
                onClick={handleIncrement}
                className="group relative px-8 py-3 bg-white text-slate-950 font-bold rounded-full transition-all hover:scale-105 active:scale-95 overflow-hidden"
              >
                <div className="absolute inset-0 bg-linear-to-r from-blue-500 to-emerald-500 opacity-0 group-hover:opacity-10 transition-opacity" />
                Increment Global Counter
              </button>
            </div>

            <p className="text-xs text-slate-500 italic">
              Realtime Database connection is active. Open this page in another tab to see it sync in real-time.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
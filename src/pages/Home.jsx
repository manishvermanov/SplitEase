import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import LoginModal from "../components/Login";
import SignupModal from "../components/Signup";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

// Background animation
import Threads from "../components/Threads";

export default function Home({ user, setUser }) {
  const [showAuth, setShowAuth] = useState(null);
  const [personalExpenses, setPersonalExpenses] = useState([]);
  const [groups, setGroups] = useState([]);
  const navigate = useNavigate();

  const handleLogin = (userData) => {
    setUser(userData);
    setShowAuth(null);
  };

  useEffect(() => {
    if (user) {
      axios
        .get(`http://localhost:5000/expenses/personal/${user.id}`)
        .then((res) => setPersonalExpenses(res.data))
        .catch(() => setPersonalExpenses([]));

      axios
        .get(`http://localhost:5000/groups/user/${user.id}`)
        .then((res) => setGroups(res.data))
        .catch(() => setGroups([]));
    }
  }, [user]);

  return (
    <div className="flex flex-col min-h-screen relative">
      <Navbar setShowAuth={setShowAuth} setActiveSpace={() => {}} user={user} />

      {/* Base black background */}
     {/* Purple background */}
<div className="absolute inset-0 -z-30 bg-gradient-to-b from-purple-700 via-purple-900 to-black" />


      {/* Threads background (centered, narrower, behind content but above black) */}
     {/* Full-screen Threads background */}
<div className="pointer-events-none absolute inset-0 -z-10">
  <Threads amplitude={0.8} distance={0} enableMouseInteraction={false} />
</div>


      {/* Main content */}
      <div className="relative z-20 flex flex-col items-center justify-center mt-32 md:mt-40 flex-grow px-4 w-full max-w-6xl mx-auto">
        {!user ? (
          <>
            {/* Hero */}
            <div className="w-full max-w-5xl mx-auto grid md:grid-cols-2 gap-8 items-center">
              <div className="order-2 md:order-1">
                <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight leading-tight">
                  Welcome to{" "}
                  <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-300 to-fuchsia-300">
                    SplitEase
                  </span>
                </h1>
                <p className="mt-4 text-lg md:text-xl text-purple-100/80">
                  Track, split, and settle expenses with friends—fast, fair, and beautiful.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    onClick={() => setShowAuth("login")}
                    className="px-6 py-3 rounded-xl text-white bg-gradient-to-r from-purple-700 to-fuchsia-600 shadow-sm hover:shadow-lg hover:translate-y-[-1px] active:translate-y-0 transition"
                  >
                    Login
                  </button>
                  <button
                    onClick={() => setShowAuth("signup")}
                    className="px-6 py-3 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 text-white hover:bg-white/15 shadow-sm transition"
                  >
                    Sign Up
                  </button>
                </div>
              </div>

              <div className="order-1 md:order-2">
                <img
                  src="/images/hero.png"
                  alt="Hero Banner"
                  className="w-full rounded-2xl shadow-xl ring-1 ring-white/10"
                />
              </div>
            </div>

            {/* Feature blurbs (glassy cards) */}
            <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
              {[
                { t: "Smart Splits", d: "Auto-calc who owes whom in one click." },
                { t: "Clean History", d: "See every expense and settlement clearly." },
                { t: "Lightweight", d: "Fast UI with a friendly workflow." },
              ].map((f, i) => (
                <div
                  key={i}
                  className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 p-4 shadow-sm hover:shadow-md transition"
                >
                  <div className="text-sm font-semibold text-white">{f.t}</div>
                  <div className="text-purple-100/80 text-sm mt-1">{f.d}</div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <h1 className="text-3xl font-bold text-white mb-6">Hello, {user.name}!</h1>

            {/* Dashboard Preview (glassy cards) */}
            <div className="grid md:grid-cols-2 w-full gap-6">
              {/* Personal Expenses */}
              <div className="flex-1 rounded-2xl bg-white/30 backdrop-blur-md border border-white/15 p-6 shadow-sm hover:shadow-md transition">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-white">Your Personal Expenses</h2>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 border border-white/15 text-white">
                    preview
                  </span>
                </div>

                {personalExpenses.length === 0 ? (
                  <div className="text-purple-100/90 text-sm bg-white/5 border border-white/10 rounded-xl p-4">
                    You have no expenses yet. Add your first one from the Personal dashboard.
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-white/10">
                    <table className="w-full text-left">
                      <thead className="bg-white/5">
                        <tr className="text-purple-100/80 text-sm">
                          <th className="px-4 py-2 font-medium">Description</th>
                          <th className="px-4 py-2 font-medium">Amount</th>
                          <th className="px-4 py-2 font-medium">Date</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white/0">
                        {personalExpenses.slice(0, 3).map((exp) => (
                          <tr key={exp.expense_id} className="border-t border-white/10 hover:bg-white/5">
                            <td className="px-4 py-2 text-white">{exp.description}</td>
                            <td className="px-4 py-2 text-white">₹{exp.amount}</td>
                            <td className="px-4 py-2 text-purple-100/80">
                              {new Date(exp.expense_date).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <button
                  onClick={() => navigate("/dashboard/personal")}
                  className="mt-5 px-4 py-2 rounded-lg text-white bg-gradient-to-r from-purple-700 to-fuchsia-600 hover:shadow-md hover:translate-y-[-1px] active:translate-y-0 transition"
                >
                  Go to Personal Dashboard
                </button>
              </div>

              {/* Groups */}
              <div className="flex-1 rounded-2xl bg-white/30 backdrop-blur-md border border-white/15 p-6 shadow-sm hover:shadow-md transition">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-white">Your Groups</h2>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 border border-white/15 text-white">
                    preview
                  </span>
                </div>

                {groups.length === 0 ? (
                  <div className="text-purple-100/90 text-sm bg-white/5 border border-white/10 rounded-xl p-4">
                    You’re not part of any groups yet. Create or join one from the Groups dashboard.
                  </div>
                ) : (
                  <ul className="divide-y divide-white/10 rounded-xl border border-white/10 bg-white/0 overflow-hidden">
                    {groups.slice(0, 3).map((group) => (
                      <li
                        key={group.group_id}
                        className="p-3 hover:bg-white/5 cursor-pointer flex items-center justify-between"
                        onClick={() => navigate(`/dashboard/groups?gid=${group.group_id}`)}
                      >
                        <div>
                          <div className="font-medium text-white">{group.group_name}</div>
                          <div className="text-xs text-purple-100/80">Code: {group.gcode}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                <button
                  onClick={() => navigate("/dashboard/groups")}
                  className="mt-5 px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:shadow-md hover:translate-y-[-1px] active:translate-y-0 transition"
                >
                  Go to Groups Dashboard
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modal */}
      {showAuth && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 backdrop-blur-sm bg-black/40" />
          <div className="relative bg-white p-6 md:p-8 rounded-2xl shadow-2xl max-w-md w-full z-10 border border-purple-100">
            <button
              onClick={() => setShowAuth(null)}
              className="absolute top-3 right-3 text-gray-500 hover:text-gray-800 text-lg font-bold"
              aria-label="Close"
            >
              &times;
            </button>

            {showAuth === "login" && (
              <LoginModal onLogin={handleLogin} switchToSignup={() => setShowAuth("signup")} />
            )}
            {showAuth === "signup" && (
              <SignupModal onSignup={handleLogin} switchToLogin={() => setShowAuth("login")} />
            )}
          </div>
        </div>
      )}

      {/* Extra spacing to keep footer pushed down */}
      <div className="mt-28" />

      <Footer />
    </div>
  );
}

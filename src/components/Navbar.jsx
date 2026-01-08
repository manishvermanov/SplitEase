import { useNavigate } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { FaBell } from "react-icons/fa";
import axios from "axios";

export default function Navbar({ user, setShowAuth, onLogout }) {
  const navigate = useNavigate();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(false);
  const pollRef = useRef(null);

  const fetchNotifs = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const res = await axios.get(`http://localhost:5000/notifications/user/${user.id}`);
      setNotifs(res.data || []);
    } catch (e) {
      console.error("Failed to load notifications", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (showNotif && user) fetchNotifs();
  }, [showNotif, user]);

  useEffect(() => {
    if (!user) return;
    pollRef.current = setInterval(fetchNotifs, 30000);
    return () => clearInterval(pollRef.current);
  }, [user]);

  const markRead = async (id) => {
    try {
      await axios.patch(`http://localhost:5000/notifications/${id}/read`);
      setNotifs((prev) => prev.filter((n) => n.id !== id));
    } catch (e) {
      console.error("markRead failed", e);
    }
  };

  const markAllRead = async () => {
    try {
      await axios.patch(`http://localhost:5000/notifications/user/${user.id}/read-all`);
      setNotifs([]);
    } catch (e) {
      console.error("markAllRead failed", e);
    }
  };

  const handleOpenNotification = (n) => {
    if (n.entity_type === "expense" && n.data?.group_id) {
      navigate("/dashboard/groups", { state: { group_id: n.data.group_id, focus: "expenses" } });
    } else if (n.entity_type === "settlement" && n.data?.group_id) {
      navigate("/dashboard/groups", { state: { group_id: n.data.group_id, focus: "settlements" } });
    } else {
      navigate("/dashboard/groups");
    }
    markRead(n.id);
    setShowNotif(false);
  };

  const handleLogout = () => {
    try {
      if (pollRef.current) clearInterval(pollRef.current);
      setShowDropdown(false);
      setShowNotif(false);
      const keys = ["token","authToken","accessToken","refreshToken","jwt","user","currentUser"];
      keys.forEach((k) => {
        try { localStorage.removeItem(k); } catch {}
        try { sessionStorage.removeItem(k); } catch {}
      });
      if (typeof onLogout === "function") onLogout();
      navigate("/");
      setTimeout(() => { if (user) window.location.reload(); }, 50);
    } catch (e) {
      console.error("Logout error:", e);
      navigate("/");
      setTimeout(() => window.location.reload(), 50);
    }
  };

  return (
    <>
      <nav className="bg-purple-100 text-purple-800 p-4 flex items-center shadow-md">
        {/* LEFT: LOGO */}
        <h1
          className="text-2xl font-bold cursor-pointer"
          onClick={() => navigate("/")}
        >
          SplitEase
        </h1>

        {/* RIGHT SECTION */}
        <div className="flex items-center gap-6 ml-auto text-[15px]">
          {!user && (
            <>
              <button onClick={() => setShowAuth("login")} className="px-3 py-1 rounded hover:bg-purple-200">
                Personal Expenses
              </button>
              <button onClick={() => setShowAuth("login")} className="px-3 py-1 rounded hover:bg-purple-200">
                Groups
              </button>
              <button onClick={() => setShowAuth("login")} className="px-3 py-1 rounded hover:bg-purple-200">
                Login
              </button>
              <button onClick={() => setShowAuth("signup")} className="px-3 py-1 rounded hover:bg-purple-200">
                Signup
              </button>
            </>
          )}

          {user && (
            <>
              <button onClick={() => navigate("/dashboard/personal")} className="px-3 py-1 rounded hover:bg-purple-200">
                Personal Expenses
              </button>
              <button onClick={() => navigate("/dashboard/groups")} className="px-3 py-1 rounded hover:bg-purple-200">
                Groups
              </button>

              {/* USER DROPDOWN */}
              <div className="relative">
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="px-3 py-1 rounded hover:bg-purple-200"
                >
                  Hello, {user.name.split(" ")[0]}
                </button>

                {showDropdown && (
                  <div className="absolute right-0 mt-2 w-32 bg-white shadow-lg rounded-lg text-black text-sm">
                    <button
                      className="w-full text-left px-4 py-2 hover:bg-gray-100"
                      onClick={handleLogout}
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>

              {/* NOTIFICATION BELL */}
              <button
                className="relative"
                onClick={() => setShowNotif(true)}
                aria-label="Open notifications"
              >
                <FaBell className="text-xl hover:text-purple-600" />
                {notifs.length > 0 && (
                  <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[11px] leading-[18px] text-center">
                    {notifs.length}
                  </span>
                )}
              </button>
            </>
          )}
        </div>
      </nav>

      {/* NOTIFICATION SLIDER */}
      {user && (
        <>
          {showNotif && (
            <div
              className="fixed inset-0 bg-black/40 backdrop-blur-[1px] z-[99]"
              onClick={() => setShowNotif(false)}
              aria-hidden="true"
            />
          )}

          <aside
            className={`fixed top-0 right-0 h-full w-[380px] md:w-[420px] z-[100]
                        transform transition-transform duration-300 ease-out
                        ${showNotif ? "translate-x-0" : "translate-x-full"}`}
            role="dialog"
            aria-label="Notifications"
          >
            <div className="h-full flex flex-col rounded-l-2xl overflow-hidden shadow-2xl pointer-events-auto">
              {/* Header */}
              <div className="bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white p-4 pl-5 sticky top-0 z-10 flex items-center justify-between">
                <div className="font-semibold text-lg">Notifications</div>
                <div className="flex items-center gap-2">
                  <button
                    className="text-xs/none px-2 py-1 rounded bg-white/20 hover:bg-white/30 active:scale-[0.98] transition"
                    onClick={markAllRead}
                  >
                    Mark all read
                  </button>
                  <button
                    className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 grid place-items-center text-xl leading-none"
                    onClick={() => setShowNotif(false)}
                    aria-label="Close"
                    type="button"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* List */}
              <div className="flex-1 overflow-y-auto bg-white">
                <div className="p-3 text-sm">
                  {loading ? (
                    <div className="text-gray-500">Loading…</div>
                  ) : notifs.length === 0 ? (
                    <div className="text-gray-500">No notifications yet.</div>
                  ) : (
                    <ul className="space-y-3">
                      {notifs.map((n) => (
                        <li
                          key={n.id}
                          className={`border rounded-xl p-3 cursor-pointer transition hover:shadow-sm ${
                            n.status === "unread"
                              ? "bg-purple-50 border-purple-200"
                              : "bg-white"
                          }`}
                          onClick={() =>
                            handleOpenNotification({
                              ...n,
                              data: n.data
                                ? (typeof n.data === "string" ? JSON.parse(n.data) : n.data)
                                : null,
                            })
                          }
                        >
                          <div className="font-medium text-gray-900">{n.title}</div>
                          {n.body && <div className="text-gray-600 mt-0.5">{n.body}</div>}
                          <div className="text-[11px] text-gray-500 mt-1">
                            {new Date(n.created_at).toLocaleString()}
                          </div>
                          {n.status === "unread" && (
                            <button
                              className="mt-2 text-[11px] underline"
                              onClick={(e) => {
                                e.stopPropagation();
                                markRead(n.id);
                              }}
                            >
                              Dismiss
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Footer (optional subtle hint) */}
              <div className="p-3 bg-gray-50 text-[12px] text-gray-500 border-t">
                You’ll receive updates about expenses, settlements, and groups here.
              </div>
            </div>
          </aside>
        </>
      )}
    </>
  );
}

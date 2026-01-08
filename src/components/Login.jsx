import { useState } from "react";
import axios from "axios";

export default function Login({ switchToSignup, onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await axios.post("http://localhost:5000/login", { email, password });

      // Backend returns: { message, user: { id, name, email }, token }
      const userData = response.data.user;  

      // ✅ Pass user object to parent (App.jsx) to update state
      onLogin(userData);

      alert("Login successful!");
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || "Login failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-xl">
      <h1 className="text-3xl font-bold text-center text-purple-700 mb-6">SplitEase Login</h1>
      <form onSubmit={handleLogin} className="space-y-4">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
          required
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-purple-700 hover:bg-purple-800 text-white py-2 rounded-lg font-semibold transition-colors"
        >
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>
      <p className="mt-4 text-center text-gray-600">
        Not registered yet?{" "}
        <button onClick={switchToSignup} className="text-purple-700 font-semibold hover:underline">
          Sign up
        </button>
      </p>
    </div>
  );
}

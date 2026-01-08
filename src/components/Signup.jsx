// components/Signup.jsx
import { useState } from "react";
import axios from "axios";

export default function Signup({ switchToLogin }) {
  const [form, setForm] = useState({ name: "", email: "", password: "", mobile: "" });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post("http://localhost:5000/signup", form);
      alert("User registered successfully!");
      switchToLogin(); // switch to login modal after successful signup
    } catch (err) {
      console.error(err);
      alert("Registration failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-xl relative">
      <h2 className="text-2xl font-bold text-center text-purple-700 mb-6">SplitEase Sign Up</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          name="name"
          placeholder="Full Name"
          onChange={handleChange}
          className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
          required
        />
        <input
          name="email"
          type="email"
          placeholder="Email"
          onChange={handleChange}
          className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
          required
        />
        <input
          type="password"
          name="password"
          placeholder="Password"
          onChange={handleChange}
          className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
          required
        />
        <input
          name="mobile"
          placeholder="Mobile Number"
          onChange={handleChange}
          className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-purple-700 hover:bg-purple-800 text-white py-2 rounded-lg font-semibold transition-colors"
        >
          {loading ? "Registering..." : "Sign Up"}
        </button>
      </form>

      <p className="mt-6 text-center text-gray-600">
        Already a customer?{" "}
        <button
          onClick={switchToLogin}
          className="text-purple-700 font-semibold hover:underline"
        >
          Login
        </button>
      </p>
    </div>
  );
}

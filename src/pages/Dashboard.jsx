import { Routes, Route, Navigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import PersonalExpenses from "./PersonalExpenses";
import Groups from "./Groups";
import Footer from "../components/Footer";

export default function Dashboard({ user }) {
  if (!user) {
    return (
      <div className="text-center mt-20 text-xl">
        Please <a href="/" className="text-purple-700 underline">login</a> to access the dashboard.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 via-purple-50 to-blue-50 flex flex-col">

      {/* Navbar with bottom gap */}
      <div className="mb-16">
        <Navbar user={user} />
      </div>

      {/* Main content */}
      <div className="flex-grow">
        <Routes>
          <Route path="/" element={<Navigate to="personal" />} />
          <Route path="personal" element={<PersonalExpenses userId={user.id} />} />
          <Route path="groups" element={<Groups userId={user.id} />} />
        </Routes>
      </div>

      {/* Footer with large top margin */}
      <div className="mt-28">
        <Footer />
      </div>

    </div>
  );
}

export default function Footer() {
  return (
    <footer className="bg-purple-100 text-purple-800 mt-10 w-full">
      <div className="max-w-7xl mx-auto px-6 py-10 grid md:grid-cols-3 gap-8">

        {/* Left: Logo / Name */}
        <div>
          <h2 className="text-2xl font-bold mb-4">SplitEase 2025</h2>
          <p className="text-sm">
            Track and split your expenses easily. Manage personal and group expenses effortlessly.
          </p>
        </div>

        {/* Middle: Navigation */}
        <div>
          <h3 className="text-lg font-semibold mb-3">Navigation</h3>
          <ul className="space-y-2">
            <li>
              <a href="/" className="hover:underline">Personal Expenses</a>
            </li>
            <li>
              <a href="/groups" className="hover:underline">Groups</a>
            </li>
            <li>
              <a href="/login" className="hover:underline">Login</a>
            </li>
            <li>
              <a href="/signup" className="hover:underline">Signup</a>
            </li>
          </ul>
        </div>

        {/* Right: Contact */}
        <div>
          <h3 className="text-lg font-semibold mb-3">Contact / Feedback</h3>
          <form className="flex flex-col space-y-2">
            <input
              type="text"
              placeholder="Your Name"
              className="p-2 border rounded"
            />
            <input
              type="email"
              placeholder="Your Email"
              className="p-2 border rounded"
            />
            <textarea
              placeholder="Message"
              className="p-2 border rounded resize-none"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-purple-700 text-white rounded hover:bg-purple-800 transition"
            >
              Send
            </button>
          </form>
        </div>

      </div>

      {/* Bottom */}
      <div className="bg-purple-200 text-purple-800 text-sm text-center py-3 mt-6">
        &copy; 2025 SplitEase. All rights reserved.
      </div>
    </footer>
  );
}

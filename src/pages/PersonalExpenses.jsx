import { useEffect, useState } from "react";
import axios from "axios";
import Footer from "../components/Footer";


export default function PersonalExpenses({ userId }) {
  const [expenses, setExpenses] = useState([]);
  const [filteredExpenses, setFilteredExpenses] = useState([]);
  const [formData, setFormData] = useState({
    description: "",
    vendor: "",
    amount: "",
    expense_date: "",
    category: "",
  });
  const [receiptFile, setReceiptFile] = useState(null);
  const [filter, setFilter] = useState({ category: "", startDate: "", endDate: "" });

  const [editModal, setEditModal] = useState(false);
  const [receiptModal, setReceiptModal] = useState(false);
  const [editId, setEditId] = useState(null);

  // UX for upload
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  // ------------------- HELPERS -------------------
  // Normalize many date formats -> yyyy-MM-dd
  const pad2 = (n) => String(n).padStart(2, "0");

const toISODate = (raw) => {
  if (!raw) return "";

  const s = String(raw).trim();

  // ✅ dd/mm/yy → yyyy-mm-dd (prepend 20)
  if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2}$/.test(s)) {
    let [dd, mm, yy] = s.split(/[\/\-\.]/);
    yy = "20" + yy;
    return `${yy}-${pad2(mm)}-${pad2(dd)}`;
  }

  // ✅ dd/mm/yyyy (any one/two-digit day/month)
  let m = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (m) {
    const dd = parseInt(m[1], 10);
    const mm = parseInt(m[2], 10);
    const yyyy = parseInt(m[3], 10);
    return `${yyyy}-${pad2(mm)}-${pad2(dd)}`;
  }

  // ✅ ISO (yyyy-mm-dd or yyyy-mm-ddT…)
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  // ✅ Try natural language dates: "Nov 8 2025" etc.
  const tryDate = new Date(s);
  if (!isNaN(tryDate.getTime())) {
    const yyyy = tryDate.getFullYear();
    const mm = pad2(tryDate.getMonth() + 1);
    const dd = pad2(tryDate.getDate());
    return `${yyyy}-${mm}-${dd}`;
  }

  return "";
};


  // ------------------- FETCH EXPENSES -------------------
  useEffect(() => {
    if (!userId) return;
    axios
      .get(`http://localhost:5000/expenses/personal/${userId}`)
      .then((res) => {
        setExpenses(res.data);
        setFilteredExpenses(res.data);
      })
      .catch((err) => console.error(err));
  }, [userId]);

  // ------------------- SUBMIT EXPENSE -------------------
  const handleSubmitExpense = async (e, isModal = false) => {
    e.preventDefault();
    if (!userId) return;

    try {
      if (editId) {
        // EDIT EXPENSE
        await axios.put(`http://localhost:5000/expenses/${editId}`, formData);
        const updated = expenses.map((exp) =>
          exp.expense_id === editId ? { ...exp, ...formData } : exp
        );
        setExpenses(updated);
        setFilteredExpenses(updated);
        setEditId(null);
        setEditModal(false);
      } else {
        // ADD NEW EXPENSE
        const res = await axios.post("http://localhost:5000/expenses", {
          ...formData,
          payer_id: userId,
          uploader_id: userId,
          group_id: null,
        });
        const newExp = { ...formData, expense_id: res.data.insertId };
        setExpenses([...expenses, newExp]);
        setFilteredExpenses([...filteredExpenses, newExp]);
        if (isModal) setReceiptModal(false);
      }

      // Reset form
      setFormData({ description: "", vendor: "", amount: "", expense_date: "", category: "" });
    } catch (err) {
      console.error(err);
      alert("Failed to save expense.");
    }
  };

  // ------------------- UPLOAD RECEIPT -------------------
  const handleUploadReceipt = async () => {
    if (!receiptFile) {
      setUploadError("Please choose a file first.");
      return;
    }
    setUploadError("");
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", receiptFile, receiptFile.name);

      // IMPORTANT: no trailing slash; add a timeout so it doesn't hang forever
      const res = await axios.post(
        "http://127.0.0.1:8000/process_receipt",
        form,
        {
          headers: { "Content-Type": "multipart/form-data" },
          timeout: 20000, // 20s
        }
      );

      // Your OCR server returns: { company, date, time, grand_total }
      const { company, date, time, grand_total } = res.data || {};

      const isoDate = toISODate(date);
      const amountStr = grand_total != null ? String(grand_total).replace(/[^\d.]/g, "") : "";
      const amount = amountStr ? amountStr : "";

      setFormData((prev) => ({
        ...prev,
        description: prev.description || "",     // keep any existing description from user
        vendor: company || "",
        amount: amount,
        expense_date: isoDate,                   // MUST be yyyy-MM-dd
        category: prev.category || "",           // OCR doesn't provide; keep user’s
      }));

      setReceiptModal(true);
      setReceiptFile(null);
    } catch (err) {
      console.error("Failed to upload receipt:", err);
      setUploadError(
        err.code === "ECONNABORTED"
          ? "OCR took too long. Please try again or use a smaller/clearer image."
          : "Failed to parse receipt. Please check the image and try again."
      );
    } finally {
      setUploading(false);
    }
  };

  // ------------------- EDIT & DELETE -------------------
  const handleEdit = (exp) => {
    setFormData({
      description: exp.description || "",
      vendor: exp.vendor || "",
      amount: String(exp.amount ?? ""),
      expense_date: exp.expense_date ? toISODate(exp.expense_date) : "",
      category: exp.category || "",
    });
    setEditId(exp.expense_id);
    setEditModal(true);
  };

const handleDelete = async (expense_id) => {
  if (!window.confirm("Are you sure you want to delete this expense?")) return;

  try {
    await axios.delete(`http://localhost:5000/expenses/${expense_id}`, {
      data: { deleter_id: userId }   // ✅ REQUIRED FIX
    });

    const updated = expenses.filter((exp) => exp.expense_id !== expense_id);
    setExpenses(updated);
    setFilteredExpenses(updated);
  } catch (err) {
    console.error("Failed to delete expense:", err);
    alert("Failed to delete expense.");
  }
};


  const closeModals = () => {
    setEditModal(false);
    setReceiptModal(false);
    setEditId(null);
    setFormData({ description: "", vendor: "", amount: "", expense_date: "", category: "" });
  };

  // ------------------- FILTERS -------------------
  const applyFilter = () => {
    let temp = [...expenses];
    if (filter.category) {
      temp = temp.filter((exp) =>
        exp.category?.toLowerCase().includes(filter.category.toLowerCase())
      );
    }
    if (filter.startDate) temp = temp.filter((exp) => toISODate(exp.expense_date) >= filter.startDate);
    if (filter.endDate) temp = temp.filter((exp) => toISODate(exp.expense_date) <= filter.endDate);
    setFilteredExpenses(temp);
  };

  const removeFilter = () => {
    setFilter({ category: "", startDate: "", endDate: "" });
    setFilteredExpenses(expenses);
  };

  // ------------------- RENDER -------------------
  return (
    <div className="max-w-6xl mx-auto mt-8 px-4 flex flex-col md:flex-row gap-6">

      {/* LEFT: Forms */}
      <div className="flex flex-col gap-6 w-full md:w-1/2">
        {/* Manual Add Expense */}
        <div className="bg-white/70 backdrop-blur rounded-2xl shadow-xl border border-purple-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-extrabold text-purple-800 tracking-tight">
              Add Expense Manually
            </h2>
            <span className="text-[11px] px-2 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-100">
              Personal
            </span>
          </div>

          <form onSubmit={(e) => handleSubmitExpense(e, false)} className="grid grid-cols-1 gap-4">
            <Input
              placeholder="Description"
              value={formData.description}
              onChange={(v) => setFormData({ ...formData, description: v })}
              required
            />
            <Input
              placeholder="Vendor"
              value={formData.vendor}
              onChange={(v) => setFormData({ ...formData, vendor: v })}
            />
            <Input
              type="number"
              placeholder="Amount"
              value={formData.amount}
              onChange={(v) => setFormData({ ...formData, amount: v })}
              required
            />
            <Input
              type="date"
              value={formData.expense_date}
              onChange={(v) => setFormData({ ...formData, expense_date: v })}
              required
            />
            <Input
              placeholder="Category (Food, Travel, etc.)"
              value={formData.category}
              onChange={(v) => setFormData({ ...formData, category: v })}
            />

            <div className="flex items-center justify-end">
              <button
                type="submit"
                className="inline-flex items-center gap-2 bg-purple-700 text-white py-3 px-4 rounded-xl hover:bg-purple-800 transition shadow-md"
              >
                <span>➕</span> Add Expense
              </button>
            </div>
          </form>
        </div>

        {/* Upload Receipt */}
        <div className="bg-white/70 backdrop-blur rounded-2xl shadow-xl border border-purple-100 p-6">
          <h2 className="text-2xl font-extrabold mb-4 text-purple-800 tracking-tight">
            Add Expense via Receipt
          </h2>
          <div className="flex gap-3 items-center">
            <input
              type="file"
              onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
              className="block w-full text-sm file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-purple-100 file:text-purple-800 hover:file:bg-purple-200 border border-gray-200 rounded-xl px-3 py-2"
            />
            <button
              onClick={handleUploadReceipt}
              disabled={uploading}
              className={`whitespace-nowrap py-2.5 px-4 rounded-xl border transition shadow-md ${
                uploading
                  ? "bg-gray-400 text-white border-gray-400 cursor-not-allowed"
                  : "bg-black text-white hover:bg-white hover:text-black border-black"
              }`}
            >
              {uploading ? "Uploading…" : "Upload"}
            </button>
          </div>
          {uploadError && <p className="text-xs text-red-600 mt-2">{uploadError}</p>}
          {!uploadError && uploading && (
            <p className="text-xs text-gray-500 mt-2">Parsing receipt, please wait…</p>
          )}
          <p className="text-xs text-gray-500 mt-2">
            We’ll pre-fill the form with details parsed from your receipt. Review & submit.
          </p>
        </div>
      </div>

      {/* RIGHT: List & Filters */}
<div className="w-full md:w-1/2">
  <div className="bg-white/80 backdrop-blur rounded-2xl shadow-xl border border-purple-100 p-6">

    <div className="flex items-center justify-between mb-4">
      <h2 className="text-2xl font-extrabold text-purple-800 tracking-tight">Your Expenses</h2>
      <div className="text-right">
        <div className="text-xs text-gray-500">Total items</div>
        <div className="text-lg font-semibold text-purple-700">{filteredExpenses.length}</div>
      </div>
    </div>

    {/* ✅ VISUAL EXPENSE BREAKDOWN — put here */}
    <div className="bg-white/80 backdrop-blur rounded-2xl shadow-xl border border-purple-100 p-6 mb-4">
      <h2 className="text-xl font-bold text-purple-800 mb-3">Visual Expense Breakdown</h2>

      {filteredExpenses.length === 0 ? (
        <p className="text-sm text-gray-500">No data available to visualize.</p>
      ) : (
        <ExpenseChart data={filteredExpenses} />
      )}
    </div>

    {/* ✅ FILTER AREA continues below */}
    <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-purple-50 to-white p-4 mb-4 space-y-4">

  {/* Search Category Input - Full Width */}
  <div>
    <Input
      placeholder="Search by category"
      value={filter.category}
      onChange={(v) => setFilter({ ...filter, category: v })}
    />
  </div>

  {/* Date Range Row */}
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
    <div>
      <label className="text-xs text-gray-600">Start Date</label>
      <Input
        type="date"
        value={filter.startDate}
        onChange={(v) => setFilter({ ...filter, startDate: v })}
      />
    </div>
    <div>
      <label className="text-xs text-gray-600">End Date</label>
      <Input
        type="date"
        value={filter.endDate}
        onChange={(v) => setFilter({ ...filter, endDate: v })}
      />
    </div>
  </div>

  {/* Buttons Row */}
  <div className="flex gap-3 justify-end">
    <button
      onClick={applyFilter}
      className="px-4 py-2 bg-purple-700 text-white rounded-xl hover:bg-purple-800 transition shadow-sm"
    >
      Apply
    </button>

    {(filter.category || filter.startDate || filter.endDate) && (
      <button
        onClick={removeFilter}
        className="px-4 py-2 bg-white text-purple-800 rounded-xl border border-purple-200 hover:bg-purple-50 transition"
      >
        Reset
      </button>
    )}
  </div>
</div>


          {/* Expense List */}
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-purple-200">
            {filteredExpenses.length === 0 ? (
              <div className="text-center py-12">
                <div className="mx-auto w-16 h-16 rounded-full bg-purple-50 flex items-center justify-center text-2xl text-purple-600 mb-3">
                  🧾
                </div>
                <p className="text-purple-800 text-lg font-semibold">No personal expenses</p>
                <p className="text-gray-500 text-sm">Add one from the form on the left.</p>
              </div>
            ) : (
              filteredExpenses.map((exp) => (
                <div
                  key={exp.expense_id}
                  className="group flex items-start justify-between p-4 bg-white rounded-xl shadow border border-gray-100 hover:shadow-md transition"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-purple-900">{exp.description}</p>
                      {exp.category && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-100">
                          {exp.category}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">
                      {exp.vendor || <span className="italic text-gray-400">No vendor</span>}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {toISODate(exp.expense_date)}
                    </p>
                  </div>

                  <div className="text-right ml-4">
                    <div className="text-lg font-semibold text-purple-800">₹{exp.amount}</div>
                    <div className="flex gap-3 mt-2 justify-end">
                      <button
                        onClick={() => handleEdit(exp)}
                        className="text-sm font-medium text-blue-600 hover:text-blue-800"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(exp.expense_id)}
                        className="text-sm font-medium text-red-600 hover:text-red-800"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* EDIT MODAL */}
      {editModal && (
        <Modal
          title="Edit Expense"
          formData={formData}
          setFormData={setFormData}
          onClose={closeModals}
          onSubmit={handleSubmitExpense}
        />
      )}

      {/* RECEIPT MODAL */}
      {receiptModal && (
        <Modal
          title="Add Expense via Receipt"
          formData={formData}
          setFormData={setFormData}
          onClose={closeModals}
          onSubmit={(e) => handleSubmitExpense(e, true)}
        />
      )}
    </div>
  );
}

/* ---------- Small presentational helpers (no functionality change) ---------- */

const Input = ({ value, onChange, placeholder, type = "text", required = false }) => (
  <input
    type={type}
    placeholder={placeholder}
    value={value}
    required={required}
    onChange={(e) => onChange(e.target.value)}
    className="w-full border border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 px-3 py-2.5 rounded-xl outline-none transition bg-white"
  />
);

const Modal = ({ title, formData, setFormData, onClose, onSubmit }) => (
  <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50">
    <div className="bg-white rounded-2xl shadow-2xl w-[28rem] p-6 border border-purple-100">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-extrabold text-purple-800">{title}</h2>
        <button
          onClick={onClose}
          className="h-8 w-8 rounded-full grid place-items-center hover:bg-gray-100"
          aria-label="Close"
        >
          ✕
        </button>
      </div>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <Input
          placeholder="Description"
          value={formData.description}
          onChange={(v) => setFormData({ ...formData, description: v })}
          required
        />
        <Input
          placeholder="Vendor"
          value={formData.vendor}
          onChange={(v) => setFormData({ ...formData, vendor: v })}
        />
        <Input
          type="number"
          placeholder="Amount"
          value={formData.amount}
          onChange={(v) => setFormData({ ...formData, amount: v })}
          required
        />
        <Input
          type="date"
          value={formData.expense_date}
          onChange={(v) => setFormData({ ...formData, expense_date: v })}
          required
        />
        <Input
          placeholder="Category"
          value={formData.category}
          onChange={(v) => setFormData({ ...formData, category: v })}
        />
        <div className="flex gap-2 mt-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-gray-200 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-purple-700 text-white hover:bg-purple-800 shadow"
          >
            Submit
          </button>
        </div>
      </form>
    </div>
  </div>
);

import {
  PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from "recharts";

/* ---------- ExpenseChart (Pie + Bar) ---------- */
const ExpenseChart = ({ data }) => {
  // aggregate category totals
  const totals = {};
  data.forEach((e) => {
    const cat = e.category || "Uncategorized";
    const amt = parseFloat(e.amount) || 0;
    totals[cat] = (totals[cat] || 0) + amt;
  });

  const chartData = Object.entries(totals).map(([category, amount]) => ({
    category,
    amount,
  }));

  const COLORS = ["#6D28D9", "#9333EA", "#7C3AED", "#C084FC", "#A78BFA", "#E9D5FF"];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

      {/* PIE CHART */}
      <div className="flex justify-center">
        <PieChart width={260} height={260}>
          <Pie
            data={chartData}
            dataKey="amount"
            nameKey="category"
            cx="50%"
            cy="50%"
            outerRadius={90}
            label
          >
            {chartData.map((_, index) => (
              <Cell key={index} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </div>

      {/* BAR CHART */}
      <div className="flex justify-center">
        <BarChart width={300} height={260} data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="category" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="amount">
            {chartData.map((_, index) => (
              <Cell key={index} fill={COLORS[index % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </div>
    </div>
  );
};

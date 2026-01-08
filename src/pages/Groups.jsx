import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";





// Normalizes 06/01/2018 → 2018-01-06 etc.
const normalizeDate = (raw) => {
  if (!raw) return "";

  const s = String(raw).trim();

  // ✅ yyyy-mm-dd or yyyy-mm-ddTHH:MM
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  // ✅ dd/mm/yy → prepend "20"
  // ✅ dd/mm/yyyy
  let m = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (m) {
    let dd = parseInt(m[1], 10);
    let mm = parseInt(m[2], 10);
    let yyyy = m[3];

    // ✅ fix 2-digit years like "25" → "2025"
    if (yyyy.length === 2) yyyy = "20" + yyyy;

    return `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
  }

  // ✅ Parse formats like "Nov 08 2025", "November 8, 2025", full text dates
  const tryDate = new Date(s);
  if (!isNaN(tryDate.getTime())) {
    const yyyy = tryDate.getFullYear();
    const mm = String(tryDate.getMonth() + 1).padStart(2, "0");
    const dd = String(tryDate.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  return "";
};


const safeMoney = (v) => (v ? String(v).replace(/[^\d.]/g, "") : "");


export default function Groups({ userId }) {
  const location = useLocation();
  const navigate = useNavigate();

  // ✅ For UPI OCR loading
const [upiUploading, setUpiUploading] = useState(false);
const [upiUploadError, setUpiUploadError] = useState("");

  const [receiptUploading, setReceiptUploading] = useState(false);
const [receiptUploadError, setReceiptUploadError] = useState("");
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [groupName, setGroupName] = useState("");
  const [groupMembers, setGroupMembers] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [settlements, setSettlements] = useState([]);

  // Modals / modes
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showJoinGroup, setShowJoinGroup] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseMode, setExpenseMode] = useState(null); // "manual" | "receipt" | null

  // Settlement suggestion modal
  const [showSettlementModal, setShowSettlementModal] = useState(false);
  const [settlementPlan, setSettlementPlan] = useState([]); // [{fromUserId, toUserId, fromName, toName, amount}]

  // Add Payment modal (updated flow)
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentStep, setPaymentStep] = useState("choice"); // "choice" | "upload" | "form"
  const [paymentFile, setPaymentFile] = useState(null);

  const [paymentForm, setPaymentForm] = useState({
    payee_id: "",
    amount: "",
    method: "upi",             // 'upi' | 'cash'
    payment_made_on: "",       // YYYY-MM-DD (required)
    payment_made_time: "",     // optional "HH:MM"
  });
  const resetPaymentFlow = () => {
    setPaymentForm({
      payee_id: "",
      amount: "",
      method: "upi",
      payment_made_on: "",
      payment_made_time: "",
    });
    setPaymentFile(null);
    setPaymentStep("choice");
  };

  // Add member (registered-only by phone)
  const [addMemberPhone, setAddMemberPhone] = useState("");
  const [lookup, setLookup] = useState({ loading: false, found: null, user: null, error: "" });

  // Create/join
  const [joinCode, setJoinCode] = useState("");

  // Expense form + inline edit
  const [manualExpense, setManualExpense] = useState({
    description: "",
    vendor: "",
    amount: "",
    expense_date: "",
    category: "",
    payer_id: "",
    participants: [],
  });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    description: "",
    vendor: "",
    amount: "",
    expense_date: "",
    category: "",
  });

  const [receiptFile, setReceiptFile] = useState(null);

  // Toggle participants for checkboxes
  const toggleParticipant = (uid) => {
    const userIdStr = uid.toString();
    setManualExpense((prev) => ({
      ...prev,
      participants: prev.participants.includes(userIdStr)
        ? prev.participants.filter((id) => id !== userIdStr)
        : [...prev.participants, userIdStr],
    }));
  };

  // Fetch groups
  useEffect(() => {
    if (!userId) return;
    axios
      .get(`http://localhost:5000/groups/user/${userId}`)
      .then((res) => setGroups(res.data))
      .catch((err) => console.error(err));
  }, [userId]);

  // Fetch members / expenses / settlements when group changes
  useEffect(() => {
    if (!selectedGroup) return;

    axios
      .get(`http://localhost:5000/groups/${selectedGroup.group_id}/members`)
      .then((res) => setGroupMembers(res.data))
      .catch((err) => console.error(err));

    axios
      .get(`http://localhost:5000/groups/${selectedGroup.group_id}/expenses`)
      .then((res) => setExpenses(res.data))
      .catch((err) => console.error(err));

    axios
      .get(`http://localhost:5000/groups/${selectedGroup.group_id}/settlements`)
      .then((res) => setSettlements(res.data))
      .catch((err) => console.error(err));
  }, [selectedGroup]);

  // preselect group from ?gid=
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const gidParam = params.get("gid");
    const gid = gidParam ? parseInt(gidParam, 10) : NaN;
    if (!isNaN(gid) && groups.length) {
      const g = groups.find((x) => x.group_id === gid);
      if (g) setSelectedGroup(g);
    }
  }, [location.search, groups]);

  // ---------------- Create / Join ----------------
  const handleCreateGroup = (e) => {
    e.preventDefault();
    if (!groupName) return;

    axios
      .post("http://localhost:5000/groups", {
        group_name: groupName,
        created_by: userId,
      })
      .then((res) => {
        const newGroup = {
          group_id: res.data.group_id,
          group_name: res.data.group_name,
          gcode: res.data.gcode,
          created_by: res.data.created_by,
          created_at: new Date().toISOString(),
        };
        setGroups((prev) => [newGroup, ...prev]);
        setGroupName("");
        setShowCreateGroup(false);
        setSelectedGroup(newGroup);
      })
      .catch((err) => console.error(err));
  };

  const handleJoinGroup = (e) => {
    e.preventDefault();
    if (!joinCode) return;
    axios
      .post("http://localhost:5000/groups/join", { gcode: joinCode, user_id: userId })
      .then((res) => {
        const g = {
          group_id: res.data.group_id,
          group_name: res.data.group_name,
          gcode: res.data.gcode,
          created_by: res.data.created_by,
          created_at: res.data.created_at,
        };
        setGroups((prev) => {
          const exists = prev.some((x) => x.group_id === g.group_id);
          return exists ? prev : [g, ...prev];
        });
        setShowJoinGroup(false);
        setJoinCode("");
        setSelectedGroup(g);
      })
      .catch((err) => {
        alert(err.response?.data?.error || "Failed to join group");
      });
  };

  // ---------------- Members (registered-only via phone) ----------------
  const lookupPhone = async (phone) => {
    if (!phone) return;
    setLookup({ loading: true, found: null, user: null, error: "" });
    try {
      const res = await axios.get("http://localhost:5000/users/lookup", {
        params: { phone },
      });
      if (res.data.found) {
        setLookup({ loading: false, found: true, user: res.data.user, error: "" });
      } else {
        setLookup({ loading: false, found: false, user: null, error: "" });
      }
    } catch (e) {
      setLookup({
        loading: false,
        found: null,
        user: null,
        error: "Lookup failed",
      });
    }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!selectedGroup) return;
    if (!addMemberPhone) return;

    try {
      const res = await axios.post(
        `http://localhost:5000/groups/${selectedGroup.group_id}/members`,
        { phone: addMemberPhone }
      );
      setGroupMembers((prev) => {
        if (prev.some((m) => m.user_id === res.data.user_id)) return prev;
        return [...prev, { user_id: res.data.user_id, user_name: res.data.user_name }];
      });
      setAddMemberPhone("");
      setLookup({ loading: false, found: null, user: null, error: "" });
      setShowAddMember(false);
    } catch (err) {
      alert(err.response?.data?.error || "Failed to add member");
    }
  };

  // ---------------- Expenses ----------------
  const handleAddManualExpense = async (e) => {
    e.preventDefault();
    if (
      !manualExpense.description ||
      !manualExpense.amount ||
      !manualExpense.payer_id ||
      !manualExpense.participants.length ||
      !selectedGroup
    )
      return;

    try {
      const expenseData = {
        ...manualExpense,
        group_id: selectedGroup.group_id,
        uploader_id: userId,
        payer_id: parseInt(manualExpense.payer_id, 10),
      };

      const expenseRes = await axios.post(
        `http://localhost:5000/groups/${selectedGroup.group_id}/expenses`,
        expenseData
      );

      const expenseId = expenseRes.data.expense_id;
      const amount = parseFloat(manualExpense.amount);
      const participantCount = manualExpense.participants.length;
      const splitAmount = parseFloat((amount / participantCount).toFixed(2));

      const splits = manualExpense.participants.map((uid) => ({
        expense_id: expenseId,
        user_id: parseInt(uid, 10),
        amount_owed: splitAmount,
      }));

      await axios.post(`http://localhost:5000/expense_splits/bulk`, { splits });

      const [updatedExpenses, updatedSettlements] = await Promise.all([
        axios.get(`http://localhost:5000/groups/${selectedGroup.group_id}/expenses`),
        axios.get(`http://localhost:5000/groups/${selectedGroup.group_id}/settlements`),
      ]);
      setExpenses(updatedExpenses.data);
      setSettlements(updatedSettlements.data);

      setManualExpense({
        description: "",
        vendor: "",
        amount: "",
        expense_date: "",
        category: "",
        payer_id: "",
        participants: [],
      });
      setShowExpenseModal(false);
      setExpenseMode(null);
    } catch (err) {
      console.error(err);
    }
  };

  // Upload receipt for expense and prefill manual form
 const handleUploadReceipt = async (e) => {
  e.preventDefault();

  if (!receiptFile) {
    setReceiptUploadError("Please choose a file first.");
    return;
  }

  setReceiptUploading(true);
  setReceiptUploadError("");

  try {
    const formData = new FormData();
    formData.append("file", receiptFile);

    const res = await axios.post(
      "http://127.0.0.1:8000/process_receipt/",
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 30000,
      }
    );

    const { company, date, grand_total } = res.data || {};

    setManualExpense((prev) => ({
      ...prev,
      description: "",
      vendor: company || "",
      amount: safeMoney(grand_total),
      expense_date: normalizeDate(date),
    }));

    setExpenseMode("manual");
  } catch (err) {
    console.error("Receipt OCR failed:", err);
    setReceiptUploadError(
      err.code === "ECONNABORTED"
        ? "OCR took too long. Try again or use a clearer image."
        : "Failed to read receipt. Please try again."
    );
  } finally {
    setReceiptUploading(false);
  }
};



  // Edit/Delete expense
  const beginEdit = (exp) => {
    setEditingId(exp.expense_id);
    setEditForm({
      description: exp.description || "",
      vendor: exp.vendor || "",
      amount: exp.amount || "",
      expense_date: exp.expense_date ? exp.expense_date.slice(0, 10) : "",
      category: exp.category || "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({
      description: "",
      vendor: "",
      amount: "",
      expense_date: "",
      category: "",
    });
  };

  const saveEdit = async (id) => {
    try {
      await axios.put(`http://localhost:5000/expenses/${id}`, editForm);
      const [updatedExpenses, updatedSettlements] = await Promise.all([
        axios.get(`http://localhost:5000/groups/${selectedGroup.group_id}/expenses`),
        axios.get(`http://localhost:5000/groups/${selectedGroup.group_id}/settlements`),
      ]);
      setExpenses(updatedExpenses.data);
      setSettlements(updatedSettlements.data);
      cancelEdit();
    } catch (e) {
      alert("Failed to update expense");
    }
  };

const deleteExpense = async (id) => {
  if (!window.confirm("Delete this expense?")) return;

  try {
    await axios.delete(`http://localhost:5000/expenses/${id}`, {
      data: { deleter_id: userId }   // ✅ FIXED
    });

    const [updatedExpenses, updatedSettlements] = await Promise.all([
      axios.get(`http://localhost:5000/groups/${selectedGroup.group_id}/expenses`),
      axios.get(`http://localhost:5000/groups/${selectedGroup.group_id}/settlements`),
    ]);

    setExpenses(updatedExpenses.data);
    setSettlements(updatedSettlements.data);
  } catch (e) {
    alert("Failed to delete expense");
    console.error(e);
  }
};

const leaveGroup = async () => {
  if (!selectedGroup) return;

  // ✅ Prevent owner from leaving (frontend check)
  if (selectedGroup.created_by === userId) {
    alert("You are the owner. You cannot leave this group. You can only delete it.");
    return;
  }

  if (!window.confirm("Are you sure you want to leave this group?")) return;

  try {
    await axios.delete(
      `http://localhost:5000/groups/${selectedGroup.group_id}/leave`,
      { data: { user_id: userId } }
    );

    setGroups((prev) => prev.filter((g) => g.group_id !== selectedGroup.group_id));
    setSelectedGroup(null);

    alert("You left the group.");
  } catch (err) {
    alert(err.response?.data?.error || "Failed to leave group");
  }
};


const deleteGroup = async () => {
  if (!selectedGroup) return;
  if (!window.confirm("Delete this group for EVERYONE?")) return;

  try {
    await axios.delete(
      `http://localhost:5000/groups/${selectedGroup.group_id}/delete`,
      { data: { user_id: userId } }
    );

    // Remove group locally
    setGroups((prev) => prev.filter(g => g.group_id !== selectedGroup.group_id));
    setSelectedGroup(null);

    alert("Group deleted.");
  } catch (err) {
    alert("Failed to delete group");
  }
};



  // --------- BALANCES ---------
  const calculateBalance = (memberId) => {
    let paid = 0;
    let owed = 0;

    expenses.forEach((exp) => {
      const amount = parseFloat(exp.amount) || 0;
      if (exp.payer_id === memberId) paid += amount;
      if (exp.splits) {
        const split = exp.splits.find((s) => s.user_id === memberId);
        if (split) owed += parseFloat(split.amount_owed) || 0;
      }
    });

    let net = paid - owed;

    // adjust with validated settlements
    settlements.forEach((s) => {
      if (s.status !== "validated") return;
      const amt = parseFloat(s.amount) || 0;
      if (s.payer_id === memberId) net += amt;  // payer paid, debt reduced
      if (s.payee_id === memberId) net -= amt;  // payee received, credit reduced
    });

    return net;
  };

  // --- Build settlement plan (who should pay whom) ---
  const buildSettlementPlan = () => {
    if (!selectedGroup) return [];

    const balances = groupMembers.map((m) => {
      const net = calculateBalance(m.user_id);
      return { user_id: m.user_id, name: m.user_name, balance: parseFloat(net.toFixed(2)) };
    });

    const eps = 0.005;
    const creditors = [];
    const debtors = [];
    balances.forEach((b) => {
      if (b.balance > eps) creditors.push({ ...b, amount: b.balance });
      else if (b.balance < -eps) debtors.push({ ...b, amount: -b.balance });
    });

    creditors.sort((a, b) => b.amount - a.amount);
    debtors.sort((a, b) => b.amount - a.amount);

    const transfers = [];
    let i = 0, j = 0;
    while (i < creditors.length && j < debtors.length) {
      const give = creditors[i];
      const owe = debtors[j];
      const amt = Math.min(give.amount, owe.amount);

      transfers.push({
        fromUserId: owe.user_id,
        toUserId: give.user_id,
        fromName: owe.name,
        toName: give.name,
        amount: parseFloat(amt.toFixed(2)),
      });

      give.amount = parseFloat((give.amount - amt).toFixed(2));
      owe.amount  = parseFloat((owe.amount  - amt).toFixed(2));

      if (give.amount <= eps) i++;
      if (owe.amount  <= eps) j++;
    }

    return transfers;
  };

  // --- Add Payment submission (multipart if UPI) ---
  const submitPayment = async (e) => {
    e.preventDefault();
    if (!selectedGroup) return;

    const payeeId = parseInt(paymentForm.payee_id, 10);
    const amt = parseFloat(paymentForm.amount);

    if (!payeeId || isNaN(amt) || amt <= 0) {
      return alert("Please fill payee and a valid amount.");
    }
    if (payeeId === userId) {
      return alert("You can’t pay yourself.");
    }
    if (!paymentForm.payment_made_on) {
      return alert("Please set the payment date.");
    }

    try {
      // Build formdata (for both methods; file only included for UPI & when selected)
      const fd = new FormData();
      fd.append("payer_id", String(userId));
      fd.append("payee_id", String(payeeId));
      fd.append("amount", String(amt));
      fd.append("method", paymentForm.method);
      fd.append("payment_made_on", paymentForm.payment_made_on);
      if (paymentForm.payment_made_time) {
        fd.append("payment_made_time", paymentForm.payment_made_time); // "14:35"
      }
      if (paymentForm.method === "upi" && paymentFile) {
        fd.append("proof", paymentFile);
      }

      await axios.post(
        `http://localhost:5000/groups/${selectedGroup.group_id}/settlements`,
        fd,
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      const updatedSettlements = await axios.get(
        `http://localhost:5000/groups/${selectedGroup.group_id}/settlements`
      );
      setSettlements(updatedSettlements.data);

      setShowPaymentModal(false);
      resetPaymentFlow();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to submit payment");
    }
  };

  // --- Validate / Reject (payee only) ---
  const actOnSettlement = async (id, action) => {
    try {
      if (action === "validate") {
        await axios.patch(`http://localhost:5000/settlements/${id}/validate`);
      } else {
        await axios.patch(`http://localhost:5000/settlements/${id}/reject`);
      }
      const res = await axios.get(
        `http://localhost:5000/groups/${selectedGroup.group_id}/settlements`
      );
      setSettlements(res.data);
    } catch (e) {
      alert("Action failed");
    }
  };

  // Combined timeline
  const timeline = [
    ...expenses.map((e) => ({
      kind: "expense",
      id: `exp-${e.expense_id}`,
      ts: e.created_at,
      text: `Expense: ${e.description} • ₹${e.amount} • by ${e.payer_name}`,
    })),
    ...settlements.map((s) => ({
      kind: "settlement",
      id: `set-${s.settlement_id}`,
      ts: s.settlement_date,
      status: s.status,
      payer_id: s.payer_id,
      payee_id: s.payee_id,
      method: s.method,
      // server now provides proof_url if blob exists
      proof_url: s.proof_url || null,
      text: `Settlement: ${s.payer_name} → ${s.payee_name} • ₹${s.amount} ${s.status ? `• ${s.status}` : ""}`,
      raw: s,
    })),
  ].sort((a, b) => new Date(b.ts) - new Date(a.ts));

  // ----- UPI OCR (image -> amount, date, time) -----
  // NOTE: replace the URL below with your actual OCR endpoint (your Tesseract service).
const runUpiOCR = async () => {
  if (!paymentFile) {
    setUpiUploadError("Please choose an image first.");
    return;
  }

  setUpiUploading(true);
  setUpiUploadError("");

  const fd = new FormData();
  fd.append("file", paymentFile);

  try {
    const res = await axios.post("http://127.0.0.1:8001/process_upi/", fd, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 45000,
    });

    const { amount, date, time } = res.data || {};

    setPaymentForm((prev) => ({
      ...prev,
      amount: safeMoney(amount),
      payment_made_on: normalizeDate(date),
      payment_made_time: time || "",
      method: "upi",
    }));

    setPaymentStep("form");
  } catch (err) {
    console.error("UPI OCR failed:", err);

    setUpiUploadError(
      err.code === "ECONNABORTED"
        ? "OCR timed out. Try again or upload a clearer screenshot."
        : "Unable to read UPI screenshot."
    );
  } finally {
    setUpiUploading(false);
  }
};



  return (
    <div className="max-w-7xl mx-auto mt-6 px-4 grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* ================= PART 1 ================= */}
      <div className="space-y-4">
        {/* Create / Join buttons */}
        <div className="bg-white p-4 rounded-2xl shadow flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowCreateGroup(true)}
            className="flex-1 bg-black text-white text-sm px-3 py-2 rounded hover:bg-gray-800 transition"
          >
            + Create Group
          </button>
          <button
            type="button"
            onClick={() => setShowJoinGroup(true)}
            className="flex-1 bg-purple-800 text-white text-sm px-3 py-2 rounded hover:bg-purple-600 transition"
          >
            ⇢ Join Group
          </button>
        </div>

        {/* Group selector + show gcode */}
        <div className="bg-white p-4 rounded-2xl shadow">
          <label className="block text-sm font-semibold mb-2">Select Group</label>
          <select
            className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none"
            value={selectedGroup?.group_id || ""}
            onChange={(e) => {
              const group = groups.find((g) => g.group_id === parseInt(e.target.value));
              setSelectedGroup(group || null);
            }}
          >
            <option value="">-- choose --</option>
            {groups.map((g) => (
              <option key={g.group_id} value={g.group_id}>
                {g.group_name}
              </option>
            ))}
          </select>

          {selectedGroup && (
  <div className="mt-3 text-sm">
    <div>
      <span className="font-semibold">Group Code:</span>{" "}
      <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800">
        {selectedGroup.gcode}
      </span>
    </div>
    <div className="text-gray-500">
      Share this code to let others join.
    </div>

    {/* ✅ Leave + Delete buttons go here */}
    <div className="flex gap-3 mt-4">
      <button
        className="flex-1 border border-red-600 text-red-600 px-3 py-2 rounded hover:bg-red-50 text-sm"
        onClick={leaveGroup}
      >
        Leave Group
      </button>

      {selectedGroup.created_by === userId && (
        <button
          className="flex-1 bg-red-700 text-white px-3 py-2 rounded hover:bg-red-800 text-sm"
          onClick={deleteGroup}
        >
          Delete Group
        </button>
      )}
    </div>
  </div>
)}

        </div>

        {/* Members & Balances */}
        {selectedGroup && (
          <div className="bg-white p-4 rounded-2xl shadow">
            <h2 className="text-lg font-bold text-purple-800 mb-2">Members & Balances</h2>
            <ul className="space-y-1 max-h-60 overflow-y-auto pr-1">
              {groupMembers.map((m) => {
                const net = calculateBalance(m.user_id);
                return (
                  <li key={m.user_id} className="flex justify-between text-sm">
                    <span>{m.user_name}</span>
                    <span className={net >= 0 ? "text-green-600" : "text-red-600"}>
                      {net >= 0 ? "+" : ""}
                      {net.toFixed(2)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Add Member (registered-only) */}
        <div className="bg-white p-4 rounded-2xl shadow">
          <h3 className="text-sm font-semibold mb-2">Add Member (Registered by Phone)</h3>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Phone number"
              value={addMemberPhone}
              onChange={(e) => setAddMemberPhone(e.target.value)}
              onBlur={() => lookupPhone(addMemberPhone)}
              className="flex-1 border px-3 py-2 rounded-lg"
              disabled={!selectedGroup}
            />
            <button
              type="button"
              onClick={handleAddMember}
              className="px-3 py-2 bg-purple-800 text-white rounded disabled:opacity-50"
              disabled={!selectedGroup || !lookup.found}
            >
              Add
            </button>
          </div>
          <div className="mt-2 text-sm">
            {lookup.loading && <span className="text-gray-500">Checking…</span>}
            {!lookup.loading && lookup.found === true && lookup.user && (
              <span className="text-green-700">
                User is registered: <b>{lookup.user.name}</b>
              </span>
            )}
            {!lookup.loading && lookup.found === false && (
              <span className="text-red-600">User not registered</span>
            )}
            {lookup.error && <span className="text-red-600">{lookup.error}</span>}
          </div>
        </div>
      </div>

      {/* ================= PART 2 ================= */}
      <div className="space-y-4">
        {/* Buttons */}
        <div className="bg-white p-4 rounded-2xl shadow flex flex-col gap-3">
          {/* Row 1: Add Expense + Add Payment */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                if (!selectedGroup) return alert("Pick a group first");
                setShowExpenseModal(true);
                setExpenseMode(null);
              }}
              className="flex-1 bg-purple-800 text-white text-sm px-3 py-2 rounded hover:bg-purple-600 transition disabled:opacity-50"
              disabled={!selectedGroup}
            >
              + Add Expense
            </button>

            <button
              type="button"
              onClick={() => {
                if (!selectedGroup) return alert("Pick a group first");
                setShowPaymentModal(true);
                resetPaymentFlow();
              }}
              className="flex-1 border border-green-700 text-green-700 text-sm px-3 py-2 rounded hover:bg-green-50 transition"
              disabled={!selectedGroup}
            >
              + Add Payment
            </button>
          </div>

          {/* Row 2: Suggest Settlement → full width */}
          <button
            type="button"
            onClick={() => {
              if (!selectedGroup) return alert("Pick a group first");
              const plan = buildSettlementPlan();
              setSettlementPlan(plan);
              setShowSettlementModal(true);
            }}
            className="w-full border border-purple-800 text-purple-800 text-sm px-3 py-2 rounded hover:bg-gray-50 transition"
          >
            Suggest Settlement
          </button>
        </div>

        {/* Expense List (editable) */}
        <div className="bg-[#FAF6EB] rounded-2xl shadow p-4">
          <h2 className="text-lg font-bold text-purple-900 mb-3">Expenses</h2>
          {(!selectedGroup || expenses.length === 0) ? (
            <p className="text-gray-600 text-sm">
              {selectedGroup ? "No expenses yet." : "Select a group to view expenses."}
            </p>
          ) : (
            <ul className="space-y-2 max-h-[450px] overflow-y-auto pr-1">
              {expenses.map((exp) => (
                <li key={exp.expense_id} className="bg-white rounded-lg p-3 shadow-sm">
                  {editingId === exp.expense_id ? (
                    <div className="grid gap-2 md:grid-cols-5">
                      <input
                        className="border px-2 py-1 rounded"
                        value={editForm.description}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, description: e.target.value }))
                        }
                      />
                      <input
                        className="border px-2 py-1 rounded"
                        placeholder="Vendor"
                        value={editForm.vendor}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, vendor: e.target.value }))
                        }
                      />
                      <input
                        className="border px-2 py-1 rounded"
                        type="number"
                        value={editForm.amount}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, amount: e.target.value }))
                        }
                      />
                      <input
                        className="border px-2 py-1 rounded"
                        type="date"
                        value={editForm.expense_date}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, expense_date: e.target.value }))
                        }
                      />
                      <input
                        className="border px-2 py-1 rounded"
                        placeholder="Category"
                        value={editForm.category}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, category: e.target.value }))
                        }
                      />
                      <div className="col-span-full flex gap-2 justify-end">
                        <button
                          className="px-3 py-1 border rounded"
                          onClick={cancelEdit}
                        >
                          Cancel
                        </button>
                        <button
                          className="px-3 py-1 bg-purple-800 text-white rounded"
                          onClick={() => saveEdit(exp.expense_id)}
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-sm">
                        <div className="font-semibold">{exp.description}</div>
                        <div className="text-gray-600">
                          ₹{exp.amount} {exp.category ? `• ${exp.category}` : ""} • Payer:{" "}
                          {exp.payer_name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {exp.vendor ? `Vendor: ${exp.vendor} • ` : ""}
                          {exp.expense_date ? exp.expense_date.slice(0, 10) : ""}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          className="text-xs px-2 py-1 border rounded"
                          onClick={() => beginEdit(exp)}
                        >
                          Edit
                        </button>
                        <button
                          className="text-xs px-2 py-1 border rounded text-red-700"
                          onClick={() => deleteExpense(exp.expense_id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ================= PART 3 ================= */}
      <div className="space-y-4">
        <div className="bg-white p-4 rounded-2xl shadow">
          <h2 className="text-lg font-bold text-purple-800 mb-2">Transaction History</h2>
          <p className="text-xs text-gray-500 mb-3">
            A chronological log of expenses and settlements for this group.
          </p>
          {(!selectedGroup || timeline.length === 0) ? (
            <p className="text-gray-600 text-sm">
              {selectedGroup ? "No transactions yet." : "Select a group to view history."}
            </p>
          ) : (
            <ul className="space-y-2 max-h-[550px] overflow-y-auto pr-1">
              {timeline.map((t) => (
                <li key={t.id} className="text-sm flex items-start gap-2">
                  <span
                    className={`mt-1 h-2 w-2 rounded-full ${
                      t.kind === "expense" ? "bg-purple-700" : "bg-green-600"
                    }`}
                  />
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span>{t.text}</span>
                      {t.kind === "settlement" && t.status === "pending" && (
                        <span className="text-xs px-2 py-0.5 rounded bg-yellow-100 text-yellow-800">
                          pending
                        </span>
                      )}
                      {t.kind === "settlement" && t.status === "validated" && (
                        <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-800">
                          validated
                        </span>
                      )}
                      {t.kind === "settlement" && t.status === "rejected" && (
                        <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-700">
                          rejected
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      {t.ts ? new Date(t.ts).toLocaleString() : ""}
                    </div>

                    {/* Approve/Reject controls for payee when pending */}
                    {t.kind === "settlement" &&
                      t.status === "pending" &&
                      t.payee_id === userId && (
                        <div className="mt-2 flex items-center gap-2">
                          <button
                            className="text-xs px-2 py-1 border rounded hover:bg-green-50"
                            onClick={() => actOnSettlement(t.raw.settlement_id, "validate")}
                          >
                            Approve
                          </button>
                          <button
                            className="text-xs px-2 py-1 border rounded hover:bg-red-50"
                            onClick={() => actOnSettlement(t.raw.settlement_id, "reject")}
                          >
                            Reject
                          </button>
                          {t.proof_url && (
                            <a
                              href={t.proof_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs underline text-purple-700"
                            >
                              view proof
                            </a>
                          )}
                        </div>
                      )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ================= MODALS ================= */}

      {/* Create Group Modal */}
      {showCreateGroup && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-xl w-96">
            <h2 className="text-lg font-bold mb-3">Create New Group</h2>
            <form onSubmit={handleCreateGroup} className="flex flex-col gap-3">
              <input
                type="text"
                placeholder="Group Name"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="border px-3 py-2 rounded-lg"
                required
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateGroup(false)}
                  className="px-3 py-1 border rounded"
                >
                  Cancel
                </button>
                <button className="px-3 py-1 bg-purple-800 text-white rounded">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Join Group Modal */}
      {showJoinGroup && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-xl w-96">
            <h2 className="text-lg font-bold mb-3">Join Group</h2>
            <form onSubmit={handleJoinGroup} className="flex flex-col gap-3">
              <input
                type="text"
                placeholder="6-char Group Code"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                className="border px-3 py-2 rounded-lg uppercase"
                maxLength={6}
                required
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowJoinGroup(false)}
                  className="px-3 py-1 border rounded"
                >
                  Cancel
                </button>
                <button className="px-3 py-1 bg-purple-800 text-white rounded">Join</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Expense Mode Selection */}
      {showExpenseModal && expenseMode === null && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-xl w-96 text-center">
            <h2 className="text-lg font-bold mb-4">How would you like to add the expense?</h2>
            <div className="flex justify-center gap-4">
              <button
                type="button"
                onClick={() => setExpenseMode("manual")}
                className="px-4 py-2 bg-purple-800 text-white rounded hover:bg-purple-600"
              >
                Manual Entry
              </button>
              <button
                type="button"
                onClick={() => setExpenseMode("receipt")}
                className="px-4 py-2 border border-purple-800 text-purple-800 rounded hover:bg-gray-100"
              >
                Upload Receipt
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowExpenseModal(false);
                setExpenseMode(null);
              }}
              className="mt-4 text-sm text-gray-500 hover:text-gray-800"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Manual Expense Modal */}
      {showExpenseModal && expenseMode === "manual" && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-xl w-96">
            <h2 className="text-lg font-bold mb-3">Add Manual Expense</h2>
            <form onSubmit={handleAddManualExpense} className="flex flex-col gap-3">
              <input
                type="text"
                placeholder="Description"
                value={manualExpense.description}
                onChange={(e) =>
                  setManualExpense({ ...manualExpense, description: e.target.value })
                }
                className="border px-3 py-2 rounded-lg"
                required
              />
              <input
                type="text"
                placeholder="Vendor"
                value={manualExpense.vendor}
                onChange={(e) => setManualExpense({ ...manualExpense, vendor: e.target.value })}
                className="border px-3 py-2 rounded-lg"
              />
              <input
                type="text"
                placeholder="Category (e.g., Food, Travel)"
                value={manualExpense.category}
                onChange={(e) => setManualExpense({ ...manualExpense, category: e.target.value })}
                className="border px-3 py-2 rounded-lg"
              />
              <input
                type="number"
                placeholder="Amount"
                value={manualExpense.amount}
                onChange={(e) => setManualExpense({ ...manualExpense, amount: e.target.value })}
                className="border px-3 py-2 rounded-lg"
                required
              />
              <input
                type="date"
                value={manualExpense.expense_date}
                onChange={(e) =>
                  setManualExpense({ ...manualExpense, expense_date: e.target.value })
                }
                className="border px-3 py-2 rounded-lg"
              />
              <select
                value={manualExpense.payer_id}
                onChange={(e) => setManualExpense({ ...manualExpense, payer_id: e.target.value })}
                className="border px-3 py-2 rounded-lg"
                required
              >
                <option value="">Select Payer</option>
                {groupMembers.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.user_name}
                  </option>
                ))}
              </select>

              <label className="text-sm font-semibold mt-2">Participants</label>
              <div className="border p-2 rounded-lg max-h-32 overflow-y-auto bg-gray-50">
                {groupMembers.map((m) => (
                  <div key={m.user_id} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={`participant-${m.user_id}`}
                      value={m.user_id}
                      checked={manualExpense.participants.includes(m.user_id.toString())}
                      onChange={() => toggleParticipant(m.user_id)}
                      className="text-purple-600 focus:ring-purple-500"
                    />
                    <label htmlFor={`participant-${m.user_id}`} className="text-sm cursor-pointer">
                      {m.user_name}
                    </label>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowExpenseModal(false);
                    setExpenseMode(null);
                  }}
                  className="px-3 py-1 border rounded"
                >
                  Cancel
                </button>
                <button className="px-3 py-1 bg-purple-800 text-white rounded">Add</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receipt Upload Modal */}
      {showExpenseModal && expenseMode === "receipt" && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-xl w-96 text-center">
            <h2 className="text-lg font-bold mb-4">Upload Receipt</h2>
            <form onSubmit={handleUploadReceipt} className="flex flex-col gap-3">
  <input
    type="file"
    onChange={(e) => setReceiptFile(e.target.files[0])}
    className="border px-3 py-2 rounded-lg"
    required
  />

  {/* Error */}
  {receiptUploadError && (
    <p className="text-xs text-red-600">{receiptUploadError}</p>
  )}

  {/* Loading */}
  {receiptUploading && (
    <p className="text-xs text-gray-500">Reading receipt… please wait…</p>
  )}

  <div className="flex justify-end gap-2 mt-2">
    <button
      type="button"
      onClick={() => {
        setShowExpenseModal(false);
        setExpenseMode(null);
        setReceiptUploadError("");
        setReceiptUploading(false);
      }}
      className="px-3 py-1 border rounded"
      disabled={receiptUploading}
    >
      Cancel
    </button>

    <button
      type="submit"
      className={`px-3 py-1 rounded text-white ${
        receiptUploading
          ? "bg-gray-400 cursor-not-allowed"
          : "bg-purple-800 hover:bg-purple-600"
      }`}
      disabled={receiptUploading}
    >
      {receiptUploading ? "Uploading…" : "Upload"}
    </button>
  </div>
</form>

          </div>
        </div>
      )}

      {/* Settlement Suggestion Modal */}
      {showSettlementModal && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-xl w-[28rem]">
            <h2 className="text-lg font-bold mb-3">Suggested Settlement</h2>
            {settlementPlan.length === 0 ? (
              <p className="text-sm text-gray-700">Already balanced. No payments needed.</p>
            ) : (
              <ul className="space-y-2">
                {settlementPlan.map((t, idx) => (
                  <li
                    key={`${t.fromUserId}-${t.toUserId}-${idx}`}
                    className="text-sm bg-purple-50 border border-purple-200 rounded p-2"
                  >
                    <b>{t.fromName}</b> should pay <b>{t.toName}</b> ₹{t.amount.toFixed(2)}
                  </li>
                ))}
              </ul>
            )}
            <div className="flex justify-end gap-2 mt-4">
              <button
                className="px-3 py-1 border rounded"
                onClick={() => setShowSettlementModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Payment Modal (UPDATED FLOW) */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-xl w-[26rem]">
            {paymentStep === "choice" && (
              <>
                <h2 className="text-lg font-bold mb-3">Payment Method</h2>
                <div className="flex flex-col gap-3">
                  <button
                    type="button"
                    className="px-4 py-2 bg-purple-800 text-white rounded hover:bg-purple-600"
                    onClick={() => {
                      setPaymentForm((f) => ({ ...f, method: "upi" }));
                      setPaymentStep("upload");
                    }}
                  >
                    Paid by UPI
                  </button>
                  <button
                    type="button"
                    className="px-4 py-2 border border-purple-800 text-purple-800 rounded hover:bg-gray-100"
                    onClick={() => {
                      setPaymentForm((f) => ({ ...f, method: "cash" }));
                      setPaymentStep("form");
                    }}
                  >
                    Paid by Cash
                  </button>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <button
                    type="button"
                    className="px-3 py-1 border rounded"
                    onClick={() => {
                      setShowPaymentModal(false);
                      resetPaymentFlow();
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}

            {paymentStep === "upload" && (
              <>
                <h2 className="text-lg font-bold mb-3">Upload UPI Screenshot</h2>
                <form
  onSubmit={(e) => {
    e.preventDefault();
    if (!paymentFile) return setUpiUploadError("Choose an image first.");
    runUpiOCR();
  }}
  className="flex flex-col gap-3"
>
  <input
    type="file"
    accept="image/*"
    onChange={(e) => setPaymentFile(e.target.files[0])}
    className="border px-3 py-2 rounded-lg"
    required
  />

  {/* ✅ Show errors */}
  {upiUploadError && (
    <p className="text-xs text-red-600">{upiUploadError}</p>
  )}

  {/* ✅ Show loading */}
  {upiUploading && (
    <p className="text-xs text-gray-500">Reading UPI screenshot… please wait…</p>
  )}

  <div className="flex justify-end gap-2">
    <button
      type="button"
      className="px-3 py-1 border rounded"
      onClick={() => {
        setShowPaymentModal(false);
        resetPaymentFlow();
        setUpiUploadError("");
      }}
      disabled={upiUploading}
    >
      Cancel
    </button>

    <button
      type="submit"
      className={`px-3 py-1 rounded text-white ${
        upiUploading
          ? "bg-gray-400 cursor-not-allowed"
          : "bg-purple-800 hover:bg-purple-600"
      }`}
      disabled={upiUploading}
    >
      {upiUploading ? "Processing…" : "Continue"}
    </button>
  </div>
</form>

                <p className="text-xs text-gray-500 mt-2">
                  We’ll read amount, date, and time (e.g. <code>14:35</code>) from the image. You can edit them next.
                </p>
              </>
            )}

            {paymentStep === "form" && (
              <>
                <h2 className="text-lg font-bold mb-3">Add Payment</h2>
                <form onSubmit={submitPayment} className="flex flex-col gap-3">
                  <select
                    value={paymentForm.payee_id}
                    onChange={(e) => setPaymentForm((f) => ({ ...f, payee_id: e.target.value }))}
                    className="border px-3 py-2 rounded-lg"
                    required
                  >
                    <option value="">Select Payee (who receives)</option>
                    {groupMembers
                      .filter((m) => m.user_id !== userId)
                      .map((m) => (
                        <option key={m.user_id} value={m.user_id}>
                          {m.user_name}
                        </option>
                      ))}
                  </select>

                  <input
                    type="number"
                    placeholder="Amount"
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm((f) => ({ ...f, amount: e.target.value }))}
                    className="border px-3 py-2 rounded-lg"
                    required
                    min="0"
                    step="0.01"
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-600">Payment Date</label>
                      <input
                        type="date"
                        value={paymentForm.payment_made_on}
                        onChange={(e) => setPaymentForm((f) => ({ ...f, payment_made_on: e.target.value }))}
                        className="border px-3 py-2 rounded-lg w-full"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600">Time (optional)</label>
                      <input
                        type="time"
                        value={paymentForm.payment_made_time}
                        onChange={(e) => setPaymentForm((f) => ({ ...f, payment_made_time: e.target.value }))}
                        className="border px-3 py-2 rounded-lg w-full"
                      />
                    </div>
                  </div>

                  <input
                    type="text"
                    value={paymentForm.method}
                    readOnly
                    className="border px-3 py-2 rounded-lg bg-gray-50"
                  />

                  <div className="flex justify-end gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowPaymentModal(false);
                        resetPaymentFlow();
                      }}
                      className="px-3 py-1 border rounded"
                    >
                      Cancel
                    </button>
                    <button className="px-3 py-1 bg-purple-800 text-white rounded">Submit</button>
                  </div>
                </form>
                <p className="text-xs text-gray-500 mt-2">
                  Payment will be <b>pending</b> until the payee approves it from the history panel.
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

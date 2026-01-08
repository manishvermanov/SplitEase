import express from "express";
import mysql from "mysql2";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import cors from "cors";
import jwt from "jsonwebtoken";
import multer from "multer";
const upload = multer();


dotenv.config();
const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(cors());



// -------------------- MYSQL CONNECTION --------------------
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

db.getConnection((err, connection) => {
  if (err) console.error("Database connection failed:", err);
  else {
    console.log("Database connected successfully!");
    connection.release();
  }
});

// ---------- helpers ----------
async function generateUniqueGCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const randomCode = () =>
    Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return await new Promise((resolve) => {
    const tryOne = () => {
      const code = randomCode();
      db.query("SELECT 1 FROM usergroups WHERE gcode=? LIMIT 1", [code], (err, rows) => {
        if (err) {
          console.error(err);
          return resolve(code);
        }
        if (rows.length) tryOne();
        else resolve(code);
      });
    };
    tryOne();
  });
}

function q(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

async function bothMembersOfGroup(group_id, payer_id, payee_id) {
  const rows = await q(
    "SELECT user_id FROM group_members WHERE group_id=? AND user_id IN (?,?)",
    [group_id, payer_id, payee_id]
  );
  return rows.length === 2;
}

async function getUserName(user_id) {
  try {
    const rows = await q("SELECT name FROM users WHERE user_id=? LIMIT 1", [user_id]);
    return rows?.[0]?.name || `User ${user_id}`;
  } catch {
    return `User ${user_id}`;
  }
}


/**
 * SAFE notification writer (notifications table):
 */
function createNotif({ user_id, type, entity_type, entity_id, title, body = null, data = {} }) {
  return new Promise((resolve) => {
    try {
      const sql = `
        INSERT INTO notifications
          (user_id, type, entity_type, entity_id, title, body, data, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'unread')
      `;
      db.query(
        sql,
        [
          user_id,
          String(type || ""),
          String(entity_type || ""),
          Number(entity_id || 0),
          String(title || ""),
          body ? String(body) : null,
          JSON.stringify(data || {}),
        ],
        (err, r) => {
          if (err) {
            console.warn("Notification insert skipped:", err?.code || err?.message || err);
            return resolve(null);
          }
          resolve(r?.insertId || null);
        }
      );
    } catch (e) {
      console.warn("Notification insert error:", e?.message || e);
      resolve(null);
    }
  });
}

// -------------------- AUTH ROUTES --------------------
app.post("/signup", async (req, res) => {
  const { name, email, password, mobile } = req.body;
  if (!name || !email || !password || !mobile)
    return res.status(400).json({ error: "All fields are required" });
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    await q(
      "INSERT INTO users (name, email, password, mobile_number, created_at) VALUES (?, ?, ?, ?, NOW())",
      [name, email, hashedPassword, mobile]
    );
    res.status(201).json({ message: "User registered successfully!" });
  } catch (err) {
    console.error("DB Error (signup):", err);
    res.status(500).json({ error: "Database error" });
  }
});

app.post("/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });
  db.query("SELECT * FROM users WHERE email = ?", [email], async (err, results) => {
    if (err) return res.status(500).json({ error: "Database error" });
    if (results.length === 0) return res.status(400).json({ error: "User not found" });
    const user = results[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ error: "Invalid password" });
    const token = jwt.sign({ id: user.user_id, email: user.email }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });
    res.json({
      message: "Login successful",
      user: { id: user.user_id, name: user.name, email: user.email },
      token,
    });
  });
});

// -------------------- UTILITY --------------------
app.get("/users/lookup", (req, res) => {
  const { phone } = req.query;
  if (!phone) return res.status(400).json({ error: "phone is required" });
  db.query(
    "SELECT user_id, name, email, mobile_number FROM users WHERE mobile_number=? LIMIT 1",
    [phone.trim()],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "Database error" });
      if (!rows.length) return res.json({ found: false });
      const u = rows[0];
      res.json({
        found: true,
        user: {
          user_id: u.user_id,
          name: u.name,
          email: u.email,
          mobile_number: u.mobile_number,
        },
      });
    }
  );
});

// -------------------- GROUPS --------------------
app.post("/groups", async (req, res) => {
  const { group_name, created_by } = req.body;
  if (!group_name || !created_by) return res.status(400).json({ error: "Missing fields" });
  try {
    const gcode = await generateUniqueGCode();
    const r = await q(
      "INSERT INTO usergroups (group_name, created_by, created_at, gcode) VALUES (?, ?, NOW(), ?)",
      [group_name, created_by, gcode]
    );
    await q("INSERT INTO group_members (group_id, user_id, joined_at) VALUES (?, ?, NOW())", [
      r.insertId,
      created_by,
    ]);
    res
      .status(201)
      .json({ message: "Group created", group_id: r.insertId, group_name, gcode, created_by });
  } catch (e) {
    console.error("DB Error creating group:", e);
    res.status(500).json({ error: "Database error" });
  }
});

app.post("/groups/join", (req, res) => {
  const { gcode, user_id } = req.body;
  if (!gcode || !user_id) return res.status(400).json({ error: "gcode and user_id required" });
  db.query(
    "SELECT group_id, group_name, created_by, created_at, gcode FROM usergroups WHERE gcode=?",
    [gcode.trim().toUpperCase()],
    (err, groups) => {
      if (err) return res.status(500).json({ error: "Database error" });
      if (!groups.length) return res.status(404).json({ error: "Invalid group code" });
      const group = groups[0];
      db.query(
        "SELECT 1 FROM group_members WHERE group_id=? AND user_id=?",
        [group.group_id, user_id],
        (err2, rows) => {
          if (err2) return res.status(500).json({ error: "Database error" });
          if (rows.length) return res.json({ message: "Already a member", ...group });
          db.query(
            "INSERT INTO group_members (group_id, user_id, joined_at) VALUES (?, ?, NOW())",
            [group.group_id, user_id],
            (err3) => {
              if (err3) return res.status(500).json({ error: "Database error joining group" });
              res.json({ message: "Joined group", ...group });
            }
          );
        }
      );
    }
  );
});

// new1

// ✅ PERSONAL EXPENSES (non-group)
app.get("/expenses/personal/:userId", (req, res) => {
  const { userId } = req.params;

  const sql = `
    SELECT *
    FROM expenses
    WHERE uploader_id = ? AND group_id IS NULL
    ORDER BY created_at DESC
  `;

  db.query(sql, [userId], (err, rows) => {
    if (err) return res.status(500).json({ error: "Database error fetching personal expenses" });
    res.json(rows);
  });
});


// ✅ Add NEW personal expense route (no group)
app.post("/expenses", (req, res) => {
  const { description, vendor, amount, expense_date, category, payer_id, uploader_id } = req.body;

  if (!description || !amount || !expense_date || !payer_id)
    return res.status(400).json({ error: "Missing required fields" });

  const sql = `
    INSERT INTO expenses
      (description, vendor, amount, expense_date, category, uploader_id, payer_id, group_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NOW())
  `;

  db.query(
    sql,
    [
      description,
      vendor || null,
      amount,
      expense_date,
      category || null,
      uploader_id || payer_id,
      payer_id,
    ],
    (err, r) => {
      if (err) return res.status(500).json({ error: "Database error adding personal expense" });

      res.json({
        message: "Personal expense added successfully",
        insertId: r.insertId,
      });
    }
  );
});




// 

app.get("/groups/user/:userId", (req, res) => {
  db.query(
    `SELECT g.group_id, g.group_name, g.created_by, g.created_at, g.gcode
     FROM usergroups g
     JOIN group_members gm ON g.group_id = gm.group_id
     WHERE gm.user_id = ?
     ORDER BY g.created_at DESC`,
    [req.params.userId],
    (err, rows) =>
      err ? res.status(500).json({ error: "Database error" }) : res.json(rows)
  );
});

app.get("/groups/:group_id/members", (req, res) => {
  db.query(
    `SELECT u.user_id, u.name AS user_name, u.mobile_number AS phone, gm.joined_at
     FROM group_members gm
     JOIN users u ON gm.user_id = u.user_id
     WHERE gm.group_id = ?
     ORDER BY u.name ASC`,
    [req.params.group_id],
    (err, rows) =>
      err ? res.status(500).json({ error: "Database error fetching members" }) : res.json(rows)
  );
});

// REGISTERED-ONLY add member by phone
app.post("/groups/:group_id/members", (req, res) => {
  const { phone } = req.body;
  const { group_id } = req.params;
  if (!phone) return res.status(400).json({ error: "Phone is required" });
  db.query("SELECT user_id, name FROM users WHERE mobile_number=?", [phone.trim()], (err, users) => {
    if (err) return res.status(500).json({ error: "Database error finding user" });
    if (!users.length) return res.status(404).json({ error: "User not registered" });
    const user = users[0];
    db.query(
      "SELECT 1 FROM group_members WHERE group_id=? AND user_id=?",
      [group_id, user.user_id],
      (err2, rows) => {
        if (err2) return res.status(500).json({ error: "Database error" });
        if (rows.length)
          return res.json({
            message: "User already in group",
            user_id: user.user_id,
            user_name: user.name,
          });
        db.query(
          "INSERT INTO group_members (group_id, user_id, joined_at) VALUES (?, ?, NOW())",
          [group_id, user.user_id],
          (err3) =>
            err3
              ? res.status(500).json({ error: "Database error adding member" })
              : res.json({
                  message: "Registered user added",
                  user_id: user.user_id,
                  user_name: user.name,
                })
        );
      }
    );
  });
});

// -------------------- EXPENSES --------------------
app.post("/groups/:group_id/expenses", (req, res) => {
  const { description, vendor, amount, expense_date, category, payer_id, uploader_id } = req.body;
  const { group_id } = req.params;

  if (!description || !amount || !expense_date || !payer_id)
    return res.status(400).json({ error: "Missing required fields" });

  // Insert Expense
  db.query(
    `INSERT INTO expenses 
      (description, vendor, amount, expense_date, category, uploader_id, payer_id, group_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      description,
      vendor || null,
      amount,
      expense_date,
      category || null,
      uploader_id || payer_id,
      payer_id,
      group_id,
    ],
    (err, r) => {
      if (err) return res.status(500).json({ error: "Database error adding expense" });

      const expense_id = r.insertId;

      try {
        // Get all members
        db.query("SELECT user_id FROM group_members WHERE group_id=?", [group_id], async (e2, members) => {
          if (e2 || !members?.length) return;

          // Fetch creator name (once)
          const creatorName = await getUserName(uploader_id || payer_id);

          // Notify all members except creator
          members
            .filter((m) => Number(m.user_id) !== Number(uploader_id || payer_id))
            .forEach((m) => {
              createNotif({
                user_id: m.user_id,
                type: "expense_created",
                entity_type: "expense",
                entity_id: expense_id,
                title: "New expense added",
                body: `${creatorName} added: ${description} • ₹${amount}`,
                data: {
                  group_id: Number(group_id),
                  expense_id,
                  category,
                  vendor,
                },
              });
            });
        });
      } catch (err) {
        console.error("Notification error:", err);
      }

      // Final response
      res.json({
        message: "Expense added successfully",
        expense_id,
      });
    }
  );
});


app.get("/groups/:group_id/expenses", (req, res) => {
  const { group_id } = req.params;
  db.query(
    `SELECT e.*, u.name AS payer_name
     FROM expenses e
     JOIN users u ON e.payer_id = u.user_id
     WHERE e.group_id = ?
     ORDER BY e.created_at DESC`,
    [group_id],
    (err, expenses) => {
      if (err) return res.status(500).json({ error: "Database error fetching expenses" });
      if (!expenses.length) return res.json([]);
      const ids = expenses.map((e) => e.expense_id);
      db.query(
        `SELECT es.expense_id, es.user_id, es.amount_owed, u.name AS user_name
         FROM expense_splits es
         JOIN users u ON es.user_id = u.user_id
         WHERE es.expense_id IN (?)`,
        [ids],
        (err2, splits) => {
          if (err2) return res.status(500).json({ error: "Database error fetching splits" });
          res.json(
            expenses.map((e) => ({
              ...e,
              splits: splits.filter((s) => s.expense_id === e.expense_id),
            }))
          );
        }
      );
    }
  );
});

app.post("/expense_splits/bulk", (req, res) => {
  const { splits } = req.body;
  if (!splits || !splits.length) return res.status(400).json({ error: "No splits data provided" });
  const values = splits.map((s) => [s.expense_id, s.user_id, s.amount_owed]);
  db.query(
    "INSERT INTO expense_splits (expense_id, user_id, amount_owed) VALUES ?",
    [values],
    (err, r) =>
      err
        ? res.status(500).json({ error: "Database error inserting splits" })
        : res.json({ message: "Splits inserted successfully", insertedCount: r.affectedRows })
  );
});

app.put("/expenses/:expense_id", (req, res) => {
  const { expense_id } = req.params;
  const { description, vendor, amount, expense_date, category } = req.body;

  if (!description || !amount || !expense_date) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const sql = `
    UPDATE expenses
    SET description = ?, vendor = ?, amount = ?, expense_date = ?, category = ?
    WHERE expense_id = ?
  `;

  db.query(
    sql,
    [description, vendor || null, amount, expense_date, category || null, expense_id],
    (err, result) => {
      if (err) {
        console.error("Error updating expense:", err);
        return res.status(500).json({ error: "Database error updating expense" });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: "Expense not found" });
      }

      res.json({ message: "Expense updated successfully" });
    }
  );
});



// -------------------- SETTLEMENTS --------------------

// ✅ FIXED: Extract payment_made_on + corrected INSERT
app.post(
  "/groups/:group_id/settlements",
  upload.single("proof"),           // ✅ IMPORTANT
  async (req, res) => {
  try {
    const { group_id } = req.params;
    const {
      payer_id,
      payee_id,
      amount,
      method,
      proof_image,
      payment_made_on // NEW FIELD
    } = req.body;

    if (!payer_id || !payee_id || !amount || !method)
      return res.status(400).json({ error: "Missing required fields" });

    if (!["upi", "cash"].includes(String(method)))
      return res.status(400).json({ error: "Invalid method" });

    const amt = Number(amount);
    if (!(amt > 0)) return res.status(400).json({ error: "Amount must be > 0" });
    if (Number(payer_id) === Number(payee_id))
      return res.status(400).json({ error: "Payer and payee cannot be same" });

    const okMembers = await bothMembersOfGroup(group_id, payer_id, payee_id);
    if (!okMembers)
      return res.status(400).json({ error: "Both users must be members of this group" });

    // ✅ FIXED QUERY
    const r = await q(
      `INSERT INTO settlements 
       (group_id, payer_id, payee_id, amount, method, proof_image, payment_made_on) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [group_id, payer_id, payee_id, amount, method, proof_image, payment_made_on]
    );

    const payerName = await getUserName(payer_id);
    createNotif({
      user_id: Number(payee_id),
      type: "settlement_submitted",
      entity_type: "settlement",
      entity_id: Number(r.insertId),
      title: "Payment submitted for approval",

body: `${payerName} submitted a payment of ₹${amt}`,

      data: { group_id: Number(group_id), settlement_id: Number(r.insertId), payer_id: Number(payer_id) },
    });

    res.json({ message: "Payment submitted", settlement_id: r.insertId });
  } catch (e) {
    console.error("DB Error creating settlement:", e);
    res.status(500).json({ error: "Database error" });
  }
});

// ✅ FIXED: Include payment_made_on in response
app.get("/groups/:group_id/settlements", (req, res) => {
  db.query(
    `SELECT 
        s.*,
        s.payment_made_on,
        pu.name AS payer_name,
        ru.name AS payee_name
     FROM settlements s
     JOIN users pu ON s.payer_id = pu.user_id
     JOIN users ru ON s.payee_id = ru.user_id
     WHERE s.group_id = ?
     ORDER BY s.settlement_date DESC, s.settlement_id DESC`,
    [req.params.group_id],
    (err, rows) =>
      err ? res.status(500).json({ error: "Database error fetching settlements" }) : res.json(rows)
  );
});

// VALIDATE settlement
app.patch("/settlements/:id/validate", (req, res) => {
  db.query(
    "UPDATE settlements SET status='validated' WHERE settlement_id=? AND status='pending'",
    [req.params.id],
    (err, r) => {
      if (err) return res.status(500).json({ error: "Database error" });
      if (!r.affectedRows) return res.status(400).json({ error: "Not found or not pending" });

      q(
        `SELECT payer_id, payee_id, amount, group_id FROM settlements WHERE settlement_id=? LIMIT 1`,
        [req.params.id]
      )
        .then((rows) => {
          const row = rows?.[0];
          if (!row) return;
          createNotif({
            user_id: Number(row.payer_id),
            type: "settlement_validated",
            entity_type: "settlement",
            entity_id: Number(req.params.id),
            title: "Payment approved",
            body: `₹${row.amount} approved by payee #${row.payee_id}`,
            data: { group_id: Number(row.group_id), settlement_id: Number(req.params.id) },
          });
        })
        .catch(() => {});
      res.json({ message: "Payment approved" });
    }
  );
});

// REJECT settlement
app.patch("/settlements/:id/reject", (req, res) => {
  db.query(
    "UPDATE settlements SET status='rejected' WHERE settlement_id=? AND status='pending'",
    [req.params.id],
    (err, r) => {
      if (err) return res.status(500).json({ error: "Database error" });
      if (!r.affectedRows) return res.status(400).json({ error: "Not found or not pending" });

      q(
        `SELECT payer_id, payee_id, amount, group_id FROM settlements WHERE settlement_id=? LIMIT 1`,
        [req.params.id]
      )
        .then(async (rows) => {
  const row = rows?.[0];
  if (!row) return;
  const payeeName = await getUserName(row.payee_id);

  createNotif({
    user_id: Number(row.payer_id),
    type: "settlement_rejected",
    entity_type: "settlement",
    entity_id: Number(req.params.id),
    title: "Payment rejected",
    body: `₹${row.amount} rejected by ${payeeName}`,
    data: { group_id: Number(row.group_id), settlement_id: Number(req.params.id) },
  });
})

        .catch(() => {});
      res.json({ message: "Payment rejected" });
    }
  );
});

// -------------------- NOTIFICATIONS --------------------
app.get("/notifications/user/:userId", (req, res) => {
  const { userId } = req.params;
  const sql = `
    SELECT id, user_id, type, entity_type, entity_id, title, body, data, status, created_at, read_at
    FROM notifications
    WHERE user_id = ? AND status = 'unread'
    ORDER BY created_at DESC, id DESC
  `;
  db.query(sql, [userId], (err, rows) => {
    if (err) {
      console.error("DB Error fetching notifications:", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(rows);
  });
});

app.patch("/notifications/:id/read", (req, res) => {
  const { id } = req.params;
  const sql = "UPDATE notifications SET status='read', read_at=NOW() WHERE id=? AND status='unread'";
  db.query(sql, [id], (err, r) => {
    if (err) return res.status(500).json({ error: "Database error" });
    if (!r.affectedRows) return res.status(400).json({ error: "Not found or already read" });
    res.json({ message: "OK" });
  });
});

app.patch("/notifications/user/:userId/read-all", (req, res) => {
  const { userId } = req.params;
  const sql = "UPDATE notifications SET status='read', read_at=NOW() WHERE user_id=? AND status='unread'";
  db.query(sql, [userId], (err, r) => {
    if (err) return res.status(500).json({ error: "Database error" });
    res.json({ message: "OK", updated: r.affectedRows || 0 });
  });
});

app.get("/notifications/history", (req, res) => {
  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ error: "user_id is required" });
  const sql = `
    SELECT id, user_id, type, entity_type, entity_id, title, body, data, status, created_at, read_at
    FROM notifications
    WHERE user_id = ?
    ORDER BY created_at DESC, id DESC
  `;
  db.query(sql, [user_id], (err, rows) => {
    if (err) {
      console.error("DB Error fetching notification history:", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(rows);
  });
});

//leave and delete group 
app.delete("/groups/:group_id/leave", async (req, res) => {
  const { group_id } = req.params;
  const { user_id } = req.body;

  try {
    // ✅ Get group + owner
    const rows = await q(
      "SELECT created_by, group_name FROM usergroups WHERE group_id=? LIMIT 1",
      [group_id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: "Group not found" });
    }

    const creatorId = rows[0].created_by;
    const groupName = rows[0].group_name;

    // ✅ owner cannot leave
    if (creatorId === user_id) {
      return res.status(400).json({
        error: "Owner cannot leave. Owner may delete the group."
      });
    }

    // ✅ Get leaving user name
    const userRow = await q(
      "SELECT name FROM users WHERE user_id=? LIMIT 1",
      [user_id]
    );
    const leaverName = userRow.length ? userRow[0].name : "A member";

    // ✅ Delete the member
    await q(
      "DELETE FROM group_members WHERE group_id=? AND user_id=?",
      [group_id, user_id]
    );

    // ✅ Get remaining members (for notifications)
    const members = await q(
      "SELECT user_id FROM group_members WHERE group_id=?",
      [group_id]
    );

    // ✅ Notify remaining members
    for (const m of members) {
      await q(
        "INSERT INTO notifications (user_id, type, entity_type, entity_id, title, body, data) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          m.user_id,
          "group_leave",
          "group",
          group_id,
          "Member Left Group",
          `${leaverName} left the group "${groupName}".`,
          JSON.stringify({})
        ]
      );
    }

    res.json({ message: "Left group successfully" });

  } catch (err) {
    console.error("Leave group error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// ✅ DELETE GROUP (owner only)
app.delete("/groups/:group_id/delete", async (req, res) => {
  const { group_id } = req.params;
  const { user_id } = req.body;

  try {
    // 1. Check if user is owner
    const ownerQ = await q(
      "SELECT created_by, group_name FROM usergroups WHERE group_id=?",
      [group_id]
    );

    if (!ownerQ.length) {
      return res.status(404).json({ error: "Group not found" });
    }

    if (ownerQ[0].created_by !== user_id) {
      return res.status(403).json({ error: "Only owner can delete the group" });
    }

    const groupName = ownerQ[0].group_name;

    // 2. Get all members
    const members = await q(
      "SELECT user_id FROM group_members WHERE group_id=?",
      [group_id]
    );

    // 3. Send notifications BEFORE deleting
    for (const m of members) {
      await q(
        "INSERT INTO notifications (user_id, type, entity_type, entity_id, title, body, data) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          m.user_id,
          "group_deleted",
          "group",
          group_id,
          "Group Deleted",
          `The group "${groupName}" has been deleted by the owner.`,
          JSON.stringify({})
        ]
      );
    }

    // 4. Delete group everywhere
    await q("DELETE FROM expense_splits WHERE expense_id IN (SELECT expense_id FROM expenses WHERE group_id=?)", [group_id]);
    await q("DELETE FROM settlements WHERE group_id=?", [group_id]);
    await q("DELETE FROM expenses WHERE group_id=?", [group_id]);
    await q("DELETE FROM group_members WHERE group_id=?", [group_id]);
    await q("DELETE FROM usergroups WHERE group_id=?", [group_id]);

    res.json({ message: "Group deleted successfully" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Server error" });
  }
});






// -------------------- SERVER --------------------
const PORT = process.env.PORT || 5000;
app.get("/", (req, res) => res.send("✅ Backend is running successfully!"));
app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));

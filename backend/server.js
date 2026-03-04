require("dotenv").config()

const express = require("express")
const cors = require("cors")
const bcrypt = require("bcrypt")
const { createClient } = require("@supabase/supabase-js")

const app = express()

app.use(cors())
app.use(express.json())

// =============================
// Supabase Connection
// =============================

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

// =============================
// Helpers
// =============================

function sanitizeUser(row) {
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
  }
}

// =============================
// Health Check
// =============================

app.get("/api/health", (req, res) => {
  res.json({ message: "ServiSphere backend running" })
})

// =============================
// Auth APIs (all roles)
// =============================

app.post("/api/auth/signup", async (req, res) => {
  try {
    const { email, password, role, name } = req.body

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" })
    }

    const userRole = role || "user"

    // check if user already exists
    const { data: existing, error: existingError } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .maybeSingle()

    if (existingError) {
      return res.status(500).json({ message: "Error checking user", error: existingError.message })
    }

    if (existing) {
      return res.status(400).json({ message: "User already exists" })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const { data, error } = await supabase
      .from("users")
      .insert([
        {
          name,
          email,
          password: hashedPassword,
          role: userRole,
          provider: "local",
        },
      ])
      .select()
      .single()

    if (error) {
      return res.status(500).json({ message: "Signup failed", error: error.message })
    }

    res.json({
      message: "Signup successful",
      user: sanitizeUser(data),
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" })
    }

    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .single()

    if (error || !user) {
      return res.status(400).json({ message: "User not found" })
    }

    const validPassword = await bcrypt.compare(password, user.password)

    if (!validPassword) {
      return res.status(401).json({ message: "Invalid password" })
    }

    res.json({
      message: "Login successful",
      user: sanitizeUser(user),
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// =============================
// Bookings
// =============================

// Create booking (user)
app.post("/api/bookings", async (req, res) => {
  try {
    const {
      user_id,
      worker_id,
      date,
      time_slot,
      user_lat,
      user_lng,
      address,
      otp,
    } = req.body

    if (!user_id || !worker_id) {
      return res.status(400).json({ message: "user_id and worker_id are required" })
    }

    const { data, error } = await supabase
      .from("bookings")
      .insert([
        {
          user_id,
          worker_id,
          status: "pending",
          otp: otp || null,
          user_lat,
          user_lng,
        },
      ])
      .select()
      .single()

    if (error) {
      return res.status(500).json({ message: "Failed to create booking", error: error.message })
    }

    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Get booking by id (for tracking & job details)
app.get("/api/bookings/:id", async (req, res) => {
  const id = req.params.id

  const { data, error } = await supabase
    .from("bookings")
    .select("*")
    .eq("id", id)
    .single()

  if (error) {
    return res.status(404).json({ message: "Booking not found" })
  }

  res.json(data)
})

// List bookings for a worker
app.get("/api/bookings/worker/:workerId", async (req, res) => {
  const workerId = req.params.workerId

  const { data, error } = await supabase
    .from("bookings")
    .select("*")
    .eq("worker_id", workerId)
    .order("created_at", { ascending: false })

  if (error) {
    return res.status(500).json({ message: "Failed to load bookings", error: error.message })
  }

  res.json(data)
})

// List bookings for a user
app.get("/api/bookings/user/:userId", async (req, res) => {
  const userId = req.params.userId

  const { data, error } = await supabase
    .from("bookings")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  if (error) {
    return res.status(500).json({ message: "Failed to load user bookings", error: error.message })
  }

  res.json(data)
})

// Update booking status and optionally OTP
app.patch("/api/bookings/:id/status", async (req, res) => {
  const id = req.params.id
  const { status, otp } = req.body

  const { data, error } = await supabase
    .from("bookings")
    .update({ status, otp })
    .eq("id", id)
    .select()
    .single()

  if (error) {
    return res.status(500).json({ message: "Failed to update booking", error: error.message })
  }

  res.json(data)
})

// Update worker live location for a booking
app.patch("/api/bookings/:id/location", async (req, res) => {
  const id = req.params.id
  const { worker_lat, worker_lng } = req.body

  if (typeof worker_lat !== "number" || typeof worker_lng !== "number") {
    return res.status(400).json({ message: "worker_lat and worker_lng must be numbers" })
  }

  const { data, error } = await supabase
    .from("bookings")
    .update({ worker_lat, worker_lng })
    .eq("id", id)
    .select()
    .single()

  if (error) {
    return res.status(500).json({ message: "Failed to update location", error: error.message })
  }

  res.json(data)
})

// =============================
// Payments
// =============================

// Get payment by booking id
app.get("/api/payments/:bookingId", async (req, res) => {
  const bookingId = req.params.bookingId

  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("booking_id", bookingId)
    .maybeSingle()

  if (error) {
    return res.status(500).json({ message: "Failed to load payment", error: error.message })
  }

  res.json(data)
})

// User pays for booking
app.post("/api/payments/pay", async (req, res) => {
  try {
    const { booking_id, user_id, worker_id, amount } = req.body

    if (!booking_id || !user_id || !worker_id) {
      return res
        .status(400)
        .json({ message: "booking_id, user_id and worker_id are required" })
    }

    // see if payment row exists
    const { data: existing, error: existingError } = await supabase
      .from("payments")
      .select("*")
      .eq("booking_id", booking_id)
      .maybeSingle()

    if (existingError) {
      return res.status(500).json({ message: "Failed to check payment", error: existingError.message })
    }

    let paymentRow = existing

    if (paymentRow) {
      const { data, error } = await supabase
        .from("payments")
        .update({
          status: "paid_by_user",
          amount: amount ?? paymentRow.amount,
        })
        .eq("id", paymentRow.id)
        .select()
        .single()

      if (error) {
        return res.status(500).json({ message: "Failed to update payment", error: error.message })
      }

      paymentRow = data
    } else {
      const { data, error } = await supabase
        .from("payments")
        .insert([
          {
            booking_id,
            user_id,
            worker_id,
            amount: amount ?? 0,
            status: "paid_by_user",
          },
        ])
        .select()
        .single()

      if (error) {
        return res.status(500).json({ message: "Failed to create payment", error: error.message })
      }

      paymentRow = data
    }

    res.json(paymentRow)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// =============================
// Feedback
// =============================

app.post("/api/feedback", async (req, res) => {
  try {
    const { booking_id, user_id, rating, comment } = req.body

    if (!booking_id || !user_id || !rating) {
      return res
        .status(400)
        .json({ message: "booking_id, user_id and rating are required" })
    }

    const { data, error } = await supabase
      .from("feedback")
      .insert([{ booking_id, user_id, rating, comment }])
      .select()
      .single()

    if (error) {
      return res.status(500).json({ message: "Failed to save feedback", error: error.message })
    }

    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get("/api/feedback/:bookingId", async (req, res) => {
  const bookingId = req.params.bookingId

  const { data, error } = await supabase
    .from("feedback")
    .select("*")
    .eq("booking_id", bookingId)
    .maybeSingle()

  if (error) {
    return res.status(500).json({ message: "Failed to load feedback", error: error.message })
  }

  res.json(data)
})

// =============================
// Admin & Special Admin views
// =============================

// Admin: users overview
app.get("/api/admin/users", async (req, res) => {
  const { data, error } = await supabase
    .from("users")
    .select("id,email,name,role,created_at")
    .order("created_at", { ascending: false })

  if (error) {
    return res.status(500).json({ message: "Failed to load users", error: error.message })
  }

  res.json(data)
})

// Admin: workers list
app.get("/api/admin/workers", async (req, res) => {
  const { data, error } = await supabase
    .from("users")
    .select("id,email,name,role,created_at")
    .eq("role", "worker")
    .order("created_at", { ascending: false })

  if (error) {
    return res.status(500).json({ message: "Failed to load workers", error: error.message })
  }

  res.json(data)
})

// Public worker details by id (for tracking UI)
app.get("/api/workers/:id", async (req, res) => {
  const id = req.params.id

  const { data, error } = await supabase
    .from("users")
    .select("id,email,name,role")
    .eq("id", id)
    .eq("role", "worker")
    .maybeSingle()

  if (error) {
    return res.status(500).json({ message: "Failed to load worker", error: error.message })
  }

  if (!data) {
    return res.status(404).json({ message: "Worker not found" })
  }

  res.json(data)
})

// Admin: bookings overview
app.get("/api/admin/bookings", async (req, res) => {
  const { data, error } = await supabase
    .from("bookings")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) {
    return res.status(500).json({ message: "Failed to load bookings", error: error.message })
  }

  res.json(data)
})

// Admin: payments overview
app.get("/api/admin/payments", async (req, res) => {
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) {
    return res.status(500).json({ message: "Failed to load payments", error: error.message })
  }

  res.json(data)
})

// Admin: feedback overview
app.get("/api/admin/feedback", async (req, res) => {
  const { data, error } = await supabase
    .from("feedback")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) {
    return res.status(500).json({ message: "Failed to load feedback", error: error.message })
  }

  res.json(data)
})

// Special admin: payments waiting for release
app.get("/api/payments/special-admin/pending", async (req, res) => {
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("status", "paid_by_user")
    .order("created_at", { ascending: false })

  if (error) {
    return res.status(500).json({ message: "Failed to load pending payments", error: error.message })
  }

  res.json(data)
})

// Special admin: approve payment
app.post("/api/payments/:id/approve", async (req, res) => {
  const id = req.params.id

  const { data, error } = await supabase
    .from("payments")
    .update({ status: "approved" })
    .eq("id", id)
    .select()
    .single()

  if (error) {
    return res.status(500).json({ message: "Failed to approve payment", error: error.message })
  }

  res.json(data)
})

// =============================
// Start Server
// =============================

const PORT = process.env.PORT || 5000

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
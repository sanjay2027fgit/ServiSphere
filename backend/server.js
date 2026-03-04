// Load environment variables
require('dotenv').config()

const express = require("express")
const cors = require("cors")
const path = require("path")

// Import Supabase
const { createClient } = require("@supabase/supabase-js")

// Create Express app
const app = express()

// Middleware
app.use(cors())
app.use(express.json())

// ================================
// Supabase Connection
// ================================

const supabase = createClient(
process.env.SUPABASE_URL,
process.env.SUPABASE_ANON_KEY
)

// ================================
// Test Database Connection
// ================================

async function testDatabase() {
    try {

        const { data, error } = await supabase
        .from("users")
        .select("*")
        .limit(1)

        if (error) {
            console.log("Database connected but table error:", error.message)
        } else {
            console.log("Supabase connected successfully")
        }

    } catch (err) {
        console.log("Database connection failed:", err.message)
    }
}

testDatabase()

// ================================
// API ROUTES
// ================================

// Health check
app.get("/api/health", (req, res) => {
    res.json({
        status: "Backend running",
        time: new Date()
    })
})

// Get all users
app.get("/api/users", async (req, res) => {

    const { data, error } = await supabase
    .from("users")
    .select("*")

    if (error) {
        return res.status(500).json({ error: error.message })
    }

    res.json(data)
})

// Create user
app.post("/api/users", async (req, res) => {

    const { name, email, role } = req.body

    const { data, error } = await supabase
    .from("users")
    .insert([
        {
            name: name,
            email: email,
            role: role || "user"
        }
    ])
    .select()

    if (error) {
        return res.status(500).json({ error: error.message })
    }

    res.json({
        message: "User created",
        user: data
    })
})

// ================================
// SERVE FRONTEND FILES
// ================================

app.use(express.static(path.join(__dirname, "../")))

// Home route
app.get("/", (req, res) => {
    res.send("ServiSphere Backend Running 🚀")
})

// ================================
// START SERVER
// ================================

const PORT = process.env.PORT || 5000

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
})
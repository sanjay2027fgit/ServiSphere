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
// Health Check
// =============================

app.get("/api/health",(req,res)=>{
res.json({message:"ServiSphere backend running"})
})

// =============================
// Signup API
// =============================

app.post("/api/auth/signup", async (req,res)=>{

try{

const {name,email,password,role} = req.body

if(!name || !email || !password){
return res.status(400).json({
message:"Missing required fields"
})
}

// check if user exists

const {data:existingUser} = await supabase
.from("users")
.select("*")
.eq("email",email)
.single()

if(existingUser){
return res.status(400).json({
message:"User already exists"
})
}

// hash password

const hashedPassword = await bcrypt.hash(password,10)

// insert user

const {data,error} = await supabase
.from("users")
.insert([
{
name:name,
email:email,
password:hashedPassword,
role:role || "user",
provider:"local"
}
])
.select()

if(error){
return res.status(500).json(error)
}

res.json({
message:"Signup successful",
user:data
})

}catch(err){

res.status(500).json({
error:err.message
})

}

})

// =============================
// Login API
// =============================

app.post("/api/auth/login", async (req,res)=>{

try{

const {email,password} = req.body

const {data:user,error} = await supabase
.from("users")
.select("*")
.eq("email",email)
.single()

if(error || !user){
return res.status(400).json({
message:"User not found"
})
}

// compare password

const validPassword = await bcrypt.compare(
password,
user.password
)

if(!validPassword){
return res.status(401).json({
message:"Invalid password"
})
}

res.json({
message:"Login successful",
user:{
id:user.id,
name:user.name,
email:user.email,
role:user.role
}
})

}catch(err){

res.status(500).json({
error:err.message
})

}

})

// =============================
// Get All Users (test route)
// =============================

app.get("/api/users", async (req,res)=>{

const {data,error} = await supabase
.from("users")
.select("*")

if(error){
return res.status(500).json(error)
}

res.json(data)

})

// =============================
// Start Server
// =============================

const PORT = process.env.PORT || 5000

app.listen(PORT,()=>{
console.log(`Server running on port ${PORT}`)
})  
import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    username: String,
    password: String,
    role: String,
    department: String,
    email: String
  });

  const User = mongoose.model("User", userSchema);
  export default User; 
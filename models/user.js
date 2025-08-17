import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  picture: String,
  googleId: String,
  // For email/password authentication
  passwordHash: { type: String, select: false },
}, { timestamps: true });

export default mongoose.model("User", userSchema);

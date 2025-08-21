import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import User from "../models/user.js";
import bcrypt from "bcryptjs";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const setAuthCookie = (res, token) => {
  const isProd = process.env.NODE_ENV === "production";
  res.cookie("auth_token", token, {
    httpOnly: true,
    secure: isProd,               // true on HTTPS
    sameSite: isProd ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

export const googleLogin = async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ message: "Missing credential" });

    // Verify the Google ID token
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload(); // { sub, email, email_verified, name, picture, ... }
    console.log('[googleLogin] Payload received from Google:', {
      email: payload?.email,
      email_verified: payload?.email_verified,
      sub: payload?.sub ? 'present' : 'missing',
    });

    if (!payload.email_verified) {
      return res.status(401).json({ message: "Email not verified with Google" });
    }

    let user = await User.findOne({ email: payload.email });
    if (!user) {
      console.log('[googleLogin] No existing user, creating new user in MongoDB');
      try {
        user = await User.create({
          name: payload.name,
          email: payload.email,
          picture: payload.picture,
          googleId: payload.sub,
        });
        console.log('[googleLogin] User created with _id:', user._id?.toString());
      } catch (createErr) {
        console.error('[googleLogin] Error creating user:', createErr?.message || createErr);
        return res.status(500).json({ message: 'Failed to create user' });
      }
    } else {
      // Optionally update profile details from Google
      const updates = {};
      if (payload.name && payload.name !== user.name) updates.name = payload.name;
      if (payload.picture && payload.picture !== user.picture) updates.picture = payload.picture;
      if (Object.keys(updates).length) {
        await User.updateOne({ _id: user._id }, { $set: updates });
        console.log('[googleLogin] Updated user profile fields for', user.email);
      }
    }

    const token = jwt.sign({ uid: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });
    setAuthCookie(res, token);

    return res.json({
      user: { id: user._id, name: user.name, email: user.email, picture: user.picture },
    });
  } catch (err) {
    console.error("googleLogin error:", err?.message || err);
    return res.status(401).json({ message: "Invalid Google token" });
  }
};

export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email and password are required" });
    }
    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ message: "Email already in use" });

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const user = await User.create({ name, email, passwordHash });

    const token = jwt.sign({ uid: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });
    setAuthCookie(res, token);
    res.status(201).json({ user: { id: user._id, name: user.name, email: user.email } });
  } catch (err) {
    console.error("register error:", err?.message || err);
    res.status(500).json({ message: "Registration failed" });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "Email and password are required" });

    const user = await User.findOne({ email }).select("+passwordHash name email picture");
    if (!user || !user.passwordHash) return res.status(401).json({ message: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign({ uid: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });
    setAuthCookie(res, token);
    res.json({ user: { id: user._id, name: user.name, email: user.email, picture: user.picture } });
  } catch (err) {
    console.error("login error:", err?.message || err);
    res.status(500).json({ message: "Login failed" });
  }
};

export const me = async (req, res) => {
  const user = await User.findById(req.userId).select("name email picture");
  if (!user) return res.status(404).json({ message: "User not found" });
  res.json({ user });
};

export const logout = (req, res) => {
  const isProd = process.env.NODE_ENV === "production";
  res.clearCookie("auth_token", {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
  });
  res.json({ success: true });
};

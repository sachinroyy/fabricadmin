import jwt from "jsonwebtoken";

export const requireAuth = (req, res, next) => {
  const bearer = req.headers.authorization?.split(" ")[1];
  const token = req.cookies?.auth_token || bearer;
  if (!token) return res.status(401).json({ message: "Unauthorized" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.uid;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
};

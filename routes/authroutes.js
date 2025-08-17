import { Router } from "express";
import { googleLogin, me, logout, register, login } from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.post("/google", googleLogin);  // exchange Google credential -> app cookie
router.get("/me", requireAuth, me);   // verify app cookie -> return user
router.post("/logout", logout);       // clear cookie
router.post("/register", register);   // email/password register -> set cookie
router.post("/login", login);         // email/password login -> set cookie

export default router;

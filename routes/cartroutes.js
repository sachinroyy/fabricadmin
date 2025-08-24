import express from "express";
import mongoose from "mongoose";
import { requireAuth } from "../middleware/auth.js";
import Cart from "../models/cart.js";
import Product from "../models/product.js";
import TopSeller from "../models/topseller.js";
import DressStyle from "../models/dressstyle.js";

const router = express.Router();

// Helper to ensure ObjectId
const toObjectId = (id) => new mongoose.Types.ObjectId(id);

// GET /api/cart - get authenticated user's cart
router.get("/", requireAuth, async (req, res) => {
  try {
    // Do NOT populate here so that items.product retains the original ObjectId
    // Populating with ref: "Product" would set product to null for items from other collections
    const cart = await Cart.findOne({ user: req.userId }).lean();

    return res.json({ success: true, cart: cart || { user: req.userId, items: [] } });
  } catch (err) {
    console.error("Error fetching cart:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch cart" });
  }
});

// POST /api/cart/add - add item to cart
router.post("/add", requireAuth, async (req, res) => {
  try {
    const { productId, quantity = 1, selectedSize = "", selectedColor = "" } = req.body;
    if (!productId) return res.status(400).json({ success: false, message: "productId is required" });

    // Validate product from Product, TopSeller, or DressStyle collection
    let itemDoc = await Product.findById(productId).lean();
    let source = 'product';
    if (!itemDoc) {
      itemDoc = await TopSeller.findById(productId).lean();
      if (itemDoc) source = 'topseller';
    }
    if (!itemDoc) {
      itemDoc = await DressStyle.findById(productId).lean();
      if (itemDoc) source = 'dressstyle';
    }
    if (!itemDoc) return res.status(404).json({ success: false, message: "Product not found" });

    const userId = toObjectId(req.userId);

    // Upsert cart
    let cart = await Cart.findOne({ user: userId });
    if (!cart) {
      cart = new Cart({ user: userId, items: [] });
    }

    // Check if item with same product + options exists
    const existingItem = cart.items.find(
      (i) => i.product.toString() === productId && i.selectedSize === selectedSize && i.selectedColor === selectedColor
    );

    if (existingItem) {
      existingItem.quantity += Number(quantity) || 1;
      // refresh snapshots if needed
      existingItem.priceSnapshot = itemDoc.price;
      existingItem.nameSnapshot = itemDoc.name;
      existingItem.imageSnapshot = itemDoc.image || "";
      if (source) existingItem.source = source;
    } else {
      cart.items.push({
        product: toObjectId(productId),
        quantity: Number(quantity) || 1,
        selectedSize,
        selectedColor,
        source,
        priceSnapshot: itemDoc.price,
        nameSnapshot: itemDoc.name,
        imageSnapshot: itemDoc.image || ""
      });
    }

    await cart.save();

    const populated = await cart.populate({ path: "items.product", select: "name price image" });
    return res.status(201).json({ success: true, message: "Added to cart", cart: populated });
  } catch (err) {
    console.error("Error adding to cart:", err);
    return res.status(500).json({ success: false, message: "Failed to add to cart" });
  }
});

// POST /api/cart/decrement - decrement item quantity (remove if reaches 0)
router.post("/decrement", requireAuth, async (req, res) => {
  try {
    const { itemId, productId, selectedSize = "", selectedColor = "" } = req.body;

    const userId = toObjectId(req.userId);
    let cart = await Cart.findOne({ user: userId });
    if (!cart) return res.status(404).json({ success: false, message: "Cart not found" });

    let idx = -1;
    // Prefer itemId when provided
    if (itemId) {
      idx = cart.items.findIndex((i) => i._id.toString() === String(itemId));
    } else if (productId) {
      idx = cart.items.findIndex(
        (i) => i.product.toString() === productId && i.selectedSize === selectedSize && i.selectedColor === selectedColor
      );
    } else {
      return res.status(400).json({ success: false, message: "productId or itemId is required" });
    }

    if (idx === -1) return res.status(404).json({ success: false, message: "Item not in cart" });

    cart.items[idx].quantity -= 1;
    if (cart.items[idx].quantity <= 0) {
      cart.items.splice(idx, 1);
    }

    await cart.save();
    const populated = await cart.populate({ path: "items.product", select: "name price image" });
    return res.json({ success: true, message: "Cart updated", cart: populated });
  } catch (err) {
    console.error("Error decrementing cart:", err);
    return res.status(500).json({ success: false, message: "Failed to update cart" });
  }
});

export default router;

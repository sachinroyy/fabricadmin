import mongoose from "mongoose";

const cartItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    quantity: { type: Number, required: true, min: 1, default: 1 },
    selectedSize: { type: String, default: "" },
    selectedColor: { type: String, default: "" },
    // Snapshots for price/name/image at the time of adding to cart
    priceSnapshot: { type: Number, default: 0 },
    nameSnapshot: { type: String, default: "" },
    imageSnapshot: { type: String, default: "" },
    addedAt: { type: Date, default: Date.now }
  },
  { _id: true }
);

const cartSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    items: { type: [cartItemSchema], default: [] }
  },
  { timestamps: true }
);

cartSchema.index({ user: 1 });

export default mongoose.model("Cart", cartSchema);

import mongoose from "mongoose";

const topSellerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Dress style name is required'],
      trim: true,
      unique: true,
      maxlength: [50, 'Dress style name cannot exceed 50 characters']
    },
    description: {
      type: String,
      required: [true, 'Description is required']
    },
    image: {
      type: String,
      default: ''
    },
    imagePublicId: {
      type: String,
      default: ''
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

topSellerSchema.index({ name: 'text', description: 'text' });

export default mongoose.model("TopSeller", topSellerSchema);

import mongoose from "mongoose";

const callHistorySchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
    },
    from: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    to: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    type: {
      type: String,
      enum: ["audio", "video"],
    },
    duration: {
      type: Number, // đơn vị: giây
    },
    status: {
      type: String,
      enum: ["missed", "rejected", "answered", "ended"],
      default: "missed",
    },
  },
  { timestamps: true, versionKey: false }
);

const CallHistory =
  mongoose.models.CallHistory ||
  mongoose.model("CallHistory", callHistorySchema);
export default CallHistory;

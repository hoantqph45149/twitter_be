import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: {
      type: String,
      default: "",
    },
    media: [
      {
        url: { type: String, required: true },
        type: {
          type: String,
          enum: [
            "image",
            "video",
            "file",
            "audio",
            "pdf",
            "doc",
            "xls",
            "ppt",
            "other",
            "zip",
            "rar",
            "raw",
          ],
          required: true,
        },
        fileName: { type: String }, // Tên file gốc
        size: { type: Number }, // Kích thước file (byte)
      },
    ],
    call: {
      type: {
        type: String,
        enum: ["video", "audio", "missed", "ended"],
      },
      duration: { type: Number }, // Thời lượng cuộc gọi (giây)
      startedAt: { type: Date }, // Thời gian bắt đầu
      endedAt: { type: Date }, // Thời gian kết thúc
    },
    seenBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    },
    deletedFor: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { timestamps: true, versionKey: false }
);

const Message =
  mongoose.models.Message || mongoose.model("Message", messageSchema);
export default Message;

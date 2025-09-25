import Conversation from "../models/conversation.model.js";
import Message from "../models/message.model.js";
import { io, onlineUsers } from "../socket/socket.js";
import { uploadToCloudinary } from "../lib/utils/uploadToCloudinary.js";
import User from "../models/user.model.js";

export const sendMessage = async (req, res) => {
  const { conversationId, receiverId, content, replyTo } = req.body;
  const senderId = req.user._id;

  try {
    let conversation;
    let isNewConversation = false;

    // Tìm hoặc tạo conversation
    if (conversationId) {
      conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        return res
          .status(404)
          .json({ success: false, error: "Conversation not found" });
      }
      // Kiểm tra quyền truy cập
      if (!conversation.participants.some((p) => p.user.equals(senderId))) {
        return res.status(403).json({
          success: false,
          error: "Unauthorized access to conversation",
        });
      }
    } else if (receiverId) {
      conversation = await Conversation.findOne({
        isGroup: false,
        "participants.user": { $all: [senderId, receiverId] },
      });

      if (!conversation) {
        conversation = await Conversation.create({
          participants: [{ user: senderId }, { user: receiverId }],
          isGroup: false,
        });
        isNewConversation = true;
      }
    } else {
      return res.status(400).json({
        success: false,
        error: "conversationId or receiverId is required",
      });
    }

    // Xử lý file upload (nếu có)
    let media = [];
    if (req.files && req.files.length > 0) {
      media = await Promise.all(
        req.files.map(async (file) => {
          const uploadedFile = await uploadToCloudinary(file);
          return uploadedFile;
        })
      );
    }

    if (!content && media.length === 0 && !req.body.call) {
      return res.status(400).json({
        success: false,
        error: "Message must have content, media, or call",
      });
    }

    // Tạo message
    let message = await Message.create({
      conversationId: conversation._id,
      senderId,
      content: content || "",
      media,
      replyTo: replyTo || null,
      seenBy: [senderId],
    });

    // Populate dữ liệu cần thiết
    message = await message.populate([
      { path: "senderId", select: "fullName profileImg" },
      { path: "replyTo", select: "content media" },
      { path: "conversationId", select: "isGroup name avatar participants" },
    ]);

    // Cập nhật lastMessage
    conversation.lastMessage = message._id;
    await conversation.save();

    // Nếu là conv mới thì populate luôn participants
    let populatedConversation = null;
    if (isNewConversation) {
      populatedConversation = await Conversation.findById(conversation._id)
        .populate("participants.user", "username fullName profileImg")
        .lean();
    }

    // Gửi socket
    const memberIds = conversation.participants.map((p) => p.user.toString());
    memberIds.forEach((userId) => {
      if (userId === senderId.toString()) return;
      const socketSet = onlineUsers.get(userId);
      if (!socketSet) return;
      socketSet.forEach((socketId) => {
        io.to(socketId).emit("new_message", message, populatedConversation);
      });
    });

    res.status(201).json({
      success: true,
      data: { message, conversation: populatedConversation },
    });
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getMessages = async (req, res) => {
  const { conversationId } = req.params;

  try {
    const messages = await Message.find({ conversationId })
      .populate("senderId", "username fullName profileImg")
      .populate("seenBy", "fullName profileImg")
      .populate("replyTo");
    res.status(200).json({ success: true, data: messages });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const markAsSeen = async (req, res) => {
  const { conversationId } = req.params;
  const userId = req.user._id;

  try {
    const updated = await Message.updateMany(
      { conversationId, seenBy: { $ne: userId } },
      { $addToSet: { seenBy: userId } }
    );

    // Lấy thông tin user
    const user = await User.findById(userId).select("_id fullName profileImg");

    // Emit seen event kèm thông tin user
    io.to(conversationId).emit("messages_seen", { user });

    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const deleteMessageForUser = async (req, res) => {
  const { messageId } = req.params;
  const userId = req.user._id;

  try {
    const message = await Message.findById(messageId);
    if (!message) {
      return res
        .status(404)
        .json({ success: false, error: "Message not found" });
    }

    message.deletedFor = message.deletedFor || [];
    message.deletedFor.push(userId);
    await message.save();

    res
      .status(200)
      .json({ success: true, message: "Message deleted for user" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const deleteMessageCompletely = async (req, res) => {
  const { messageId } = req.params;

  try {
    const message = await Message.findById(messageId);
    if (!message) {
      return res
        .status(404)
        .json({ success: false, error: "Message not found" });
    }

    await Message.deleteOne({ _id: messageId });

    res
      .status(200)
      .json({ success: true, message: "Message deleted completely" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

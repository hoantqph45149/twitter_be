import mongoose from "mongoose";
import { uploadToCloudinary } from "../lib/utils/uploadToCloudinary.js";
import Conversation from "../models/conversation.model.js";
import Message from "../models/message.model.js";
import { io, onlineUsers } from "../socket/socket.js";

export const getAllConversations = async (req, res) => {
  const userId = req.user._id;

  try {
    // Lấy tất cả conversation có user này
    let conversations = await Conversation.find({ "participants.user": userId })
      .populate({
        path: "participants.user",
        select: "fullName profileImg username",
      })
      .populate({
        path: "lastMessage",
        populate: {
          path: "senderId",
          select: "fullName profileImg username",
          // Nếu muốn rename senderId => sender thì map sau
        },
      })
      .sort({ updatedAt: -1 });

    // Tính unreadCount cho mỗi conversation
    conversations = await Promise.all(
      conversations.map(async (conv) => {
        const unreadCount = await Message.countDocuments({
          conversationId: conv._id,
          seenBy: { $ne: userId },
        });

        return {
          ...conv.toObject(),
          unreadCount,
        };
      })
    );

    res.json({ success: true, data: conversations });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getConversationById = async (req, res) => {
  const { id } = req.params;

  try {
    const conversation = await Conversation.findById(id)
      .populate("lastMessage")
      .populate("participants.user", "username")
      .populate("admins", "username");

    if (!conversation) {
      return res
        .status(404)
        .json({ success: false, error: "Conversation not found" });
    }

    res.json({ success: true, data: conversation });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const updateConversation = async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid conversation id" });
  }

  try {
    const conversation = await Conversation.findById(id);
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    // Update name nếu có
    if (name) conversation.name = name;

    // Update avatar nếu là group
    if (req.file) {
      if (!conversation.isGroup) {
        return res
          .status(400)
          .json({ message: "Cannot set avatar for 1-1 conversation" });
      }

      const result = await uploadToCloudinary(req.file);
      conversation.avatar = result.url;
    }

    await conversation.save();
    return res.status(200).json(conversation);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const createConversation = async (req, res) => {
  const { isGroup, name, participants } = req.body;
  if (!participants || participants.length < 2) {
    return res
      .status(400)
      .json({ success: false, error: "At least 2 participants required" });
  }

  try {
    let newConversation = new Conversation({
      name: isGroup ? name : undefined,
      isGroup,
      participants: [
        ...participants.map((u) => ({ user: u })),
        { user: req.user._id },
      ],
      owner: isGroup ? req.user._id : null,
    });

    await newConversation.save();

    newConversation = await newConversation.populate({
      path: "participants.user",
      select: "fullName username profileImg",
    });

    const memberIds = newConversation.participants.map((p) =>
      p.user._id.toString()
    );
    memberIds.forEach((userId) => {
      if (userId === req.user._id.toString()) return;
      console.log("userId:", userId);
      const socketSet = onlineUsers.get(userId);
      console.log("socketSet:", socketSet);
      if (!socketSet) return;

      socketSet.forEach((socketId) => {
        io.to(socketId).emit("new_conversation", newConversation);
      });
    });
    res.status(201).json({ success: true, data: newConversation });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const markLastSeen = async (req, res) => {
  const { id } = req.params;
  const { messageId } = req.body;

  try {
    await Conversation.updateOne(
      { _id: id, "participants.user": req.user._id },
      { $set: { "participants.$.lastSeenMessage": messageId } }
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const toggleTypingStatus = async (req, res) => {
  const { id } = req.params;
  const { isTyping } = req.body;
  const io = req.app.get("io");

  // Emit typing status to conversation room
  io.to(`conversation_${id}`).emit("typing", {
    userId: req.user._id,
    isTyping,
  });

  res.json({ success: true });
};

export const muteConversation = async (req, res) => {
  const { id } = req.params;
  const { mute } = req.body;

  // Validate conversation id
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res
      .status(400)
      .json({ success: false, error: "Invalid conversation ID" });
  }

  // Validate mute
  if (typeof mute !== "boolean") {
    return res
      .status(400)
      .json({ success: false, error: "`mute` must be a boolean" });
  }

  try {
    const result = await Conversation.updateOne(
      { _id: id, "participants.user": req.user._id },
      { $set: { "participants.$.isMuted": mute } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        error: "Conversation not found or user not a participant",
      });
    }

    res.json({ success: true, muted: mute });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

export const leaveConversation = async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res
      .status(400)
      .json({ success: false, error: "Invalid conversation ID" });
  }

  try {
    // Xóa user khỏi participants + admins
    const conversation = await Conversation.findByIdAndUpdate(
      id,
      {
        $pull: {
          participants: { user: userId },
          admins: userId, // nếu có trong admins thì gỡ ra luôn
        },
      },
      { new: true }
    );

    if (!conversation) {
      return res
        .status(404)
        .json({ success: false, error: "Conversation not found" });
    }

    // Nếu không còn participant nào -> xoá hẳn group
    if (conversation.participants.length === 0) {
      await Conversation.findByIdAndDelete(id);
      return res.json({
        success: true,
        message:
          "You left the conversation and it has been deleted because no participants left.",
      });
    }

    res.json({
      success: true,
      message: "You left the conversation",
      data: conversation,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

export const addParticipants = async (req, res) => {
  const { id } = req.params;
  const { newUserIds } = req.body;

  try {
    let conversation = await Conversation.findById(id);

    if (!conversation || !conversation.isGroup) {
      return res
        .status(400)
        .json({ success: false, error: "Conversation is not a group" });
    }

    const currentIds = conversation.participants.map((p) => p.user.toString());
    const uniqueNewUsers = newUserIds.filter((id) => !currentIds.includes(id));

    const newParticipants = uniqueNewUsers.map((userId) => ({
      user: userId,
    }));

    conversation.participants.push(...newParticipants);
    await conversation.save();

    conversation = await conversation.populate({
      path: "participants.user",
      select: "fullName username profileImg",
    });

    uniqueNewUsers.forEach((userId) => {
      const socketSet = onlineUsers.get(userId.toString());
      if (!socketSet) return;

      socketSet.forEach((socketId) => {
        io.to(socketId).emit("added_to_conversation", {
          conversation,
          message: "You have been added to a conversation",
        });
      });
    });

    res.json({ success: true, data: conversation });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const removeParticipant = async (req, res) => {
  const { id, userId } = req.params;

  try {
    const conversation = await Conversation.findById(id);

    if (!conversation) {
      return res
        .status(404)
        .json({ success: false, error: "Conversation not found" });
    }

    // Không cho xoá owner
    if (conversation.owner.toString() === userId.toString()) {
      return res
        .status(400)
        .json({ success: false, error: "Cannot remove the group owner" });
    }

    // Thực hiện xoá participant + nếu là admin thì gỡ luôn
    const updatedConversation = await Conversation.findByIdAndUpdate(
      id,
      {
        $pull: {
          participants: { user: userId },
          admins: userId,
        },
      },
      { new: true }
    );

    const socketSet = onlineUsers.get(userId.toString());
    if (socketSet) {
      socketSet.forEach((socketId) => {
        io.to(socketId).emit("removed_from_conversation", {
          conversation: updatedConversation,
          message: "You have been removed from the conversation",
        });
      });
    }

    res.json({ success: true, data: updatedConversation });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const transferOwnership = async (req, res) => {
  const { id } = req.params;
  const { newOwnerId } = req.body;
  const authUserId = req.user._id?.toString();

  // validate ids
  if (
    !mongoose.Types.ObjectId.isValid(id) ||
    !mongoose.Types.ObjectId.isValid(newOwnerId)
  ) {
    return res.status(400).json({ message: "Invalid id" });
  }

  try {
    const conversation = await Conversation.findById(id);
    if (!conversation)
      return res.status(404).json({ message: "Conversation not found" });

    // chỉ owner mới được chuyển nhượng
    if (conversation.owner?.toString() !== authUserId) {
      return res
        .status(403)
        .json({ message: "Only the owner can transfer ownership" });
    }

    // newOwner không thể là chính owner hiện tại
    if (conversation.owner?.toString() === newOwnerId) {
      return res
        .status(400)
        .json({ message: "Selected user is already the owner" });
    }

    // newOwner phải là participant
    const isParticipant = conversation.participants.some(
      (p) => p.user.toString() === newOwnerId.toString()
    );
    if (!isParticipant) {
      return res
        .status(400)
        .json({ message: "The new owner must be a member of the group" });
    }

    // ---------- business logic ----------
    // 1) nếu newOwner đang nằm trong admins => remove nó khỏi admins
    conversation.admins = conversation.admins.filter(
      (a) => a.toString() !== newOwnerId.toString()
    );

    // 2) đưa current owner (trước khi set) vào admins nếu chưa có (owner cũ sẽ thành admin)
    const prevOwnerId = conversation.owner;
    if (
      prevOwnerId &&
      prevOwnerId.toString() !== newOwnerId.toString() &&
      !conversation.admins.some((a) => a.toString() === prevOwnerId.toString())
    ) {
      conversation.admins.push(prevOwnerId);
    }

    // 3) set owner mới
    conversation.owner = newOwnerId;

    await conversation.save();

    const socketSet = onlineUsers.get(newOwnerId.toString());
    if (socketSet) {
      socketSet.forEach((socketId) => {
        io.to(socketId).emit("ownership_transferred", {
          conversation: conversation,
          message: "You are now the owner of the conversation",
        });
      });
    }

    return res
      .status(200)
      .json({ message: "Ownership transferred successfully", conversation });
  } catch (err) {
    console.error("transferOwnership error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const assignAdmin = async (req, res) => {
  try {
    const { id, userId } = req.params; // id của conversation
    const authUserId = req.user._id; // thằng đang đăng nhập (gắn nhờ middleware auth)

    // 1. Tìm group
    const conversation = await Conversation.findById(id);
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    // 2. Chỉ owner mới có quyền
    if (conversation.owner.toString() !== authUserId.toString()) {
      return res.status(403).json({ message: "Only owner can assign admins" });
    }

    // 3. Check user có trong participants ko
    const isParticipant = conversation.participants.some(
      (p) => p.user.toString() === userId.toString()
    );
    if (!isParticipant) {
      return res
        .status(400)
        .json({ message: "User must be a participant before becoming admin" });
    }

    // 4. Thêm vào admins nếu chưa có
    if (conversation.admins.includes(userId)) {
      return res.status(400).json({ message: "User is already an admin" });
    }

    conversation.admins.push(userId);
    await conversation.save();

    const socketSet = onlineUsers.get(userId.toString());
    if (socketSet) {
      socketSet.forEach((socketId) => {
        io.to(socketId).emit("promoted_to_admin", {
          conversation: conversation,
          message: "You have been promoted to admin",
        });
      });
    }

    res.status(200).json({
      message: "Admin added successfully",
      conversation,
    });
  } catch (error) {
    console.error("Error adding admin:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Bỏ quyền admin
export const removeAdmin = async (req, res) => {
  try {
    const { id, adminId } = req.params;
    const userId = req.user._id;

    // Validate ids
    if (
      !mongoose.Types.ObjectId.isValid(id) ||
      !mongoose.Types.ObjectId.isValid(adminId)
    ) {
      return res.status(400).json({ message: "Invalid id" });
    }

    // Find conversation

    const conversation = await Conversation.findById(id);
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    // Only owner can remove admin
    if (conversation.owner.toString() !== userId.toString()) {
      return res
        .status(403)
        .json({ message: " Only the owner can remove admin" });
    }

    // Check if the user to be removed is an admin
    if (!conversation.admins.includes(adminId)) {
      return res.status(400).json({ message: "This user is not an admin" });
    }

    // Remove admin
    conversation.admins = conversation.admins.filter(
      (id) => id.toString() !== adminId.toString()
    );

    await conversation.save();

    const socketSet = onlineUsers.get(adminId.toString());
    if (socketSet) {
      socketSet.forEach((socketId) => {
        io.to(socketId).emit("demoted_from_admin", {
          conversation: conversation,
          message: "You have been demoted from admin",
        });
      });
    }
    res.json({
      message: "Admin rights removed successfully",
      conversation,
    });
  } catch (err) {
    console.error("Error removeAdmin:", err);
    res.status(500).json({ message: "Server error" });
  }
};

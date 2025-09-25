import express from "express";
import {
  getAllConversations,
  getConversationById,
  createConversation,
  markLastSeen,
  toggleTypingStatus,
  muteConversation,
  addParticipants,
  removeParticipant,
  updateConversation,
  leaveConversation,
  assignAdmin,
  transferOwnership,
  removeAdmin,
} from "../controllers/conversation.controller.js";
import { protectRoute } from "../middlewares/protectRoute.js";
import { uploadSingle } from "../config/multer.js";

const router = express.Router();

router.use(protectRoute);

router.get("/", getAllConversations);
router.get("/:id", getConversationById);
router.post("/", createConversation);
router.patch("/:id/add-admin/:userId", assignAdmin);
router.patch("/:id", uploadSingle, updateConversation);
router.patch("/:id/remove-admin/:adminId", removeAdmin);
router.put("/:id/last-seen", markLastSeen);
router.put("/:id/typing", toggleTypingStatus);
router.put("/:id/mute", muteConversation);
router.put("/:id/participants", addParticipants);
router.put("/:id/leave", leaveConversation);
router.put("/:id/transfer-ownership", transferOwnership);
router.delete("/:id/participants/:userId", removeParticipant);

export default router;

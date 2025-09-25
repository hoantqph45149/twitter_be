import express from "express";
import {
  deleteMessageCompletely,
  deleteMessageForUser,
  getMessages,
  markAsSeen,
  sendMessage,
} from "../controllers/message.controller.js";
import { protectRoute } from "../middlewares/protectRoute.js";
import { uploadMultiple } from "../config/multer.js";

const router = express.Router();

router.use(protectRoute);

router.post("/:conversationId", uploadMultiple, sendMessage);
router.get("/:conversationId", getMessages);
router.put("/:conversationId/seen", markAsSeen);
router.delete("/:messageId", deleteMessageForUser);
router.delete("/completely/:messageId", deleteMessageCompletely);
export default router;

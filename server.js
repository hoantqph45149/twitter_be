import { v2 as cloudinary } from "cloudinary";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import connectMongoDB from "./db/connect.js";
import authRoutes from "./routes/auth.route.js";
import conversation from "./routes/conversation.route.js";
import messages from "./routes/message.route.js";
import notificationRoutes from "./routes/notification.route.js";
import postRoutes from "./routes/post.route.js";
import userRoutes from "./routes/user.route.js";
import { app, server } from "./socket/socket.js";
dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const PORT = process.env.PORT || 5000;

app.use(express.json({ limit: "5mb" }));
app.use(cookieParser());

app.use(
  cors({
    origin: ["https://twitter-fe-pied.vercel.app", "http://localhost:3000"], // domain FE của mày
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    credentials: true, // cần nếu mày gửi cookie/token
  })
);

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/conversations", conversation);
app.use("/api/messages", messages);

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  connectMongoDB();
});

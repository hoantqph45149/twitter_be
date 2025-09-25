import fs from "fs";
import cloudinary from "../../config/cloudinary.js";
import path from "path";

const fixEncoding = (str) => Buffer.from(str, "latin1").toString("utf8");

// Hàm chuyển tên gốc thành public_id an toàn
const sanitizeFileName = (filename) => {
  return filename
    .normalize("NFD") // bỏ dấu tiếng Việt
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_]/g, "_"); // thay ký tự đặc biệt bằng _
};

export const uploadToCloudinary = async (file) => {
  try {
    const fixedName = fixEncoding(file.originalname);
    const safeName = sanitizeFileName(path.parse(fixedName).name);
    let mediaType = "raw";
    const result = await cloudinary.uploader.upload(file.path, {
      resource_type: "auto",
      folder: "chat_files",
      use_filename: true,
      unique_filename: false,
      public_id: safeName,
    });
    if (file.mimetype.startsWith("image/")) {
      mediaType = "image";
    } else if (file.mimetype.startsWith("video/")) {
      mediaType = "video";
    } else {
      mediaType = "file";
    }

    fs.unlinkSync(file.path);

    return {
      url: result.secure_url,
      type: mediaType,
      fileName: fixedName,
      size: file.size,
    };
  } catch (err) {
    throw new Error("Upload failed: " + err.message);
  }
};

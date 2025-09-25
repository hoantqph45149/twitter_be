import jwt from "jsonwebtoken";
export const generateTokenAndSetCookie = (userId, res) => {
  const token = jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: "15d",
  });
  res.cookie("jwt", token, {
    maxAge: 15 * 24 * 60 * 60 * 1000, // 15 ngày
    httpOnly: true, // bảo mật
    secure: true, // bắt buộc HTTPS
    sameSite: "none", // cross-domain
    path: "/", // toàn site
  });
};

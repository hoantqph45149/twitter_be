import bcryptjs from "bcryptjs";
import User from "../models/user.model.js";
import { loginSchema, signupSchema } from "../schemas/auth.js";
import { generateTokenAndSetCookie } from "../lib/utils/generateToken.js";
import { validateData } from "../lib/utils/validateData.js";

export const signup = async (req, res) => {
  try {
    const { fullName, username, email, password } = req.body;

    const error = validateData(signupSchema, { username, email, password });
    if (error) {
      return res.status(400).json({
        error,
      });
    }

    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      return res.status(400).json({
        error:
          existingUser.username === username
            ? "Username is already taken"
            : "Email is already taken",
      });
    }

    const salt = await bcryptjs.genSalt(10);
    const hashedPassword = await bcryptjs.hash(password, salt);

    const newUser = new User({
      fullName,
      username,
      email,
      password: hashedPassword,
    });

    if (newUser) {
      generateTokenAndSetCookie(newUser._id, res);
      await newUser.save();

      return res.status(201).json({
        _id: newUser._id,
        fullName: newUser.fullName,
        username: newUser.username,
        email: newUser.email,
        followers: newUser.followers,
        following: newUser.following,
        profileImg: newUser.profileImg,
        coverImg: newUser.coverImg,
      });
    } else {
      return res.status(400).json({
        error: "Invalid user data",
      });
    }
  } catch (error) {
    console.log(`Error in signup controller`, error.message);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

export const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    const error = validateData(loginSchema, { username, password });
    if (error) {
      return res.status(400).json({
        error,
      });
    }

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({
        error: "Invalid username. Please try again",
      });
    }

    const isPasswordCorrect = await bcryptjs.compare(
      password,
      user?.password || ""
    );
    if (!isPasswordCorrect) {
      return res.status(400).json({
        error: "Incorrect password. Please try again.",
      });
    }

    generateTokenAndSetCookie(user._id, res);
    return res.status(200).json({
      _id: user._id,
      fullName: user.fullName,
      username: user.username,
      email: user.email,
      followers: user.followers,
      following: user.following,
      profileImg: user.profileImg,
      coverImg: user.coverImg,
    });
  } catch (error) {
    console.log(`Error in login controller`, error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const logout = async (req, res) => {
  try {
    res.cookie("jwt", "", { maxAge: 0 });
    return res.status(200).json({
      message: "Logged out successfully",
    });
  } catch (error) {
    console.log(`Error in logout controller`, error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password");
    return res.status(200).json(user);
  } catch (error) {
    console.log("Error in getMe controller", error.message);
    return res.status(500).json({
      error: "Internal Server Error",
    });
  }
};

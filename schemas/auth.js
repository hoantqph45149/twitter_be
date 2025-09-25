import Joi from "joi";
export const signupSchema = Joi.object({
  username: Joi.string().required().trim().messages({
    "string.empty": "Username cannot be empty.",
    "any.required": "Username is required.",
  }),
  email: Joi.string().required().trim().email().messages({
    "string.empty": "Email cannot be empty.",
    "string.email": "Please enter a valid email address.",
    "any.required": "Email is required.",
  }),
  password: Joi.string().required().trim().min(6).messages({
    "string.empty": "Password cannot be empty.",
    "string.min": "Password must be at least 6 characters long.",
    "any.required": "Password is required.",
  }),
});
export const loginSchema = Joi.object({
  username: Joi.string().required().trim().messages({
    "string.empty": "Username cannot be empty.",
    "any.required": "Username is required.",
  }),
  password: Joi.string().required().trim().min(6).messages({
    "string.empty": "Password cannot be empty.",
    "string.min": "Password must be at least 6 characters long.",
    "any.required": "Password is required.",
  }),
});

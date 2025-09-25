import Joi from "joi";
export const commentOnPostSchema = Joi.object({
  text: Joi.string().required().trim().messages({
    "string.base": "Comment text must be a string.",
    "string.empty": "Comment text cannot be empty.",
    "any.required": "Comment text is required.",
  }),
});

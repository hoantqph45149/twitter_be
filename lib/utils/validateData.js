export const validateData = (schema, data) => {
  const { error } = schema.validate(data);
  if (error) return error.details[0].message;
};

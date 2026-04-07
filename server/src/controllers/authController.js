const { sendSuccess } = require("../utils/apiResponse");
const { signup, login } = require("../services/authService");

const signupController = async (req, res) => {
  const result = await signup(req.body || {});
  return sendSuccess(res, result, "Signup successful", 201);
};

const loginController = async (req, res) => {
  const result = await login(req.body || {});
  return sendSuccess(res, result, "Login successful", 200);
};

module.exports = {
  signupController,
  loginController
};

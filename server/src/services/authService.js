const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const AppError = require("../utils/appError");
const env = require("../config/env");
const User = require("../models/User");

const validateSignupInput = ({ name, email, password }) => {
  if (!name || !String(name).trim()) {
    throw new AppError("Name is required", 400);
  }
  if (!email || !String(email).trim()) {
    throw new AppError("Email is required", 400);
  }
  if (!password || String(password).length < 6) {
    throw new AppError("Password must be at least 6 characters", 400);
  }
};

const validateLoginInput = ({ email, password }) => {
  if (!email || !String(email).trim()) {
    throw new AppError("Email is required", 400);
  }
  if (!password || !String(password)) {
    throw new AppError("Password is required", 400);
  }
};

const buildUserPayload = (user) => ({
  id: String(user._id),
  name: user.name,
  email: user.email,
  role: user.role
});

const signJwt = (user) =>
  jwt.sign(
    {
      sub: String(user._id),
      email: user.email,
      role: user.role,
      name: user.name
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn || "7d" }
  );

const signup = async ({ name, email, password }) => {
  validateSignupInput({ name, email, password });

  const normalizedEmail = String(email).trim().toLowerCase();
  const existingUser = await User.findOne({ email: normalizedEmail }).lean();
  if (existingUser) {
    throw new AppError("User already exists", 409);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({
    name: String(name).trim(),
    email: normalizedEmail,
    password: passwordHash,
    role: "user"
  });

  return {
    token: signJwt(user),
    user: buildUserPayload(user)
  };
};

const login = async ({ email, password }) => {
  validateLoginInput({ email, password });

  const normalizedEmail = String(email).trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail }).select("+password");
  if (!user) {
    throw new AppError("Invalid credentials", 401);
  }

  const passwordMatch = await bcrypt.compare(password, user.password);
  if (!passwordMatch) {
    throw new AppError("Invalid credentials", 401);
  }

  return {
    token: signJwt(user),
    user: buildUserPayload(user)
  };
};

module.exports = {
  signup,
  login
};

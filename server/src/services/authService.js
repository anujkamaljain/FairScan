const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const AppError = require("../utils/appError");
const env = require("../config/env");
const User = require("../models/User");

const googleClient = new OAuth2Client();

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
  role: user.role,
  authProvider: user.authProvider || "local"
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
    authProvider: "local",
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

  if (!user.password) {
    throw new AppError("This account uses Google sign-in. Please continue with Google.", 400);
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

const loginWithGoogle = async ({ idToken }) => {
  if (!idToken || !String(idToken).trim()) {
    throw new AppError("Google ID token is required", 400);
  }
  if (!env.googleOAuthClientId) {
    throw new AppError("Google OAuth is not configured on the server", 500);
  }

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: String(idToken).trim(),
      audience: env.googleOAuthClientId
    });
    payload = ticket.getPayload();
  } catch {
    throw new AppError("Google authentication failed", 401);
  }

  const email = String(payload?.email || "").trim().toLowerCase();
  if (!email || payload?.email_verified !== true) {
    throw new AppError("Google account email is not verified", 401);
  }

  const googleId = String(payload?.sub || "").trim();
  const name = String(payload?.name || payload?.given_name || "Google User").trim();

  let user = await User.findOne({ email });
  if (!user) {
    user = await User.create({
      name,
      email,
      authProvider: "google",
      googleId,
      role: "user"
    });
  } else {
    const shouldUpdate =
      user.authProvider !== "google" ||
      (googleId && user.googleId !== googleId) ||
      (name && user.name !== name);
    if (shouldUpdate) {
      user.authProvider = "google";
      if (googleId) user.googleId = googleId;
      if (name) user.name = name;
      await user.save();
    }
  }

  return {
    token: signJwt(user),
    user: buildUserPayload(user)
  };
};

module.exports = {
  signup,
  login,
  loginWithGoogle
};

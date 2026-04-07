const express = require("express");
const { signupController, loginController, googleLoginController } = require("../controllers/authController");

const router = express.Router();

router.post("/signup", signupController);
router.post("/login", loginController);
router.post("/google", googleLoginController);

module.exports = router;

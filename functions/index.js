// functions/index.js
const { onRequest } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const { v6: uuidv6 } = require("uuid");


// Initialize Firebase Admin SDK only once
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

// Basic email validation helper
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// CORS headers for preflight and actual requests
const allowedOrigins = [
  "https://cms.cezary-czerwinski.pl", 
  "https://www.cezary-czerwinski.pl", 
  "https://cezary-czerwinski.pl", 
  "http://localhost:3000"
];

/**
 * Newsletter Subscription HTTP Function (2nd gen)
 * Region: Warsaw (europe-central2)
 */
exports.subscribeToNewsletter = onRequest(
  {
    region: "europe-central2",
  },
  async (req, res) => {
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
      res.set("Access-Control-Allow-Origin", origin);
    } 
    res.set("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    const email = req.body.email;
    if (!email || typeof email !== "string" || !isValidEmail(email)) {
      res.status(400).json({ success: false, message: "Invalid or missing email." });
      return;
    }

    try {
      // console.log("req.headers", req.headers);

      const subscribersRef = db.collection("newsletterSubscribers");

      // Check if email already exists
      const snapshot = await subscribersRef
        .where("email", "==", email.toLowerCase())
        .limit(1)
        .get();

      if (!snapshot.empty) {
        res.status(409).json({ success: false, message: "Email already subscribed." });
        return;
      }

      const recordObject = {
        email: email.toLowerCase(),
        subscribedAt: FieldValue.serverTimestamp()
      }

      try {
        recordObject["req.headers"] = req.headers;
        recordObject["req.ip"] = req.ip || req.headers["x-forwarded-for"] || req.connection.remoteAddress || null;
      } catch (error) {
        const errorMessage = "Error adding request info to recordObject:"
        logger.error(errorMessage, error);
        console.error(errorMessage, error);
      }

      await subscribersRef.add(recordObject);

      logger.info(`New subscriber: ${email}`);
      res.status(201).json({ success: true, message: "Successfully subscribed to the newsletter!" });
    } catch (error) {
      logger.error("Error subscribing to newsletter:", error);
      res.status(500).json({ success: false, message: "An error occurred. Please try again." });
    }
  }
);

/**
 * Send Contact Message HTTP Function (2nd gen)
 * Region: Warsaw (europe-central2)
 */
exports.sendContactMessage = onRequest(
  { region: "europe-central2" },
  async (req, res) => {
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
      res.set("Access-Control-Allow-Origin", origin);
    }
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      return res.status(204).send("");
    }
    if (req.method !== "POST") {
      return res.status(405).send("Method Not Allowed");
    }

    const { name, email, message } = req.body;
    if (
      !name || typeof name !== "string" ||
      !email || typeof email !== "string" || !isValidEmail(email) ||
      !message || typeof message !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid or missing fields. 'name', 'email' (valid), and 'message' are required."
      });
    }

    try {
      const messagesRef = db.collection("contactMessages");
      const docData = {
        name: name.trim(),
        email: email.toLowerCase(),
        message: message.trim(),
        sentAt: FieldValue.serverTimestamp(),
        req: {
          headers: req.headers,
          ip: req.ip || req.headers["x-forwarded-for"] || req.connection.remoteAddress || null
        }
      };

      await messagesRef.add(docData);
      logger.info(`New contact message from ${email}`);
      return res.status(201).json({ success: true, message: "Message sent successfully!" });
    } catch (error) {
      logger.error("Error sending contact message:", error);
      return res.status(500).json({ success: false, message: "An error occurred. Please try again." });
    }
  }
);
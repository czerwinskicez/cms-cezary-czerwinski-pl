// functions/index.js
const { onRequest } = require("firebase-functions/v2/https");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const { v6: uuidv6 } = require("uuid");
const axios = require("axios");


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

// New function to trigger revalidation
exports.revalidateBlogContent = onDocumentWritten(
  {
    document: "posts/{postId}",
    region: "europe-central2",
  },
  async (event) => {
    logger.info("Revalidation event triggered for posts collection", {
      docId: event.params.postId,
      type: event.type,
    });

    const revalidationToken = functions.config().revalidation.token;
    const blogUrl = "https://www.cezary-czerwinski.pl"; // Replace with your actual blog URL if different

    if (!revalidationToken) {
      logger.error(
        "Revalidation token is not set in Firebase Functions config."
      );
      return;
    }

    // Determine the path to revalidate
    // For deletions, the 'after' data won't exist.
    // For creations/updates, 'after' data should have the slug.
    let slug;
    if (event.data && event.data.after && event.data.after.exists) {
      slug = event.data.after.data().slug;
    } else if (event.data && event.data.before && event.data.before.exists && event.type === 'delete') {
      // If it's a delete event, try to get slug from 'before' data
      // This is a fallback, as ideally the path is known or not needed for deletion revalidation of a list page
      slug = event.data.before.data().slug;
      logger.info(`Document ${event.params.postId} deleted. Slug was: ${slug}`);
    }


    // Paths to revalidate
    // We always revalidate the homepage and the main blog listing page.
    // If a specific post was changed (created, updated, deleted with slug), revalidate its path too.
    const pathsToRevalidate = ["/", "/blog"]; // Common paths to revalidate

    if (slug) {
      pathsToRevalidate.push(`/blog/${slug}`); // Path for individual blog post
    } else if (event.type === 'delete') {
        logger.info("No slug available for deleted document, revalidating general paths only.");
    } else if (event.data && event.data.after && event.data.after.exists) {
        logger.warn("No slug found in created/updated document:", event.params.postId, event.data.after.data());
    }


    const revalidatePromises = pathsToRevalidate.map(async (pathToRevalidate) => {
      const revalidateUrl = `${blogUrl}/api/revalidate?secret=${revalidationToken}&path=${pathToRevalidate}`;
      try {
        logger.info(`Attempting to revalidate: ${blogUrl}${pathToRevalidate}`);
        const response = await axios.get(revalidateUrl);
        if (response.data.revalidated) {
          logger.info(
            `Successfully revalidated: ${blogUrl}${pathToRevalidate}`,
            response.data
          );
        } else {
          logger.warn(
            `Revalidation API response indicates not revalidated or unexpected response: ${blogUrl}${pathToRevalidate}`,
            response.data
          );
        }
      } catch (error) {
        logger.error(
          `Error revalidating ${blogUrl}${pathToRevalidate}:`,
          error.response ? error.response.data : error.message
        );
      }
    });

    try {
      await Promise.all(revalidatePromises);
      logger.info("All revalidation requests processed for trigger on post:", event.params.postId);
    } catch (error) {
      logger.error("Error processing revalidation requests:", error);
    }
  }
);
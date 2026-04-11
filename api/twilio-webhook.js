/**
 * Vauldr Ops Lead Shield — Vercel Serverless Function
 * Handles: Twilio webhook → detect missed call → send SMS
 */

const twilio = require("twilio");

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const SMS_FROM_NUMBER = process.env.SMS_FROM_NUMBER || "+14195155790";

const PLUMBER_SMS = "Hi! We received your call and will get back to you ASAP. Reply URGENT if this is an emergency.";

module.exports = async (req, res) => {
    if (req.method !== "POST") {
          return res.status(405).json({ error: "Method not allowed" });
    }

    try {
          const { CallSid, From, CallStatus, CallDuration } = req.body;

      console.log(`[${CallSid}] Webhook received. Status: ${CallStatus}, Duration: ${CallDuration}s`);

      // Only process completed calls
      if (CallStatus !== "completed") {
              return res.status(200).json({ status: "ok", message: "Call in progress" });
      }

      // Check if call was missed (duration < 2 seconds means unanswered)
      const callDurationSeconds = parseInt(CallDuration, 10) || 0;
          if (callDurationSeconds >= 2) {
                  console.log(`[${CallSid}] Call was answered (${callDurationSeconds}s). Skipping SMS.`);
                  return res.status(200).json({ status: "ok", message: "Call answered" });
          }

      // Missed call detected — send SMS
      console.log(`[${CallSid}] Missed call detected. Sending SMS to ${From}...`);

      const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
          const message = await client.messages.create({
                  body: PLUMBER_SMS,
                  from: SMS_FROM_NUMBER,
                  to: From,
          });

      console.log(`[${CallSid}] SMS sent successfully. Message SID: ${message.sid}`);
          return res.status(200).json({ status: "ok", message: "SMS sent", sid: message.sid });
    } catch (error) {
          console.error(`Error: ${error.message}`);
          return res.status(500).json({ status: "error", message: error.message });
    }
};

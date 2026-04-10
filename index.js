/**
 * Vauldr Ops Lead Shield — Vercel Serverless Function
 * 
 * Handles: Twilio webhook → detect missed call → send SMS → log to Airtable
 */

const twilio = require("twilio");
const fetch = require("node-fetch");

// Configuration
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_TABLE_ID = process.env.AIRTABLE_TABLE_ID;

// Plumber-specific SMS
const PLUMBER_SMS =
  "Hi! We received your call and will get back to you ASAP. Reply URGENT if this is an emergency.";

// ============================================================================
// MAIN HANDLER
// ============================================================================

module.exports = async (req, res) => {
  // Only accept POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { CallSid, From, To, CallStatus, CallDuration } = req.body;

  console.log(`[${new Date().toISOString()}] Webhook received:`, {
    CallSid,
    From,
    To,
    CallStatus,
    CallDuration,
  });

  // Only process completed calls
  if (CallStatus !== "completed") {
    return res.status(200).json({ message: "Call in progress" });
  }

  try {
    // Check if call was missed (duration < 2 seconds)
    const callDurationSeconds = parseInt(CallDuration, 10) || 0;
    const wasMissed = callDurationSeconds < 2;

    if (!wasMissed) {
      console.log(`[${CallSid}] Call was answered. Skipping SMS.`);
      return res.status(200).json({ message: "Call was answered" });
    }

    console.log(`[${CallSid}] Missed call detected. Sending SMS...`);

    // Send SMS
    await sendSmsViaTwilio(From, CallSid);

    // Log to Airtable (if configured)
    if (AIRTABLE_BASE_ID && AIRTABLE_API_KEY && AIRTABLE_TABLE_ID) {
      await logToAirtable({
        callSid: CallSid,
        callerPhone: From,
        businessPhone: To,
        smsMessage: PLUMBER_SMS,
        timestamp: new Date().toISOString(),
        callDuration: callDurationSeconds,
      });
    }

    console.log(`[${CallSid}] SMS sent to ${From}`);
    return res.status(200).json({ message: "SMS sent successfully" });
  } catch (error) {
    console.error(`Error:`, error.message);
    return res
      .status(500)
      .json({ error: error.message || "Internal server error" });
  }
};

// ============================================================================
// HELPERS
// ============================================================================

async function sendSmsViaTwilio(toPhone, callSid) {
  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

  try {
    const sms = await client.messages.create({
      body: PLUMBER_SMS,
      from: TWILIO_PHONE_NUMBER,
      to: toPhone,
    });

    console.log(`[${callSid}] SMS sent. Message SID: ${sms.sid}`);
    return sms.sid;
  } catch (error) {
    console.error(`[${callSid}] Twilio error:`, error.message);
    throw error;
  }
}

async function logToAirtable(data) {
  const airtableUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}`;

  try {
    const response = await fetch(airtableUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AIRTABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        records: [
          {
            fields: {
              "Call SID": data.callSid,
              "Caller Phone": data.callerPhone,
              "Business Phone": data.businessPhone,
              "SMS Message": data.smsMessage,
              Timestamp: data.timestamp,
              "Call Duration (sec)": data.callDuration,
              Status: "Sent",
            },
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Airtable ${response.status}: ${errorText}`);
    }

    console.log(`[AIRTABLE] Logged: ${data.callSid}`);
  } catch (error) {
    console.error("[AIRTABLE] Error:", error.message);
    // Don't throw — logging failure shouldn't kill the SMS
  }
}

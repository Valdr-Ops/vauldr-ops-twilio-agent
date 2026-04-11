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
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER; // For receiving calls
const SMS_FROM_NUMBER = process.env.SMS_FROM_NUMBER || "+1-419-515-5790"; // Google Voice number for sending SMS

const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_TABLE_ID = process.env.AIRTABLE_TABLE_ID;

// Plumber-specific SMS
const PLUMBER_SMS =
  "Hi! We received your call and will get

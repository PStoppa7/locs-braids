require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;

// Lash price list
const PRICES = {
  "Classic": { fullSet: 500, fills: 300 },
  "Hybrid": { fullSet: 600, fills: 350 },
  "Volume": { fullSet: 700, fills: 400 },
  "Mega Volume": { fullSet: 800, fills: 500 }
};

// Opening hours (Mon-Fri)
const OPENING_HOURS = {
  "Monday":    { open: "09:00", close: "17:00" },
  "Tuesday":   { open: "09:00", close: "17:00" },
  "Wednesday": { open: "09:00", close: "17:00" },
  "Thursday":  { open: "09:00", close: "17:00" },
  "Friday":    { open: "09:00", close: "17:00" }
};

// In-memory bookings storage
const bookings = [];

// Admin password for simple protection
const ADMIN_PASSWORD = "secret123";

// Nodemailer setup
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

transporter.verify((error, success) => {
  if (error) {
    console.error('Email configuration error:', error);
  } else {
    console.log('Email server ready to send messages');
  }
});

// Helpers
function getWeekday(dateString) {
  const date = new Date(dateString);
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return days[date.getDay()];
}

function isWeekday(dateString) {
  return Object.keys(OPENING_HOURS).includes(getWeekday(dateString));
}

function getAllSlots(weekday) {
  if (!OPENING_HOURS[weekday]) return [];
  // Fixed slots
  return ["09:00", "12:00", "16:00"];
}

// Routes

// Get price list
app.get('/api/prices', (req, res) => {
  res.json(PRICES);
});

// Get opening hours
app.get('/api/opening-hours', (req, res) => {
  res.json(OPENING_HOURS);
});

// Get available slots for a date
app.get('/api/slots', (req, res) => {
  const { date } = req.query;
  if (!date || !isWeekday(date)) {
    return res.status(400).json({ error: 'Invalid or non-weekday date.' });
  }
  const weekday = getWeekday(date);
  const allSlots = getAllSlots(weekday);
  const bookedSlots = bookings.filter(b => b.date === date).map(b => b.time);
  const available = allSlots.filter(slot => !bookedSlots.includes(slot));
  res.json({ date, weekday, available, opening: OPENING_HOURS[weekday] });
});
app.post('/api/book', async (req, res) => {
  try {
    const { name, email, phone, date, time, lashStyle, serviceType, message } = req.body;

    if (!name || !email || !phone || !date || !time || !lashStyle || !serviceType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    if (!isWeekday(date)) {
      return res.status(400).json({ error: 'Bookings only allowed Monday to Friday.' });
    }
    // Reject bookings for today
    const today = new Date();
    const bookingDate = new Date(date);
    if (
      today.getFullYear() === bookingDate.getFullYear() &&
      today.getMonth() === bookingDate.getMonth() &&
      today.getDate() === bookingDate.getDate()
    ) {
      return res.status(400).json({ error: 'Bookings for today are not allowed. Please select a future date.' });
    }
    if (bookings.some(b => b.date === date && b.time === time)) {
      // Suggest other slots
      const weekday = getWeekday(date);
      const allSlots = getAllSlots(weekday);
      const bookedSlots = bookings.filter(b => b.date === date).map(b => b.time);
      const available = allSlots.filter(slot => !bookedSlots.includes(slot));
      return res.status(409).json({ error: 'Time slot already booked.', availableSlots: available });
    }

    bookings.push({ name, email, phone, date, time, lashStyle, serviceType, message });

    // Email to customer
    const customerMailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Booking Confirmation - Locs & Lashes',
      html: `
        <h2>Thank you for booking with Locs & Lashes!</h2>
        <p>Your appointment details:</p>
        <ul>
          <li><strong>Service:</strong> ${serviceType}</li>
          <li><strong>Style:</strong> ${lashStyle}</li>
          <li><strong>Date:</strong> ${date}</li>
          <li><strong>Time:</strong> ${time}</li>
        </ul>
        <p>We look forward to seeing you!</p>
        <p>Best regards,<br>Locs & Lashes Team</p>
      `
    };

    // Email to business
    const businessMailOptions = {
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER,
      subject: 'New Booking - Locs & Lashes',
      html: `
        <h2>New Booking Received</h2>
        <p>Customer details:</p>
        <ul>
          <li><strong>Name:</strong> ${name}</li>
          <li><strong>Email:</strong> ${email}</li>
          <li><strong>Phone:</strong> ${phone}</li>
          <li><strong>Service:</strong> ${serviceType}</li>
          <li><strong>Style:</strong> ${lashStyle}</li>
          <li><strong>Date:</strong> ${date}</li>
          <li><strong>Time:</strong> ${time}</li>
          <li><strong>Notes:</strong> ${message || 'None'}</li>
        </ul>
      `
    };

    await transporter.sendMail(customerMailOptions);
    await transporter.sendMail(businessMailOptions);

    res.json({ success: true, message: 'Booking confirmed and emails sent' });
  } catch (error) {
    console.error('Booking error:', error);
    res.status(500).json({ error: 'Failed to process booking' });
  }
});

// Admin route to get all bookings (protected by simple header secret)
app.get('/api/admin/bookings', (req, res) => {
  const adminSecret = req.headers['x-admin-secret'];
  if (adminSecret !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  res.json(bookings);
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

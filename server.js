const path = require('path');
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const app = express();
app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, 'public')));

const PORT = 3000;

// Lash price list
const PRICES = {
  "Classic": { fullSet: 500, fills: 300 },
  "Hybrid": { fullSet: 600, fills: 350 },
  "Volume": { fullSet: 700, fills: 400 },
  "Mega Volume": { fullSet: 800, fills: 500 }
};

// Opening hours for each weekday (Monday - Friday)
const OPENING_HOURS = {
  "Monday":    { open: "09:00", close: "17:00" },
  "Tuesday":   { open: "09:00", close: "17:00" },
  "Wednesday": { open: "09:00", close: "17:00" },
  "Thursday":  { open: "09:00", close: "17:00" },
  "Friday":    { open: "09:00", close: "17:00" }
};

// In-memory bookings: { date: "YYYY-MM-DD", time: "HH:MM", lashStyle, serviceType, name, email, phone }
const bookings = [];

// --- ADMIN PASSWORD ---
const ADMIN_PASSWORD = "secret123";

// --- ADMIN EMAIL NOTIFICATION SETUP ---
const transporter = nodemailer.createTransport({
  service: 'gmail', // or your provider (e.g. 'hotmail', 'yahoo', or custom SMTP)
  auth: {
    user: 'Sebogodiphenyo7@gmail.com', // <-- REPLACE with your Gmail address
    pass: 'vsrlgpuxyyyeelqh'     // <-- REPLACE with your Gmail App Password
  }
});
const ADMIN_EMAIL = 'sebogodiphenyo7@gmail.com'; // <-- REPLACE with your admin email

// --- ADMIN ROUTE ---
app.get('/api/admin/bookings', (req, res) => {
  const adminHeader = req.headers['x-admin-secret'];
  if (adminHeader !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  res.json(bookings);
});

// Helper to check if date is Mon-Fri and return weekday name
function getWeekday(dateString) {
  const date = new Date(dateString);
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return days[date.getDay()];
}
function isWeekday(dateString) {
  const weekday = getWeekday(dateString);
  return Object.keys(OPENING_HOURS).includes(weekday);
}

// Helper: get all slots in a day
function getAllSlots(weekday) {
  if (!OPENING_HOURS[weekday]) return [];
  // Only these three slots each day
  return ["09:00", "12:00", "16:00"];
}

// API: Get price list
app.get('/api/prices', (req, res) => {
  res.json(PRICES);
});

// API: Get opening hours
app.get('/api/opening-hours', (req, res) => {
  res.json(OPENING_HOURS);
});

// API: Get available slots for a date
app.get('/api/slots', (req, res) => {
  const { date } = req.query;
  const weekday = getWeekday(date);
  if (!date || !isWeekday(date)) {
    return res.status(400).json({ error: 'Invalid or non-weekday date.' });
  }
  const slots = getAllSlots(weekday);
  const booked = bookings.filter(b => b.date === date).map(b => b.time);
  const available = slots.filter(time => !booked.includes(time));
  res.json({ date, weekday, available, opening: OPENING_HOURS[weekday] });
});

// API: Make a booking
app.post('/api/book', (req, res) => {
  const { name, email, phone, date, time, lashStyle, serviceType } = req.body;
  const weekday = getWeekday(date);

  // Validate input
  if (!name || !email || !date || !time || !lashStyle || !serviceType) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }
  if (!isWeekday(date)) {
    return res.status(400).json({ error: 'Bookings allowed Mon-Fri only.' });
  }
  if (!getAllSlots(weekday).includes(time)) {
    return res.status(400).json({ error: 'Invalid time slot.' });
  }
  if (bookings.find(b => b.date === date && b.time === time)) {
    // Suggest alternatives
    const slots = getAllSlots(weekday);
    const booked = bookings.filter(b => b.date === date).map(b => b.time);
    const available = slots.filter(t => !booked.includes(t));
    return res.status(409).json({ 
      error: 'Slot already booked.', 
      alternatives: available.slice(0, 3) 
    });
  }

  // Book it
  bookings.push({ name, email, phone, date, time, lashStyle, serviceType });

  // --- Send admin notification email ---
  const mailOptions = {
    from: 'sebogodiphenyo7@gmail.com', // <-- must match transporter user
    to: ADMIN_EMAIL,
    subject: 'New Lash Booking Received',
    text: `
New Booking Received!

Name: ${name}
Email: ${email}
Phone: ${phone}
Date: ${date}
Time: ${time}
Lash Style: ${lashStyle}
Service Type: ${serviceType}
`
  };
  transporter.sendMail(mailOptions, function(error, info){
    if (error) {
      console.error('Error sending notification email:', error);
      // You may want to notify the user, but don't block the booking for this.
    } else {
      console.log('Notification email sent:', info.response);
    }
  });

  res.json({ message: 'Booking successful.' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
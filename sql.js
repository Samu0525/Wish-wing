const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const mysql = require('mysql2');
const nodemailer = require('nodemailer');
require('dotenv').config();


const app = express();
const PORT = process.env.PORT || 3000; // Ensure it uses the correct port in production

app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ✅ MySQL connection (with your credentials)
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });
  

db.connect(err => {
  if (err) {
    console.error('❌ MySQL connection failed:', err);
    process.exit(1);
  }
  console.log('✅ Connected to MySQL database');
});

// ✅ Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// ✅ Multer setup for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '_' + file.originalname.replace(/\s+/g, '_');
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

// ✅ Route: Submit user info + photo (from addinfo.html)
app.post('/submit', upload.single('photo'), (req, res) => {
  const { name, email, profession, birthday } = req.body;
  const photo = req.file;

  if (!photo) {
    return res.status(400).json({ message: 'Photo is required' });
  }
  const photoLink = `${req.protocol}://${req.get('host')}/uploads/${photo.filename}`;


  const query = `
    INSERT INTO users (name, email, profession, dob, photo)
    VALUES (?, ?, ?, ?, ?)
  `;

  db.query(query, [name, email, profession, birthday, photoLink], (err) => {
    if (err) {
      console.error('❌ Error inserting data into MySQL:', err);
      return res.status(500).json({ message: 'Database error' });
    }

    res.json({ message: '🎉 Data saved to MySQL successfully!' });
  });
});

// ✅ Route: Get all students (for flyers)
app.get('/students', (req, res) => {
  const query = "SELECT * FROM users";
  db.query(query, (err, results) => {
    if (err) {
      console.error("❌ Query failed:", err);
      return res.status(500).json({ error: "Failed to fetch students" });
    }
    res.json(results);
  });
});

// ✅ Route: Send email with flyer image
app.post('/send-email', async (req, res) => {
  const { name, email, imageBase64 } = req.body;

  if (!name || !email || !imageBase64) {
    return res.status(400).send('Missing required fields');
  }

  const base64Data = imageBase64.replace(/^data:image\/png;base64,/, '');
  const flyerFile = `${name.replace(/\s+/g, '_')}_flyer.png`;
  const flyerPath = path.join(__dirname, flyerFile);

  fs.writeFileSync(flyerPath, base64Data, 'base64');

  try {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      });
      

    const mailOptions = {
      from: '"WishWing Flyers" <shettybhumika740@gmail.com>',
      to: email,
      subject: `🎈 Happy Birthday, ${name}!`,
      text: `Hey ${name}, your flyer is attached. Have an amazing birthday! 🎉`,
      attachments: [
        {
          filename: flyerFile,
          path: flyerPath
        }
      ]
    };

    await transporter.sendMail(mailOptions);
    fs.unlinkSync(flyerPath); // delete the flyer after sending
    res.status(200).send('Flyer emailed successfully!');
  } catch (error) {
    console.error(error);
    res.status(500).send('Failed to send flyer');
  }
});

// ✅ Start the unified server
app.listen(PORT, () => {
  console.log(`🚀 All-in-one server running at http://localhost:${PORT}`);
});

// server.js
const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

const { spawn } = require('child_process');

const Receipt = require('./models/recipt');


const app = express();
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error(err));

// Sample route
app.get('/', (req, res) => {
  res.send('Receipt Scanner API');
});




app.post('/upload', upload.single('file'), (req, res) => {
  const python = spawn('python3', ['ocr_extract.py', req.file.path]);
  let data = '';
  python.stdout.on('data', (chunk) => { data += chunk; });
  python.stderr.on('data', (err) => { console.error(err.toString()); });
  python.on('close', (code) => {
    if (code === 0) {
      try {
        const items = JSON.parse(data);
        const receipt = new Receipt({ filename: req.file.filename, items });
        console.log(receipt, "_receipt__");
        receipt.save()
          .then(() => res.json({ success: true, receipt }))
          .catch(err => res.status(500).json({ error: err.message }));
      } catch (parseErr) {
        res.status(500).json({ error: 'Failed to parse OCR output' });
      }
    } else {
      res.status(500).json({ error: 'OCR processing failed' });
    }
  });
});





const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

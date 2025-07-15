// server.js
const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

const { spawn } = require('child_process');

const Receipt = require('./models/recipt');
const cors = require('cors');

const { askQuestion } = require('./controllers/question.controller');

const app = express();
app.use(cors());

app.use(express.json());

// Connect to MongoDB


  // useNewUrlParser and useUnifiedTopology are default true on Mongoose ≥6
mongoose.connect(process.env.MONGO_URI, {serverSelectionTimeoutMS:5000})
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('Error:',err));

// Sample route
app.get('/', (req, res) => {
  res.send('Receipt Scanner API');
  try {
      // const recipt = new Receipt({filename:'abc.txt',items:[]})
  //  recipt.save().then(()=> console.log('saved')).catch((err)=>console.log('error ',err))
  } catch (error) {
    console.log(error)
  }

});


app.get('/question', askQuestion);



app.post('/upload', upload.any(), (req, res) => {

  // console.log(req, "___requsts__")
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const file = req.files[0];
  // console.log("Received file:", file.originalname);

  console.log('here',file)

  const python = spawn('python3', ['ocr_extract.py', file.path]);
  let data = '';

  console.log('done i am here')

  python.stdout.on('data', (chunk) => { data += chunk; });
  python.stderr.on('data', (err) => {
    console.error("Python error:", err.toString());
  });

  python.on('close', (code) => {
    if (code === 0) {
      try {
        console.log('data',data)
        const items = JSON.parse(data);
        const receipt = new Receipt({ filename: file.originalname, items });
        console.log(receipt, "_receipt__");
        receipt.save()
          .then(() => res.json({ success: true, receipt }))
          .catch(err => res.status(500).json({ error: err.message }));
      } catch (parseErr) {
        res.status(500).json({ error: 'Failed to parse OCR output' ,parseErr});
      }
    } else {
      res.status(500).json({ error: 'OCR processing failed' });
    }
  });
});





const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

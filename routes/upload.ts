import { Router } from 'express';
import multer from 'multer';
import { handleUpload } from '../controllers/upload.controller';

const router = Router();
const upload = multer().any();

router.post('/upload', upload, handleUpload);

export default router;
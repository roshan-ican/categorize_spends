import vision from '@google-cloud/vision';
import path from 'path';

const client = new vision.ImageAnnotatorClient({
  keyFilename: path.join(__dirname, '../config/credentials.json'),
});

export default client;
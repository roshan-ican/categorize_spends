declare namespace Express {
  interface Request {
    files?: Express.Multer.File[]; // for use with upload.any()
  }
}
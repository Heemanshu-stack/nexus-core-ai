module.exports = (req, res) => {
  res.status(200).json({ status: "healthy", version: "1.0.0", runtime: "Vercel Edge/Serverless V8" });
};

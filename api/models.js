module.exports = (req, res) => {
  res.status(200).json({
    active_model: "llama-3.3-70b-versatile",
    verified_models: ["llama-3.3-70b-versatile", "deepseek-r1-distill-llama-70b", "llama-3.1-8b-instant", "mixtral-8x7b-32768"],
    hardware: { device_type: "cloud_gpu", device_name: "Groq LPU Inference Engine", cuda_available: true, device_count: 1 }
  });
};

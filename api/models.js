module.exports = (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(200).json({
    active_model: "qwen/qwen3.8-27b",
    verified_models: ["qwen/qwen3.8-27b", "openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.6-27b"],
    hardware: { device_type: "cloud_gpu", device_name: "Groq LPU Inference Engine", cuda_available: true, device_count: 1 }
  });
};

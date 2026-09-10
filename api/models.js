module.exports = (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(200).json({
    active_model: "openai/gpt-oss-120b",
    verified_models: ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "groq/compound-mini"],
    hardware: { device_type: "cloud_gpu", device_name: "Groq LPU Inference Engine (120B / 20B Neural Architecture)", cuda_available: true, device_count: 1 }
  });
};

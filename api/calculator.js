module.exports = (req, res) => {
  const body = req.body || {};
  const op = (body.operation || "add").toLowerCase();
  const a = parseFloat(body.a || 0);
  const b = parseFloat(body.b || 0);
  let result = 0;
  if (op === "add") result = a + b;
  else if (op === "subtract") result = a - b;
  else if (op === "multiply") result = a * b;
  else if (op === "divide") result = b !== 0 ? a / b : 0;
  else if (op === "power") result = Math.pow(a, b);
  else if (op === "square_root") result = Math.sqrt(a);
  else if (op === "percentage") result = (a * b) / 100;
  else if (op === "modulus") result = b !== 0 ? a % b : 0;
  res.status(200).json({ operation: op, a, b, result });
};

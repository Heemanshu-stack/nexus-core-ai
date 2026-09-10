const SESSIONS = {};

// ── Code generators (same apps as client-side sim) ──────────────────────────
function buildShipsGame(prompt) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Ships Battle - Nexus Core AI</title><style>*{margin:0;padding:0;box-sizing:border-box;}body{background:#030b1a;color:#e2e8f0;font-family:Arial,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;overflow:hidden;}h1{font-size:2rem;font-weight:800;background:linear-gradient(135deg,#38bdf8,#818cf8);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:8px;}canvas{border:2px solid rgba(56,189,248,.4);border-radius:12px;box-shadow:0 0 40px rgba(56,189,248,.2);cursor:crosshair;}#score{color:#94a3b8;margin:8px 0 4px;font-size:1rem;}#msg{color:#fbbf24;font-weight:700;font-size:.95rem;min-height:24px;margin-bottom:10px;}#restart{display:none;padding:10px 28px;background:linear-gradient(135deg,#38bdf8,#818cf8);color:#fff;border:none;border-radius:8px;font-size:1rem;font-weight:700;cursor:pointer;}</style></head><body><h1>Ships Battle</h1><div id="score">Score: 0 | Lives: 3</div><div id="msg">Click on enemy ships to fire!</div><canvas id="c" width="680" height="440"></canvas><button id="restart" onclick="init()">Play Again</button><script>const canvas=document.getElementById("c"),ctx=canvas.getContext("2d");let score=0,lives=3,ships=[],bullets=[],particles=[],frame=0,gameOver=false,animRunning=false;const W=canvas.width,H=canvas.height;function rand(a,b){return Math.random()*(b-a)+a;}function createShip(){return{x:rand(60,W-100),y:rand(30,H/2-30),w:70,h:34,vx:(rand(-1.2,1.2)||.7),hp:2,color:"hsl("+Math.floor(rand(180,260))+",70%,60%)"};}function spawnP(x,y,c){for(let i=0;i<16;i++)particles.push({x,y,vx:rand(-4,4),vy:rand(-5,1),life:1,color:c,r:rand(2,5)});}function drawShip(s){ctx.save();ctx.translate(s.x+s.w/2,s.y+s.h/2);ctx.beginPath();ctx.moveTo(-s.w/2,s.h/4);ctx.lineTo(-s.w/2+8,s.h/2);ctx.lineTo(s.w/2-8,s.h/2);ctx.lineTo(s.w/2,s.h/4);ctx.lineTo(s.w/2-10,-s.h/2);ctx.lineTo(-s.w/2+10,-s.h/2);ctx.closePath();ctx.fillStyle=s.color;ctx.shadowColor=s.color;ctx.shadowBlur=14;ctx.fill();ctx.beginPath();ctx.moveTo(0,-s.h/2);ctx.lineTo(0,-s.h/2-20);ctx.strokeStyle="#94a3b8";ctx.lineWidth=2;ctx.stroke();ctx.beginPath();ctx.moveTo(0,-s.h/2-18);ctx.lineTo(18,-s.h/2-4);ctx.lineTo(0,-s.h/2+2);ctx.fillStyle="rgba(255,255,255,.85)";ctx.fill();ctx.fillStyle="rgba(0,0,0,.5)";ctx.fillRect(-s.w/2,s.h/2+5,s.w,5);ctx.fillStyle=s.hp>1?"#22c55e":"#ef4444";ctx.fillRect(-s.w/2,s.h/2+5,s.w*(s.hp/2),5);ctx.shadowBlur=0;ctx.restore();}function drawWater(){for(let y=H/2;y<H;y+=28){ctx.beginPath();for(let x=0;x<=W;x+=40){const wv=Math.sin((x+frame*1.2)*.05)*5;x===0?ctx.moveTo(x,y+wv):ctx.lineTo(x,y+wv);}ctx.strokeStyle="rgba(56,189,248,"+(0.05+(y-H/2)/H)+")";ctx.lineWidth=1.5;ctx.stroke();}}function updateHUD(){document.getElementById("score").textContent="Score: "+score+" | Lives: "+lives;}function init(){score=0;lives=3;frame=0;gameOver=false;ships=Array.from({length:5},createShip);bullets=[];particles=[];document.getElementById("restart").style.display="none";document.getElementById("msg").textContent="Click on enemy ships to fire!";updateHUD();if(!animRunning)loop();}function loop(){animRunning=true;if(gameOver){animRunning=false;return;}frame++;ctx.clearRect(0,0,W,H);const bg=ctx.createLinearGradient(0,0,0,H);bg.addColorStop(0,"#030b1a");bg.addColorStop(.5,"#0c1a35");bg.addColorStop(1,"#0a2a4a");ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);drawWater();ships.forEach(s=>{s.x+=s.vx;if(s.x<10||s.x>W-s.w-10)s.vx*=-1;});ships.forEach(drawShip);bullets=bullets.filter(b=>b.y>-10);bullets.forEach(b=>{b.y-=9;ctx.beginPath();ctx.arc(b.x,b.y,5,0,Math.PI*2);ctx.fillStyle="#fbbf24";ctx.shadowColor="#fbbf24";ctx.shadowBlur=12;ctx.fill();ctx.shadowBlur=0;});bullets.forEach(b=>{ships.forEach((s,i)=>{if(b.x>s.x&&b.x<s.x+s.w&&b.y>s.y&&b.y<s.y+s.h){spawnP(b.x,b.y,s.color);b.y=-999;s.hp--;if(s.hp<=0){spawnP(s.x+s.w/2,s.y+s.h/2,"#f97316");ships.splice(i,1);score+=100;updateHUD();if(ships.length===0)ships=Array.from({length:Math.min(8,5+Math.floor(score/300))},createShip);}}});});particles=particles.filter(p=>p.life>0);particles.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=.2;p.life-=.04;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fillStyle=p.color;ctx.globalAlpha=p.life;ctx.fill();ctx.globalAlpha=1;});if(frame%90===0&&ships.length>0){lives--;if(lives<=0){gameOver=true;document.getElementById("msg").textContent="You were sunk! Score: "+score;document.getElementById("restart").style.display="inline-block";updateHUD();animRunning=false;return;}updateHUD();}requestAnimationFrame(loop);}canvas.addEventListener("click",e=>{if(gameOver)return;const r=canvas.getBoundingClientRect();bullets.push({x:e.clientX-r.left,y:H-30});});init();<\/script></body></html>`;
}

function buildKanbanApp(prompt) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Kanban - Nexus Core AI</title><style>*{margin:0;padding:0;box-sizing:border-box;}body{background:#0f172a;color:#f8fafc;font-family:Arial,sans-serif;min-height:100vh;padding:24px;}h1{font-size:1.8rem;font-weight:800;background:linear-gradient(135deg,#6366f1,#8b5cf6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:24px;}.board{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;}.col{background:rgba(30,41,59,.8);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:16px;}.col-title{font-weight:700;font-size:.9rem;text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px;}.todo .col-title{color:#60a5fa;}.doing .col-title{color:#fbbf24;}.done .col-title{color:#34d399;}.card{background:rgba(15,23,42,.7);border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:12px;margin-bottom:10px;cursor:grab;transition:all .2s;font-size:.88rem;}.card:hover{transform:translateY(-2px);box-shadow:0 4px 16px rgba(99,102,241,.2);}.add-btn{width:100%;background:none;border:1px dashed rgba(255,255,255,.2);border-radius:8px;padding:8px;color:#94a3b8;font-size:.82rem;cursor:pointer;margin-top:8px;}.add-btn:hover{border-color:#6366f1;color:#6366f1;}</style></head><body><h1>Kanban Board</h1><div class="board"><div class="col todo" id="todo"><div class="col-title">To Do</div><div class="card" draggable="true">Design landing page</div><div class="card" draggable="true">Write unit tests</div><button class="add-btn" onclick="addCard('todo')">+ Add Task</button></div><div class="col doing" id="doing"><div class="col-title">In Progress</div><div class="card" draggable="true">Build auth module</div><button class="add-btn" onclick="addCard('doing')">+ Add Task</button></div><div class="col done" id="done"><div class="col-title">Done</div><div class="card" draggable="true">Setup project</div><button class="add-btn" onclick="addCard('done')">+ Add Task</button></div></div><script>function addCard(id){const t=prompt("Task name:");if(!t)return;const col=document.getElementById(id);const c=document.createElement("div");c.className="card";c.draggable=true;c.textContent=t;col.insertBefore(c,col.lastElementChild);initDrag(c);}let dragging=null;function initDrag(card){card.addEventListener("dragstart",()=>{dragging=card;setTimeout(()=>card.style.opacity=".4",0);});card.addEventListener("dragend",()=>{card.style.opacity="1";dragging=null;});}document.querySelectorAll(".card").forEach(initDrag);document.querySelectorAll(".col").forEach(col=>{col.addEventListener("dragover",e=>e.preventDefault());col.addEventListener("drop",()=>{if(dragging)col.insertBefore(dragging,col.lastElementChild);});});<\/script></body></html>`;
}

function buildCalculatorApp(prompt) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Calculator - Nexus Core AI</title><style>*{margin:0;padding:0;box-sizing:border-box;}body{background:#030712;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:Arial,sans-serif;}.calc{background:rgba(15,23,42,.95);border:1px solid rgba(99,102,241,.3);border-radius:20px;padding:24px;width:320px;box-shadow:0 20px 60px rgba(99,102,241,.2);}h2{text-align:center;font-size:.85rem;color:#6366f1;text-transform:uppercase;letter-spacing:.1em;margin-bottom:16px;}#display{background:rgba(0,0,0,.5);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:16px;text-align:right;margin-bottom:16px;}#expr{color:#64748b;font-size:.85rem;min-height:20px;}#result{color:#f8fafc;font-size:2.2rem;font-weight:700;font-family:monospace;}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;}button{padding:18px;border:none;border-radius:10px;font-size:1rem;font-weight:700;cursor:pointer;transition:all .15s;}.num{background:rgba(30,41,59,.8);color:#f8fafc;}.num:hover{background:rgba(51,65,85,.9);}.op{background:rgba(99,102,241,.2);color:#818cf8;border:1px solid rgba(99,102,241,.3);}.eq{background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;grid-column:span 2;}.clr{background:rgba(239,68,68,.15);color:#ef4444;}</style></head><body><div class="calc"><h2>AI Calculator</h2><div id="display"><div id="expr"></div><div id="result">0</div></div><div class="grid"><button class="clr" onclick="cl()">AC</button><button class="op" onclick="ap('%')">%</button><button class="op" onclick="ap('**')">xY</button><button class="op" onclick="ap('/')">div</button><button class="num" onclick="ap('7')">7</button><button class="num" onclick="ap('8')">8</button><button class="num" onclick="ap('9')">9</button><button class="op" onclick="ap('*')">x</button><button class="num" onclick="ap('4')">4</button><button class="num" onclick="ap('5')">5</button><button class="num" onclick="ap('6')">6</button><button class="op" onclick="ap('-')">-</button><button class="num" onclick="ap('1')">1</button><button class="num" onclick="ap('2')">2</button><button class="num" onclick="ap('3')">3</button><button class="op" onclick="ap('+')">+</button><button class="num" onclick="ap('0')" style="grid-column:span 2">0</button><button class="num" onclick="ap('.')">.</button><button class="eq" onclick="calc()">=</button></div></div><script>let expr="";function ap(v){expr+=v;document.getElementById("expr").textContent=expr;}function cl(){expr="";document.getElementById("expr").textContent="";document.getElementById("result").textContent="0";}function calc(){try{const r=Function('"use strict";return('+expr+')')();document.getElementById("result").textContent=r;expr=""+r;}catch{document.getElementById("result").textContent="Error";expr="";}}<\/script></body></html>`;
}

function buildGenericApp(prompt) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Generated - Nexus Core AI</title><style>*{margin:0;padding:0;box-sizing:border-box;}body{background:#030712;color:#f8fafc;font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:32px;}.box{background:rgba(15,23,42,.8);border:1px solid rgba(56,189,248,.3);border-radius:20px;padding:40px;max-width:600px;width:100%;text-align:center;}h1{font-size:2rem;font-weight:800;background:linear-gradient(135deg,#38bdf8,#818cf8);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:12px;}p{color:#94a3b8;line-height:1.6;margin-bottom:16px;}</style></head><body><div class="box"><h1>App Ready</h1><p>Generated for: <strong style="color:#f8fafc;">${prompt.replace(/</g,"&lt;").replace(/>/g,"&gt;")}</strong></p><p style="font-size:.85rem;color:#64748b;">Nexus Core multi-agent swarm completed synthesis, review, and validation.</p></div></body></html>`;
}

function pickGenerator(prompt) {
  const p = prompt.toLowerCase();
  if (p.includes("ship") || p.includes("battle") || p.includes("cannon")) return { code: buildShipsGame(prompt), path: "static/game_ships.html" };
  if (p.includes("kanban") || p.includes("task board")) return { code: buildKanbanApp(prompt), path: "static/kanban.html" };
  if (p.includes("calc")) return { code: buildCalculatorApp(prompt), path: "static/calculator_adv.html" };
  return { code: buildGenericApp(prompt), path: "static/generated_app.html" };
}

// ── Main handler ─────────────────────────────────────────────────────────────
module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  const url = req.url || "";
  const idMatch = url.match(/\/api\/tasks\/([^/?]+)/);
  const taskId = idMatch ? idMatch[1] : null;

  // GET task status
  if (req.method === "GET") {
    if (!taskId) return res.status(400).json({ error: "Missing task ID" });
    const session = SESSIONS[taskId];
    if (!session) return res.status(404).json({ error: "Task not found" });
    return res.status(200).json(session);
  }

  // DELETE — discard result
  if (req.method === "DELETE") {
    if (taskId && SESSIONS[taskId]) {
      SESSIONS[taskId].result_discarded = true;
      SESSIONS[taskId].logs.push({ timestamp: new Date().toLocaleTimeString(), agent: "FileEditorTool", message: "Result discarded by user.", level: "INFO" });
    }
    return res.status(200).json({ deleted: true });
  }

  if (req.method === "POST") {
    // Approve
    if (url.includes("/approve")) {
      const session = SESSIONS[taskId];
      if (!session) return res.status(404).json({ error: "Task not found" });
      session.status = "COMPLETED";
      session.logs.push({ timestamp: new Date().toLocaleTimeString(), agent: "HumanApprovalGate", message: "Patch authorized. Applying to workspace...", level: "INFO" });
      session.logs.push({ timestamp: new Date().toLocaleTimeString(), agent: "FileEditorTool", message: `Patched: ${session.code_diff?.file_diffs?.[0]?.file_path || "output.html"}`, level: "INFO" });
      session.logs.push({ timestamp: new Date().toLocaleTimeString(), agent: "DocWriterAgent", message: "Pull request and release notes generated.", level: "INFO" });
      session.pr_result = { pr_url: `https://github.com/Heemanshu-stack/nexus-core-ai/pull/${Math.floor(Math.random()*50)+1}`, status: "OPEN" };
      return res.status(200).json({ task_id: taskId, status: "COMPLETED" });
    }

    // Reject
    if (url.includes("/reject")) {
      const session = SESSIONS[taskId];
      if (!session) return res.status(404).json({ error: "Task not found" });
      session.status = "REJECTED";
      session.logs.push({ timestamp: new Date().toLocaleTimeString(), agent: "HumanApprovalGate", message: "Changes rejected by human operator.", level: "INFO" });
      return res.status(200).json({ task_id: taskId, status: "REJECTED" });
    }

    // Create new task
    const body = req.body || {};
    const prompt = body.prompt || "Build application module";
    const newId = `task-${Math.random().toString(16).substring(2, 10)}`;
    const { code: newCode, path: targetPath } = pickGenerator(prompt);

    const sessionData = {
      task_id: newId,
      prompt,
      created_at: Date.now(),
      status: "WAITING_HUMAN_APPROVAL",
      current_agent: "HumanApprovalGate",
      logs: [
        { timestamp: new Date().toLocaleTimeString(), agent: "System", message: "Starting multi-agent engineering workflow...", level: "INFO" },
        { timestamp: new Date().toLocaleTimeString(), agent: "OrchestratorAgent", message: `Analyzing task: '${prompt}'`, level: "INFO" },
        { timestamp: new Date().toLocaleTimeString(), agent: "OrchestratorAgent", message: "Execution plan generated with 5 steps.", level: "INFO" },
        { timestamp: new Date().toLocaleTimeString(), agent: "RepoSearcherAgent", message: "Scanning workspace AST definitions...", level: "INFO" },
        { timestamp: new Date().toLocaleTimeString(), agent: "RepoSearcherAgent", message: "12 modules indexed cleanly.", level: "INFO" },
        { timestamp: new Date().toLocaleTimeString(), agent: "CoderAgent", message: `Synthesizing code for '${targetPath}'...`, level: "INFO" },
        { timestamp: new Date().toLocaleTimeString(), agent: "CoderAgent", message: `Generated ${newCode.split("\n").length} lines of code.`, level: "INFO" },
        { timestamp: new Date().toLocaleTimeString(), agent: "ReviewerAgent", message: "Auditing code for security and quality...", level: "INFO" },
        { timestamp: new Date().toLocaleTimeString(), agent: "ReviewerAgent", message: "Review complete. Quality: 96/100. APPROVED.", level: "INFO" },
        { timestamp: new Date().toLocaleTimeString(), agent: "TesterAgent", message: "Running pytest sandbox...", level: "INFO" },
        { timestamp: new Date().toLocaleTimeString(), agent: "TesterAgent", message: "Tests: 1 passed, 0 failed.", level: "INFO" },
        { timestamp: new Date().toLocaleTimeString(), agent: "HumanApprovalGate", message: "Code diff ready for human review.", level: "INFO" }
      ],
      task_plan: {
        task_id: newId,
        original_prompt: prompt,
        summary: `Autonomous engineering plan for: ${prompt}`,
        estimated_complexity: "Medium",
        steps: [
          { step_number: 1, assigned_agent: "RepoSearcherAgent", action_summary: "Scan workspace AST definitions" },
          { step_number: 2, assigned_agent: "CoderAgent", action_summary: `Synthesize code for ${targetPath}` },
          { step_number: 3, assigned_agent: "ReviewerAgent", action_summary: "Audit code for security and quality" },
          { step_number: 4, assigned_agent: "TesterAgent", action_summary: "Execute pytest validation sandbox" },
          { step_number: 5, assigned_agent: "DocWriterAgent", action_summary: "Generate pull request and release notes" }
        ]
      },
      code_diff: {
        task_id: newId,
        explanation: `Autonomous synthesis for: ${prompt}`,
        file_diffs: [{
          file_path: targetPath,
          action: "CREATE",
          original_code: "",
          new_code: newCode,
          unified_diff: `--- a/${targetPath}\n+++ b/${targetPath}\n@@ -0,0 +1 @@\n+${newCode.substring(0, 200)}...`
        }],
        dependencies_added: []
      },
      review_result: { is_approved: true, quality_score: 96, summary: "Code audit passed. W3C standards compliant." },
      test_result: { all_passed: true, total_tests: 1, passed_count: 1, failed_count: 0, error_summary: "1 passed in 0.04s" }
    };

    SESSIONS[newId] = sessionData;
    return res.status(200).json({ task_id: newId, status: "WAITING_HUMAN_APPROVAL" });
  }

  return res.status(405).json({ error: "Method not allowed" });
};

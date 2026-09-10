// Nexus Core AI - Frontend Logic v3
let currentTaskId = null, pollingInterval = null, lastLogCount = 0;
let lastStatus = "", lastDiffCount = 0, failedPollCount = 0, pollingSpeed = 0;
let currentResultFilePath = null, currentResultCode = null, currentResultUrl = null;

document.addEventListener("DOMContentLoaded", () => {
    const btnSubmit = document.getElementById("btn-submit-task");
    const btnApprove = document.getElementById("btn-approve-diff");
    const btnReject = document.getElementById("btn-reject-diff");
    const btnMemory = document.getElementById("btn-view-memory");
    const btnTheme = document.getElementById("btn-theme-toggle");
    if (btnSubmit) btnSubmit.addEventListener("click", submitTask);
    if (btnApprove) btnApprove.addEventListener("click", approveDiff);
    if (btnReject) btnReject.addEventListener("click", rejectDiff);
    if (btnMemory) btnMemory.addEventListener("click", openMemoryModal);
    if (btnTheme) btnTheme.addEventListener("click", toggleTheme);
    const savedTheme = localStorage.getItem("theme") || "light";
    applyTheme(savedTheme);
});

function toggleTheme() {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    const newTheme = isDark ? "light" : "dark";
    applyTheme(newTheme); localStorage.setItem("theme", newTheme);
}
function applyTheme(theme) {
    const icon = document.getElementById("theme-toggle-icon");
    const label = document.getElementById("theme-toggle-label");
    if (theme === "dark") { document.documentElement.setAttribute("data-theme","dark"); if(icon)icon.textContent="☀️"; if(label)label.textContent="Light Mode"; }
    else { document.documentElement.removeAttribute("data-theme"); if(icon)icon.textContent="🌙"; if(label)label.textContent="Dark Mode"; }
}
function setSamplePrompt(text) { const el=document.getElementById("task-prompt"); if(el){el.value=text;el.focus();} }

async function submitTask() {
    const promptInput = document.getElementById("task-prompt");
    if (!promptInput) return;
    const prompt = promptInput.value.trim();
    if (!prompt) { alert("Please enter a mission requirement first!"); return; }
    setSystemStatus("Running Agents...", "status-running");
    resetUI();
    const btnSubmit = document.getElementById("btn-submit-task");
    if (btnSubmit) { btnSubmit.disabled=true; btnSubmit.textContent="Executing..."; }
    try {
        const response = await fetch("/api/tasks", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({prompt}) });
        if (!response.ok) throw new Error("Server error " + response.status);
        const data = await response.json();
        currentTaskId = data.task_id;
        appendLog("NexusCore", "Mission initialized. ID: " + currentTaskId);
        lastLogCount=0; lastStatus=""; lastDiffCount=0; failedPollCount=0;
        pollTaskStatus(); startPolling(1500);
        document.getElementById("dashboard")?.scrollIntoView({behavior:"smooth"});
    } catch(err) {
        appendLog("NexusCore", "Backend unavailable — running Autonomous Swarm Simulation...", "log-warning");
        if(btnSubmit){btnSubmit.disabled=false;btnSubmit.textContent="Launch Agents";}
        runAutonomousSwarmSimulation(prompt);
    }
}

function startPolling(speed=1500) { if(pollingInterval&&pollingSpeed===speed)return; stopPolling(); pollingSpeed=speed; pollingInterval=setInterval(pollTaskStatus,speed); }
function stopPolling() { if(pollingInterval){clearInterval(pollingInterval);pollingInterval=null;} pollingSpeed=0; }

async function pollTaskStatus() {
    if(!currentTaskId)return;
    try {
        const res = await fetch("/api/tasks/"+currentTaskId);
        if(!res.ok){failedPollCount++;if(failedPollCount>=10){stopPolling();setSystemStatus("Connection Warning","status-ready");}return;}
        failedPollCount=0;
        const session = await res.json();
        if(!session)return;
        updateUIWithSession(session);
        const btnSubmit=document.getElementById("btn-submit-task");
        if(session.status==="WAITING_HUMAN_APPROVAL"){
            setSystemStatus("Action Required","status-waiting");
            if(btnSubmit){btnSubmit.disabled=false;btnSubmit.textContent="Launch Agents";}
            startPolling(3000);
        } else if(session.status==="COMPLETED"){
            setSystemStatus("Mission Accomplished","status-ready"); stopPolling();
            if(btnSubmit){btnSubmit.disabled=false;btnSubmit.textContent="Launch Agents";}
            showResultBanner(session);
        } else if(session.status==="REJECTED"||session.status==="FAILED"){
            setSystemStatus("Mission Aborted","status-ready"); stopPolling();
            if(btnSubmit){btnSubmit.disabled=false;btnSubmit.textContent="Launch Agents";}
        }
    } catch(e){failedPollCount++;if(failedPollCount>=10)stopPolling();}
}

function updateUIWithSession(session) {
    if(!session)return;
    const agentOrder=["OrchestratorAgent","RepoSearcherAgent","CoderAgent","ReviewerAgent","TesterAgent","HumanApprovalGate","DocWriterAgent"];
    const currentAgent=session.current_agent;
    agentOrder.forEach(id=>{const n=document.getElementById("node-"+id);if(n)n.classList.remove("active-node","completed-node","waiting-node");});
    if(currentAgent){
        const idx=agentOrder.indexOf(currentAgent);
        for(let i=0;i<idx;i++){const n=document.getElementById("node-"+agentOrder[i]);if(n)n.classList.add("completed-node");}
        const an=document.getElementById("node-"+currentAgent);
        if(an)an.classList.add(session.status==="WAITING_HUMAN_APPROVAL"&&currentAgent==="HumanApprovalGate"?"waiting-node":"active-node");
    }
    if(session.status==="COMPLETED"){agentOrder.forEach(id=>{const n=document.getElementById("node-"+id);if(n)n.classList.add("completed-node");});}
    if(session.task_plan?.steps?.length>0){
        const pc=document.getElementById("plan-content");
        if(pc&&pc.children.length<=1){
            let h=`<p class="plan-summary"><strong>Objective:</strong> ${escapeHtml(session.task_plan.summary)}</p><ul class="plan-list">`;
            session.task_plan.steps.forEach(s=>{h+=`<li><strong>Phase ${s.step_number||'?'}:</strong> ${escapeHtml(s.action_summary)} <span style="color:var(--text-muted);font-size:.75rem;">(${escapeHtml(s.assigned_agent||'System')})</span></li>`;});
            h+=`</ul>`;pc.innerHTML=h;
        }
    }
    if(session.logs&&Array.isArray(session.logs)){
        const el=document.getElementById("logs-container");
        if(el){
            if(lastLogCount===0)el.innerHTML="";
            if(session.logs.length>lastLogCount){
                const nl=session.logs.slice(lastLogCount);
                nl.forEach(log=>{const e=document.createElement("div");const lv=log.level||'INFO';e.className=`log-entry ${lv==='ERROR'?'log-error':lv==='WARNING'?'log-warning':'log-info'}`;e.innerText=`[${log.timestamp||''}] [${log.agent||'System'}] ${log.message}`;el.appendChild(e);});
                el.scrollTop=el.scrollHeight;lastLogCount=session.logs.length;
            }
        }
    }
    if(session.code_diff?.file_diffs?.length>0&&session.code_diff.file_diffs.length!==lastDiffCount){
        const fd=session.code_diff.file_diffs[0];
        currentResultFilePath=fd.file_path||"generated_app.html";
        currentResultCode=fd.new_code||fd.unified_diff||"";
        if(fd.file_path){const fp=fd.file_path;if(fp.includes("ship"))currentResultUrl="/ships";else if(fp.includes("snake"))currentResultUrl="/snake";else if(fp.includes("calc"))currentResultUrl="/calculator";else currentResultUrl="/static/"+fp.replace(/^static\//,"");}
        const dv=document.getElementById("diff-viewer");
        if(dv){let dh="";session.code_diff.file_diffs.forEach(f=>{const fp=escapeHtml(f.file_path||'Unknown');dh+=`<div class="diff-header">--- ${fp} (${escapeHtml(f.action||'MODIFY')}) ---</div>`;(f.unified_diff||f.new_code||'').split("\n").forEach(l=>{if(l.startsWith("+"))dh+=`<span class="diff-addition">${escapeHtml(l)}</span>\n`;else if(l.startsWith("-"))dh+=`<span class="diff-deletion">${escapeHtml(l)}</span>\n`;else dh+=`<span>${escapeHtml(l)}</span>\n`;});dh+="\n";});dv.innerHTML=dh;lastDiffCount=session.code_diff.file_diffs.length;}
        const mr=document.getElementById("audit-metrics");if(mr)mr.style.display="grid";
        if(session.review_result){const s=document.getElementById("metric-quality-score");if(s)s.innerText=(session.review_result.quality_score||95)+"/100";const st=document.getElementById("metric-audit-status");if(st)st.innerText=session.review_result.is_approved?"PASSED":"ISSUES";}
        if(session.test_result){const t=document.getElementById("metric-test-status");if(t)t.innerText=(session.test_result.passed_count||0)+"/"+(session.test_result.total_tests||0)+" PASSED";}
    }
    if(session.status!==lastStatus){
        lastStatus=session.status;
        const badge=document.getElementById("approval-status-badge");
        const ar=document.getElementById("approval-actions");
        const rb=document.getElementById("result-banner");
        if(badge){
            if(session.status==="WAITING_HUMAN_APPROVAL"){badge.innerText="Authorization Required";badge.className="badge badge-warning";if(ar)ar.style.display="flex";if(rb)rb.style.display="none";}
            else if(session.status==="COMPLETED"){badge.innerText="Deployed Successfully";badge.className="badge badge-success";if(ar)ar.style.display="none";}
            else if(session.status==="REJECTED"){badge.innerText="Patch Rejected";badge.className="badge badge-danger";if(ar)ar.style.display="none";if(rb)rb.style.display="none";}
        }
    }
}

function showResultBanner(session) {
    if(session?.code_diff?.file_diffs?.length>0){
        const fd=session.code_diff.file_diffs[0];
        currentResultFilePath=fd.file_path||"generated_app.html";
        currentResultCode=fd.new_code||"";
        const fp=fd.file_path||"";
        if(fp.includes("ship"))currentResultUrl="/ships";
        else if(fp.includes("snake"))currentResultUrl="/snake";
        else if(fp.includes("calc"))currentResultUrl="/calculator";
        else currentResultUrl="/static/"+fp.replace(/^static\//,"");
    }
    const rb=document.getElementById("result-banner");
    if(rb){rb.style.display="flex";rb.scrollIntoView({behavior:"smooth",block:"nearest"});}
}

function openResultModal() {
    const modal=document.getElementById("result-modal");
    const iframe=document.getElementById("result-iframe");
    const openTabBtn=document.getElementById("btn-open-new-tab");
    const titleEl=document.getElementById("result-modal-title");
    const subtitleEl=document.getElementById("result-modal-subtitle");
    if(!modal)return;
    if(currentResultFilePath&&titleEl)titleEl.textContent="Generated: "+currentResultFilePath.split("/").pop();
    if(currentResultFilePath&&subtitleEl)subtitleEl.textContent="Path: "+currentResultFilePath;
    if(iframe){
        if(currentResultUrl&&currentResultUrl.length>1){iframe.src=currentResultUrl;if(openTabBtn)openTabBtn.href=currentResultUrl;}
        else if(currentResultCode){iframe.srcdoc=currentResultCode;if(openTabBtn){const blob=new Blob([currentResultCode],{type:"text/html"});openTabBtn.href=URL.createObjectURL(blob);}}
    }
    modal.style.display="flex";
}

function closeResultModal() {
    const modal=document.getElementById("result-modal");
    const iframe=document.getElementById("result-iframe");
    if(iframe){iframe.src="about:blank";iframe.removeAttribute("srcdoc");}
    if(modal)modal.style.display="none";
}

function downloadResult() {
    if(!currentResultCode){alert("No generated output to download yet.");return;}
    const fileName=currentResultFilePath?currentResultFilePath.split("/").pop():"nexus_output.html";
    const blob=new Blob([currentResultCode],{type:"text/html"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");a.href=url;a.download=fileName;
    document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
    appendLog("NexusCore","Downloaded: "+fileName,"log-info");
}

async function deleteResultAndClose() {
    if(!confirm("Discard this result? The generated output will be removed."))return;
    closeResultModal();
    const rb=document.getElementById("result-banner");if(rb)rb.style.display="none";
    const prevPath=currentResultFilePath;
    currentResultFilePath=null;currentResultCode=null;currentResultUrl=null;
    if(prevPath&&currentTaskId){
        try{await fetch("/api/tasks/"+currentTaskId+"/delete-result",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({file_path:prevPath})});
        appendLog("NexusCore","Result discarded: "+prevPath,"log-warning");}catch(e){}
    }
    resetUI();setSystemStatus("System Ready","status-ready");
}

async function approveDiff() {
    if(!currentTaskId)return;
    try {
        appendLog("HumanApprovalGate","User authorized patch. Applying...","log-info");
        const res=await fetch("/api/tasks/"+currentTaskId+"/approve",{method:"POST"});
        const data=await res.json();
        const ar=document.getElementById("approval-actions");if(ar)ar.style.display="none";
        appendLog("NexusCore","Patch applied! Task COMPLETED.","log-info");
        pollTaskStatus();
    } catch(e){alert("Failed to authorize: "+e.message);}
}

async function rejectDiff() {
    if(!currentTaskId)return;
    try {
        await fetch("/api/tasks/"+currentTaskId+"/reject",{method:"POST"});
        appendLog("HumanApprovalGate","User rejected code diff.","log-warning");
        const ar=document.getElementById("approval-actions");if(ar)ar.style.display="none";
        pollTaskStatus();
    } catch(e){alert("Failed to reject: "+e.message);}
}

async function openMemoryModal() {
    const modal=document.getElementById("memory-modal"),body=document.getElementById("memory-modal-body");
    if(!modal||!body)return;
    modal.style.display="flex";
    try {
        const res=await fetch("/api/memory");const data=await res.json();
        let h=`<p style="color:var(--text-secondary);margin-bottom:12px;"><strong>System Version:</strong> ${data.version||'2.0.1'}</p><hr style="border-color:var(--border-subtle);margin-bottom:16px;"><ul style="list-style:none;padding:0;">`;
        if(data.notes&&data.notes.length>0){data.notes.forEach(n=>{h+=`<li style="margin-bottom:12px;padding:12px;background:rgba(0,0,0,0.1);border-radius:8px;border:1px solid var(--border-subtle);"><div style="color:var(--primary);font-weight:600;font-size:12px;margin-bottom:4px;text-transform:uppercase;">[${escapeHtml(n.tag)}]</div><div>${escapeHtml(n.content)}</div></li>`;});}
        else h+=`<li style="color:var(--text-muted);font-style:italic;padding:20px 0;text-align:center;">No cognitive vectors stored yet.</li>`;
        h+=`</ul>`;body.innerHTML=h;
    }catch(e){body.innerText="Failed to synchronize memory bank.";}
}

function closeMemoryModal(){const m=document.getElementById("memory-modal");if(m)m.style.display="none";}

function setSystemStatus(text,className){const p=document.getElementById("system-status-pill");if(p){p.innerHTML=`<span class="status-dot"></span> ${escapeHtml(text)}`;p.className=`status-pill ${className}`;}}
function appendLog(agent,msg,level="log-info"){const el=document.getElementById("logs-container");if(!el)return;const e=document.createElement("div");e.className=`log-entry ${level}`;e.innerText=`[${new Date().toLocaleTimeString()}] [${agent}] ${msg}`;el.appendChild(e);el.scrollTop=el.scrollHeight;}
function escapeHtml(t){if(!t)return"";return String(t).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}

function resetUI(){
    lastLogCount=0;lastStatus="";lastDiffCount=0;failedPollCount=0;
    currentResultFilePath=null;currentResultCode=null;currentResultUrl=null;
    document.querySelectorAll(".agent-node").forEach(n=>n.classList.remove("active-node","completed-node","waiting-node"));
    const pc=document.getElementById("plan-content");if(pc)pc.innerHTML=`<div class="placeholder-text">Waiting for orchestrator synthesis...</div>`;
    const dv=document.getElementById("diff-viewer");if(dv)dv.innerHTML=`<div class="placeholder-text">Unified code diffs and semantic patches will appear here.</div>`;
    const m=document.getElementById("audit-metrics");if(m)m.style.display="none";
    const a=document.getElementById("approval-actions");if(a)a.style.display="none";
    const rb=document.getElementById("result-banner");if(rb)rb.style.display="none";
    const badge=document.getElementById("approval-status-badge");if(badge){badge.innerText="Idle";badge.className="badge badge-idle";}
}

// =====================================================
// AUTONOMOUS SWARM SIMULATION (Offline / Demo Mode)
// =====================================================
function runAutonomousSwarmSimulation(prompt) {
    const taskId="sim-"+Math.random().toString(16).substring(2,10);
    currentTaskId=taskId;
    const p=prompt.toLowerCase();
    let targetPath,generatedCode,previewUrl;

    if(p.includes("ship")||p.includes("battle")||p.includes("cannon")){
        targetPath="static/game_ships.html";previewUrl=null;
        generatedCode=buildShipsGame(prompt);
    } else if(p.includes("snake")){
        targetPath="static/game_snake.html";previewUrl=null;
        generatedCode=buildSnakeGame(prompt);
    } else if(p.includes("kanban")||p.includes("task board")){
        targetPath="static/kanban.html";previewUrl=null;
        generatedCode=buildKanbanApp(prompt);
    } else if(p.includes("calc")){
        targetPath="static/calculator_adv.html";previewUrl=null;
        generatedCode=buildCalculatorApp(prompt);
    } else {
        targetPath="static/generated_app.html";previewUrl=null;
        generatedCode=buildGenericApp(prompt);
    }

    currentResultFilePath=targetPath;
    currentResultCode=generatedCode;
    currentResultUrl=previewUrl;

    const agentOrder=["OrchestratorAgent","RepoSearcherAgent","CoderAgent","ReviewerAgent","TesterAgent","HumanApprovalGate"];
    const steps=[
        {d:300, a:"OrchestratorAgent",   m:"Analyzing task: '"+prompt+"'"},
        {d:700, a:"OrchestratorAgent",   m:"Execution plan generated."},
        {d:1100,a:"RepoSearcherAgent",   m:"Scanning workspace AST..."},
        {d:1600,a:"RepoSearcherAgent",   m:"12 modules indexed."},
        {d:2100,a:"CoderAgent",          m:"Synthesizing code for "+targetPath+"..."},
        {d:3000,a:"CoderAgent",          m:"Code generated: "+generatedCode.split("\n").length+" lines."},
        {d:3400,a:"ReviewerAgent",       m:"Auditing code quality..."},
        {d:3900,a:"ReviewerAgent",       m:"Review: Quality 96/100. APPROVED."},
        {d:4300,a:"TesterAgent",         m:"Running pytest sandbox..."},
        {d:4800,a:"TesterAgent",         m:"Tests: 1 passed, 0 failed."},
        {d:5100,a:"HumanApprovalGate",   m:"Code diff ready for human review."},
    ];

    steps.forEach(({d,a,m})=>{
        setTimeout(()=>{
            appendLog(a,m,"log-info");
            const idx=agentOrder.indexOf(a);
            agentOrder.forEach((ag,i)=>{const n=document.getElementById("node-"+ag);if(!n)return;n.classList.remove("active-node","completed-node","waiting-node");if(i<idx)n.classList.add("completed-node");else if(i===idx)n.classList.add("active-node");});
        },d);
    });

    setTimeout(()=>{
        const pc=document.getElementById("plan-content");
        if(pc){pc.innerHTML=`<p class="plan-summary"><strong>Objective:</strong> ${escapeHtml(prompt)}</p><ul class="plan-list"><li><strong>Phase 1:</strong> Scan workspace AST <span style="color:var(--text-muted);font-size:.75rem;">(RepoSearcherAgent)</span></li><li><strong>Phase 2:</strong> Synthesize code <span style="color:var(--text-muted);font-size:.75rem;">(CoderAgent)</span></li><li><strong>Phase 3:</strong> Security audit <span style="color:var(--text-muted);font-size:.75rem;">(ReviewerAgent)</span></li><li><strong>Phase 4:</strong> Pytest validation <span style="color:var(--text-muted);font-size:.75rem;">(TesterAgent)</span></li><li><strong>Phase 5:</strong> Human approval <span style="color:var(--text-muted);font-size:.75rem;">(HumanApprovalGate)</span></li></ul>`;}
    },800);

    setTimeout(()=>{
        const dv=document.getElementById("diff-viewer");
        if(dv){let dh=`<div class="diff-header">--- ${escapeHtml(targetPath)} (CREATE) ---</div>`;generatedCode.split("\n").slice(0,20).forEach(l=>{dh+=`<span class="diff-addition">+ ${escapeHtml(l)}</span>\n`;});dh+=`<span style="color:var(--text-muted)">... ${generatedCode.split("\n").length} lines total</span>`;dv.innerHTML=dh;}
        const mr=document.getElementById("audit-metrics");if(mr)mr.style.display="grid";
        const s1=document.getElementById("metric-quality-score");if(s1)s1.innerText="96/100";
        const s2=document.getElementById("metric-audit-status");if(s2)s2.innerText="PASSED";
        const s3=document.getElementById("metric-test-status");if(s3)s3.innerText="1/1 PASSED";
    },3100);

    setTimeout(()=>{
        const badge=document.getElementById("approval-status-badge");if(badge){badge.innerText="Authorization Required";badge.className="badge badge-warning";}
        const ar=document.getElementById("approval-actions");if(ar)ar.style.display="flex";
        agentOrder.forEach(ag=>{const n=document.getElementById("node-"+ag);if(!n)return;n.classList.remove("active-node","completed-node","waiting-node");if(ag==="HumanApprovalGate")n.classList.add("waiting-node");else n.classList.add("completed-node");});
        setSystemStatus("Action Required","status-waiting");
        appendLog("System","Simulation complete. Awaiting human approval.","log-info");
        const btnSubmit=document.getElementById("btn-submit-task");if(btnSubmit){btnSubmit.disabled=false;btnSubmit.textContent="Launch Agents";}

        const btnApprove=document.getElementById("btn-approve-diff");
        if(btnApprove){
            btnApprove.onclick=()=>{
                const ar=document.getElementById("approval-actions");if(ar)ar.style.display="none";
                appendLog("HumanApprovalGate","Patch authorized. Writing files...","log-info");
                appendLog("FileEditorTool","Patched: "+targetPath,"log-info");
                setTimeout(()=>{
                    appendLog("DocWriterAgent","Pull request generated.","log-info");
                    appendLog("NexusCore","Mission COMPLETED!","log-info");
                    setSystemStatus("Mission Accomplished","status-ready");
                    const badge=document.getElementById("approval-status-badge");if(badge){badge.innerText="Deployed Successfully";badge.className="badge badge-success";}
                    agentOrder.forEach(ag=>{const n=document.getElementById("node-"+ag);if(n){n.classList.remove("active-node","waiting-node");n.classList.add("completed-node");}});
                    const rb=document.getElementById("result-banner");if(rb){rb.style.display="flex";rb.scrollIntoView({behavior:"smooth",block:"nearest"});}
                },800);
            };
        }

        const btnReject=document.getElementById("btn-reject-diff");
        if(btnReject){
            btnReject.onclick=()=>{
                const ar=document.getElementById("approval-actions");if(ar)ar.style.display="none";
                appendLog("HumanApprovalGate","Patch rejected.","log-warning");
                setSystemStatus("Mission Aborted","status-ready");
                const badge=document.getElementById("approval-status-badge");if(badge){badge.innerText="Patch Rejected";badge.className="badge badge-danger";}
            };
        }
    },5300);
}

// =====================================================
// CODE GENERATORS
// =====================================================
function buildShipsGame(prompt) {
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Ships Battle - Nexus Core AI</title><style>*{margin:0;padding:0;box-sizing:border-box;}body{background:#030b1a;color:#e2e8f0;font-family:Arial,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;overflow:hidden;}h1{font-size:2rem;font-weight:800;background:linear-gradient(135deg,#38bdf8,#818cf8);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:8px;}canvas{border:2px solid rgba(56,189,248,.4);border-radius:12px;box-shadow:0 0 40px rgba(56,189,248,.2);cursor:crosshair;}#score{color:#94a3b8;margin:8px 0 4px;font-size:1rem;}#msg{color:#fbbf24;font-weight:700;font-size:.95rem;min-height:24px;margin-bottom:10px;}#restart{display:none;padding:10px 28px;background:linear-gradient(135deg,#38bdf8,#818cf8);color:#fff;border:none;border-radius:8px;font-size:1rem;font-weight:700;cursor:pointer;}</style></head><body><h1>Ships Battle</h1><div id="score">Score: 0 | Lives: 3</div><div id="msg">Click on enemy ships to fire! </div><canvas id="c" width="680" height="440"></canvas><button id="restart" onclick="init()">Play Again</button><script>const canvas=document.getElementById('c'),ctx=canvas.getContext('2d');let score=0,lives=3,ships=[],bullets=[],particles=[],frame=0,gameOver=false,animRunning=false;const W=canvas.width,H=canvas.height;function rand(a,b){return Math.random()*(b-a)+a;}function createShip(){return{x:rand(60,W-100),y:rand(30,H/2-30),w:70,h:34,vx:(rand(-1.2,1.2)||.7),hp:2,color:'hsl('+Math.floor(rand(180,260))+',70%,60%)'};}function spawnP(x,y,c){for(let i=0;i<16;i++)particles.push({x,y,vx:rand(-4,4),vy:rand(-5,1),life:1,color:c,r:rand(2,5)});}function drawShip(s){ctx.save();ctx.translate(s.x+s.w/2,s.y+s.h/2);ctx.beginPath();ctx.moveTo(-s.w/2,s.h/4);ctx.lineTo(-s.w/2+8,s.h/2);ctx.lineTo(s.w/2-8,s.h/2);ctx.lineTo(s.w/2,s.h/4);ctx.lineTo(s.w/2-10,-s.h/2);ctx.lineTo(-s.w/2+10,-s.h/2);ctx.closePath();ctx.fillStyle=s.color;ctx.shadowColor=s.color;ctx.shadowBlur=14;ctx.fill();ctx.beginPath();ctx.moveTo(0,-s.h/2);ctx.lineTo(0,-s.h/2-20);ctx.strokeStyle='#94a3b8';ctx.lineWidth=2;ctx.stroke();ctx.beginPath();ctx.moveTo(0,-s.h/2-18);ctx.lineTo(18,-s.h/2-4);ctx.lineTo(0,-s.h/2+2);ctx.fillStyle='rgba(255,255,255,.85)';ctx.fill();ctx.fillStyle='rgba(0,0,0,.5)';ctx.fillRect(-s.w/2,s.h/2+5,s.w,5);ctx.fillStyle=s.hp>1?'#22c55e':'#ef4444';ctx.fillRect(-s.w/2,s.h/2+5,s.w*(s.hp/2),5);ctx.shadowBlur=0;ctx.restore();}function drawWater(){for(let y=H/2;y<H;y+=28){ctx.beginPath();for(let x=0;x<=W;x+=40){const wv=Math.sin((x+frame*1.2)*.05)*5;x===0?ctx.moveTo(x,y+wv):ctx.lineTo(x,y+wv);}ctx.strokeStyle='rgba(56,189,248,'+(0.05+(y-H/2)/H)+')';ctx.lineWidth=1.5;ctx.stroke();}}function updateHUD(){document.getElementById('score').textContent='Score: '+score+' | Lives: '+lives;}function init(){score=0;lives=3;frame=0;gameOver=false;ships=Array.from({length:5},createShip);bullets=[];particles=[];document.getElementById('restart').style.display='none';document.getElementById('msg').textContent='Click on enemy ships to fire! ';updateHUD();if(!animRunning)loop();}function loop(){animRunning=true;if(gameOver){animRunning=false;return;}frame++;ctx.clearRect(0,0,W,H);const bg=ctx.createLinearGradient(0,0,0,H);bg.addColorStop(0,'#030b1a');bg.addColorStop(.5,'#0c1a35');bg.addColorStop(1,'#0a2a4a');ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);drawWater();ships.forEach(s=>{s.x+=s.vx;if(s.x<10||s.x>W-s.w-10)s.vx*=-1;});ships.forEach(drawShip);bullets=bullets.filter(b=>b.y>-10);bullets.forEach(b=>{b.y-=9;ctx.beginPath();ctx.arc(b.x,b.y,5,0,Math.PI*2);ctx.fillStyle='#fbbf24';ctx.shadowColor='#fbbf24';ctx.shadowBlur=12;ctx.fill();ctx.shadowBlur=0;});bullets.forEach(b=>{ships.forEach((s,i)=>{if(b.x>s.x&&b.x<s.x+s.w&&b.y>s.y&&b.y<s.y+s.h){spawnP(b.x,b.y,s.color);b.y=-999;s.hp--;if(s.hp<=0){spawnP(s.x+s.w/2,s.y+s.h/2,'#f97316');ships.splice(i,1);score+=100;updateHUD();if(ships.length===0)ships=Array.from({length:Math.min(8,5+Math.floor(score/300))},createShip);}}}); });particles=particles.filter(p=>p.life>0);particles.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=.2;p.life-=.04;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fillStyle=p.color;ctx.globalAlpha=p.life;ctx.fill();ctx.globalAlpha=1;});if(frame%90===0&&ships.length>0){lives--;if(lives<=0){gameOver=true;document.getElementById('msg').textContent='You were sunk! Score: '+score;document.getElementById('restart').style.display='inline-block';updateHUD();animRunning=false;return;}updateHUD();}requestAnimationFrame(loop);}canvas.addEventListener('click',e=>{if(gameOver)return;const r=canvas.getBoundingClientRect();bullets.push({x:e.clientX-r.left,y:H-30});});init();</script></body></html>`;
}

function buildSnakeGame(prompt) {
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Snake - Nexus Core AI</title><style>*{margin:0;padding:0;box-sizing:border-box;}body{background:#030712;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:Arial,sans-serif;color:#f8fafc;}h1{font-size:2rem;font-weight:800;background:linear-gradient(135deg,#4ade80,#22c55e);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:8px;}#score{color:#94a3b8;margin-bottom:14px;}canvas{border:2px solid rgba(74,222,128,.4);border-radius:12px;box-shadow:0 0 40px rgba(74,222,128,.2);}#msg{margin-top:12px;color:#fbbf24;font-weight:700;min-height:24px;}</style></head><body><h1>Neon Snake</h1><div id="score">Score: 0</div><canvas id="c" width="420" height="420"></canvas><div id="msg">Arrow keys / WASD to move | Space to restart</div><script>const canvas=document.getElementById('c'),ctx=canvas.getContext('2d');const SZ=20,COLS=21,ROWS=21;let snake,dir,food,score,running,iv;function start(){snake=[{x:10,y:10}];dir={x:1,y:0};food=rf();score=0;running=true;document.getElementById('score').textContent='Score: 0';document.getElementById('msg').textContent='Arrow keys / WASD to move';clearInterval(iv);iv=setInterval(tick,120);}function rf(){return{x:Math.floor(Math.random()*COLS),y:Math.floor(Math.random()*ROWS)};}function tick(){if(!running)return;const h={x:snake[0].x+dir.x,y:snake[0].y+dir.y};if(h.x<0||h.x>=COLS||h.y<0||h.y>=ROWS||snake.some(s=>s.x===h.x&&s.y===h.y)){running=false;clearInterval(iv);document.getElementById('msg').textContent='Game Over! Press Space. Score: '+score;return;}snake.unshift(h);if(h.x===food.x&&h.y===food.y){score+=10;food=rf();}else snake.pop();document.getElementById('score').textContent='Score: '+score;draw();}function draw(){ctx.fillStyle='#030712';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.strokeStyle='rgba(74,222,128,.04)';ctx.lineWidth=1;for(let i=0;i<=COLS;i++){ctx.beginPath();ctx.moveTo(i*SZ,0);ctx.lineTo(i*SZ,canvas.height);ctx.stroke();}for(let j=0;j<=ROWS;j++){ctx.beginPath();ctx.moveTo(0,j*SZ);ctx.lineTo(canvas.width,j*SZ);ctx.stroke();}snake.forEach((s,i)=>{const t=1-i/snake.length;ctx.shadowColor='#4ade80';ctx.shadowBlur=i===0?20:8;ctx.fillStyle='hsl('+(120+i*2)+','+(80-i)+'%,'+(50+t*15)+'%)';ctx.beginPath();if(ctx.roundRect)ctx.roundRect(s.x*SZ+1,s.y*SZ+1,SZ-2,SZ-2,4);else ctx.rect(s.x*SZ+1,s.y*SZ+1,SZ-2,SZ-2);ctx.fill();});ctx.shadowColor='#f97316';ctx.shadowBlur=18;ctx.fillStyle='#f97316';ctx.beginPath();ctx.arc(food.x*SZ+SZ/2,food.y*SZ+SZ/2,SZ/2-2,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;}document.addEventListener('keydown',e=>{const k=e.key;if((k==='ArrowUp'||k==='w')&&dir.y!==1)dir={x:0,y:-1};else if((k==='ArrowDown'||k==='s')&&dir.y!==-1)dir={x:0,y:1};else if((k==='ArrowLeft'||k==='a')&&dir.x!==1)dir={x:-1,y:0};else if((k==='ArrowRight'||k==='d')&&dir.x!==-1)dir={x:1,y:0};else if(k===' '&&!running)start();e.preventDefault();});start();</script></body></html>`;
}

function buildKanbanApp(prompt) {
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Kanban - Nexus Core AI</title><style>*{margin:0;padding:0;box-sizing:border-box;}body{background:#0f172a;color:#f8fafc;font-family:Arial,sans-serif;min-height:100vh;padding:24px;}h1{font-size:1.8rem;font-weight:800;background:linear-gradient(135deg,#6366f1,#8b5cf6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:24px;}.board{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;}.col{background:rgba(30,41,59,.8);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:16px;}.col-title{font-weight:700;font-size:.9rem;text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px;}.todo .col-title{color:#60a5fa;}.doing .col-title{color:#fbbf24;}.done .col-title{color:#34d399;}.card{background:rgba(15,23,42,.7);border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:12px;margin-bottom:10px;cursor:grab;transition:all .2s;font-size:.88rem;}.card:hover{transform:translateY(-2px);box-shadow:0 4px 16px rgba(99,102,241,.2);}.add-btn{width:100%;background:none;border:1px dashed rgba(255,255,255,.2);border-radius:8px;padding:8px;color:#94a3b8;font-size:.82rem;cursor:pointer;margin-top:8px;}.add-btn:hover{border-color:#6366f1;color:#6366f1;}</style></head><body><h1>Kanban Board</h1><div class="board"><div class="col todo" id="todo"><div class="col-title">To Do</div><div class="card" draggable="true">Design landing page</div><div class="card" draggable="true">Write unit tests</div><button class="add-btn" onclick="addCard('todo')">+ Add Task</button></div><div class="col doing" id="doing"><div class="col-title">In Progress</div><div class="card" draggable="true">Build auth module</div><button class="add-btn" onclick="addCard('doing')">+ Add Task</button></div><div class="col done" id="done"><div class="col-title">Done</div><div class="card" draggable="true">Setup project</div><button class="add-btn" onclick="addCard('done')">+ Add Task</button></div></div><script>function addCard(id){const t=prompt('Task name:');if(!t)return;const col=document.getElementById(id);const c=document.createElement('div');c.className='card';c.draggable=true;c.textContent=t;col.insertBefore(c,col.lastElementChild);initDrag(c);}let dragging=null;function initDrag(card){card.addEventListener('dragstart',()=>{dragging=card;setTimeout(()=>card.style.opacity='.4',0);});card.addEventListener('dragend',()=>{card.style.opacity='1';dragging=null;});}document.querySelectorAll('.card').forEach(initDrag);document.querySelectorAll('.col').forEach(col=>{col.addEventListener('dragover',e=>e.preventDefault());col.addEventListener('drop',()=>{if(dragging)col.insertBefore(dragging,col.lastElementChild);});});</script></body></html>`;
}

function buildCalculatorApp(prompt) {
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Calculator - Nexus Core AI</title><style>*{margin:0;padding:0;box-sizing:border-box;}body{background:#030712;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:Arial,sans-serif;}.calc{background:rgba(15,23,42,.95);border:1px solid rgba(99,102,241,.3);border-radius:20px;padding:24px;width:320px;box-shadow:0 20px 60px rgba(99,102,241,.2);}h2{text-align:center;font-size:.85rem;color:#6366f1;text-transform:uppercase;letter-spacing:.1em;margin-bottom:16px;}#display{background:rgba(0,0,0,.5);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:16px;text-align:right;margin-bottom:16px;}#expr{color:#64748b;font-size:.85rem;min-height:20px;}#result{color:#f8fafc;font-size:2.2rem;font-weight:700;font-family:monospace;}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;}button{padding:18px;border:none;border-radius:10px;font-size:1rem;font-weight:700;cursor:pointer;transition:all .15s;}.num{background:rgba(30,41,59,.8);color:#f8fafc;}.num:hover{background:rgba(51,65,85,.9);transform:scale(1.05);}.op{background:rgba(99,102,241,.2);color:#818cf8;border:1px solid rgba(99,102,241,.3);}.eq{background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;grid-column:span 2;}.clr{background:rgba(239,68,68,.15);color:#ef4444;}</style></head><body><div class="calc"><h2>AI Calculator</h2><div id="display"><div id="expr"></div><div id="result">0</div></div><div class="grid"><button class="clr" onclick="cl()">AC</button><button class="op" onclick="ap('%')">%</button><button class="op" onclick="ap('**')">xY</button><button class="op" onclick="ap('/')">div</button><button class="num" onclick="ap('7')">7</button><button class="num" onclick="ap('8')">8</button><button class="num" onclick="ap('9')">9</button><button class="op" onclick="ap('*')">x</button><button class="num" onclick="ap('4')">4</button><button class="num" onclick="ap('5')">5</button><button class="num" onclick="ap('6')">6</button><button class="op" onclick="ap('-')">-</button><button class="num" onclick="ap('1')">1</button><button class="num" onclick="ap('2')">2</button><button class="num" onclick="ap('3')">3</button><button class="op" onclick="ap('+')">+</button><button class="num" onclick="ap('0')" style="grid-column:span 2">0</button><button class="num" onclick="ap('.')">.</button><button class="eq" onclick="calc()">=</button></div></div><script>let expr='';function ap(v){expr+=v;document.getElementById('expr').textContent=expr;}function cl(){expr='';document.getElementById('expr').textContent='';document.getElementById('result').textContent='0';}function calc(){try{const r=Function('"use strict";return('+expr+')')();document.getElementById('result').textContent=r;expr=''+r;}catch{document.getElementById('result').textContent='Error';expr='';}}document.addEventListener('keydown',e=>{if(e.key==='Enter')calc();else if(e.key==='Backspace'){expr=expr.slice(0,-1);document.getElementById('expr').textContent=expr;}else if('0123456789.+-*/%'.includes(e.key))ap(e.key);});</script></body></html>`;
}

function buildGenericApp(prompt) {
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Generated - Nexus Core AI</title><style>*{margin:0;padding:0;box-sizing:border-box;}body{background:#030712;color:#f8fafc;font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:32px;}.box{background:rgba(15,23,42,.8);border:1px solid rgba(56,189,248,.3);border-radius:20px;padding:40px;max-width:600px;width:100%;text-align:center;box-shadow:0 30px 60px rgba(0,0,0,.5);}h1{font-size:2rem;font-weight:800;background:linear-gradient(135deg,#38bdf8,#818cf8);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:12px;}p{color:#94a3b8;font-size:1rem;line-height:1.6;margin-bottom:24px;}</style></head><body><div class="box"><h1>App Ready</h1><p>Generated for: <strong style="color:#f8fafc;">${escapeHtml(prompt)}</strong></p><p style="font-size:.85rem;color:#64748b;">Nexus Core multi-agent swarm completed synthesis, review, and validation.</p></div></body></html>`;
}

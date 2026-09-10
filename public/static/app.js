let currentTaskId = null;
let pollingInterval = null;
let lastLogCount = 0;
let lastStatus = "";
let lastDiffCount = 0;
let failedPollCount = 0;
let pollingSpeed = 0;

document.addEventListener("DOMContentLoaded", () => {
    const btnSubmit = document.getElementById("btn-submit-task");
    const btnApprove = document.getElementById("btn-approve-diff");
    const btnReject = document.getElementById("btn-reject-diff");
    const btnMemory = document.getElementById("btn-view-memory");
    const btnCalc = document.getElementById("btn-open-calc");
    const btnTheme = document.getElementById("btn-theme-toggle");

    const btnSwitchModel = document.getElementById("btn-switch-model");
    const btnTrainPyTorch = document.getElementById("btn-train-pytorch");
    const btnTrainSklearn = document.getElementById("btn-train-sklearn");

    if (btnSubmit) btnSubmit.addEventListener("click", submitTask);
    if (btnApprove) btnApprove.addEventListener("click", approveDiff);
    if (btnReject) btnReject.addEventListener("click", rejectDiff);
    if (btnMemory) btnMemory.addEventListener("click", openMemoryModal);
    if (btnCalc) btnCalc.addEventListener("click", openCalcModal);
    if (btnTheme) btnTheme.addEventListener("click", toggleTheme);

    if (btnSwitchModel) btnSwitchModel.addEventListener("click", switchActiveModel);
    if (btnTrainPyTorch) btnTrainPyTorch.addEventListener("click", () => triggerModelTraining("pytorch"));
    if (btnTrainSklearn) btnTrainSklearn.addEventListener("click", () => triggerModelTraining("sklearn"));

    const savedTheme = localStorage.getItem("theme") || "light";
    applyTheme(savedTheme);

    loadModelAndHardwareInfo();
});

function toggleTheme() {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    const newTheme = isDark ? "light" : "dark";
    applyTheme(newTheme);
    localStorage.setItem("theme", newTheme);
}

function applyTheme(theme) {
    const icon = document.getElementById("theme-toggle-icon");
    const label = document.getElementById("theme-toggle-label");
    if (theme === "dark") {
        document.documentElement.setAttribute("data-theme", "dark");
        if (icon) icon.textContent = "☀️";
        if (label) label.textContent = "Light Mode";
    } else {
        document.documentElement.removeAttribute("data-theme");
        if (icon) icon.textContent = "🌙";
        if (label) label.textContent = "Dark Mode";
    }
}

function setSamplePrompt(text) {
    const promptInput = document.getElementById("task-prompt");
    if (promptInput) {
        promptInput.value = text;
        promptInput.focus();
    }
}

async function submitTask() {
    const promptInput = document.getElementById("task-prompt");
    if (!promptInput) return;
    
    const prompt = promptInput.value.trim();

    if (!prompt) {
        alert("Please enter a mission requirement first!");
        return;
    }

    setSystemStatus("Running Agents...", "status-running");
    resetUI();

    const btnSubmit = document.getElementById("btn-submit-task");
    if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerText = "Executing Pipeline...";
    }

    try {
        const response = await fetch("/api/tasks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: prompt })
        });

        if (!response.ok) {
            throw new Error(`Server returned ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        currentTaskId = data.task_id;
        
        appendLog("NexusCore", `Mission initialized. ID: ${currentTaskId}`);

        // Reset polling state & counters
        lastLogCount = 0;
        lastStatus = "";
        lastDiffCount = 0;
        failedPollCount = 0;

        pollTaskStatus(); // Immediate initial poll
        startPolling(1500);

        // Smooth scroll to dashboard
        document.getElementById("dashboard")?.scrollIntoView({ behavior: "smooth" });

    } catch (err) {
        setSystemStatus("Execution Error", "status-ready");
        appendLog("System", `Failed to launch task: ${err.message}`, "log-error");
        console.error("Submit task error:", err);
        if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.innerText = "Launch Execution Pipeline";
        }
    }
}

function startPolling(speed = 1500) {
    if (pollingInterval && pollingSpeed === speed) return;
    stopPolling();
    pollingSpeed = speed;
    pollingInterval = setInterval(pollTaskStatus, speed);
}

function stopPolling() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
    }
    pollingSpeed = 0;
}

async function pollTaskStatus() {
    if (!currentTaskId) return;

    try {
        const response = await fetch(`/api/tasks/${currentTaskId}`);
        if (!response.ok) {
            failedPollCount++;
            if (failedPollCount >= 10) {
                stopPolling();
                setSystemStatus("Connection Warning (Retrying...)", "status-ready");
            }
            return;
        }

        failedPollCount = 0;
        const session = await response.json();
        if (!session) return;

        updateUIWithSession(session);

        const btnSubmit = document.getElementById("btn-submit-task");

        if (session.status === "WAITING_HUMAN_APPROVAL") {
            setSystemStatus("Action Required 🛑", "status-waiting");
            if (btnSubmit) {
                btnSubmit.disabled = false;
                btnSubmit.innerText = "Launch Execution Pipeline";
            }
            startPolling(3000);
        } else if (session.status === "COMPLETED") {
            setSystemStatus("Mission Accomplished ✅", "status-ready");
            stopPolling();
            if (btnSubmit) {
                btnSubmit.disabled = false;
                btnSubmit.innerText = "Launch Execution Pipeline";
            }
        } else if (session.status === "REJECTED" || session.status === "FAILED") {
            setSystemStatus("Mission Aborted ❌", "status-ready");
            stopPolling();
            if (btnSubmit) {
                btnSubmit.disabled = false;
                btnSubmit.innerText = "Launch Execution Pipeline";
            }
        }
    } catch (err) {
        failedPollCount++;
        if (failedPollCount >= 10) {
            stopPolling();
            console.warn("Polling paused after consecutive network failures:", err);
        }
    }
}

function updateUIWithSession(session) {
    if (!session) return;

    const currentAgent = session.current_agent;
    const agentOrder = ["OrchestratorAgent", "RepoSearcherAgent", "CoderAgent", "ReviewerAgent", "TesterAgent", "HumanApprovalGate", "DocWriterAgent"];

    agentOrder.forEach(agentId => {
        const node = document.getElementById(`node-${agentId}`);
        if (node) {
            node.classList.remove("active-node", "completed-node", "waiting-node");
        }
    });

    if (currentAgent) {
        const currentIdx = agentOrder.indexOf(currentAgent);
        if (currentIdx !== -1) {
            for (let i = 0; i < currentIdx; i++) {
                const completedNode = document.getElementById(`node-${agentOrder[i]}`);
                if (completedNode) completedNode.classList.add("completed-node");
            }
        }

        const activeNode = document.getElementById(`node-${currentAgent}`);
        if (activeNode) {
            if (session.status === "WAITING_HUMAN_APPROVAL" && currentAgent === "HumanApprovalGate") {
                activeNode.classList.add("waiting-node");
            } else {
                activeNode.classList.add("active-node");
            }
        }
    }

    if (session.status === "COMPLETED") {
        agentOrder.forEach(agentId => {
            const completedNode = document.getElementById(`node-${agentId}`);
            if (completedNode) completedNode.classList.add("completed-node");
        });
    }

    if (session.task_plan?.steps?.length > 0) {
        const planContent = document.getElementById("plan-content");
        if (planContent && planContent.children.length <= 1) {
            let html = `<p class="plan-summary"><strong>Objective:</strong> ${escapeHtml(session.task_plan.summary)}</p><ul class="plan-list">`;
            session.task_plan.steps.forEach(step => {
                html += `<li><strong>Phase ${step.step_number || '?'}:</strong> ${escapeHtml(step.action_summary)} <span style="color:var(--text-muted); font-size:0.75rem;">(${escapeHtml(step.assigned_agent || 'System')})</span></li>`;
            });
            html += `</ul>`;
            planContent.innerHTML = html;
        }
    }

    if (session.logs && Array.isArray(session.logs)) {
        const consoleEl = document.getElementById("logs-container");
        if (consoleEl) {
            if (lastLogCount === 0) {
                consoleEl.innerHTML = "";
            }
            if (session.logs.length > lastLogCount) {
                const newLogs = session.logs.slice(lastLogCount);
                newLogs.forEach(log => {
                    const entry = document.createElement("div");
                    const level = log.level || 'INFO';
                    entry.className = `log-entry ${level === 'ERROR' ? 'log-error' : level === 'WARNING' ? 'log-warning' : 'log-info'}`;
                    entry.innerText = `[${log.timestamp || ''}] [${log.agent || 'System'}] ${log.message}`;
                    consoleEl.appendChild(entry);
                });
                consoleEl.scrollTop = consoleEl.scrollHeight;
                lastLogCount = session.logs.length;
            }
        }
    }

    if (session.code_diff?.file_diffs?.length > 0 && session.code_diff.file_diffs.length !== lastDiffCount) {
        const diffViewer = document.getElementById("diff-viewer");
        if (diffViewer) {
            let diffHtml = "";
            session.code_diff.file_diffs.forEach(fd => {
                const filePath = escapeHtml(fd.file_path || 'Unknown File');
                const action = escapeHtml(fd.action || 'MODIFY');
                diffHtml += `<div class="diff-header">--- ${filePath} (${action}) ---</div>`;
                
                const codeStr = fd.unified_diff || fd.new_code || '';
                const lines = codeStr.split("\n");
                
                lines.forEach(line => {
                    if (line.startsWith("+")) {
                        diffHtml += `<span class="diff-addition">${escapeHtml(line)}</span>\n`;
                    } else if (line.startsWith("-")) {
                        diffHtml += `<span class="diff-deletion">${escapeHtml(line)}</span>\n`;
                    } else {
                        diffHtml += `<span>${escapeHtml(line)}</span>\n`;
                    }
                });
                diffHtml += `\n`;
            });
            diffViewer.innerHTML = diffHtml;
            lastDiffCount = session.code_diff.file_diffs.length;
        }

        const metricsRow = document.getElementById("audit-metrics");
        if (metricsRow) metricsRow.style.display = "grid";
        
        if (session.review_result) {
            const scoreEl = document.getElementById("metric-quality-score");
            if (scoreEl) scoreEl.innerText = `${session.review_result.quality_score || 95}/100`;
            
            const statusEl = document.getElementById("metric-audit-status");
            if (statusEl) statusEl.innerText = session.review_result.is_approved ? "PASSED" : "ISSUES";
        }
        
        if (session.test_result) {
            const testEl = document.getElementById("metric-test-status");
            if (testEl) testEl.innerText = `${session.test_result.passed_count || 0}/${session.test_result.total_tests || 0} PASSED`;
        }
    }

    if (session.status !== lastStatus) {
        lastStatus = session.status;
        const badge = document.getElementById("approval-status-badge");
        const actionsRow = document.getElementById("approval-actions");
        
        if (badge) {
            if (session.status === "WAITING_HUMAN_APPROVAL") {
                badge.innerText = "Authorization Required";
                badge.className = "badge badge-warning";
                if (actionsRow) actionsRow.style.display = "flex";
            } else if (session.status === "COMPLETED") {
                badge.innerText = "Deployed Successfully";
                badge.className = "badge badge-success";
                if (actionsRow) actionsRow.style.display = "none";
            } else if (session.status === "REJECTED") {
                badge.innerText = "Patch Rejected";
                badge.className = "badge badge-danger";
                if (actionsRow) actionsRow.style.display = "none";
            }
        }
    }
}

async function approveDiff() {
    if (!currentTaskId) return;

    try {
        appendLog("HumanApprovalGate", "User authorized code diff. Applying patch to workspace...", "log-info");
        const response = await fetch(`/api/tasks/${currentTaskId}/approve`, { method: "POST" });
        const data = await response.json();
        
        if (data.pr_result?.pr_url) {
            alert(`✅ Code diff authorized and applied!\nPull Request: ${data.pr_result.pr_url}`);
        } else {
            alert(`✅ Code diff authorized and applied successfully!`);
        }
        pollTaskStatus();
    } catch (err) {
        alert("Failed to authorize task: " + err.message);
        console.error("Approve error:", err);
    }
}

async function rejectDiff() {
    if (!currentTaskId) return;

    try {
        await fetch(`/api/tasks/${currentTaskId}/reject`, { method: "POST" });
        appendLog("HumanApprovalGate", "User rejected the code diff. Aborting.", "log-warning");
        alert("❌ Code patch rejected.");
        pollTaskStatus();
    } catch (err) {
        alert("Failed to reject task: " + err.message);
        console.error("Reject error:", err);
    }
}

async function openMemoryModal() {
    const modal = document.getElementById("memory-modal");
    const body = document.getElementById("memory-modal-body");
    if (!modal || !body) return;
    
    modal.style.display = "flex";

    try {
        const response = await fetch("/api/memory");
        const data = await response.json();
        
        let html = `<p style="color:var(--text-secondary); margin-bottom: 12px;"><strong>System Version:</strong> ${data.version || '2.0.1'}</p><div style="height:1px; background:var(--border-subtle); margin-bottom:16px;"></div><ul style="list-style:none; padding:0;">`;
        if (data.notes && data.notes.length > 0) {
            data.notes.forEach(note => {
                html += `<li style="margin-bottom:12px; padding:12px; background:rgba(0,0,0,0.3); border-radius:8px; border:1px solid var(--border-subtle);">
                    <div style="color:var(--primary); font-weight:600; font-size:12px; margin-bottom:4px; text-transform:uppercase;">[${escapeHtml(note.tag)}]</div>
                    <div style="color:var(--text-primary);">${escapeHtml(note.content)}</div>
                </li>`;
            });
        } else {
            html += `<li style="color:var(--text-muted); font-style:italic;">No cognitive vectors stored in memory bank yet.</li>`;
        }
        html += `</ul>`;
        body.innerHTML = html;
    } catch (err) {
        body.innerText = "Failed to synchronize memory bank.";
        console.error("Memory fetch error:", err);
    }
}

function closeMemoryModal() {
    const modal = document.getElementById("memory-modal");
    if (modal) modal.style.display = "none";
}

function openCalcModal() {
    const modal = document.getElementById("calc-modal");
    if (modal) modal.style.display = "flex";
}

function closeCalcModal() {
    const modal = document.getElementById("calc-modal");
    if (modal) modal.style.display = "none";
}

async function runCalc(op) {
    const valA = parseFloat(document.getElementById("calc-val-a")?.value || 0);
    const valB = parseFloat(document.getElementById("calc-val-b")?.value || 0);
    const resEl = document.getElementById("calc-result");

    if (!resEl) return;
    resEl.innerText = "Calculating...";

    try {
        const response = await fetch("/api/calculate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ operation: op, a: valA, b: valB })
        });
        const data = await response.json();
        if (!response.ok) {
            resEl.style.color = "var(--danger)";
            resEl.innerText = `Error: ${data.detail || 'Calculation failed'}`;
        } else {
            resEl.style.color = "var(--primary)";
            resEl.innerText = `${valA} ${op} ${valB} = ${data.result}`;
        }
    } catch (err) {
        resEl.style.color = "var(--danger)";
        resEl.innerText = `Network Error: ${err.message}`;
    }
}

function setSystemStatus(text, className) {
    const pill = document.getElementById("system-status-pill");
    if (pill) {
        pill.innerHTML = `<span class="status-dot"></span> ${escapeHtml(text)}`;
        pill.className = `status-pill ${className}`;
    }
}

function appendLog(agent, msg, level = "log-info") {
    const consoleEl = document.getElementById("logs-container");
    if (!consoleEl) return;
    
    const entry = document.createElement("div");
    entry.className = `log-entry ${level}`;
    const timeStr = new Date().toLocaleTimeString();
    entry.innerText = `[${timeStr}] [${agent}] ${msg}`;
    consoleEl.appendChild(entry);
    consoleEl.scrollTop = consoleEl.scrollHeight;
}

function resetUI() {
    lastLogCount = 0;
    lastStatus = "";
    lastDiffCount = 0;
    failedPollCount = 0;

    document.querySelectorAll(".agent-node").forEach(node => {
        node.classList.remove("active-node", "completed-node", "waiting-node");
    });
    
    const planContent = document.getElementById("plan-content");
    if (planContent) planContent.innerHTML = `<div class="placeholder-text">Waiting for orchestrator synthesis...</div>`;
    
    const diffViewer = document.getElementById("diff-viewer");
    if (diffViewer) diffViewer.innerHTML = `<div class="placeholder-text">Unified code diffs and semantic patches will appear here.</div>`;
    
    const metrics = document.getElementById("audit-metrics");
    if (metrics) metrics.style.display = "none";
    
    const actions = document.getElementById("approval-actions");
    if (actions) actions.style.display = "none";
}

function escapeHtml(text) {
    if (!text) return "";
    return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function loadModelAndHardwareInfo() {
    const badge = document.getElementById("gpu-device-badge");
    const dropdown = document.getElementById("model-select-dropdown");
    try {
        const res = await fetch("/api/models/list");
        if (!res.ok) return;
        const data = await res.json();
        
        if (dropdown && data.current_model) {
            dropdown.value = data.current_model;
        }

        if (badge && data.hardware) {
            const hw = data.hardware;
            if (hw.cuda_available) {
                badge.className = "badge badge-success";
                badge.innerText = `⚡ GPU CUDA: ${hw.device_name}`;
            } else {
                badge.className = "badge badge-info";
                badge.innerText = `💻 CPU Compute Mode (${hw.device_name})`;
            }
        }
    } catch (e) {
        console.warn("Could not fetch model hardware info:", e);
    }
}

async function switchActiveModel() {
    const dropdown = document.getElementById("model-select-dropdown");
    if (!dropdown) return;
    const selectedModel = dropdown.value;
    try {
        const res = await fetch("/api/models/switch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model_name: selectedModel })
        });
        if (res.ok) {
            appendLog("NexusCore", `Active LLM switched to '${selectedModel}'`);
            alert(`Active LLM updated to '${selectedModel}'`);
        } else {
            const err = await res.json();
            alert(`Failed to switch model: ${err.detail || 'Unknown error'}`);
        }
    } catch (e) {
        alert(`Error switching model: ${e.message}`);
    }
}

async function triggerModelTraining(framework) {
    const statusBox = document.getElementById("training-output-status");
    if (statusBox) {
        statusBox.className = "training-status-box training-status-loading";
        statusBox.style.display = "block";
        statusBox.innerHTML = `
            <div class="training-header">
                <span>⚡</span> <span>Training ${framework.toUpperCase()} Model on GPU/CPU...</span>
            </div>
            <div style="font-size:0.82rem; color:var(--text-secondary);">Initializing benchmark tensors, batch size 32, epochs 8...</div>
        `;
    }

    appendLog("TrainerService", `Starting ${framework.toUpperCase()} model training benchmark...`);

    try {
        const res = await fetch("/api/models/train", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ framework: framework, epochs: 8, batch_size: 32, num_samples: 1000 })
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || "Training failed");
        }

        const data = await res.json();
        const acc = data.best_val_accuracy || data.test_accuracy || 0;
        const timeSec = data.training_time_sec || 0;
        const deviceUsed = data.device_used || "CPU";
        const checkpoint = data.checkpoint_saved || '';

        if (statusBox) {
            statusBox.className = "training-status-box training-status-success";
            statusBox.innerHTML = `
                <div class="training-header success">
                    <span>✅</span> <span>Training Completed Successfully!</span>
                </div>
                <div class="training-metric-grid">
                    <div class="metric-pill">
                        <span class="metric-pill-label">Framework</span>
                        <span class="metric-pill-value">${escapeHtml(data.framework)}</span>
                    </div>
                    <div class="metric-pill">
                        <span class="metric-pill-label">Device</span>
                        <span class="metric-pill-value">${escapeHtml(deviceUsed)}</span>
                    </div>
                    <div class="metric-pill">
                        <span class="metric-pill-label">Accuracy</span>
                        <span class="metric-pill-value" style="color:var(--success);">${acc}%</span>
                    </div>
                    <div class="metric-pill">
                        <span class="metric-pill-label">Time</span>
                        <span class="metric-pill-value">${timeSec}s</span>
                    </div>
                </div>
                ${checkpoint ? `
                    <div class="checkpoint-box">
                        <span>💾 <b>Saved:</b> ${escapeHtml(checkpoint)}</span>
                    </div>
                ` : ''}
            `;
        }

        appendLog("TrainerService", `Training finished in ${timeSec}s. Accuracy: ${acc}%. Device: ${deviceUsed}.`);
    } catch (e) {
        if (statusBox) {
            statusBox.className = "training-status-box training-status-error";
            statusBox.innerHTML = `
                <div class="training-header error">
                    <span>❌</span> <span>Training Error</span>
                </div>
                <div style="font-size:0.85rem; color:var(--danger);">${escapeHtml(e.message)}</div>
            `;
        }
        appendLog("TrainerService", `Training Error: ${e.message}`, "log-error");
    }
}

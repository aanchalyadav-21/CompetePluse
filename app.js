class CompetePulseApp {
    constructor() {
        this.COMP_KEY = 'compete_pulse_data';
        this.TODO_KEY = 'compete_pulse_todos';
        this.API_KEY = 'compete_pulse_gemini';
        
        this.competitions = [];
        this.todos = [];
        this.geminiApiKey = localStorage.getItem(this.API_KEY) || '';
        
        this.init();
    }

    init() {
        this.setupTheme(); // NEW: Light/Dark Mode init
        this.loadData();
        this.setupNavigation();
        this.setupMagicURLExtractor();
        this.setupModals();
        this.setupTodos();
        this.renderAll();
        
        if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
            Notification.requestPermission();
        }
        
        setInterval(() => this.checkTimers(), 1000);
        
        if (window.lucide) window.lucide.createIcons();
    }

    // ==========================================================================
    // THEME SWITCHER (Light / Dark / Auto)
    // ==========================================================================
    setupTheme() {
        const savedTheme = localStorage.getItem('compete_pulse_theme') || 'auto';
        this.applyTheme(savedTheme);

        document.querySelectorAll('.theme-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.applyTheme(btn.dataset.theme);
            });
        });

        // Listen for OS changes if set to auto
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
            if (localStorage.getItem('compete_pulse_theme') === 'auto') {
                this.applyTheme('auto');
            }
        });
    }

    applyTheme(theme) {
        localStorage.setItem('compete_pulse_theme', theme);
        
        // Update UI Button states
        document.querySelectorAll('.theme-btn').forEach(btn => {
            if (btn.dataset.theme === theme) {
                btn.classList.add('bg-white', 'dark:bg-slate-800', 'text-slate-900', 'dark:text-white', 'shadow-sm');
                btn.classList.remove('text-slate-500', 'dark:text-slate-400');
            } else {
                btn.classList.remove('bg-white', 'dark:bg-slate-800', 'text-slate-900', 'dark:text-white', 'shadow-sm');
                btn.classList.add('text-slate-500', 'dark:text-slate-400');
            }
        });

        // Apply dark class to HTML body
        const root = document.documentElement;
        if (theme === 'dark') {
            root.classList.add('dark');
        } else if (theme === 'light') {
            root.classList.remove('dark');
        } else {
            // Auto
            if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                root.classList.add('dark');
            } else {
                root.classList.remove('dark');
            }
        }
    }

    // ==========================================================================
    // CORE APP LOGIC
    // ==========================================================================
    loadData() {
        const cStored = localStorage.getItem(this.COMP_KEY);
        this.competitions = cStored ? JSON.parse(cStored) : [];
        const tStored = localStorage.getItem(this.TODO_KEY);
        this.todos = tStored ? JSON.parse(tStored) : [];
    }

    saveData() {
        localStorage.setItem(this.COMP_KEY, JSON.stringify(this.competitions));
        localStorage.setItem(this.TODO_KEY, JSON.stringify(this.todos));
        this.renderAll();
    }

    setupNavigation() {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.nav-btn').forEach(b => {
                    b.classList.remove('active', 'bg-indigo-500/10', 'text-indigo-600', 'dark:text-indigo-400');
                    b.classList.add('text-slate-500', 'dark:text-slate-300');
                });
                btn.classList.remove('text-slate-500', 'dark:text-slate-300');
                btn.classList.add('active', 'bg-indigo-500/10', 'text-indigo-600', 'dark:text-indigo-400');

                document.querySelectorAll('.view-section').forEach(s => s.classList.add('hidden'));
                document.getElementById(`view-${btn.dataset.view}`).classList.remove('hidden');
                
                const titleMap = { 'dashboard': 'Dashboard', 'todos': 'Tasks & Reminders' };
                document.getElementById('header-title').textContent = titleMap[btn.dataset.view];
            });
        });
    }

    showToast(message, type = 'success') {
        const existing = document.getElementById('app-toast');
        if (existing) existing.remove();
        
        const toast = document.createElement('div');
        toast.id = 'app-toast';
        toast.className = `fixed bottom-6 right-6 p-4 rounded-2xl shadow-2xl z-[999] text-sm font-bold flex items-center gap-3 animate-[slideIn_0.3s_ease-out] ${type === 'error' ? 'bg-rose-600 text-white' : 'bg-emerald-500 text-white'}`;
        toast.innerHTML = `<i data-lucide="${type === 'error' ? 'alert-octagon' : 'bell-ring'}" class="w-5 h-5"></i> <span>${message}</span>`;
        
        document.body.appendChild(toast);
        if (window.lucide) window.lucide.createIcons();
        
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(20px)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 5000); 
    }

    setupTodos() {
        const form = document.getElementById('form-todo');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const text = document.getElementById('todo-text').value.trim();
                const date = document.getElementById('todo-date').value;
                const time = document.getElementById('todo-time').value;
                
                let reminderStr = null;
                if (date) {
                    reminderStr = date + (time ? `T${time}` : 'T00:00:00');
                } else if (time) {
                    const today = new Date().toISOString().split('T')[0];
                    reminderStr = today + `T${time}`;
                }
                
                if (text) {
                    this.todos.unshift({
                        id: 'todo-' + Date.now(),
                        text: text,
                        reminder: reminderStr,
                        done: false,
                        notified: false
                    });
                    this.saveData();
                    form.reset();
                    this.showToast('Task added successfully.', 'success');
                }
            });
        }
    }

    renderTodos() {
        const container = document.getElementById('todo-list-container');
        if (!container) return;
        if (this.todos.length === 0) {
            container.innerHTML = `<div class="p-6 rounded-2xl bg-slate-50 dark:bg-[#0a0f1f] border border-slate-200 dark:border-slate-800 text-center text-slate-500 text-sm">No tasks pending. Add one above!</div>`;
            return;
        }

        container.innerHTML = this.todos.map((t, index) => {
            let timeHtml = '';
            if (t.reminder) {
                const rDate = new Date(t.reminder);
                const dStr = rDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
                const tStr = t.reminder.includes('T00:00:00') ? '' : ' at ' + rDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                timeHtml = `<p class="text-[11px] font-bold text-indigo-500 dark:text-indigo-400 mt-0.5"><i data-lucide="clock" class="w-3 h-3 inline mr-1"></i>Due: ${dStr}${tStr}</p>`;
            }

            return `
            <div class="p-4 rounded-2xl bg-white dark:bg-[#0a0f1f] border ${t.done ? 'border-slate-200 dark:border-slate-800 opacity-50' : 'border-slate-200 dark:border-slate-700'} flex items-center justify-between gap-4 transition-all shadow-sm">
                <div class="flex items-center gap-3">
                    <input type="checkbox" ${t.done ? 'checked' : ''} onchange="app.toggleTodo(${index})" class="w-5 h-5 rounded border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-[#04070f] text-indigo-600 focus:ring-0 cursor-pointer">
                    <div>
                        <p class="text-sm font-semibold text-slate-900 dark:text-white ${t.done ? 'line-through' : ''}">${t.text}</p>
                        ${timeHtml}
                    </div>
                </div>
                <button onclick="app.deleteTodo(${index})" class="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
            </div>
            `;
        }).join('');
    }

    toggleTodo(index) { this.todos[index].done = !this.todos[index].done; this.saveData(); }
    deleteTodo(index) { this.todos.splice(index, 1); this.saveData(); }

    setupMagicURLExtractor() {
        this.updateApiKeyStatus();

        const btnOpenApi = document.getElementById('btn-open-api-key-modal');
        const btnCloseApi = document.getElementById('btn-close-api-key-modal');
        const modalApi = document.getElementById('modal-api-key');
        const btnSaveApi = document.getElementById('btn-save-api-key');
        const inputApiKey = document.getElementById('input-gemini-api-key');
        const btnClearApi = document.getElementById('btn-clear-api-key');
        const btnExtract = document.getElementById('btn-magic-extract');
        const inputUrl = document.getElementById('magic-url-input');

        if (btnOpenApi) btnOpenApi.addEventListener('click', () => { inputApiKey.value = this.geminiApiKey; modalApi.classList.remove('hidden'); });
        if (btnCloseApi) btnCloseApi.addEventListener('click', () => modalApi.classList.add('hidden'));
        
        if (btnSaveApi) btnSaveApi.addEventListener('click', () => {
            const key = inputApiKey.value.trim();
            if (key) {
                this.geminiApiKey = key;
                localStorage.setItem(this.API_KEY, key);
                this.updateApiKeyStatus();
                modalApi.classList.add('hidden');
                this.showToast('API Key Configured!', 'success');
            }
        });

        if (btnClearApi) btnClearApi.addEventListener('click', () => {
            this.geminiApiKey = '';
            localStorage.removeItem(this.API_KEY);
            inputApiKey.value = '';
            this.updateApiKeyStatus();
        });

        if (btnExtract && inputUrl) btnExtract.addEventListener('click', () => this.runAIExtraction(inputUrl.value.trim(), btnExtract));
    }

    updateApiKeyStatus() {
        const label = document.getElementById('api-key-status-label');
        if (!label) return;
        if (this.geminiApiKey) {
            label.textContent = 'Key Active ✓';
            label.classList.add('text-emerald-500');
        } else {
            label.textContent = 'API Key';
            label.classList.remove('text-emerald-500');
        }
    }

    async runAIExtraction(targetUrl, btn) {
        if (!targetUrl) return this.showToast('Paste a valid Unstop/Devpost URL.', 'error');
        if (!this.geminiApiKey) {
            this.showToast('Google API Key required for AI.', 'error');
            document.getElementById('modal-api-key').classList.remove('hidden');
            return;
        }

        const originalText = btn.innerHTML;
        btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Scanning...`;
        btn.disabled = true;

        try {
            const jinaRes = await fetch(`https://r.jina.ai/${targetUrl}`);
            const pageText = await jinaRes.text();

            const prompt = `You are a strict data extractor. Read this competition page text and output ONLY valid JSON.
            CRITICAL DATE/TIME RULES:
            1. Find the "Submission Deadline" or "Round 1 End Date". IGNORE the "Registration" deadline.
            2. DO NOT convert timezones. Read the exact clock time shown on the page.
            3. Convert 12-hour AM/PM to 24-hour format perfectly (e.g., 11:59 PM = 23:59, 12:00 PM = 12:00).
            4. Format EXACTLY as: YYYY-MM-DDTHH:mm
            
            Schema: {"title": "Comp Name", "subDeadline": "YYYY-MM-DDTHH:mm", "description": "1-2 sentence summary"}
            Text: ${pageText.substring(0, 10000)}`;

            const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${this.geminiApiKey}`;
            
            const apiCall = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { response_mime_type: "application/json" }
                })
            });

            const dataPackage = await apiCall.json();
            if (dataPackage.error) throw new Error(`Google API: ${dataPackage.error.message}`);
            if (!dataPackage.candidates) throw new Error(`Google blocked this request.`);

            const extractedRaw = dataPackage.candidates[0].content.parts[0].text;
            const payloadObj = JSON.parse(extractedRaw.trim());

            document.getElementById('comp-title').value = payloadObj.title || '';
            document.getElementById('comp-description').value = payloadObj.description || '';
            document.getElementById('comp-url').value = targetUrl;
            
            if (payloadObj.subDeadline) {
                document.getElementById('comp-sub-deadline').value = payloadObj.subDeadline;
            }
            
            document.getElementById('modal-comp').classList.remove('hidden');
            document.getElementById('magic-url-input').value = '';
            
            this.showToast('Event Extracted! Verify & Save.', 'success');

        } catch (error) {
            console.error(error);
            this.showToast(error.message, 'error');
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
            if (window.lucide) window.lucide.createIcons();
        }
    }

    setupModals() {
        document.getElementById('btn-add-comp').addEventListener('click', () => { document.getElementById('form-comp').reset(); document.getElementById('modal-comp').classList.remove('hidden'); });
        document.getElementById('btn-close-modal').addEventListener('click', () => document.getElementById('modal-comp').classList.add('hidden'));
        
        document.getElementById('form-comp').addEventListener('submit', (e) => {
            e.preventDefault();
            this.competitions.unshift({
                id: 'comp-' + Date.now(),
                title: document.getElementById('comp-title').value,
                description: document.getElementById('comp-description').value,
                subDeadline: document.getElementById('comp-sub-deadline').value,
                url: document.getElementById('comp-url').value,
            });
            this.saveData();
            document.getElementById('modal-comp').classList.add('hidden');
            this.showToast('Competition Tracker Saved!', 'success');
        });
    }

    checkTimers() {
        const now = new Date().getTime();

        this.todos.forEach(t => {
            if (t.reminder && !t.notified && !t.done && !t.reminder.includes('T00:00:00')) {
                const remTime = new Date(t.reminder).getTime();
                if (remTime <= now) {
                    this.showToast(`⏰ REMINDER: ${t.text}`, 'success');
                    if ('Notification' in window && Notification.permission === 'granted') {
                        new Notification("CompetePulse Reminder", { 
                            body: t.text,
                            icon: "watermarked_img_2684804424754179128.png"
                        });
                    }
                    t.notified = true;
                    this.saveData(); 
                }
            }
        });

        document.querySelectorAll('.live-countdown').forEach(el => {
            const target = new Date(el.getAttribute('data-time')).getTime();
            const diff = target - target + target - now; // simple refresh calc

            if (diff <= 0) {
                el.innerHTML = `<span class="text-rose-500 font-bold">Deadline Passed</span>`;
            } else {
                const d = Math.floor(diff / (1000 * 60 * 60 * 24));
                const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                el.innerHTML = `<span class="text-amber-500 font-bold">${d}d ${h}h ${m}m left</span>`;
            }
        });
    }

    renderAll() {
        this.renderTodos();
        
        const grid = document.getElementById('dashboard-cards-grid');
        if (!grid) return;

        if (this.competitions.length === 0) {
            grid.innerHTML = `<div class="col-span-full py-16 text-center text-slate-400 bg-slate-50 dark:bg-[#0a0f1f] border border-slate-200 dark:border-slate-800 rounded-3xl">
                <i data-lucide="layers" class="w-12 h-12 mx-auto mb-3 opacity-20"></i>
                <p class="font-semibold text-slate-600 dark:text-white">Your dashboard is empty.</p>
                <p class="text-xs mt-1">Paste a URL above to start building your portfolio.</p>
            </div>`;
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        grid.innerHTML = this.competitions.map(c => `
            <div class="bg-white dark:bg-[#0a0f1f] border border-slate-200 dark:border-slate-700/60 rounded-3xl p-5 hover:border-indigo-400 transition-all flex flex-col justify-between group relative overflow-hidden shadow-sm">
                <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div>
                    <div class="flex items-center justify-between mb-3">
                        <span class="px-2.5 py-1 rounded-md bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Active Track</span>
                        <button onclick="app.deleteComp('${c.id}')" class="text-slate-400 hover:text-rose-500 transition-colors"><i data-lucide="trash" class="w-4 h-4"></i></button>
                    </div>
                    <h4 class="text-lg font-outfit font-extrabold line-clamp-2 leading-tight">${c.title}</h4>
                    ${c.description ? `<p class="text-[11px] text-slate-500 dark:text-slate-400 mt-2 line-clamp-3 leading-relaxed">${c.description}</p>` : ''}
                </div>
                
                <div class="mt-5 space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <div class="bg-slate-50 dark:bg-[#04070f] p-3 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center gap-3">
                        <div class="p-2 rounded-xl bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 shadow-sm"><i data-lucide="calendar-clock" class="w-4 h-4"></i></div>
                        <div class="flex flex-col">
                            <span class="text-[10px] text-slate-500 font-bold uppercase">Submission Due</span>
                            <span class="text-xs font-semibold mt-0.5">${c.subDeadline ? new Date(c.subDeadline).toLocaleString([], {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'}) : 'No Deadline set'}</span>
                        </div>
                    </div>
                    
                    <div class="flex items-center justify-between pt-2">
                        <div class="live-countdown text-xs font-mono" data-time="${c.subDeadline}">Calculating...</div>
                        ${c.url ? `<a href="${c.url}" target="_blank" class="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-indigo-600 text-slate-500 dark:text-slate-300 hover:text-white flex items-center justify-center transition-colors"><i data-lucide="external-link" class="w-3.5 h-3.5"></i></a>` : ''}
                    </div>
                </div>
            </div>
        `).join('');
        
        if (window.lucide) window.lucide.createIcons();
    }

    deleteComp(id) {
        if(confirm('Remove this track from your dashboard?')) {
            this.competitions = this.competitions.filter(c => c.id !== id);
            this.saveData();
        }
    }
}

const style = document.createElement('style');
style.innerHTML = `@keyframes slideIn { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`;
document.head.appendChild(style);

let app;
document.addEventListener('DOMContentLoaded', () => { app = new CompetePulseApp(); });
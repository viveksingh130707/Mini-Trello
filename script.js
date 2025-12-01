/**
 * Mini-Trello Application Logic (Rewritten)
 */

const STATE_KEY = 'mini-trello-state';

class MiniTrello {
    constructor() {
        this.state = {
            tasks: [],
            nextId: 1
        };

        this.filters = {
            search: '',
            priority: 'all'
        };

        // DOM Elements
        this.lists = {
            todo: document.getElementById('list-todo'),
            inprogress: document.getElementById('list-inprogress'),
            done: document.getElementById('list-done')
        };

        this.counts = {
            todo: document.querySelector('#col-todo .column-count'),
            inprogress: document.querySelector('#col-inprogress .column-count'),
            done: document.querySelector('#col-done .column-count')
        };

        this.stats = {
            total: document.getElementById('stat-total'),
            pending: document.getElementById('stat-pending'),
            completed: document.getElementById('stat-completed')
        };

        this.modal = document.getElementById('task-modal');
        this.form = document.getElementById('task-form');

        this.init();
    }

    init() {
        this.loadState();
        this.setupEventListeners();
        this.render();
    }

    // --- State Management ---

    loadState() {
        const saved = localStorage.getItem(STATE_KEY);
        if (saved) {
            this.state = JSON.parse(saved);
        } else {
            // Seed Data
            this.state.tasks = [
                { id: 'T1', title: 'Initialize System', desc: 'Boot up the core kernel', status: 'done', priority: 'high', tags: ['system'], due: '' },
                { id: 'T2', title: 'Design Interface', desc: 'Create neon styling', status: 'inprogress', priority: 'medium', tags: ['ui', 'css'], due: '' },
                { id: 'T3', title: 'Implement Drag & Drop', desc: 'Enable task movement', status: 'todo', priority: 'high', tags: ['feature'], due: '' }
            ];
            this.state.nextId = 4;
            this.saveState();
        }
    }

    saveState() {
        localStorage.setItem(STATE_KEY, JSON.stringify(this.state));
        this.updateStats();
    }

    updateStats() {
        const total = this.state.tasks.length;
        const done = this.state.tasks.filter(t => t.status === 'done').length;
        const pending = total - done;

        this.stats.total.textContent = total;
        this.stats.pending.textContent = pending;
        this.stats.completed.textContent = done;
    }

    // --- Rendering ---

    render() {
        // Clear all lists
        Object.values(this.lists).forEach(list => list.innerHTML = '');
        const counts = { todo: 0, inprogress: 0, done: 0 };

        // Filter and Render
        this.state.tasks.forEach(task => {
            // Apply Filters
            const matchesSearch = task.title.toLowerCase().includes(this.filters.search) ||
                (task.tags && task.tags.some(tag => tag.toLowerCase().includes(this.filters.search)));
            const matchesPriority = this.filters.priority === 'all' || task.priority === this.filters.priority;

            if (matchesSearch && matchesPriority) {
                if (this.lists[task.status]) {
                    const card = this.createTaskElement(task);
                    this.lists[task.status].appendChild(card);
                    counts[task.status]++;
                }
            }
        });

        // Update Counts
        this.counts.todo.textContent = counts.todo;
        this.counts.inprogress.textContent = counts.inprogress;
        this.counts.done.textContent = counts.done;

        // Update Stats
        this.updateStats();
    }

    createTaskElement(task) {
        const el = document.createElement('div');
        el.className = `task-card priority-${task.priority}`;
        el.draggable = true;
        el.dataset.id = task.id;

        el.innerHTML = `
            <div class="task-header">
                <span class="task-id">#${task.id}</span>
                <div class="task-actions">
                    <button class="card-btn edit-btn" title="Edit">✎</button>
                    <button class="card-btn delete-btn" title="Delete">×</button>
                </div>
            </div>
            <div class="task-title">${task.title}</div>
            ${task.desc ? `<div class="task-desc" style="font-size:0.8rem; color:#a0a0b0; margin-bottom:0.5rem;">${task.desc}</div>` : ''}
            <div class="task-tags">
                ${task.tags ? task.tags.map(tag => `<span class="tag">${tag}</span>`).join('') : ''}
            </div>
            <div class="task-meta">
                <span>${task.due ? 'Due: ' + task.due : ''}</span>
            </div>
        `;

        // Event Listeners for Buttons
        el.querySelector('.edit-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.openModal(task);
        });

        el.querySelector('.delete-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm('Delete task?')) {
                this.deleteTask(task.id);
            }
        });

        // Drag Events
        el.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', task.id);
            e.dataTransfer.effectAllowed = 'move';
            el.classList.add('dragging');
        });

        el.addEventListener('dragend', () => {
            el.classList.remove('dragging');
            this.syncOrderFromDOM(); // Critical: Update state to match DOM
        });

        return el;
    }

    // --- Drag & Drop Logic ---

    setupEventListeners() {
        // Drag & Drop for Lists
        Object.entries(this.lists).forEach(([status, list]) => {
            list.addEventListener('dragover', (e) => {
                e.preventDefault(); // Allow drop
                const draggable = document.querySelector('.dragging');
                if (!draggable) return;

                const afterElement = this.getDragAfterElement(list, e.clientY);
                if (afterElement == null) {
                    list.appendChild(draggable);
                } else {
                    list.insertBefore(draggable, afterElement);
                }
            });

            list.addEventListener('dragenter', (e) => {
                e.preventDefault();
                list.classList.add('drag-over');
            });

            list.addEventListener('dragleave', (e) => {
                // Check if leaving the list to an outside element
                if (!list.contains(e.relatedTarget)) {
                    list.classList.remove('drag-over');
                }
            });

            list.addEventListener('drop', (e) => {
                e.preventDefault();
                list.classList.remove('drag-over');
                // Actual logic handled in dragend -> syncOrderFromDOM
            });
        });

        // UI Event Listeners
        document.getElementById('btn-create-task').addEventListener('click', () => this.openModal());
        document.querySelectorAll('.close-modal').forEach(btn => btn.addEventListener('click', () => this.closeModal()));
        this.form.addEventListener('submit', (e) => this.handleFormSubmit(e));

        // Search
        document.getElementById('search-input').addEventListener('input', (e) => {
            this.filters.search = e.target.value.toLowerCase();
            this.render();
        });

        // Priority Filter
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.filters.priority = btn.dataset.priority;
                this.render();
            });
        });

        // Clear Done
        document.getElementById('btn-clear-done').addEventListener('click', () => {
            if (confirm('Delete all completed tasks?')) {
                this.state.tasks = this.state.tasks.filter(t => t.status !== 'done');
                this.saveState();
                this.render();
            }
        });
    }

    getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.task-card:not(.dragging)')];

        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    syncOrderFromDOM() {
        // Reconstruct the tasks array based on the current DOM order
        const newTasks = [];
        const processedIds = new Set();

        // Iterate through lists in order
        ['todo', 'inprogress', 'done'].forEach(status => {
            const list = this.lists[status];
            [...list.children].forEach(card => {
                const id = card.dataset.id;
                const task = this.state.tasks.find(t => t.id === id);
                if (task) {
                    task.status = status; // Update status
                    newTasks.push(task);
                    processedIds.add(id);
                }
            });
        });

        // Add any tasks that were filtered out (hidden) back to the array
        this.state.tasks.forEach(task => {
            if (!processedIds.has(task.id)) {
                newTasks.push(task);
            }
        });

        this.state.tasks = newTasks;
        this.saveState();
        this.render(); // Re-render to ensure consistency
    }

    // --- CRUD Operations ---

    deleteTask(id) {
        this.state.tasks = this.state.tasks.filter(t => t.id !== id);
        this.saveState();
        this.render();
    }

    openModal(task = null) {
        this.modal.classList.remove('hidden');
        const title = document.getElementById('modal-title');
        const idInput = document.getElementById('task-id');

        if (task) {
            title.textContent = 'EDIT_TASK';
            idInput.value = task.id;
            document.getElementById('task-title').value = task.title;
            document.getElementById('task-desc').value = task.desc || '';
            document.getElementById('task-priority').value = task.priority;
            document.getElementById('task-due').value = task.due || '';
            document.getElementById('task-tags').value = task.tags ? task.tags.join(', ') : '';
        } else {
            title.textContent = 'NEW_TASK';
            this.form.reset();
            idInput.value = '';
        }
    }

    closeModal() {
        this.modal.classList.add('hidden');
    }

    handleFormSubmit(e) {
        e.preventDefault();
        const id = document.getElementById('task-id').value;
        const title = document.getElementById('task-title').value;
        const desc = document.getElementById('task-desc').value;
        const priority = document.getElementById('task-priority').value;
        const due = document.getElementById('task-due').value;
        const tags = document.getElementById('task-tags').value.split(',').map(t => t.trim()).filter(t => t);

        if (id) {
            // Edit
            const task = this.state.tasks.find(t => t.id === id);
            if (task) {
                task.title = title;
                task.desc = desc;
                task.priority = priority;
                task.due = due;
                task.tags = tags;
            }
        } else {
            // Create
            const newId = `T${this.state.nextId++}`;
            const newTask = {
                id: newId,
                title,
                desc,
                priority,
                due,
                tags,
                status: 'todo'
            };
            this.state.tasks.push(newTask);
        }

        this.saveState();
        this.render();
        this.closeModal();
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    new MiniTrello();
});

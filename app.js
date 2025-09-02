class GroupScheduler {
    constructor() {
        this.groups = JSON.parse(localStorage.getItem('groups')) || [];
        this.events = JSON.parse(localStorage.getItem('events')) || [];
        this.notifications = JSON.parse(localStorage.getItem('notifications')) || [];
        this.currentUser = 'Rodrigo';
        
        this.init();
        this.setupEventListeners();
        this.requestNotificationPermission();
        this.startNotificationChecker();
    }

    init() {
        this.renderGroups();
        this.renderEvents();
        this.renderNotifications();
        this.populateGroupSelects();
    }

    setupEventListeners() {
        // Tabs
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
        });

        // Grupos
        document.getElementById('createGroupBtn').addEventListener('click', () => this.showModal('createGroupModal'));
        document.getElementById('saveGroupBtn').addEventListener('click', () => this.createGroup());
        document.getElementById('cancelGroupBtn').addEventListener('click', () => this.hideModal('createGroupModal'));

        // Membros
        document.getElementById('addMemberBtn').addEventListener('click', () => this.addMember());
        document.getElementById('closeMembersBtn').addEventListener('click', () => this.hideModal('membersModal'));

        // Eventos
        document.getElementById('createEventBtn').addEventListener('click', () => this.showModal('createEventModal'));
        document.getElementById('saveEventBtn').addEventListener('click', () => this.createEvent());
        document.getElementById('cancelEventBtn').addEventListener('click', () => this.hideModal('createEventModal'));

        // Filtros
        document.getElementById('groupFilter').addEventListener('change', () => this.renderEvents());
        document.getElementById('typeFilter').addEventListener('change', () => this.renderEvents());

        // Notificações
        document.getElementById('clearNotificationsBtn').addEventListener('click', () => this.clearNotifications());
        document.getElementById('shareAppBtn').addEventListener('click', () => this.shareApp());

        // Configurações de notificação
        document.getElementById('browserNotifications').addEventListener('change', () => this.saveNotificationSettings());
        document.getElementById('emailNotifications').addEventListener('change', () => this.saveNotificationSettings());
        document.getElementById('notificationTiming').addEventListener('change', () => this.saveNotificationSettings());
    }

    switchTab(tabName) {
        // Remover classe active de todas as tabs
        document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

        // Adicionar classe active na tab selecionada
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(tabName).classList.add('active');
    }

    showModal(modalId) {
        document.getElementById(modalId).style.display = 'block';
    }

    hideModal(modalId) {
        document.getElementById(modalId).style.display = 'none';
        this.clearModalInputs(modalId);
    }

    clearModalInputs(modalId) {
        const modal = document.getElementById(modalId);
        modal.querySelectorAll('input, textarea, select').forEach(input => {
            if (input.type !== 'checkbox') {
                input.value = '';
            }
        });
    }

    // GRUPOS
    createGroup() {
        const name = document.getElementById('groupName').value.trim();
        const description = document.getElementById('groupDescription').value.trim();

        if (!name) {
            alert('Por favor, insira um nome para o grupo.');
            return;
        }

        const group = {
            id: Date.now(),
            name,
            description,
            members: [{ name: this.currentUser, email: 'rodrigo@email.com', isAdmin: true }],
            createdBy: this.currentUser,
            createdAt: new Date().toISOString()
        };

        this.groups.push(group);
        this.saveData();
        this.renderGroups();
        this.populateGroupSelects();
        this.hideModal('createGroupModal');
        
        this.addNotification(`Grupo "${name}" criado com sucesso! 🎉`);
    }

    deleteGroup(groupId) {
        if (confirm('Tem certeza que deseja excluir este grupo? Esta ação não pode ser desfeita.')) {
            this.groups = this.groups.filter(group => group.id !== groupId);
            this.events = this.events.filter(event => event.groupId !== groupId);
            this.saveData();
            this.renderGroups();
            this.renderEvents();
            this.populateGroupSelects();
        }
    }

    manageMembers(groupId) {
        this.currentGroupId = groupId;
        this.renderMembersList(groupId);
        this.showModal('membersModal');
    }

    addMember() {
        const name = document.getElementById('memberName').value.trim();
        const email = document.getElementById('memberEmail').value.trim();

        if (!name || !email) {
            alert('Por favor, preencha nome e email do membro.');
            return;
        }

        const group = this.groups.find(g => g.id === this.currentGroupId);
        if (group) {
            // Verificar se o membro já existe
            if (group.members.some(member => member.email === email)) {
                alert('Este membro já está no grupo.');
                return;
            }

            group.members.push({ name, email, isAdmin: false });
            this.saveData();
            this.renderMembersList(this.currentGroupId);
            this.renderGroups();
            
            document.getElementById('memberName').value = '';
            document.getElementById('memberEmail').value = '';
            
            this.addNotification(`${name} foi adicionado ao grupo "${group.name}"`);
        }
    }

    removeMember(groupId, memberEmail) {
        const group = this.groups.find(g => g.id === groupId);
        if (group) {
            group.members = group.members.filter(member => member.email !== memberEmail);
            this.saveData();
            this.renderMembersList(groupId);
            this.renderGroups();
        }
    }

    renderGroups() {
        const container = document.getElementById('groupsList');
        
        if (this.groups.length === 0) {
            container.innerHTML = '<div class="empty-state">Nenhum grupo criado ainda. Crie seu primeiro grupo!</div>';
            return;
        }

        container.innerHTML = this.groups.map(group => `
            <div class="group-card">
                <h3>${group.name}</h3>
                <p>${group.description}</p>
                <div class="group-info">
                    <small>👥 ${group.members.length} membros</small>
                    <small>📅 Criado em ${new Date(group.createdAt).toLocaleDateString('pt-BR')}</small>
                </div>
                <div class="group-actions">
                    <button class="btn-small btn-manage" onclick="app.manageMembers(${group.id})">
                        👥 Gerenciar Membros
                    </button>
                    <button class="btn-small btn-delete" onclick="app.deleteGroup(${group.id})">
                        🗑️ Excluir
                    </button>
                </div>
            </div>
        `).join('');
    }

    renderMembersList(groupId) {
        const group = this.groups.find(g => g.id === groupId);
        const container = document.getElementById('membersList');
        
        if (!group) return;

        container.innerHTML = group.members.map(member => `
            <div class="member-item">
                <div>
                    <strong>${member.name}</strong>
                    <br>
                    <small>${member.email}</small>
                    ${member.isAdmin ? '<span class="admin-badge">👑 Admin</span>' : ''}
                </div>
                ${!member.isAdmin ? `
                    <button class="btn-small btn-delete" onclick="app.removeMember(${groupId}, '${member.email}')">
                        Remover
                    </button>
                ` : ''}
            </div>
        `).join('');
    }

    // EVENTOS
    createEvent() {
        const title = document.getElementById('eventTitle').value.trim();
        const description = document.getElementById('eventDescription').value.trim();
        const groupId = parseInt(document.getElementById('eventGroup').value);
        const type = document.getElementById('eventType').value;
        const date = document.getElementById('eventDate').value;
        const time = document.getElementById('eventTime').value;
        const recurring = document.getElementById('eventRecurring').checked;

        if (!title || !groupId || !date || !time) {
            alert('Por favor, preencha todos os campos obrigatórios.');
            return;
        }

        const group = this.groups.find(g => g.id === groupId);
        if (!group) {
            alert('Grupo não encontrado.');
            return;
        }

        const event = {
            id: Date.now(),
            title,
            description,
            groupId,
            groupName: group.name,
            type,
            date,
            time,
            recurring,
            createdBy: this.currentUser,
            createdAt: new Date().toISOString(),
            participants: [this.currentUser]
        };

        this.events.push(event);
        
        // Se for recorrente, criar eventos para as próximas 4 semanas
        if (recurring) {
            for (let i = 1; i <= 4; i++) {
                const recurringDate = new Date(date);
                recurringDate.setDate(recurringDate.getDate() + (i * 7));
                
                const recurringEvent = {
                    ...event,
                    id: Date.now() + i,
                    date: recurringDate.toISOString().split('T')[0]
                };
                
                this.events.push(recurringEvent);
            }
        }

        this.saveData();
        this.renderEvents();
        this.hideModal('createEventModal');
        
        this.addNotification(`Evento "${title}" criado para ${new Date(date + 'T' + time).toLocaleString('pt-BR')} 🎯`);
        this.scheduleNotification(event);
    }

    joinEvent(eventId) {
        const event = this.events.find(e => e.id === eventId);
        if (event && !event.participants.includes(this.currentUser)) {
            event.participants.push(this.currentUser);
            this.saveData();
            this.renderEvents();
            this.addNotification(`Você confirmou presença no evento "${event.title}" 📌`);
        }
    }

    leaveEvent(eventId) {
        const event = this.events.find(e => e.id === eventId);
        if (event) {
            event.participants = event.participants.filter(p => p !== this.currentUser);
            this.saveData();
            this.renderEvents();
            this.addNotification(`Você cancelou sua presença no evento "${event.title}" ❌`);
        }
    }

    deleteEvent(eventId) {
        if (confirm('Tem certeza que deseja excluir este evento?')) {
            this.events = this.events.filter(event => event.id !== eventId);
            this.saveData();
            this.renderEvents();
        }
    }

    renderEvents() {
        const container = document.getElementById('eventsList');
        const groupFilter = document.getElementById('groupFilter').value;
        const typeFilter = document.getElementById('typeFilter').value;

        let filteredEvents = this.events;

        if (groupFilter) {
            filteredEvents = filteredEvents.filter(event => event.groupId == groupFilter);
        }

        if (typeFilter) {
            filteredEvents = filteredEvents.filter(event => event.type === typeFilter);
        }

        // Ordenar por data e hora
        filteredEvents.sort((a, b) => {
            const dateA = new Date(a.date + 'T' + a.time);
            const dateB = new Date(b.date + 'T' + b.time);
            return dateA - dateB;
        });

        if (filteredEvents.length === 0) {
            container.innerHTML = '<div class="empty-state">Nenhum evento encontrado. Crie seu primeiro evento!</div>';
            return;
        }

        const typeIcons = {
            esporte: '🏃',
            leitura: '📚',
            administracao: '⏰',
            outro: '📝'
        };

        container.innerHTML = filteredEvents.map(event => {
            const eventDate = new Date(event.date + 'T' + event.time);
            const isParticipant = event.participants.includes(this.currentUser);
            const isPast = eventDate < new Date();
            
            return `
                <div class="event-card ${isPast ? 'past-event' : ''}">
                    <h3>${typeIcons[event.type]} ${event.title}</h3>
                    <p>${event.description}</p>
                    <div class="event-info">
                        <span>📅 ${eventDate.toLocaleDateString('pt-BR')}</span>
                        <span>🕐 ${eventDate.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</span>
                        <span>👥 ${event.groupName}</span>
                        <span>✅ ${event.participants.length} confirmados</span>
                    </div>
                    ${event.recurring ? '<div class="recurring-badge">🔄 Evento Recorrente</div>' : ''}
                    <div class="event-actions">
                        ${!isPast ? (isParticipant ? 
                            `<button class="btn-small btn-delete" onclick="app.leaveEvent(${event.id})">❌ Cancelar Presença</button>` :
                            `<button class="btn-small btn-join" onclick="app.joinEvent(${event.id})">✅ Confirmar Presença</button>`
                        ) : '<span class="past-label">Evento finalizado</span>'}
                        ${event.createdBy === this.currentUser ? 
                            `<button class="btn-small btn-delete" onclick="app.deleteEvent(${event.id})">🗑️ Excluir</button>` : ''
                        }
                    </div>
                </div>
            `;
        }).join('');
    }

    populateGroupSelects() {
        const selects = ['eventGroup', 'groupFilter'];
        
        selects.forEach(selectId => {
            const select = document.getElementById(selectId);
            const currentValue = select.value;
            
            // Limpar opções existentes (exceto a primeira)
            while (select.children.length > 1) {
                select.removeChild(select.lastChild);
            }
            
            // Adicionar grupos
            this.groups.forEach(group => {
                const option = document.createElement('option');
                option.value = group.id;
                option.textContent = group.name;
                select.appendChild(option);
            });
            
            // Restaurar valor selecionado
            select.value = currentValue;
        });
    }

    // NOTIFICAÇÕES
    requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }

    scheduleNotification(event) {
        const eventTime = new Date(event.date + 'T' + event.time);
        const notificationSettings = JSON.parse(localStorage.getItem('notificationSettings')) || { timing: 15 };
        const notificationTime = new Date(eventTime.getTime() - (notificationSettings.timing * 60 * 1000));
        
        if (notificationTime > new Date()) {
            setTimeout(() => {
                this.showNotification(event);
            }, notificationTime.getTime() - new Date().getTime());
        }
    }

    showNotification(event) {
        const browserNotifications = document.getElementById('browserNotifications').checked;
        
        if (browserNotifications && 'Notification' in window && Notification.permission === 'granted') {
            new Notification(`📅 ${event.title}`, {
                body: `O evento "${event.title}" começará em breve!\n${event.description}`,
                icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="0.9em" font-size="90">🗓️</text></svg>',
                requireInteraction: true
            });
        }
        
        this.addNotification(`⏰ Lembrete: "${event.title}" começará em breve!`);
    }

    startNotificationChecker() {
        setInterval(() => {
            const now = new Date();
            const notificationSettings = JSON.parse(localStorage.getItem('notificationSettings')) || { timing: 15 };
            
            this.events.forEach(event => {
                const eventTime = new Date(event.date + 'T' + event.time);
                const notificationTime = new Date(eventTime.getTime() - (notificationSettings.timing * 60 * 1000));
                
                if (Math.abs(now.getTime() - notificationTime.getTime()) < 30000) { // 30 segundos de tolerância
                    if (!event.notificationSent) {
                        this.showNotification(event);
                        event.notificationSent = true;
                        this.saveData();
                    }
                }
            });
        }, 30000); // Verificar a cada 30 segundos
    }

    addNotification(message) {
        const notification = {
            id: Date.now(),
            message,
            timestamp: new Date().toISOString(),
            read: false
        };
        
        this.notifications.unshift(notification);
        this.saveData();
        this.renderNotifications();
    }

    clearNotifications() {
        if (confirm('Tem certeza que deseja limpar todas as notificações?')) {
            this.notifications = [];
            this.saveData();
            this.renderNotifications();
        }
    }

    renderNotifications() {
        const container = document.getElementById('notificationsList');
        
        if (this.notifications.length === 0) {
            container.innerHTML = '<div class="empty-state">Nenhuma notificação no momento 🔕</div>';
            return;
        }

        container.innerHTML = this.notifications.map(notification => `
            <div class="notification-item ${notification.read ? 'read' : ''}">
                <div class="notification-content">
                    <p>${notification.message}</p>
                    <small>${new Date(notification.timestamp).toLocaleString('pt-BR')}</small>
                </div>
            </div>
        `).join('');
    }

    saveNotificationSettings() {
        const settings = {
            browser: document.getElementById('browserNotifications').checked,
            email: document.getElementById('emailNotifications').checked,
            timing: parseInt(document.getElementById('notificationTiming').value)
        };
        
        localStorage.setItem('notificationSettings', JSON.stringify(settings));
    }

    shareApp() {
        if (navigator.share) {
            navigator.share({
                title: 'GroupScheduler - Agenda Colaborativa',
                text: 'Organize eventos em grupo de forma colaborativa!',
                url: window.location.href
            });
        } else {
            // Fallback para navegadores que não suportam Web Share API
            const url = window.location.href;
            navigator.clipboard.writeText(url).then(() => {
                alert('Link do aplicativo copiado para a área de transferência! 📋');
            });
        }
    }

    saveData() {
        localStorage.setItem('groups', JSON.stringify(this.groups));
        localStorage.setItem('events', JSON.stringify(this.events));
        localStorage.setItem('notifications', JSON.stringify(this.notifications));
    }
}

// Inicializar aplicativo
const app = new GroupScheduler();

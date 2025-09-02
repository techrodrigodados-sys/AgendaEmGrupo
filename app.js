class GroupScheduler {
    constructor() {
        this.groups = this.loadFromStorage('groups', []);
        this.events = this.loadFromStorage('events', []);
        this.notifications = this.loadFromStorage('notifications', []);
        this.currentUser = 'Rodrigo';
        this.swRegistration = null;
        this.currentGroupId = null;
        this.notificationTimers = new Map();
        
        this.init();
        this.setupEventListeners();
        this.setupNotificationSystem();
    }

    // INICIALIZAÇÃO
    async init() {
        try {
            this.renderGroups();
            this.renderEvents();
            this.renderNotifications();
            this.populateGroupSelects();
            this.loadNotificationSettings();
            this.handleURLParameters();
            this.cleanupPastEvents();
            
            console.log('✅ Organizador Rola inicializado com sucesso');
        } catch (error) {
            console.error('❌ Erro na inicialização:', error);
            this.showCustomAlert('Erro ao inicializar o aplicativo. Recarregue a página.', '❌');
        }
    }

    // UTILITÁRIOS DE ARMAZENAMENTO
    loadFromStorage(key, defaultValue = []) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : defaultValue;
        } catch (error) {
            console.error(`Erro ao carregar ${key}:`, error);
            return defaultValue;
        }
    }

    saveData() {
        try {
            localStorage.setItem('groups', JSON.stringify(this.groups));
            localStorage.setItem('events', JSON.stringify(this.events));
            localStorage.setItem('notifications', JSON.stringify(this.notifications));
        } catch (error) {
            console.error('Erro ao salvar dados:', error);
            this.showCustomAlert('Erro ao salvar dados. Verifique o espaço disponível.', '⚠️');
        }
    }

    // SISTEMA DE NOTIFICAÇÕES AVANÇADO
    async setupNotificationSystem() {
        try {
            // Registrar Service Worker
            if ('serviceWorker' in navigator) {
                const registration = await navigator.serviceWorker.register('sw.js');
                this.swRegistration = registration;
                console.log('Service Worker registrado:', registration);
                
                // Mostrar notificação de boas-vindas se for primeira vez
                if (!localStorage.getItem('appInstalled')) {
                    localStorage.setItem('appInstalled', 'true');
                    setTimeout(() => this.showWelcomeNotification(), 2000);
                }
            }

            // Solicitar permissão para notificações
            await this.requestNotificationPermission();

            // Configurar Background Sync
            if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
                navigator.serviceWorker.ready.then(registration => {
                    return registration.sync.register('background-sync-notifications');
                });
            }

            // Iniciar verificador de notificações
            this.startAdvancedNotificationChecker();
            
        } catch (error) {
            console.error('Erro ao configurar notificações:', error);
        }
    }

    async requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            try {
                const permission = await Notification.requestPermission();
                console.log('Permissão de notificação:', permission);
            } catch (error) {
                console.error('Erro ao solicitar permissão:', error);
            }
        }
    }

    showWelcomeNotification() {
        if ('serviceWorker' in navigator && this.swRegistration && Notification.permission === 'granted') {
            this.swRegistration.showNotification('🎉 Organizador Rola Ativado!', {
                body: 'Você receberá notificações dos seus eventos agendados como alarmes do celular.',
                icon: this.getEventIcon('outro'),
                vibrate: [200, 100, 200],
                requireInteraction: false,
                silent: false,
                actions: [
                    { action: 'start', title: '✅ Começar a usar' }
                ]
            });
        }
    }

    handleURLParameters() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const eventId = urlParams.get('event');
            const action = urlParams.get('action');
            
            if (eventId && action === 'join') {
                this.joinEvent(parseInt(eventId));
                // Limpar URL
                window.history.replaceState({}, document.title, window.location.pathname);
            }
        } catch (error) {
            console.error('Erro ao processar parâmetros da URL:', error);
        }
    }

    // EVENT LISTENERS
    setupEventListeners() {
        try {
            // Tabs
            this.delegateEvent('.tab', 'click', (e) => this.switchTab(e.target.dataset.tab));

            // Grupos
            this.getElementById('createGroupBtn')?.addEventListener('click', () => this.showModal('createGroupModal'));
            this.getElementById('saveGroupBtn')?.addEventListener('click', () => this.createGroup());
            this.getElementById('cancelGroupBtn')?.addEventListener('click', () => this.hideModal('createGroupModal'));

            // Membros
            this.getElementById('addMemberBtn')?.addEventListener('click', () => this.addMember());
            this.getElementById('closeMembersBtn')?.addEventListener('click', () => this.hideModal('membersModal'));

            // Eventos
            this.getElementById('createEventBtn')?.addEventListener('click', () => this.showModal('createEventModal'));
            this.getElementById('saveEventBtn')?.addEventListener('click', () => this.createEvent());
            this.getElementById('cancelEventBtn')?.addEventListener('click', () => this.hideModal('createEventModal'));

            // Filtros
            this.getElementById('groupFilter')?.addEventListener('change', () => this.renderEvents());
            this.getElementById('typeFilter')?.addEventListener('change', () => this.renderEvents());

            // Notificações
            this.getElementById('clearNotificationsBtn')?.addEventListener('click', () => this.clearNotifications());
            this.getElementById('shareAppBtn')?.addEventListener('click', () => this.shareApp());

            // Configurações
            this.setupNotificationSettingsListeners();
            this.setupAdvancedEventListeners();

        } catch (error) {
            console.error('Erro ao configurar event listeners:', error);
        }
    }

    setupNotificationSettingsListeners() {
        const settings = ['browserNotifications', 'vibrationNotifications', 'calendarIntegration', 'notificationTiming'];
        settings.forEach(id => {
            this.getElementById(id)?.addEventListener('change', () => this.saveNotificationSettings());
        });
    }

    setupAdvancedEventListeners() {
        this.getElementById('addToCalendarBtn')?.addEventListener('click', () => this.exportAllEventsToCalendar());
    }

    // Método utilitário para event delegation
    delegateEvent(selector, event, handler) {
        document.addEventListener(event, (e) => {
            if (e.target.matches(selector)) {
                handler(e);
            }
        });
    }

    // Método utilitário para getElementById com verificação
    getElementById(id) {
        const element = document.getElementById(id);
        if (!element) {
            console.warn(`Elemento não encontrado: ${id}`);
        }
        return element;
    }

    // INTERFACE
    switchTab(tabName) {
        if (!tabName) return;
        
        try {
            // Remover classe active de todas as tabs
            document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

            // Adicionar classe active na tab selecionada
            const selectedTab = document.querySelector(`[data-tab="${tabName}"]`);
            const selectedContent = document.getElementById(tabName);
            
            if (selectedTab) selectedTab.classList.add('active');
            if (selectedContent) selectedContent.classList.add('active');
        } catch (error) {
            console.error('Erro ao trocar tab:', error);
        }
    }

    showModal(modalId) {
        const modal = this.getElementById(modalId);
        if (modal) {
            modal.style.display = 'block';
        }
    }

    hideModal(modalId) {
        const modal = this.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
            this.clearModalInputs(modalId);
        }
    }

    clearModalInputs(modalId) {
        const modal = this.getElementById(modalId);
        if (!modal) return;

        modal.querySelectorAll('input, textarea, select').forEach(input => {
            if (input.type !== 'checkbox') {
                input.value = '';
            }
        });
    }

    // GRUPOS
    createGroup() {
        const nameInput = this.getElementById('groupName');
        const descriptionInput = this.getElementById('groupDescription');
        
        if (!nameInput || !descriptionInput) {
            this.showCustomAlert('Erro: campos não encontrados.', '❌');
            return;
        }

        const name = nameInput.value.trim();
        const description = descriptionInput.value.trim();

        if (!name) {
            this.showCustomAlert('Por favor, insira um nome para o grupo.', '⚠️');
            return;
        }

        // Verificar se já existe um grupo com o mesmo nome
        if (this.groups.some(group => group.name.toLowerCase() === name.toLowerCase())) {
            this.showCustomAlert('Já existe um grupo com esse nome.', '⚠️');
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
        this.showCustomAlert(`Grupo "${name}" criado com sucesso!`, '🎉');
    }

    deleteGroup(groupId) {
        const group = this.groups.find(g => g.id === groupId);
        if (!group) return;

        if (this.showCustomConfirm(`Tem certeza que deseja excluir o grupo "${group.name}"? Esta ação não pode ser desfeita.`, '🗑️')) {
            // Contar eventos que serão excluídos
            const eventsToDelete = this.events.filter(event => event.groupId === groupId);
            
            this.groups = this.groups.filter(group => group.id !== groupId);
            this.events = this.events.filter(event => event.groupId !== groupId);
            
            // Cancelar notificações dos eventos excluídos
            eventsToDelete.forEach(event => {
                this.cancelEventNotifications(event.id);
            });
            
            this.saveData();
            this.renderGroups();
            this.renderEvents();
            this.populateGroupSelects();
            
            this.addNotification(`Grupo "${group.name}" e ${eventsToDelete.length} eventos excluídos`);
        }
    }

    manageMembers(groupId) {
        this.currentGroupId = groupId;
        this.renderMembersList(groupId);
        this.showModal('membersModal');
    }

    addMember() {
        const nameInput = this.getElementById('memberName');
        const emailInput = this.getElementById('memberEmail');
        
        if (!nameInput || !emailInput) return;

        const name = nameInput.value.trim();
        const email = emailInput.value.trim();

        if (!name || !email) {
            this.showCustomAlert('Por favor, preencha nome e email do membro.', '⚠️');
            return;
        }

        // Validar email
        if (!this.validateEmail(email)) {
            this.showCustomAlert('Por favor, insira um email válido.', '⚠️');
            return;
        }

        const group = this.groups.find(g => g.id === this.currentGroupId);
        if (!group) return;

        // Verificar se o membro já existe
        if (group.members.some(member => member.email === email)) {
            this.showCustomAlert('Este membro já está no grupo.', '⚠️');
            return;
        }

        group.members.push({ name, email, isAdmin: false });
        this.saveData();
        this.renderMembersList(this.currentGroupId);
        this.renderGroups();
        
        nameInput.value = '';
        emailInput.value = '';
        this.addNotification(`${name} foi adicionado ao grupo "${group.name}"`);
    }

    removeMember(groupId, memberEmail) {
        const group = this.groups.find(g => g.id === groupId);
        if (!group) return;

        const member = group.members.find(m => m.email === memberEmail);
        if (!member) return;

        if (this.showCustomConfirm(`Remover ${member.name} do grupo?`, '🗑️')) {
            group.members = group.members.filter(member => member.email !== memberEmail);
            this.saveData();
            this.renderMembersList(groupId);
            this.renderGroups();
            this.addNotification(`${member.name} foi removido do grupo "${group.name}"`);
        }
    }

    renderGroups() {
        const container = this.getElementById('groupsList');
        if (!container) return;
        
        if (this.groups.length === 0) {
            container.innerHTML = '<div class="empty-state">Nenhum grupo criado ainda. Crie seu primeiro grupo!</div>';
            return;
        }

        container.innerHTML = this.groups.map(group => `
            <div class="group-card">
                <h3>${this.escapeHtml(group.name)}</h3>
                <p>${this.escapeHtml(group.description)}</p>
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
        const container = this.getElementById('membersList');
        
        if (!group || !container) return;

        container.innerHTML = group.members.map(member => `
            <div class="member-item">
                <div>
                    <strong>${this.escapeHtml(member.name)}</strong>
                    <br>
                    <small>${this.escapeHtml(member.email)}</small>
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
        const inputs = {
            title: this.getElementById('eventTitle'),
            description: this.getElementById('eventDescription'),
            groupId: this.getElementById('eventGroup'),
            type: this.getElementById('eventType'),
            date: this.getElementById('eventDate'),
            time: this.getElementById('eventTime'),
            recurring: this.getElementById('eventRecurring')
        };

        // Verificar se todos os elementos existem
        for (const [key, element] of Object.entries(inputs)) {
            if (!element) {
                this.showCustomAlert(`Erro: campo ${key} não encontrado.`, '❌');
                return;
            }
        }

        const title = inputs.title.value.trim();
        const description = inputs.description.value.trim();
        const groupId = parseInt(inputs.groupId.value);
        const type = inputs.type.value;
        const date = inputs.date.value;
        const time = inputs.time.value;
        const recurring = inputs.recurring.checked;

        if (!title || !groupId || !date || !time) {
            this.showCustomAlert('Por favor, preencha todos os campos obrigatórios.', '⚠️');
            return;
        }

        // Validar data não pode ser no passado
        const eventDateTime = new Date(date + 'T' + time);
        if (eventDateTime <= new Date()) {
            this.showCustomAlert('A data e hora do evento devem ser no futuro.', '⚠️');
            return;
        }

        const group = this.groups.find(g => g.id === groupId);
        if (!group) {
            this.showCustomAlert('Grupo não encontrado.', '❌');
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
            participants: [this.currentUser],
            notificationSent: false
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
                    date: recurringDate.toISOString().split('T')[0],
                    notificationSent: false
                };
                
                // Não criar eventos recorrentes no passado
                if (new Date(recurringEvent.date + 'T' + time) > new Date()) {
                    this.events.push(recurringEvent);
                }
            }
        }

        this.saveData();
        this.renderEvents();
        this.hideModal('createEventModal');
        this.addNotification(`Evento "${title}" criado para ${eventDateTime.toLocaleString('pt-BR')} 🎯`);
        
        // Agendar notificações
        this.scheduleNativeNotification(event);
        
        // Adicionar ao calendário automaticamente se configurado
        const settings = this.loadFromStorage('notificationSettings', {});
        if (settings.calendarIntegration) {
            this.addToNativeCalendar(event);
        }
        
        this.showCustomAlert(`Evento "${title}" criado com sucesso!`, '🎯');
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
        const event = this.events.find(e => e.id === eventId);
        if (!event) return;

        if (this.showCustomConfirm(`Tem certeza que deseja excluir o evento "${event.title}"?`, '🗑️')) {
            this.events = this.events.filter(event => event.id !== eventId);
            this.cancelEventNotifications(eventId);
            this.saveData();
            this.renderEvents();
            this.addNotification(`Evento "${event.title}" foi excluído`);
        }
    }

    renderEvents() {
        const container = this.getElementById('eventsList');
        if (!container) return;

        const groupFilter = this.getElementById('groupFilter')?.value || '';
        const typeFilter = this.getElementById('typeFilter')?.value || '';

        let filteredEvents = [...this.events];

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
                    <h3>${typeIcons[event.type]} ${this.escapeHtml(event.title)}</h3>
                    <p>${this.escapeHtml(event.description)}</p>
                    <div class="event-info">
                        <span class="event-date">📅 ${eventDate.toLocaleDateString('pt-BR')}</span>
                        <span>🕐 ${eventDate.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</span>
                        <span>👥 ${this.escapeHtml(event.groupName)}</span>
                        <span>✅ ${event.participants.length} confirmados</span>
                    </div>
                    ${event.recurring ? '<div class="recurring-badge">🔄 Evento Recorrente</div>' : ''}
                    <div class="event-actions">
                        ${!isPast ? (isParticipant ?
                            `<button class="btn-small btn-delete" onclick="app.leaveEvent(${event.id})">❌ Cancelar Presença</button>` :
                            `<button class="btn-small btn-join" onclick="app.joinEvent(${event.id})">✅ Confirmar Presença</button>`
                        ) : '<span class="past-label">Evento finalizado</span>'}
                        <button class="btn-small btn-manage" onclick="app.addToNativeCalendar(${JSON.stringify(event).replace(/"/g, '&quot;')})">
                            📅 Adicionar ao Calendário
                        </button>
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
            const select = this.getElementById(selectId);
            if (!select) return;

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

    // SISTEMA DE NOTIFICAÇÕES
    scheduleNativeNotification(event) {
        const eventTime = new Date(event.date + 'T' + event.time);
        const notificationSettings = this.loadFromStorage('notificationSettings', {
            timing: 15,
            vibration: true,
            browser: true
        });

        // Múltiplas notificações
        const notifications = [
            { time: notificationSettings.timing, text: `em ${notificationSettings.timing} minutos` },
            { time: 5, text: 'em 5 minutos' },
            { time: 0, text: 'AGORA' }
        ];

        notifications.forEach(notification => {
            const notificationTime = new Date(eventTime.getTime() - (notification.time * 60 * 1000));
            if (notificationTime > new Date()) {
                const timerId = setTimeout(() => {
                    this.sendNativeNotification(event, notification.text);
                }, notificationTime.getTime() - new Date().getTime());
                
                // Armazenar timer para poder cancelar depois
                if (!this.notificationTimers.has(event.id)) {
                    this.notificationTimers.set(event.id, []);
                }
                this.notificationTimers.get(event.id).push(timerId);
            }
        });
    }

    cancelEventNotifications(eventId) {
        if (this.notificationTimers.has(eventId)) {
            this.notificationTimers.get(eventId).forEach(timerId => {
                clearTimeout(timerId);
            });
            this.notificationTimers.delete(eventId);
        }
    }

    sendNativeNotification(event, timeText) {
        const settings = this.loadFromStorage('notificationSettings', {
            browser: true,
            vibration: true
        });

        if (!settings.browser || Notification.permission !== 'granted') return;

        if ('serviceWorker' in navigator && this.swRegistration) {
            this.swRegistration.showNotification(`🗓️ ${event.title}`, {
                body: `Seu evento "${event.title}" começará ${timeText}!\n📍 Grupo: ${event.groupName}\n📝 ${event.description}`,
                icon: this.getEventIcon(event.type),
                vibrate: settings.vibration ? [300, 100, 300, 100, 300] : [],
                requireInteraction: true,
                silent: false,
                actions: [
                    { action: 'join', title: '✅ Confirmar Presença' },
                    { action: 'calendar', title: '📅 Ver no Calendário' },
                    { action: 'snooze', title: '⏰ Lembrar em 5min' }
                ],
                data: {
                    eventId: event.id,
                    url: `/?event=${event.id}`
                }
            });
        }

        // Vibração adicional se suportada
        if (settings.vibration && 'vibrate' in navigator) {
            navigator.vibrate([300, 100, 300, 100, 300]);
        }

        this.addNotification(`⏰ Lembrete: "${event.title}" começará ${timeText}!`);
    }

    getEventIcon(eventType) {
        const icons = {
            esporte: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%2327ae60"/><text y="0.9em" font-size="80" x="50%" text-anchor="middle" fill="white">🏃</text></svg>',
            leitura: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%233498db"/><text y="0.9em" font-size="80" x="50%" text-anchor="middle" fill="white">📚</text></svg>',
            administracao: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23e74c3c"/><text y="0.9em" font-size="80" x="50%" text-anchor="middle" fill="white">⏰</text></svg>',
            outro: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23667eea"/><text y="0.9em" font-size="80" x="50%" text-anchor="middle" fill="white">📝</text></svg>'
        };
        return icons[eventType] || icons.outro;
    }

    // INTEGRAÇÃO COM CALENDÁRIO
    addToNativeCalendar(event) {
        try {
            const eventTime = new Date(event.date + 'T' + event.time);
            const endTime = new Date(eventTime.getTime() + (60 * 60 * 1000)); // 1 hora depois
            const icsContent = this.generateICS(event, eventTime, endTime);
            
            const blob = new Blob([icsContent], { type: 'text/calendar' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${event.title}.ics`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            this.addNotification(`📅 Evento "${event.title}" exportado para o calendário!`);
            this.showCustomAlert('Arquivo de calendário baixado! Abra-o para adicionar ao seu calendário.', '📅');
        } catch (error) {
            console.error('Erro ao exportar evento:', error);
            this.showCustomAlert('Erro ao exportar evento para o calendário.', '❌');
        }
    }

    generateICS(event, startTime, endTime) {
        const formatDate = (date) => {
            return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        };

        return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//OrganizadorRola//OrganizadorRola//PT
CALSCALE:GREGORIAN
METHOD:PUBLISH
BEGIN:VEVENT
UID:${event.id}@organizadorrola.app
DTSTART:${formatDate(startTime)}
DTEND:${formatDate(endTime)}
SUMMARY:${event.title}
DESCRIPTION:${event.description}\\n\\nGrupo: ${event.groupName}\\n\\nCriado via Organizador Rola
LOCATION:Grupo ${event.groupName}
STATUS:CONFIRMED
SEQUENCE:0
BEGIN:VALARM
TRIGGER:-PT15M
DESCRIPTION:Lembrete: ${event.title}
ACTION:DISPLAY
END:VALARM
BEGIN:VALARM
TRIGGER:-PT5M
DESCRIPTION:Lembrete: ${event.title} em 5 minutos
ACTION:DISPLAY
END:VALARM
END:VEVENT
END:VCALENDAR`;
    }

    exportAllEventsToCalendar() {
        if (this.events.length === 0) {
            this.showCustomAlert('Nenhum evento para exportar.', '⚠️');
            return;
        }

        try {
            let icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//OrganizadorRola//OrganizadorRola//PT
CALSCALE:GREGORIAN
METHOD:PUBLISH`;

            this.events.forEach(event => {
                const eventTime = new Date(event.date + 'T' + event.time);
                const endTime = new Date(eventTime.getTime() + (60 * 60 * 1000));
                
                const formatDate = (date) => {
                    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
                };

                icsContent += `
BEGIN:VEVENT
UID:${event.id}@organizadorrola.app
DTSTART:${formatDate(eventTime)}
DTEND:${formatDate(endTime)}
SUMMARY:${event.title}
DESCRIPTION:${event.description}\\n\\nGrupo: ${event.groupName}\\n\\nCriado via Organizador Rola
LOCATION:Grupo ${event.groupName}
STATUS:CONFIRMED
SEQUENCE:0
BEGIN:VALARM
TRIGGER:-PT15M
DESCRIPTION:Lembrete: ${event.title}
ACTION:DISPLAY
END:VALARM
END:VEVENT`;
            });

            icsContent += `
END:VCALENDAR`;

            const blob = new Blob([icsContent], { type: 'text/calendar' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'OrganizadorRola-Eventos.ics';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            this.addNotification(`📅 ${this.events.length} eventos exportados para o calendário!`);
            this.showCustomAlert('Todos os eventos foram exportados para o calendário!', '📅');
        } catch (error) {
            console.error('Erro ao exportar eventos:', error);
            this.showCustomAlert('Erro ao exportar eventos para o calendário.', '❌');
        }
    }

    // VERIFICADOR DE NOTIFICAÇÕES
    startAdvancedNotificationChecker() {
        // Verificar a cada 30 segundos
        setInterval(() => {
            this.checkPendingNotifications();
        }, 30000);

        // Verificar quando o app volta ao foco
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.checkPendingNotifications();
            }
        });

        // Verificar quando o app é aberto
        window.addEventListener('focus', () => {
            this.checkPendingNotifications();
        });
    }

    checkPendingNotifications() {
        const now = new Date();
        
        this.events.forEach(event => {
            if (event.notificationSent) return;
            
            const eventTime = new Date(event.date + 'T' + event.time);
            const notificationSettings = this.loadFromStorage('notificationSettings', { timing: 15 });
            const notificationTime = new Date(eventTime.getTime() - (notificationSettings.timing * 60 * 1000));
            
            if (Math.abs(now.getTime() - notificationTime.getTime()) < 60000) { // 1 minuto de tolerância
                this.sendNativeNotification(event, `em ${notificationSettings.timing} minutos`);
                event.notificationSent = true;
                this.saveData();
            }
        });
    }

    // NOTIFICAÇÕES INTERNAS
    addNotification(message) {
        const notification = {
            id: Date.now(),
            message,
            timestamp: new Date().toISOString(),
            read: false
        };
        
        this.notifications.unshift(notification);
        
        // Manter apenas as últimas 50 notificações
        if (this.notifications.length > 50) {
            this.notifications = this.notifications.slice(0, 50);
        }
        
        this.saveData();
        this.renderNotifications();
    }

    clearNotifications() {
        if (this.showCustomConfirm('Tem certeza que deseja limpar todas as notificações?', '🗑️')) {
            this.notifications = [];
            this.saveData();
            this.renderNotifications();
        }
    }

    renderNotifications() {
        const container = this.getElementById('notificationsList');
        if (!container) return;
        
        if (this.notifications.length === 0) {
            container.innerHTML = '<div class="empty-state">Nenhuma notificação no momento 🔕</div>';
            return;
        }

        container.innerHTML = this.notifications.map(notification => `
            <div class="notification-item ${notification.read ? 'read' : ''}">
                <div class="notification-content">
                    <p>${this.escapeHtml(notification.message)}</p>
                    <small>${new Date(notification.timestamp).toLocaleString('pt-BR')}</small>
                </div>
            </div>
        `).join('');
    }

    // CONFIGURAÇÕES
    loadNotificationSettings() {
        const settings = this.loadFromStorage('notificationSettings', {
            browser: true,
            vibration: true,
            calendarIntegration: false,
            timing: 15
        });

        // Aplicar configurações aos elementos
        const elements = {
            browserNotifications: settings.browser,
            vibrationNotifications: settings.vibration,
            calendarIntegration: settings.calendarIntegration,
            notificationTiming: settings.timing
        };

        Object.entries(elements).forEach(([id, value]) => {
            const element = this.getElementById(id);
            if (element) {
                if (element.type === 'checkbox') {
                    element.checked = value;
                } else {
                    element.value = value;
                }
            }
        });
    }

    saveNotificationSettings() {
        const settings = {
            browser: this.getElementById('browserNotifications')?.checked || true,
            vibration: this.getElementById('vibrationNotifications')?.checked || true,
            calendarIntegration: this.getElementById('calendarIntegration')?.checked || false,
            timing: parseInt(this.getElementById('notificationTiming')?.value || 15)
        };
        
        localStorage.setItem('notificationSettings', JSON.stringify(settings));
        this.addNotification('⚙️ Configurações de notificação salvas!');
    }

    // COMPARTILHAMENTO
    shareApp() {
        const appUrl = window.location.href;
        const appName = 'Organizador Rola';
        const appDescription = 'Organize eventos em grupo de forma colaborativa!';
        
        if (navigator.share) {
            navigator.share({
                title: appName,
                text: appDescription,
                url: appUrl
            }).catch(err => console.log('Erro ao compartilhar:', err));
        } else {
            this.showShareOptions(appUrl, appName, appDescription);
        }
    }

    showShareOptions(url, name, description) {
        const shareModal = document.createElement('div');
        shareModal.className = 'share-modal';
        shareModal.innerHTML = `
            <div class="share-content">
                <h3>📤 Compartilhar App</h3>
                <p>Escolha como compartilhar o ${name}:</p>
                
                <div class="share-buttons">
                    <button class="share-btn whatsapp" onclick="window.open('https://wa.me/?text=' + encodeURIComponent('🎯 ${name}\\n\\n${description}\\n\\n👉 ${url}'), '_blank'); document.body.removeChild(document.querySelector('.share-modal'));">
                        💚 WhatsApp
                    </button>
                    <button class="share-btn telegram" onclick="window.open('https://t.me/share/url?url=' + encodeURIComponent('${url}') + '&text=' + encodeURIComponent('🎯 ${name}\\n\\n${description}'), '_blank'); document.body.removeChild(document.querySelector('.share-modal'));">
                        💙 Telegram
                    </button>
                    <button class="share-btn copy" onclick="navigator.clipboard.writeText('${url}').then(() => { alert('Link copiado!'); document.body.removeChild(document.querySelector('.share-modal')); });">
                        📋 Copiar Link
                    </button>
                    <button class="share-btn email" onclick="window.open('mailto:?subject=' + encodeURIComponent('Confira o ${name}!') + '&body=' + encodeURIComponent('Olá!\\n\\nRecomendo o ${name} para organizar eventos em grupo:\\n\\n${description}\\n\\nAcesse: ${url}')); document.body.removeChild(document.querySelector('.share-modal'));">
                        📧 Email
                    </button>
                </div>
                
                <button class="close-share" onclick="document.body.removeChild(document.querySelector('.share-modal'));">❌ Fechar</button>
            </div>
        `;
        
        document.body.appendChild(shareModal);
    }

    // UTILITÁRIOS
    validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    cleanupPastEvents() {
        const now = new Date();
        const oneMonthAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
        
        const initialLength = this.events.length;
        this.events = this.events.filter(event => {
            const eventDate = new Date(event.date + 'T' + event.time);
            return eventDate > oneMonthAgo;
        });
        
        if (this.events.length < initialLength) {
            this.saveData();
            console.log(`Limpeza: ${initialLength - this.events.length} eventos antigos removidos`);
        }
    }

    showCustomAlert(message, icon = '💬') {
        const alert = document.createElement('div');
        alert.className = 'custom-alert';
        alert.innerHTML = `
            <div class="alert-content">
                <span class="alert-icon">${icon}</span>
                <span class="alert-message">${message}</span>
            </div>
        `;
        
        alert.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(255, 255, 255, 0.98);
            backdrop-filter: blur(20px);
            padding: 25px 30px;
            border-radius: 20px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
            z-index: 10000;
            border: 2px solid rgba(102, 126, 234, 0.3);
            min-width: 300px;
            text-align: center;
            font-weight: 600;
            color: #2c3e50;
        `;
        
        document.body.appendChild(alert);
        
        setTimeout(() => {
            if (alert.parentNode) {
                alert.parentNode.removeChild(alert);
            }
        }, 3000);
    }

    showCustomConfirm(message, icon = '❓') {
        return confirm(`${icon} ${message}`);
    }
}

// Inicializar aplicativo
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new GroupScheduler();
});

// PWA Install Prompt
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    
    const installBtn = document.getElementById('installAppBtn');
    if (installBtn) {
        installBtn.style.display = 'inline-block';
        installBtn.title = 'Instalar Organizador Rola como app';
        
        installBtn.addEventListener('click', async () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                
                const choiceResult = await deferredPrompt.userChoice;
                if (choiceResult.outcome === 'accepted') {
                    console.log('Usuário instalou o PWA');
                    app?.addNotification('🎉 Organizador Rola instalado com sucesso!');
                    installBtn.style.display = 'none';
                }
                deferredPrompt = null;
            }
        });
    }
});

window.addEventListener('appinstalled', () => {
    const installBtn = document.getElementById('installAppBtn');
    if (installBtn) {
        installBtn.style.display = 'none';
    }
    app?.addNotification('🎉 Organizador Rola instalado!');
});

// Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
            const registration = await navigator.serviceWorker.register('sw.js');
            console.log('SW registrado:', registration);
        } catch (error) {
            console.error('SW falhou:', error);
        }
    });
}

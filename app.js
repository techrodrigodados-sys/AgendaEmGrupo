class GroupScheduler {
    constructor() {
        this.groups = JSON.parse(localStorage.getItem('groups')) || [];
        this.events = JSON.parse(localStorage.getItem('events')) || [];
        this.notifications = JSON.parse(localStorage.getItem('notifications')) || [];
        this.currentUser = 'Rodrigo';
        this.swRegistration = null;
        
        this.init();
        this.setupEventListeners();
        this.setupNotificationSystem();
    }

    async init() {
        this.renderGroups();
        this.renderEvents();
        this.renderNotifications();
        this.populateGroupSelects();
        
        // Processar URL parameters (para notificações)
        this.handleURLParameters();
    }

    // Sistema de Notificações Avançado
    async setupNotificationSystem() {
        // Registrar Service Worker
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('sw.js');
                this.swRegistration = registration;
                console.log('Service Worker registrado:', registration);
                
                // Mostrar notificação de boas-vindas se for primeira vez
                const isFirstTime = !localStorage.getItem('appInstalled');
                if (isFirstTime) {
                    localStorage.setItem('appInstalled', 'true');
                    setTimeout(() => this.showWelcomeNotification(), 2000);
                }
            } catch (error) {
                console.error('Erro ao registrar Service Worker:', error);
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

        // Iniciar verificador de notificações avançado
        this.startAdvancedNotificationChecker();
    }

    async requestNotificationPermission() {
        if ('Notification' in window) {
            if (Notification.permission === 'default') {
                const permission = await Notification.requestPermission();
                if (permission === 'granted') {
                    console.log('Permissão de notificação concedida');
                } else {
                    console.log('Permissão de notificação negada');
                }
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
                    {
                        action: 'start',
                        title: '✅ Começar a usar'
                    }
                ]
            });
        }
    }

    handleURLParameters() {
        const urlParams = new URLSearchParams(window.location.search);
        const eventId = urlParams.get('event');
        const action = urlParams.get('action');
        
        if (eventId && action === 'join') {
            this.joinEvent(parseInt(eventId));
            // Limpar URL
            window.history.replaceState({}, document.title, window.location.pathname);
        }
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
        
        // Verificar se emailNotifications existe (compatibilidade)
        const emailNotifications = document.getElementById('emailNotifications');
        if (emailNotifications) {
            emailNotifications.addEventListener('change', () => this.saveNotificationSettings());
        }
        
        document.getElementById('notificationTiming').addEventListener('change', () => this.saveNotificationSettings());

        // Novos event listeners para funcionalidades avançadas
        this.setupAdvancedEventListeners();
    }

    setupAdvancedEventListeners() {
        // Adicionar ao calendário (se existir o botão)
        const addToCalendarBtn = document.getElementById('addToCalendarBtn');
        if (addToCalendarBtn) {
            addToCalendarBtn.addEventListener('click', () => this.exportAllEventsToCalendar());
        }

        // Vibração (se existir o checkbox)
        const vibrationNotifications = document.getElementById('vibrationNotifications');
        if (vibrationNotifications) {
            vibrationNotifications.addEventListener('change', () => this.saveNotificationSettings());
        }

        // Integração com calendário (se existir o checkbox)
        const calendarIntegration = document.getElementById('calendarIntegration');
        if (calendarIntegration) {
            calendarIntegration.addEventListener('change', () => this.saveNotificationSettings());
        }
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
        // REMOVIDO: blur no fundo
    }

    hideModal(modalId) {
        document.getElementById(modalId).style.display = 'none';
        this.clearModalInputs(modalId);
        // REMOVIDO: remover blur
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
            this.showCustomAlert('Por favor, insira um nome para o grupo.', '⚠️');
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
        if (this.showCustomConfirm('Tem certeza que deseja excluir este grupo? Esta ação não pode ser desfeita.', '🗑️')) {
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
            this.showCustomAlert('Por favor, preencha nome e email do membro.', '⚠️');
            return;
        }

        const group = this.groups.find(g => g.id === this.currentGroupId);
        if (group) {
            // Verificar se o membro já existe
            if (group.members.some(member => member.email === email)) {
                this.showCustomAlert('Este membro já está no grupo.', '⚠️');
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
            this.showCustomAlert('Por favor, preencha todos os campos obrigatórios.', '⚠️');
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
                this.events.push(recurringEvent);
            }
        }

        this.saveData();
        this.renderEvents();
        this.hideModal('createEventModal');
        this.addNotification(`Evento "${title}" criado para ${new Date(date + 'T' + time).toLocaleString('pt-BR')} 🎯`);
        
        // Agendar notificações nativas
        this.scheduleNativeNotification(event);
        
        // Adicionar ao calendário automaticamente se configurado
        const settings = JSON.parse(localStorage.getItem('notificationSettings')) || {};
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
        if (this.showCustomConfirm('Tem certeza que deseja excluir este evento?', '🗑️')) {
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
                        <span class="event-date">📅 ${eventDate.toLocaleDateString('pt-BR')}</span>
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
                        <button class="btn-small btn-manage" onclick="app.addToNativeCalendar({id: ${event.id}, title: '${event.title}', description: '${event.description}', date: '${event.date}', time: '${event.time}', groupName: '${event.groupName}'})">
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

    // SISTEMA DE NOTIFICAÇÕES AVANÇADO
    scheduleNativeNotification(event) {
        const eventTime = new Date(event.date + 'T' + event.time);
        const notificationSettings = JSON.parse(localStorage.getItem('notificationSettings')) || {
            timing: 15,
            vibration: true,
            browser: true
        };

        // Múltiplas notificações
        const notifications = [
            { time: notificationSettings.timing, text: `em ${notificationSettings.timing} minutos` },
            { time: 5, text: 'em 5 minutos' },
            { time: 0, text: 'AGORA' }
        ];

        notifications.forEach(notification => {
            const notificationTime = new Date(eventTime.getTime() - (notification.time * 60 * 1000));
            this.scheduleNotificationAt(event, notificationTime, notification.text);
        });
    }

    scheduleNotificationAt(event, notificationTime, timeText) {
        if (notificationTime > new Date()) {
            const timeoutDuration = notificationTime.getTime() - new Date().getTime();
            setTimeout(() => {
                this.sendNativeNotification(event, timeText);
            }, timeoutDuration);
        }
    }

    sendNativeNotification(event, timeText) {
        const settings = JSON.parse(localStorage.getItem('notificationSettings')) || {
            browser: true,
            vibration: true
        };

        if (!settings.browser || Notification.permission !== 'granted') return;

        if ('serviceWorker' in navigator && this.swRegistration) {
            this.swRegistration.showNotification(`🗓️ ${event.title}`, {
                body: `Seu evento "${event.title}" começará ${timeText}!\n📍 Grupo: ${event.groupName}\n📝 ${event.description}`,
                icon: this.getEventIcon(event.type),
                vibrate: settings.vibration ? [300, 100, 300, 100, 300] : [],
                requireInteraction: true,
                silent: false,
                actions: [
                    {
                        action: 'join',
                        title: '✅ Confirmar Presença'
                    },
                    {
                        action: 'calendar',
                        title: '📅 Ver no Calendário'
                    },
                    {
                        action: 'snooze',
                        title: '⏰ Lembrar em 5min'
                    }
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

    // INTEGRAÇÃO COM CALENDÁRIO NATIVO
    addToNativeCalendar(event) {
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
    }

    // VERIFICADOR DE NOTIFICAÇÕES AVANÇADO
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
            const notificationSettings = JSON.parse(localStorage.getItem('notificationSettings')) || { timing: 15 };
            const notificationTime = new Date(eventTime.getTime() - (notificationSettings.timing * 60 * 1000));
            
            if (Math.abs(now.getTime() - notificationTime.getTime()) < 60000) { // 1 minuto de tolerância
                this.sendNativeNotification(event, `em ${notificationSettings.timing} minutos`);
                event.notificationSent = true;
                this.saveData();
            }
        });
    }

    // NOTIFICAÇÕES LEGADAS (compatibilidade)
    scheduleNotification(event) {
        this.scheduleNativeNotification(event);
    }

    showNotification(event) {
        this.sendNativeNotification(event, 'em breve');
    }

    startNotificationChecker() {
        this.startAdvancedNotificationChecker();
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
        if (this.showCustomConfirm('Tem certeza que deseja limpar todas as notificações?', '🗑️')) {
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
            browser: document.getElementById('browserNotifications')?.checked || true,
            vibration: document.getElementById('vibrationNotifications')?.checked || true,
            calendarIntegration: document.getElementById('calendarIntegration')?.checked || false,
            timing: parseInt(document.getElementById('notificationTiming')?.value || 15)
        };
        
        localStorage.setItem('notificationSettings', JSON.stringify(settings));
        this.addNotification('⚙️ Configurações de notificação salvas!');
    }

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

    // Nova função para mostrar opções de compartilhamento
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

    // UTILITÁRIOS DE UI
    showCustomAlert(message, icon = '💬') {
        // Criar elemento de alerta personalizado
        const alert = document.createElement('div');
        alert.className = 'custom-alert';
        alert.innerHTML = `
            <div class="alert-content">
                <span class="alert-icon">${icon}</span>
                <span class="alert-message">${message}</span>
            </div>
        `;
        
        // Adicionar estilos inline para funcionar sem CSS adicional
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
        
        // Remover após 3 segundos
        setTimeout(() => {
            if (alert.parentNode) {
                alert.parentNode.removeChild(alert);
            }
        }, 3000);
    }

    showCustomConfirm(message, icon = '❓') {
        return confirm(`${icon} ${message}`);
    }

    saveData() {
        localStorage.setItem('groups', JSON.stringify(this.groups));
        localStorage.setItem('events', JSON.stringify(this.events));
        localStorage.setItem('notifications', JSON.stringify(this.notifications));
    }
}

// Inicializar aplicativo
const app = new GroupScheduler();

// PWA Install Prompt - Botão pequeno no header
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    
    // Mostrar botão pequeno no header
    const installBtn = document.getElementById('installAppBtn');
    if (installBtn) {
        installBtn.style.display = 'inline-block';
        installBtn.title = 'Instalar Organizador Rola como app';
        
        installBtn.addEventListener('click', () => {
            deferredPrompt.prompt();
            
            deferredPrompt.userChoice.then((choiceResult) => {
                if (choiceResult.outcome === 'accepted') {
                    console.log('Usuário instalou o PWA');
                    app.addNotification('🎉 Organizador Rola instalado com sucesso!');
                    installBtn.style.display = 'none';
                }
                deferredPrompt = null;
            });
        });
    }
});

// Esconder botão se já estiver instalado
window.addEventListener('appinstalled', () => {
    const installBtn = document.getElementById('installAppBtn');
    if (installBtn) {
        installBtn.style.display = 'none';
    }
    app.addNotification('🎉 Organizador Rola instalado!');
});

// Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(registration => {
                console.log('SW registrado:', registration);
            })
            .catch(error => {
                console.log('SW falhou:', error);
            });
    });
}

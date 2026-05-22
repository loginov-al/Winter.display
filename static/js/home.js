(function () {
    const api = window.WinterDisplay.api;
    const { initShell, setPageHeader } = window.WinterDisplay.shell;

    let groups = [];
    let photos = [];
    let screens = [];
    let settings = { defaultSlideInterval: 30 };

    let activeTab = new URLSearchParams(window.location.search).get('tab') === 'screens' ? 'screens' : 'gallery';
    let activeFilter = api.FILTER_ALL;
    let editingScreenId = null;

    const photoGrid = document.getElementById('photo-grid');
    const emptyPhotos = document.getElementById('empty-photos');
    const groupFilters = document.getElementById('group-filters');
    const screensGrid = document.getElementById('screens-grid');
    const emptyScreens = document.getElementById('empty-screens');
    const fileInput = document.getElementById('file-input');
    const dropzone = document.getElementById('dropzone');
    const topbarAction = document.getElementById('topbar-action');
    const screenModal = document.getElementById('screen-modal');
    const screenForm = document.getElementById('screen-form');

    function escapeHtml(value) {
        return String(value)
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;');
    }

    function formatDate(iso) {
        if (!iso) return 'ещё не подключался';
        return new Date(iso).toLocaleString('ru-RU', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
        });
    }

    function getStatusLabel(screen) {
        if (!screen.active) return { text: 'Пауза', className: 'paused' };
        if (screen.status === 'online') return { text: 'Онлайн', className: '' };
        if (screen.status === 'waiting') return { text: 'Ожидает', className: 'offline' };
        return { text: 'Оффлайн', className: 'offline' };
    }

    function switchTab(tab) {
        activeTab = tab;
        const navActive = tab === 'screens' ? 'screens' : 'home';

        document.querySelectorAll('.page-tab').forEach((button) => {
            button.classList.toggle('active', button.dataset.tab === tab);
        });

        document.querySelectorAll('.section').forEach((section) => {
            section.classList.toggle('active', section.dataset.section === tab);
        });

        if (tab === 'screens') {
            setPageHeader('Экраны', 'Создание и управление дисплеями');
            topbarAction.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 5v14M5 12h14"/>
                </svg>
                <span>Новый экран</span>
            `;
            topbarAction.onclick = () => openScreenModal();
        } else {
            setPageHeader('Главная', 'Ваши фотографии для экранов');
            topbarAction.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 5v14M5 12h14"/>
                </svg>
                <span>Загрузить</span>
            `;
            topbarAction.onclick = () => fileInput.click();
        }

        window.WinterDisplay.shell.renderNavigation(navActive);

        const url = tab === 'screens' ? '/home?tab=screens' : '/home';
        window.history.replaceState({}, '', url);
    }

    function renderFilters() {
        const items = [
            { id: api.FILTER_ALL, name: 'Все фото' },
            { id: api.FILTER_UNGROUPED, name: 'Без группы' },
            ...groups,
        ];

        groupFilters.innerHTML = items.map((group) => `
            <button class="chip ${activeFilter === group.id ? 'active' : ''}" type="button" data-filter="${group.id}">
                ${escapeHtml(group.name)}
            </button>
        `).join('');
    }

    function renderPhotos() {
        photoGrid.innerHTML = photos.map((photo) => `
            <article class="photo-card">
                <img src="${photo.url}" alt="${escapeHtml(photo.name)}">
                <div class="photo-card-actions">
                    <select data-photo-id="${photo.id}" aria-label="Группа">
                        ${groups.map((group) => `
                            <option value="${group.id}" ${photo.groupId === group.id ? 'selected' : ''}>${escapeHtml(group.name)}</option>
                        `).join('')}
                        <option value="" ${!photo.groupId ? 'selected' : ''}>Без группы</option>
                    </select>
                    <button class="danger" type="button" data-delete-photo="${photo.id}">Удалить</button>
                </div>
            </article>
        `).join('');

        emptyPhotos.hidden = photos.length > 0;
        photoGrid.hidden = photos.length === 0;
    }

    function renderScreens() {
        if (!screens.length) {
            screensGrid.innerHTML = '';
            emptyScreens.hidden = false;
            return;
        }

        emptyScreens.hidden = true;
        screensGrid.innerHTML = screens.map((screen) => {
            const status = getStatusLabel(screen);
            const description = screen.description ? escapeHtml(screen.description) : '';

            return `
                <article class="screen-card">
                    <div class="screen-card-top">
                        <div>
                            <h3>${escapeHtml(screen.name)}</h3>
                            ${description ? `<p>${description}</p>` : ''}
                        </div>
                        <span class="status-badge ${status.className}">● ${status.text}</span>
                    </div>

                    <div class="screen-meta">
                        <div>Группа: <strong>${escapeHtml(screen.groupName)}</strong></div>
                        <div>Смена: <strong>${screen.slideInterval} сек</strong></div>
                        <div>Синхронизация: <strong>${formatDate(screen.lastSync)}</strong></div>
                    </div>

                    <div class="token-box">
                        <span>Код: <code>${screen.token}</code></span>
                        <button class="secondary-btn" type="button" data-copy-token="${screen.token}">Копировать</button>
                    </div>

                    <div class="screen-actions">
                        <button class="secondary-btn" type="button" data-open-tv="${screen.token}">Открыть TV</button>
                        <button class="secondary-btn" type="button" data-edit-screen="${screen.id}">Изменить</button>
                        <button class="secondary-btn" type="button" data-toggle-screen="${screen.id}">
                            ${screen.active ? 'Пауза' : 'Запуск'}
                        </button>
                        <button class="danger-btn" type="button" data-delete-screen="${screen.id}">Удалить</button>
                    </div>
                </article>
            `;
        }).join('');
    }

    function fillScreenForm(screen) {
        document.getElementById('screen-name').value = screen?.name || '';
        document.getElementById('screen-description').value = screen?.description || '';
        document.getElementById('screen-interval').value = screen?.slideInterval || settings.defaultSlideInterval || 30;

        const groupSelect = document.getElementById('screen-group');
        groupSelect.innerHTML = `
            <option value="">Все фото</option>
            ${groups.map((group) => `
                <option value="${group.id}" ${screen?.groupId === group.id ? 'selected' : ''}>${escapeHtml(group.name)}</option>
            `).join('')}
        `;

        document.getElementById('screen-modal-title').textContent = screen ? 'Редактировать экран' : 'Новый экран';
    }

    function openScreenModal(screenId = null) {
        editingScreenId = screenId;
        const screen = screens.find((item) => item.id === screenId);
        fillScreenForm(screen);
        screenModal.classList.add('visible');
    }

    function closeScreenModal() {
        editingScreenId = null;
        screenForm.reset();
        screenModal.classList.remove('visible');
    }

    async function reloadPhotos() {
        photos = await api.getPhotos(activeFilter);
        renderPhotos();
    }

    async function reloadScreens() {
        screens = await api.getScreens();
        renderScreens();
    }

    async function reloadGroups() {
        groups = await api.getGroups();
        renderFilters();
    }

    async function loadPageData() {
        const settingsData = await api.getSettings();
        settings = settingsData;
        await Promise.all([reloadGroups(), reloadPhotos(), reloadScreens()]);
    }

    async function handleFiles(fileList) {
        const files = Array.from(fileList).filter((file) => file.type.startsWith('image/'));
        if (!files.length) return;

        await api.uploadPhotos(files, activeFilter);
        await reloadPhotos();
    }

    document.querySelectorAll('.page-tab').forEach((button) => {
        button.addEventListener('click', () => switchTab(button.dataset.tab));
    });

    if (dropzone) {
        dropzone.addEventListener('click', () => fileInput.click());
        dropzone.addEventListener('dragover', (event) => {
            event.preventDefault();
            dropzone.classList.add('dragover');
        });
        dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
        dropzone.addEventListener('drop', (event) => {
            event.preventDefault();
            dropzone.classList.remove('dragover');
            handleFiles(event.dataTransfer.files);
        });
    }

    if (fileInput) {
        fileInput.addEventListener('change', (event) => {
            handleFiles(event.target.files);
            event.target.value = '';
        });
    }

    screenForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const payload = {
            name: document.getElementById('screen-name').value.trim(),
            description: document.getElementById('screen-description').value.trim(),
            groupId: document.getElementById('screen-group').value || null,
            slideInterval: Number(document.getElementById('screen-interval').value) || 30,
        };

        if (!payload.name) return;

        try {
            if (editingScreenId) {
                await api.updateScreen(editingScreenId, payload);
            } else {
                await api.createScreen(payload);
            }
            closeScreenModal();
            switchTab('screens');
            await reloadScreens();
        } catch (error) {
            alert(error.message);
        }
    });

    document.getElementById('screen-modal-close').addEventListener('click', closeScreenModal);
    document.getElementById('screen-modal-cancel').addEventListener('click', closeScreenModal);
    screenModal.addEventListener('click', (event) => {
        if (event.target === screenModal) closeScreenModal();
    });

    document.addEventListener('click', async (event) => {
        const filterButton = event.target.closest('[data-filter]');
        if (filterButton) {
            activeFilter = filterButton.dataset.filter;
            try {
                await reloadPhotos();
                renderFilters();
            } catch (error) {
                alert(error.message);
            }
            return;
        }

        const deletePhoto = event.target.closest('[data-delete-photo]');
        if (deletePhoto) {
            try {
                await api.deletePhoto(deletePhoto.dataset.deletePhoto);
                await reloadPhotos();
            } catch (error) {
                alert(error.message);
            }
            return;
        }

        const editScreen = event.target.closest('[data-edit-screen]');
        if (editScreen) {
            openScreenModal(editScreen.dataset.editScreen);
            return;
        }

        const deleteScreen = event.target.closest('[data-delete-screen]');
        if (deleteScreen) {
            const screen = screens.find((item) => item.id === deleteScreen.dataset.deleteScreen);
            if (!screen || !confirm(`Удалить экран «${screen.name}»?`)) return;
            try {
                await api.deleteScreen(screen.id);
                await reloadScreens();
            } catch (error) {
                alert(error.message);
            }
            return;
        }

        const toggleScreen = event.target.closest('[data-toggle-screen]');
        if (toggleScreen) {
            try {
                await api.toggleScreen(toggleScreen.dataset.toggleScreen);
                await reloadScreens();
            } catch (error) {
                alert(error.message);
            }
            return;
        }

        const copyToken = event.target.closest('[data-copy-token]');
        if (copyToken) {
            navigator.clipboard.writeText(copyToken.dataset.copyToken);
            copyToken.textContent = 'Скопировано';
            setTimeout(() => {
                copyToken.textContent = 'Копировать';
            }, 1500);
            return;
        }

        const openTv = event.target.closest('[data-open-tv]');
        if (openTv) {
            window.open(`/tv?code=${openTv.dataset.openTv}`, '_blank');
        }
    });

    document.addEventListener('change', async (event) => {
        const select = event.target.closest('select[data-photo-id]');
        if (!select) return;
        try {
            await api.updatePhoto(select.dataset.photoId, {
                groupId: select.value || null,
            });
            await reloadPhotos();
        } catch (error) {
            alert(error.message);
        }
    });

    initShell(activeTab === 'screens' ? 'screens' : 'home');
    switchTab(activeTab);
    loadPageData().catch((error) => alert(error.message));
})();

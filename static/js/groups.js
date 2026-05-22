(function () {
    const api = window.WinterDisplay.api;
    const { initShell, setPageHeader } = window.WinterDisplay.shell;

    let groups = [];
    let editingGroupId = null;

    const groupsList = document.getElementById('groups-list');
    const groupModal = document.getElementById('group-modal');
    const groupForm = document.getElementById('group-form');

    function escapeHtml(value) {
        return String(value)
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;');
    }

    function renderGroups() {
        if (!groups.length) {
            groupsList.innerHTML = `
                <div class="empty-state">
                    <h3>Групп пока нет</h3>
                    <p>Создайте первую коллекцию кнопкой «Новая группа»</p>
                </div>
            `;
            return;
        }

        groupsList.innerHTML = groups.map((group) => `
            <div class="list-card">
                <div class="list-card-main">
                    <span class="group-dot" style="background:${group.color}"></span>
                    <div>
                        <strong>${escapeHtml(group.name)}</strong>
                        <span>${group.photosCount} фото</span>
                    </div>
                </div>
                <div class="group-actions">
                    <button class="secondary-btn" type="button" data-edit-group="${group.id}">Изменить</button>
                    <button class="danger-btn" type="button" data-delete-group="${group.id}">Удалить</button>
                </div>
            </div>
        `).join('');
    }

    function openGroupModal(groupId = null) {
        editingGroupId = groupId;
        const group = groups.find((item) => item.id === groupId);

        document.getElementById('group-modal-title').textContent = group ? 'Редактировать группу' : 'Новая группа';
        document.getElementById('group-name').value = group?.name || '';
        document.getElementById('group-color').value = group?.color || '#000000';
        groupModal.classList.add('visible');
    }

    function closeGroupModal() {
        editingGroupId = null;
        groupForm.reset();
        groupModal.classList.remove('visible');
    }

    async function reloadGroups() {
        groups = await api.getGroups();
        renderGroups();
    }

    document.getElementById('create-group-btn').addEventListener('click', () => openGroupModal());

    groupForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const name = document.getElementById('group-name').value.trim();
        const color = document.getElementById('group-color').value;
        if (!name) return;

        try {
            if (editingGroupId) {
                await api.updateGroup(editingGroupId, { name, color });
            } else {
                await api.createGroup({ name, color });
            }
            closeGroupModal();
            await reloadGroups();
        } catch (error) {
            alert(error.message);
        }
    });

    document.getElementById('group-modal-close').addEventListener('click', closeGroupModal);
    document.getElementById('group-modal-cancel').addEventListener('click', closeGroupModal);
    groupModal.addEventListener('click', (event) => {
        if (event.target === groupModal) closeGroupModal();
    });

    document.addEventListener('click', async (event) => {
        const editButton = event.target.closest('[data-edit-group]');
        if (editButton) {
            openGroupModal(editButton.dataset.editGroup);
            return;
        }

        const deleteButton = event.target.closest('[data-delete-group]');
        if (deleteButton) {
            const group = groups.find((item) => item.id === deleteButton.dataset.deleteGroup);
            if (!group || !confirm(`Удалить группу «${group.name}»? Фото останутся без группы.`)) return;

            try {
                await api.deleteGroup(group.id);
                await reloadGroups();
            } catch (error) {
                alert(error.message);
            }
        }
    });

    initShell('groups');
    setPageHeader('Группы фоток', 'Коллекции изображений');
    reloadGroups().catch((error) => alert(error.message));
})();

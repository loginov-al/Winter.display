(function () {
    const api = window.WinterDisplay.api;
    const { initShell, setPageHeader } = window.WinterDisplay.shell;

    let settings = {};

    function renderSettings() {
        document.querySelectorAll('.toggle[data-setting]').forEach((toggle) => {
            const key = toggle.dataset.setting;
            const enabled = Boolean(settings[key]);
            toggle.classList.toggle('on', enabled);
            toggle.setAttribute('aria-checked', String(enabled));
        });

        document.getElementById('default-interval').value = settings.defaultSlideInterval || 30;
        document.getElementById('photos-count').textContent = String(settings.stats?.photos || 0);
        document.getElementById('screens-count').textContent = String(settings.stats?.screens || 0);
        document.getElementById('groups-count').textContent = String(settings.stats?.groups || 0);
    }

    async function reloadSettings() {
        settings = await api.getSettings();
        renderSettings();
    }

    document.addEventListener('click', async (event) => {
        const toggle = event.target.closest('.toggle[data-setting]');
        if (!toggle) return;

        const key = toggle.dataset.setting;
        try {
            settings = await api.updateSettings({ [key]: !settings[key] });
            renderSettings();
        } catch (error) {
            alert(error.message);
        }
    });

    document.getElementById('default-interval').addEventListener('change', async (event) => {
        const value = Math.max(5, Number(event.target.value) || 30);
        event.target.value = value;
        try {
            settings = await api.updateSettings({ defaultSlideInterval: value });
            renderSettings();
        } catch (error) {
            alert(error.message);
        }
    });

    document.getElementById('clear-photos-btn').addEventListener('click', async () => {
        if (!settings.stats?.photos) return;
        if (!confirm('Удалить все фото?')) return;
        try {
            await api.deleteAllPhotos();
            await reloadSettings();
        } catch (error) {
            alert(error.message);
        }
    });

    document.getElementById('clear-screens-btn').addEventListener('click', async () => {
        if (!settings.stats?.screens) return;
        if (!confirm('Удалить все экраны?')) return;
        try {
            await api.deleteAllScreens();
            await reloadSettings();
        } catch (error) {
            alert(error.message);
        }
    });

    initShell('settings');
    setPageHeader('Настройки', 'Параметры приложения');
    reloadSettings().catch((error) => alert(error.message));
})();

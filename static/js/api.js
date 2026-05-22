window.WinterDisplay = window.WinterDisplay || {};

(function (app) {
    const FILTER_ALL = 'all';
    const FILTER_UNGROUPED = 'ungrouped';

    async function request(url, options = {}) {
        const config = {
            credentials: 'same-origin',
            ...options,
        };

        if (config.body && !(config.body instanceof FormData) && typeof config.body === 'object') {
            config.headers = {
                'Content-Type': 'application/json',
                ...(options.headers || {}),
            };
            config.body = JSON.stringify(config.body);
        }

        const response = await fetch(url, config);

        if (response.status === 401) {
            window.location.href = '/';
            throw new Error('Unauthorized');
        }

        if (response.status === 204) {
            return null;
        }

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data.error || 'Ошибка запроса');
        }

        return data;
    }

    const api = {
        FILTER_ALL,
        FILTER_UNGROUPED,

        getPhotos(filter = FILTER_ALL) {
            const query = filter && filter !== FILTER_ALL ? `?filter=${encodeURIComponent(filter)}` : '';
            return request(`/api/photos${query}`);
        },

        uploadPhotos(files, groupId = null) {
            const formData = new FormData();
            Array.from(files).forEach((file) => formData.append('files', file));
            if (groupId && groupId !== FILTER_ALL && groupId !== FILTER_UNGROUPED) {
                formData.append('groupId', groupId);
            }
            return request('/api/photos', { method: 'POST', body: formData });
        },

        updatePhoto(id, payload) {
            return request(`/api/photos/${id}`, { method: 'PATCH', body: payload });
        },

        deletePhoto(id) {
            return request(`/api/photos/${id}`, { method: 'DELETE' });
        },

        deleteAllPhotos() {
            return request('/api/photos', { method: 'DELETE' });
        },

        getGroups() {
            return request('/api/groups');
        },

        createGroup(payload) {
            return request('/api/groups', { method: 'POST', body: payload });
        },

        updateGroup(id, payload) {
            return request(`/api/groups/${id}`, { method: 'PATCH', body: payload });
        },

        deleteGroup(id) {
            return request(`/api/groups/${id}`, { method: 'DELETE' });
        },

        getScreens() {
            return request('/api/screens');
        },

        createScreen(payload) {
            return request('/api/screens', { method: 'POST', body: payload });
        },

        updateScreen(id, payload) {
            return request(`/api/screens/${id}`, { method: 'PATCH', body: payload });
        },

        toggleScreen(id) {
            return request(`/api/screens/${id}/toggle`, { method: 'POST' });
        },

        deleteScreen(id) {
            return request(`/api/screens/${id}`, { method: 'DELETE' });
        },

        deleteAllScreens() {
            return request('/api/screens', { method: 'DELETE' });
        },

        getSettings() {
            return request('/api/settings');
        },

        updateSettings(payload) {
            return request('/api/settings', { method: 'PATCH', body: payload });
        },
    };

    app.api = api;
})(window.WinterDisplay);

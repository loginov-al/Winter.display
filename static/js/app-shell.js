window.WinterDisplay = window.WinterDisplay || {};

(function (app) {
    const NAV_ITEMS = [
        {
            id: 'home',
            href: '/home',
            label: 'Главная',
            icon: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5Z"/>'
        },
        {
            id: 'screens',
            href: '/home?tab=screens',
            label: 'Экраны',
            icon: '<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8"/>'
        },
        {
            id: 'settings',
            href: '/settings',
            label: 'Настройки',
            icon: '<circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>'
        },
        {
            id: 'groups',
            href: '/groups',
            label: 'Группы',
            icon: '<path d="M4 7h7v7H4zM13 7h7v7h-7zM4 16h7v7H4zM16 16h4v4h-4z"/>'
        }
    ];

    function renderNavigation(activeId) {
        const bottomNav = document.getElementById('bottom-nav');
        if (!bottomNav) return;

        bottomNav.innerHTML = NAV_ITEMS.map((item) => `
            <a class="nav-item ${item.id === activeId ? 'active' : ''}" href="${item.href}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">${item.icon}</svg>
                ${item.label}
            </a>
        `).join('');
    }

    function initShell(activeId) {
        renderNavigation(activeId);
    }

    function setPageHeader(title, subtitle) {
        const titleEl = document.getElementById('page-title');
        const subtitleEl = document.getElementById('page-subtitle');
        if (titleEl) titleEl.textContent = title;
        if (subtitleEl) subtitleEl.textContent = subtitle;
    }

    app.shell = {
        NAV_ITEMS,
        initShell,
        renderNavigation,
        setPageHeader,
    };
})(window.WinterDisplay);

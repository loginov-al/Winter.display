window.addEventListener('load', function() {
    const preloader = document.getElementById('preloader');
    
    // Небольшая задержка, чтобы пользователь успел увидеть лоадер
    setTimeout(function() {
        preloader.style.opacity = '0';
        preloader.style.visibility = 'hidden'; // Чтобы блок не мешал кликам
    }, 800); // 800 мс — время показа лоадера
});

// Telegram Web App API
const tg = window.Telegram.WebApp;

// Проверка на запуск в Telegram
const isTelegram = window.Telegram && window.Telegram.WebApp;

// Если не в Telegram, показываем дефолтный интерфейс
if (!isTelegram) {
    console.warn('Запущено вне Telegram. Используется режим разработки.');
    
    // Создаем заглушку для Telegram Web App
    window.Telegram = {
        WebApp: {
            ready: () => console.log('Telegram ready (mock)'),
            expand: () => console.log('Telegram expand (mock)'),
            enableClosingConfirmation: () => console.log('Closing confirmation enabled (mock)'),
            setHeaderColor: () => console.log('Header color set (mock)'),
            setBackgroundColor: () => console.log('Background color set (mock)'),
            openLink: (url) => window.open(url, '_blank'),
            showAlert: (message) => alert(message),
            close: () => {
                if (confirm('Закрыть приложение?')) {
                    window.close();
                }
            },
            initDataUnsafe: {
                user: {
                    id: 123456789,
                    first_name: 'Тестовый',
                    last_name: 'Пользователь',
                    username: 'test_user'
                }
            }
        }
    };
}

// Initialize Telegram Web App
tg.expand(); // Раскрываем на весь экран
tg.enableClosingConfirmation(); // Подтверждение закрытия
tg.setHeaderColor('#000000'); // Черный цвет хедера
tg.setBackgroundColor('#000000'); // Черный фон

// Application state
let state = {
    cart: [],
    currentProduct: null,
    selectedSize: null,
    currentPage: 'products',
    telegramUser: tg.initDataUnsafe?.user || null
};

// DOM elements
const elements = {
    productsSection: document.getElementById('productsSection'),
    productDetailPage: document.getElementById('productDetailPage'),
    checkoutPage: document.getElementById('checkoutPage'),
    cartSidebar: document.getElementById('cartSidebar'),
    aboutModal: document.getElementById('aboutModal'),
    
    // Buttons containers
    cartButtonContainer: document.getElementById('cartButtonContainer'),
    aboutButtonContainer: document.getElementById('aboutButtonContainer'),
    
    // Buttons
    cartButton: document.getElementById('cartButton'),
    cartButtonCount: document.getElementById('cartButtonCount'),
    cartClose: document.getElementById('cartClose'),
    checkoutBtn: document.getElementById('checkoutBtn'),
    backBtn: document.getElementById('backBtn'),
    backToCartBtn: document.getElementById('backToCartBtn'),
    payNowBtn: document.getElementById('payNowBtn'),
    aboutButton: document.getElementById('aboutButton'),
    aboutModalClose: document.getElementById('aboutModalClose'),
    
    // Product elements
    sizeOptions: document.querySelectorAll('.size-option'),
    addToCartDetail: document.getElementById('addToCartDetail'),
    detailProductImageFront: document.getElementById('detailProductImageFront'),
    detailProductImageBack: document.getElementById('detailProductImageBack'),
    detailProductTitle: document.getElementById('detailProductTitle'),
    
    // Cart elements
    cartItems: document.getElementById('cartItems'),
    totalPrice: document.getElementById('totalPrice'),
    cartCount: document.getElementById('cartCount'),
    
    // Checkout elements
    checkoutForm: document.getElementById('checkoutForm'),
    checkoutItems: document.getElementById('checkoutItems'),
    subtotalPrice: document.getElementById('subtotalPrice'),
    deliveryPrice: document.getElementById('deliveryPrice'),
    totalCheckoutPrice: document.getElementById('totalCheckoutPrice'),
    finalAmount: document.getElementById('finalAmount'),
    discountRow: document.getElementById('discountRow')
};

// Product data
const products = {
    dark: {
        title: "Dark Zip Hoodie",
        price: 6000,
        frontImage: "/static/images/dark_hoodie_front.jpg",
        backImage: "/static/images/dark_hoodie_back.png"
    },
    gray: {
        title: "Gray Zip Hoodie", 
        price: 6000,
        frontImage: "/static/images/gray_hoodie_front.jpg",
        backImage: "/static/images/gray_hoodie_back.jpg"
    }
};

// Initialize application
function init() {
    console.log('Initializing MORELUFS Telegram Mini App...');
    
    loadCart();
    setupEventListeners();
    setupOptimizedEventListeners();
    updateCartDisplay();
    showProductsPage();
    
    // Если есть пользователь Telegram, предзаполняем данные
    if (state.telegramUser) {
        prefillUserData();
    }
    
    // Оптимизированная предзагрузка изображений
    optimizedPreloadImages();
}

// Prefill user data from Telegram
function prefillUserData() {
    const user = state.telegramUser;
    // Можно добавить автозаполнение если нужно
}

// Оптимизированные обработчики событий через делегирование
function setupOptimizedEventListeners() {
    // Делегирование кликов на продуктах
    if (elements.productsSection) {
        elements.productsSection.addEventListener('click', (e) => {
            const productHalf = e.target.closest('.product-half');
            if (productHalf) {
                e.preventDefault();
                showProductDetail(productHalf.dataset.product);
            }
        });
    }
    
    // Делегирование кликов на размерах
    const sizeOptionsContainer = document.querySelector('.size-options');
    if (sizeOptionsContainer) {
        sizeOptionsContainer.addEventListener('click', (e) => {
            const sizeOption = e.target.closest('.size-option');
            if (sizeOption) {
                e.stopPropagation();
                selectSize(sizeOption.dataset.size);
            }
        });
    }
    
    // Делегирование кликов на галерее
    const galleryControls = document.querySelector('.gallery-controls');
    if (galleryControls) {
        galleryControls.addEventListener('click', (e) => {
            const galleryBtn = e.target.closest('.gallery-btn');
            if (galleryBtn) {
                switchProductImage(galleryBtn.dataset.view);
            }
        });
    }
    
    // Один обработчик для всех radio кнопок
    document.addEventListener('change', (e) => {
        if (e.target.name === 'delivery' || e.target.name === 'payment') {
            updateCheckoutDisplay();
        }
    });
}

// Основные обработчики событий
function setupEventListeners() {
    // Cart functionality
    if (elements.cartButton) {
        elements.cartButton.addEventListener('click', openCart);
        elements.cartButton.setAttribute('aria-expanded', 'false');
    }
    
    if (elements.cartClose) {
        elements.cartClose.addEventListener('click', closeCart);
    }
    
    if (elements.checkoutBtn) {
        elements.checkoutBtn.addEventListener('click', openCheckout);
    }
    
    // Navigation
    if (elements.backBtn) {
        elements.backBtn.addEventListener('click', showProductsPage);
    }
    
    if (elements.backToCartBtn) {
        elements.backToCartBtn.addEventListener('click', closeCheckout);
    }
    
    // About modal
    if (elements.aboutButton) {
        elements.aboutButton.addEventListener('click', openAboutModal);
        elements.aboutButton.setAttribute('aria-expanded', 'false');
    }
    
    if (elements.aboutModalClose) {
        elements.aboutModalClose.addEventListener('click', closeAboutModal);
    }
    
    // Payment
    if (elements.payNowBtn) {
        elements.payNowBtn.addEventListener('click', processPayment);
    }
    
    // Add to cart from detail page
    if (elements.addToCartDetail) {
        elements.addToCartDetail.addEventListener('click', addToCartFromDetail);
    }
    
    // Close cart when clicking outside
    document.addEventListener('click', handleOutsideClick);
    
    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);
    
    // Touch events для свайпов
    setupSwipeHandlers();
}

// Обработка кликов вне элементов
function handleOutsideClick(e) {
    // Закрытие корзины
    if (elements.cartSidebar && elements.cartSidebar.classList.contains('active') &&
        !elements.cartSidebar.contains(e.target) && 
        elements.cartButton && !elements.cartButton.contains(e.target)) {
        closeCart();
    }
    
    // Закрытие модалки "О нас"
    if (elements.aboutModal && elements.aboutModal.classList.contains('active') &&
        e.target === elements.aboutModal) {
        closeAboutModal();
    }
    
    // Закрытие автодополнения адреса
    const addressSuggestions = document.getElementById('addressSuggestions');
    if (addressSuggestions && addressSuggestions.classList.contains('active')) {
        const addressInput = document.getElementById('address');
        if (addressInput && !addressInput.contains(e.target) && 
            !addressSuggestions.contains(e.target)) {
            addressSuggestions.classList.remove('active');
        }
    }
}

// Keyboard shortcuts
function handleKeyboardShortcuts(e) {
    // ESC to close modals and cart
    if (e.key === 'Escape') {
        if (elements.cartSidebar && elements.cartSidebar.classList.contains('active')) {
            closeCart();
        }
        if (elements.aboutModal && elements.aboutModal.classList.contains('active')) {
            closeAboutModal();
        }
    }
    
    // 'C' to open cart (только если не в поле ввода)
    if ((e.key === 'c' || e.key === 'C') && !e.target.matches('input, textarea, select')) {
        if (elements.cartButton) {
            openCart();
        }
    }
    
    // 'B' to go back
    if ((e.key === 'b' || e.key === 'B') && !e.target.matches('input, textarea, select')) {
        if (state.currentPage === 'detail') {
            showProductsPage();
        } else if (state.currentPage === 'checkout') {
            closeCheckout();
        }
    }
}

// Page navigation
function showProductsPage() {
    state.currentPage = 'products';
    
    hideAllPages();
    if (elements.productsSection) elements.productsSection.style.display = 'block';
    
    // Показываем кнопки
    showFloatingButtons();
    
    closeCart();
    closeAboutModal();
    
    state.currentProduct = null;
    state.selectedSize = null;
    
    window.scrollTo(0, 0);
}

function showProductDetail(productId) {
    state.currentProduct = productId;
    state.currentPage = 'detail';
    const product = products[productId];
    
    if (product) {
        // Set images
        if (elements.detailProductImageFront) {
            elements.detailProductImageFront.src = product.frontImage;
        }
        if (elements.detailProductImageBack) {
            elements.detailProductImageBack.src = product.backImage;
        }
        if (elements.detailProductTitle) {
            elements.detailProductTitle.textContent = product.title;
        }
        
        // Устанавливаем первое фото активным
        switchProductImage('front');
        
        // Reset size selection
        if (elements.sizeOptions) {
            elements.sizeOptions.forEach(option => {
                option.classList.remove('selected');
                option.setAttribute('aria-checked', 'false');
            });
        }
        
        state.selectedSize = null;
        
        if (elements.addToCartDetail) {
            elements.addToCartDetail.disabled = true;
            elements.addToCartDetail.textContent = 'Добавить в корзину';
            elements.addToCartDetail.classList.remove('added');
        }
    }
    
    hideAllPages();
    if (elements.productDetailPage) elements.productDetailPage.style.display = 'block';
    
    // Показываем кнопки
    showFloatingButtons();
    
    window.scrollTo(0, 0);
}

function openCheckout() {
    if (state.cart.length === 0) {
        showNotification('Корзина пуста');
        return;
    }
    
    state.currentPage = 'checkout';
    
    hideAllPages();
    if (elements.checkoutPage) elements.checkoutPage.style.display = 'block';
    
    // Скрываем кнопки на странице оформления
    hideFloatingButtons();
    
    closeCart();
    updateCheckoutDisplay();
    setupFormValidation();
    
    window.scrollTo(0, 0);
}

function closeCheckout() {
    // Показываем кнопки при возврате
    showFloatingButtons();
    showProductsPage();
}

// Вспомогательные функции для управления страницами
function hideAllPages() {
    if (elements.productsSection) elements.productsSection.style.display = 'none';
    if (elements.productDetailPage) elements.productDetailPage.style.display = 'none';
    if (elements.checkoutPage) elements.checkoutPage.style.display = 'none';
}

function showFloatingButtons() {
    if (elements.cartButtonContainer) elements.cartButtonContainer.style.display = 'block';
    if (elements.aboutButtonContainer) elements.aboutButtonContainer.style.display = 'block';
}

function hideFloatingButtons() {
    if (elements.cartButtonContainer) elements.cartButtonContainer.style.display = 'none';
    if (elements.aboutButtonContainer) elements.aboutButtonContainer.style.display = 'none';
}

// Switch product image
function switchProductImage(view) {
    const frontImg = document.getElementById('detailProductImageFront');
    const backImg = document.getElementById('detailProductImageBack');
    const buttons = document.querySelectorAll('.gallery-btn');
    
    if (frontImg && backImg) {
        if (view === 'front') {
            frontImg.classList.add('active');
            backImg.classList.remove('active');
        } else {
            frontImg.classList.remove('active');
            backImg.classList.add('active');
        }
    }
    
    if (buttons) {
        buttons.forEach(btn => {
            btn.classList.remove('active');
            btn.setAttribute('aria-selected', 'false');
            if (btn.dataset.view === view) {
                btn.classList.add('active');
                btn.setAttribute('aria-selected', 'true');
            }
        });
    }
}

// Size selection
function selectSize(size) {
    if (elements.sizeOptions) {
        elements.sizeOptions.forEach(option => {
            option.classList.remove('selected');
            option.setAttribute('aria-checked', 'false');
            if (option.dataset.size === size) {
                option.classList.add('selected');
                option.setAttribute('aria-checked', 'true');
            }
        });
    }
    state.selectedSize = size;
    if (elements.addToCartDetail) {
        elements.addToCartDetail.disabled = false;
    }
}

// Улучшенная и быстрая анимация добавления в корзину
function addToCartFromDetail() {
    if (!state.currentProduct || !state.selectedSize) {
        showNotification('Пожалуйста, выберите размер');
        return;
    }

    // Быстрая анимация кнопки
    animateAddToCart(elements.addToCartDetail);

    const product = products[state.currentProduct];
    const existingItem = state.cart.find(item => 
        item.product === state.currentProduct && item.size === state.selectedSize
    );

    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        state.cart.push({
            id: Date.now(),
            product: state.currentProduct,
            title: product.title,
            price: product.price,
            size: state.selectedSize,
            quantity: 1
        });
    }

    saveCart();
    updateCartDisplay();
    
    // Быстрое уведомление
    setTimeout(() => {
        showNotification('Товар добавлен в корзину');
    }, 300);
}

// Быстрая анимация кнопки добавления в корзину (без промежуточных состояний)
function animateAddToCart(button) {
    if (!button) return;
    
    button.classList.add('adding');
    button.disabled = true;
    
    // Сохраняем оригинальный текст
    const originalText = button.textContent;
    
    // Сразу меняем на "Добавлено ✓"
    button.textContent = 'Добавлено ✓';
    button.classList.add('added');
    
    // Быстрая анимация - 800ms
    setTimeout(() => {
        button.classList.remove('adding', 'added');
        button.textContent = originalText;
        button.disabled = false;
    }, 800);
}

// Управление корзиной
function removeFromCart(itemId) {
    state.cart = state.cart.filter(item => item.id !== itemId);
    saveCart();
    updateCartDisplay();
}

function updateQuantity(itemId, change) {
    const item = state.cart.find(item => item.id === itemId);
    if (item) {
        const newQuantity = item.quantity + change;
        
        if (newQuantity <= 0) {
            state.cart = state.cart.filter(item => item.id !== itemId);
        } else {
            item.quantity = newQuantity;
        }
        
        saveCart();
        updateCartDisplay();
    }
}

// Оптимизированное обновление отображения корзины (без анимаций)
function updateCartDisplay() {
    // Update cart items
    if (elements.cartItems) {
        if (state.cart.length === 0) {
            elements.cartItems.innerHTML = `
                <div class="empty-cart">
                    <div class="empty-cart-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                            <path d="M8 11V9a1 1 0 0 1 2 0v2a1 1 0 0 1-2 0zm7 1a1 1 0 0 0 1-1V9a1 1 0 0 0-2 0v2a1 1 0 0 0 1 1zm-3 2a6.036 6.036 0 0 0-4.775 2.368 1 1 0 1 0 1.55 1.264 4 4 0 0 1 6.45 0 1 1 0 0 0 1.55-1.264A6.036 6.036 0 0 0 12 14zm11-2A11 11 0 1 1 12 1a11.013 11.013 0 0 1 11 11zm-2 0a9 9 0 1 0-9 9 9.01 9.01 0 0 0 9-9z"/>
                        </svg>
                    </div>
                    <p>Корзина пуста</p>
                </div>
            `;
        } else {
            elements.cartItems.innerHTML = state.cart.map(item => `
                <div class="cart-item" data-item-id="${item.id}">
                    <div class="cart-item-info">
                        <h4>${item.title}</h4>
                        <div class="cart-item-details">Размер: ${item.size}</div>
                    </div>
                    <div class="cart-item-controls">
                        <button class="quantity-btn" 
                                onclick="event.stopPropagation(); window.updateQuantity(${item.id}, -1)"
                                aria-label="Уменьшить количество">-</button>
                        <span>${item.quantity}</span>
                        <button class="quantity-btn" 
                                onclick="event.stopPropagation(); window.updateQuantity(${item.id}, 1)"
                                aria-label="Увеличить количество">+</button>
                    </div>
                </div>
            `).join('');
        }
    }

    // Update total price
    const total = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    if (elements.totalPrice) {
        elements.totalPrice.textContent = total.toLocaleString('ru-RU') + ' ₽';
    }

    // Update cart count - БЕЗ АНИМАЦИЙ
    const totalItems = state.cart.reduce((sum, item) => sum + item.quantity, 0);
    if (elements.cartCount) {
        elements.cartCount.textContent = totalItems;
    }
    if (elements.cartButtonCount) {
        elements.cartButtonCount.textContent = totalItems;
    }
}

function openCart() {
    if (elements.cartSidebar) {
        elements.cartSidebar.classList.add('active');
        if (elements.cartButton) {
            elements.cartButton.setAttribute('aria-expanded', 'true');
        }
    }
}

function closeCart() {
    if (elements.cartSidebar) {
        elements.cartSidebar.classList.remove('active');
        if (elements.cartButton) {
            elements.cartButton.setAttribute('aria-expanded', 'false');
        }
    }
}

function openAboutModal() {
    if (elements.aboutModal) {
        elements.aboutModal.classList.add('active');
        if (elements.aboutButton) {
            elements.aboutButton.setAttribute('aria-expanded', 'true');
        }
    }
}

function closeAboutModal() {
    if (elements.aboutModal) {
        elements.aboutModal.classList.remove('active');
        if (elements.aboutButton) {
            elements.aboutButton.setAttribute('aria-expanded', 'false');
        }
    }
}

// Cart persistence
function saveCart() {
    try {
        localStorage.setItem('morelufs_cart', JSON.stringify(state.cart));
    } catch (e) {
        console.warn('Не удалось сохранить корзину в localStorage');
    }
}

function loadCart() {
    try {
        const savedCart = localStorage.getItem('morelufs_cart');
        if (savedCart) {
            state.cart = JSON.parse(savedCart);
        }
    } catch (e) {
        console.warn('Не удалось загрузить корзину из localStorage');
        state.cart = [];
    }
}

// Checkout functionality
function updateCheckoutDisplay() {
    if (!elements.checkoutItems) return;
    
    // Calculate totals
    const subtotal = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const deliveryPrice = calculateDeliveryPrice();
    const paymentMethod = document.querySelector('input[name="payment"]:checked')?.value || 'yookassa';
    const discount = paymentMethod === 'crypto' ? 200 : 0;
    const total = subtotal + deliveryPrice - discount;
    
    // Update items list
    elements.checkoutItems.innerHTML = state.cart.map(item => `
        <div class="order-item">
            <div class="item-info">
                <h4>${item.title}</h4>
                <div class="item-details">Размер: ${item.size} × ${item.quantity}</div>
            </div>
            <div class="item-price">${(item.price * item.quantity).toLocaleString('ru-RU')} ₽</div>
        </div>
    `).join('');
    
    // Update prices
    if (elements.subtotalPrice) {
        elements.subtotalPrice.textContent = subtotal.toLocaleString('ru-RU') + ' ₽';
    }
    if (elements.deliveryPrice) {
        elements.deliveryPrice.textContent = deliveryPrice.toLocaleString('ru-RU') + ' ₽';
    }
    if (elements.totalCheckoutPrice) {
        elements.totalCheckoutPrice.textContent = total.toLocaleString('ru-RU') + ' ₽';
    }
    if (elements.finalAmount) {
        elements.finalAmount.textContent = total.toLocaleString('ru-RU') + ' ₽';
    }
    
    // Show/hide discount
    if (elements.discountRow) {
        if (paymentMethod === 'crypto') {
            elements.discountRow.style.display = 'flex';
        } else {
            elements.discountRow.style.display = 'none';
        }
    }
}

function calculateDeliveryPrice() {
    const selectedDelivery = document.querySelector('input[name="delivery"]:checked');
    if (!selectedDelivery) return 0;
    
    const deliveryPrices = {
        'russian-post': 300,
        'yandex-delivery': 400,
        'cdek': 500
    };
    return deliveryPrices[selectedDelivery.value] || 0;
}

// Form validation
function setupFormValidation() {
    const form = elements.checkoutForm;
    if (!form) return;
    
    const inputs = form.querySelectorAll('input[required], textarea[required]');
    
    inputs.forEach(input => {
        input.addEventListener('blur', validateField);
        input.addEventListener('input', clearFieldError);
    });
}

function validateField(e) {
    const field = e.target;
    const value = field.value.trim();
    
    if (!value) {
        showFieldError(field, 'Это поле обязательно для заполнения');
        return false;
    }
    
    if (field.type === 'email' && !isValidEmail(value)) {
        showFieldError(field, 'Введите корректный email');
        return false;
    }
    
    if (field.type === 'tel' && !isValidPhone(value)) {
        showFieldError(field, 'Введите корректный номер телефона');
        return false;
    }
    
    clearFieldError(field);
    return true;
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(phone) {
    const cleaned = phone.replace(/\s|\(|\)|-/g, '');
    return /^\+7\d{10}$/.test(cleaned) || /^8\d{10}$/.test(cleaned);
}

function showFieldError(field, message) {
    clearFieldError(field);
    field.style.borderColor = '#ff4444';
    
    const errorElement = document.createElement('div');
    errorElement.className = 'field-error';
    errorElement.textContent = message;
    
    field.parentNode.appendChild(errorElement);
}

function clearFieldError(field) {
    field.style.borderColor = '#333';
    const existingError = field.parentNode.querySelector('.field-error');
    if (existingError) {
        existingError.remove();
    }
}

// Payment processing
async function processPayment() {
    // Validate form
    const requiredFields = ['city', 'postalCode', 'address', 'fullName', 'phone', 'email'];
    let isValid = true;
    
    requiredFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field && !validateField({ target: field })) {
            isValid = false;
        }
    });
    
    if (!isValid) {
        showNotification('Пожалуйста, заполните все обязательные поля корректно');
        return;
    }
    
    // Prepare order data
    const paymentMethod = document.querySelector('input[name="payment"]:checked')?.value || 'yookassa';
    const discount = paymentMethod === 'crypto' ? 200 : 0;
    const deliveryPrice = calculateDeliveryPrice();
    
    const orderData = {
        items: state.cart,
        customer: {
            name: document.getElementById('fullName')?.value || '',
            phone: document.getElementById('phone')?.value || '',
            email: document.getElementById('email')?.value || '',
            address: {
                country: document.getElementById('country')?.value || '',
                city: document.getElementById('city')?.value || '',
                postalCode: document.getElementById('postalCode')?.value || '',
                address: document.getElementById('address')?.value || ''
            }
        },
        delivery: {
            method: document.querySelector('input[name="delivery"]:checked')?.value || '',
            price: deliveryPrice
        },
        payment_method: paymentMethod,
        discount: discount,
        comments: document.getElementById('comments')?.value || '',
        total: state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0) + 
               deliveryPrice - discount,
        telegram_user: state.telegramUser
    };
    
    try {
        showNotification('Оформление заказа...');
        
        // Для локальной разработки
        const baseURL = window.location.hostname === 'localhost' 
            ? 'http://localhost:5000' 
            : '';
        
        // 1. Создаем заказ
        const orderResponse = await fetch(`${baseURL}/api/order`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(orderData)
        });
        
        const orderResult = await orderResponse.json();
        
        if (orderResult.success) {
            // 2. Создаем платеж
            const paymentResponse = await fetch(`${baseURL}/api/create-payment`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    order_id: orderResult.order_id,
                    amount: orderData.total,
                    payment_method: paymentMethod,
                    description: `Заказ #${orderResult.order_id}`
                })
            });
            
            const paymentResult = await paymentResponse.json();
            
            if (paymentResult.success) {
                // 3. Очищаем корзину
                state.cart = [];
                saveCart();
                updateCartDisplay();
                
                // 4. Открываем страницу оплаты
                if (isTelegram && tg.openLink) {
                    tg.openLink(paymentResult.payment_url);
                } else {
                    window.open(paymentResult.payment_url, '_blank');
                }
                
                // 5. Очищаем данные формы
                clearFormData();
            } else {
                throw new Error('Ошибка создания платежа');
            }
        } else {
            throw new Error('Ошибка создания заказа');
        }
    } catch (error) {
        console.error('Payment error:', error);
        showNotification('Ошибка при оформлении заказа. Пожалуйста, попробуйте еще раз.', 'error');
    }
}

// Utility functions
function showNotification(message, type = 'info') {
    if (isTelegram && tg.showAlert) {
        tg.showAlert(message);
    } else {
        // Создаем красивый toast для браузера
        const toast = document.createElement('div');
        toast.className = `toast-notification ${type}`;
        toast.textContent = message;
        toast.setAttribute('role', 'alert');
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Address autocomplete
function setupAddressAutocomplete() {
    const addressInput = document.getElementById('address');
    const suggestionsContainer = document.getElementById('addressSuggestions');
    
    if (!addressInput || !suggestionsContainer) return;
    
    const debouncedFetchSuggestions = debounce(async (query) => {
        if (query.length < 3) {
            suggestionsContainer.classList.remove('active');
            suggestionsContainer.innerHTML = '';
            return;
        }
        
        try {
            const response = await fetch('/api/address-suggestions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ query })
            });
            
            const data = await response.json();
            
            if (data.suggestions && data.suggestions.length > 0) {
                suggestionsContainer.innerHTML = data.suggestions.map(suggestion => `
                    <div class="address-suggestion" 
                         data-value="${suggestion.value}"
                         role="option"
                         tabindex="0">
                        ${suggestion.value}
                    </div>
                `).join('');
                
                suggestionsContainer.classList.add('active');
                
                // Add click handlers to suggestions
                suggestionsContainer.querySelectorAll('.address-suggestion').forEach(item => {
                    item.addEventListener('click', () => {
                        addressInput.value = item.dataset.value;
                        suggestionsContainer.classList.remove('active');
                        addressInput.focus();
                    });
                    
                    item.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            addressInput.value = item.dataset.value;
                            suggestionsContainer.classList.remove('active');
                            addressInput.focus();
                        }
                    });
                });
            } else {
                suggestionsContainer.classList.remove('active');
            }
        } catch (error) {
            console.error('Address suggestions error:', error);
            suggestionsContainer.classList.remove('active');
        }
    }, 300);
    
    addressInput.addEventListener('input', (e) => {
        debouncedFetchSuggestions(e.target.value);
    });
}

// Form auto-save
function setupFormAutoSave() {
    const form = elements.checkoutForm;
    if (!form) return;
    
    const inputs = form.querySelectorAll('input, textarea');
    
    inputs.forEach(input => {
        input.addEventListener('input', debounce(() => {
            saveFormData();
        }, 500));
    });
}

function saveFormData() {
    const formData = {
        fullName: document.getElementById('fullName')?.value || '',
        phone: document.getElementById('phone')?.value || '',
        email: document.getElementById('email')?.value || '',
        city: document.getElementById('city')?.value || '',
        postalCode: document.getElementById('postalCode')?.value || '',
        address: document.getElementById('address')?.value || '',
        comments: document.getElementById('comments')?.value || ''
    };
    
    try {
        localStorage.setItem('morelufs_checkout_form', JSON.stringify(formData));
    } catch (e) {
        console.warn('Не удалось сохранить данные формы');
    }
}

function loadFormData() {
    try {
        const savedFormData = localStorage.getItem('morelufs_checkout_form');
        if (savedFormData) {
            const formData = JSON.parse(savedFormData);
            
            Object.keys(formData).forEach(key => {
                const element = document.getElementById(key);
                if (element && formData[key]) {
                    element.value = formData[key];
                }
            });
        }
    } catch (e) {
        console.warn('Не удалось загрузить данные формы');
    }
}

function clearFormData() {
    try {
        localStorage.removeItem('morelufs_checkout_form');
        localStorage.removeItem('morelufs_cart');
    } catch (e) {
        console.warn('Не удалось очистить данные формы');
    }
}

// Оптимизированная предзагрузка изображений
function optimizedPreloadImages() {
    // Только для критически важных изображений
    const criticalImages = [
        '/static/images/dark_hoodie_front.jpg',
        '/static/images/gray_hoodie_front.jpg'
    ];
    
    criticalImages.forEach(src => {
        const img = new Image();
        img.src = src;
    });
}

// Настройка свайпов
function setupSwipeHandlers() {
    let touchStartX = 0;
    let touchEndX = 0;
    
    function handleTouch(e) {
        if (state.currentPage !== 'detail') return;
        
        const productImageMain = document.querySelector('.product-image-main');
        if (!productImageMain || !productImageMain.contains(e.target)) return;
        
        if (e.type === 'touchstart') {
            touchStartX = e.changedTouches[0].screenX;
        } else if (e.type === 'touchend') {
            touchEndX = e.changedTouches[0].screenX;
            const swipeDistance = touchEndX - touchStartX;
            
            if (Math.abs(swipeDistance) > 50) {
                const frontImg = document.getElementById('detailProductImageFront');
                if (frontImg && frontImg.classList.contains('active')) {
                    if (swipeDistance > 0) {
                        // Already on front
                    } else {
                        switchProductImage('back');
                    }
                } else {
                    if (swipeDistance > 0) {
                        switchProductImage('front');
                    } else {
                        // Already on back
                    }
                }
            }
        }
    }
    
    // Используем passive event listeners для лучшей производительности
    document.addEventListener('touchstart', handleTouch, { passive: true });
    document.addEventListener('touchend', handleTouch, { passive: true });
}

// Make functions globally available for onclick handlers
window.updateQuantity = updateQuantity;
window.openCart = openCart;
window.closeCart = closeCart;

// Initialize the application
if (tg && tg.ready) {
    tg.ready();
    // Задержка для стабилизации Telegram Web App
    setTimeout(init, 100);
} else {
    document.addEventListener('DOMContentLoaded', init);
}

// Initialize address autocomplete when checkout page loads
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('checkcheckoutPage')) {
        setupAddressAutocomplete();
        setupFormAutoSave();
        loadFormData();
    }
});

// Telegram Web App event handlers
if (tg && tg.onEvent) {
    tg.onEvent('viewportChanged', (event) => {
        console.log('Viewport changed:', event);
    });

    tg.onEvent('themeChanged', () => {
        console.log('Theme changed');
    });

    tg.onEvent('mainButtonClicked', () => {
        console.log('Main button clicked');
    });
}

// Для отладки
console.log('Telegram Web App initialized:', tg);

// Keyboard navigation for product images
document.addEventListener('keydown', (e) => {
    if (state.currentPage === 'detail') {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            const frontImg = document.getElementById('detailProductImageFront');
            if (frontImg) {
                if (frontImg.classList.contains('active')) {
                    switchProductImage('back');
                } else {
                    switchProductImage('front');
                }
                e.preventDefault();
            }
        }
    }
});

// Prevent form submission on Enter key in checkout
document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && state.currentPage === 'checkout') {
        const activeElement = document.activeElement;
        if (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA') {
            e.preventDefault();
            // Move to next input field
            const formElements = Array.from(document.querySelectorAll('.checkout-form input, .checkout-form textarea'));
            const currentIndex = formElements.indexOf(activeElement);
            if (currentIndex < formElements.length - 1) {
                formElements[currentIndex + 1].focus();
            } else if (currentIndex === formElements.length - 1) {
                // Last field, focus pay button
                if (elements.payNowBtn) {
                    elements.payNowBtn.focus();
                }
            }
        }
    }
});

// Оптимизация для медленных сетей
if ('connection' in navigator) {
    const connection = navigator.connection;
    
    if (connection.saveData || connection.effectiveType.includes('2g')) {
        // Уменьшаем качество изображений для медленных соединений
        document.querySelectorAll('img[src*="static/images/"]').forEach(img => {
            img.loading = 'lazy';
            // Можно добавить src для низкого качества
            // const src = img.src;
            // const lowQualitySrc = src.replace('.jpg', '-low.jpg');
            // img.src = lowQualitySrc;
            // img.dataset.fullSrc = src;
        });
    }
}

// Ленивая загрузка изображений с IntersectionObserver
if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                if (img.dataset.src) {
                    img.src = img.dataset.src;
                    img.removeAttribute('data-src');
                }
                observer.unobserve(img);
            }
        });
    }, {
        rootMargin: '50px 0px',
        threshold: 0.1
    });
    
    // Применить к изображениям с data-src
    setTimeout(() => {
        document.querySelectorAll('img[data-src]').forEach(img => {
            imageObserver.observe(img);
        });
    }, 1000);
}

// Оптимизация производительности: отложенная загрузка не критичных функций
let debouncedFunctionsLoaded = false;
function loadDebouncedFunctions() {
    if (debouncedFunctionsLoaded) return;
    
    // Инициализация адресного автодополнения при первом входе в чекаут
    if (state.currentPage === 'checkout') {
        setupAddressAutocomplete();
    }
    
    debouncedFunctionsLoaded = true;
}

// Загружаем отложенные функции при взаимодействии с пользователем
document.addEventListener('click', loadDebouncedFunctions, { once: true });
document.addEventListener('touchstart', loadDebouncedFunctions, { once: true });

// Оптимизация памяти: очистка ненужных данных при закрытии
window.addEventListener('beforeunload', () => {
    // Сохраняем только важные данные
    saveCart();
    saveFormData();
    
    // Освобождаем большие объекты
    state.cart = [];
    state.currentProduct = null;
    state.selectedSize = null;
});

// Обработка смены страниц для оптимизации
let lastPageChangeTime = 0;
const PAGE_CHANGE_THROTTLE = 300; // 300ms между сменами страниц

function throttlePageChange(callback) {
    const now = Date.now();
    if (now - lastPageChangeTime > PAGE_CHANGE_THROTTLE) {
        lastPageChangeTime = now;
        callback();
    } else {
        setTimeout(() => {
            lastPageChangeTime = Date.now();
            callback();
        }, PAGE_CHANGE_THROTTLE - (now - lastPageChangeTime));
    }
}

// Обновляем функции навигации с троттлингом
const originalShowProductsPage = showProductsPage;
showProductsPage = function() {
    throttlePageChange(() => originalShowProductsPage.call(this));
};

const originalShowProductDetail = showProductDetail;
showProductDetail = function(productId) {
    throttlePageChange(() => originalShowProductDetail.call(this, productId));
};

const originalOpenCheckout = openCheckout;
openCheckout = function() {
    throttlePageChange(() => originalOpenCheckout.call(this));
};

// Кэширование DOM элементов для быстрого доступа
let cachedElements = {};
function getCachedElement(selector) {
    if (!cachedElements[selector]) {
        cachedElements[selector] = document.querySelector(selector);
    }
    return cachedElements[selector];
}

// Оптимизированная функция для работы с размерами
function getSizeOption(size) {
    return getCachedElement(`.size-option[data-size="${size}"]`);
}

// Батчинг обновлений корзины
let cartUpdateTimeout = null;
function batchCartUpdate() {
    if (cartUpdateTimeout) {
        clearTimeout(cartUpdateTimeout);
    }
    
    cartUpdateTimeout = setTimeout(() => {
        updateCartDisplay();
        saveCart();
        cartUpdateTimeout = null;
    }, 100); // Батчинг обновлений каждые 100ms
}

// Обновляем функции работы с корзиной для батчинга
const originalUpdateQuantity = updateQuantity;
updateQuantity = function(itemId, change) {
    originalUpdateQuantity.call(this, itemId, change);
    batchCartUpdate();
};

const originalAddToCartFromDetail = addToCartFromDetail;
addToCartFromDetail = function() {
    originalAddToCartFromDetail.call(this);
    batchCartUpdate();
};

// Оптимизация рендеринга списка товаров
function createCartItemFragment(items) {
    const fragment = document.createDocumentFragment();
    
    items.forEach(item => {
        const itemElement = document.createElement('div');
        itemElement.className = 'cart-item';
        itemElement.dataset.itemId = item.id;
        itemElement.innerHTML = `
            <div class="cart-item-info">
                <h4>${item.title}</h4>
                <div class="cart-item-details">Размер: ${item.size}</div>
            </div>
            <div class="cart-item-controls">
                <button class="quantity-btn" 
                        onclick="event.stopPropagation(); window.updateQuantity(${item.id}, -1)"
                        aria-label="Уменьшить количество">-</button>
                <span>${item.quantity}</span>
                <button class="quantity-btn" 
                        onclick="event.stopPropagation(); window.updateQuantity(${item.id}, 1)"
                        aria-label="Увеличить количество">+</button>
            </div>
        `;
        fragment.appendChild(itemElement);
    });
    
    return fragment;
}

// Обновляем updateCartDisplay для использования фрагментов
const originalUpdateCartDisplay = updateCartDisplay;
updateCartDisplay = function() {
    // Update cart items с использованием фрагментов
    if (elements.cartItems) {
        if (state.cart.length === 0) {
            elements.cartItems.innerHTML = `
                <div class="empty-cart">
                    <div class="empty-cart-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                            <path d="M8 11V9a1 1 0 0 1 2 0v2a1 1 0 0 1-2 0zm7 1a1 1 0 0 0 1-1V9a1 1 0 0 0-2 0v2a1 1 0 0 0 1 1zm-3 2a6.036 6.036 0 0 0-4.775 2.368 1 1 0 1 0 1.55 1.264 4 4 0 0 1 6.45 0 1 1 0 0 0 1.55-1.264A6.036 6.036 0 0 0 12 14zm11-2A11 11 0 1 1 12 1a11.013 11.013 0 0 1 11 11zm-2 0a9 9 0 1 0-9 9 9.01 9.01 0 0 0 9-9z"/>
                        </svg>
                    </div>
                    <p>Корзина пуста</p>
                </div>
            `;
        } else {
            // Используем фрагмент для батчинга DOM операций
            const fragment = createCartItemFragment(state.cart);
            elements.cartItems.innerHTML = '';
            elements.cartItems.appendChild(fragment);
        }
    }

    // Update total price
    const total = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    if (elements.totalPrice) {
        elements.totalPrice.textContent = total.toLocaleString('ru-RU') + ' ₽';
    }

    // Update cart count - БЕЗ АНИМАЦИЙ
    const totalItems = state.cart.reduce((sum, item) => sum + item.quantity, 0);
    if (elements.cartCount) {
        elements.cartCount.textContent = totalItems;
    }
    if (elements.cartButtonCount) {
        elements.cartButtonCount.textContent = totalItems;
    }
};

// Оптимизация обработки событий для мобильных устройств
let lastTapTime = 0;
const TAP_THRESHOLD = 300; // 300ms для предотвращения двойного тапа

function handleOptimizedTap(e, callback) {
    const currentTime = Date.now();
    const timeSinceLastTap = currentTime - lastTapTime;
    
    if (timeSinceLastTap > TAP_THRESHOLD) {
        lastTapTime = currentTime;
        callback(e);
    }
}

// Обновляем обработчики для использования оптимизированных тапов
if (elements.cartButton) {
    elements.cartButton.addEventListener('click', (e) => {
        handleOptimizedTap(e, openCart);
    });
}

if (elements.checkoutBtn) {
    elements.checkoutBtn.addEventListener('click', (e) => {
        handleOptimizedTap(e, openCheckout);
    });
}

// Оптимизация анимаций: используем requestAnimationFrame
function animateWithRAF(callback) {
    let rafId = null;
    
    function animate() {
        callback();
        rafId = requestAnimationFrame(animate);
    }
    
    return {
        start: () => {
            if (!rafId) {
                rafId = requestAnimationFrame(animate);
            }
        },
        stop: () => {
            if (rafId) {
                cancelAnimationFrame(rafId);
                rafId = null;
            }
        }
    };
}

// Мониторинг производительности
if ('performance' in window) {
    const perfObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
            if (entry.name.includes('first-contentful-paint') || 
                entry.name.includes('largest-contentful-paint')) {
                console.log('Performance metric:', entry.name, entry.startTime);
            }
        }
    });
    
    perfObserver.observe({ entryTypes: ['paint', 'largest-contentful-paint'] });
}

// Service Worker для оффлайн работы (опционально)
if ('serviceWorker' in navigator && window.location.protocol === 'https:') {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(error => {
            console.log('Service Worker registration failed:', error);
        });
    });
}

// Экспорт для отладки
window.appState = state;
window.appElements = elements;
window.appProducts = products;

console.log('MORELUFS app initialized successfully!');

// Предзагрузка данных для следующей страницы
function prefetchNextPageData() {
    if (state.currentPage === 'products') {
        // Предзагружаем данные для детальной страницы
        Object.values(products).forEach(product => {
            const img = new Image();
            img.src = product.backImage;
        });
    }
}

// Вызываем предзагрузку после загрузки страницы
setTimeout(prefetchNextPageData, 2000);
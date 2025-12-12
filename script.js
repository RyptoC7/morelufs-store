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

// Swipe variables
let touchStartX = 0;
let touchEndX = 0;

// DOM elements
const elements = {
    productsSection: document.getElementById('productsSection'),
    productDetailPage: document.getElementById('productDetailPage'),
    checkoutPage: document.getElementById('checkoutPage'),
    cartSidebar: document.getElementById('cartSidebar'),
    aboutModal: document.getElementById('aboutModal'),
    
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
    productHalves: document.querySelectorAll('.product-half'),
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
    checkoutItems: document.getElementById('checkoutItems'),
    subtotalPrice: document.getElementById('subtotalPrice'),
    deliveryPrice: document.getElementById('deliveryPrice'),
    totalCheckoutPrice: document.getElementById('totalCheckoutPrice'),
    finalAmount: document.getElementById('finalAmount'),
    discountRow: document.getElementById('discountRow')
};

// Product data - ИСПРАВЛЕННЫЕ ПУТИ
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
    console.log('Telegram User:', state.telegramUser);
    
    loadCart();
    setupEventListeners();
    updateCartDisplay();
    showProductsPage();
    
    // Если есть пользователь Telegram, предзаполняем данные
    if (state.telegramUser) {
        prefillUserData();
    }
}

// Prefill user data from Telegram
function prefillUserData() {
    const user = state.telegramUser;
    
    // Можно добавить автозаполнение если нужно
    // Например, если у пользователя есть username
    if (user.username) {
        // Предзаполнить email или имя
    }
}

// Setup event listeners
function setupEventListeners() {
    // Product selection
    elements.productHalves.forEach(half => {
        half.addEventListener('click', (e) => {
            e.preventDefault();
            showProductDetail(half.dataset.product);
        });
    });

    // Size selection
    elements.sizeOptions.forEach(option => {
        option.addEventListener('click', (e) => {
            e.stopPropagation();
            selectSize(option.dataset.size);
        });
    });

    // Gallery controls
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('gallery-btn')) {
            const view = e.target.dataset.view;
            switchProductImage(view);
        }
    });

    // Add to cart from detail page
    elements.addToCartDetail.addEventListener('click', addToCartFromDetail);

    // Cart functionality
    elements.cartButton.addEventListener('click', openCart);
    elements.cartClose.addEventListener('click', closeCart);
    elements.checkoutBtn.addEventListener('click', openCheckout);

    // Navigation
    elements.backBtn.addEventListener('click', showProductsPage);
    elements.backToCartBtn.addEventListener('click', closeCheckout);

    // About modal
    elements.aboutButton.addEventListener('click', openAboutModal);
    elements.aboutModalClose.addEventListener('click', closeAboutModal);

    // Payment
    elements.payNowBtn.addEventListener('click', processPayment);

    // Delivery method change
    document.querySelectorAll('input[name="delivery"]').forEach(radio => {
        radio.addEventListener('change', updateCheckoutDisplay);
    });

    // Payment method change
    document.querySelectorAll('input[name="payment"]').forEach(radio => {
        radio.addEventListener('change', updateCheckoutDisplay);
    });

    // Form validation
    setupFormValidation();

    // Close cart when clicking outside
    document.addEventListener('click', (e) => {
        if (elements.cartSidebar.classList.contains('active') &&
            !elements.cartSidebar.contains(e.target) && 
            !elements.cartButton.contains(e.target)) {
            closeCart();
        }
    });

    // Close about modal when clicking outside
    document.addEventListener('click', (e) => {
        if (elements.aboutModal.classList.contains('active') &&
            e.target === elements.aboutModal) {
            closeAboutModal();
        }
    });
}

// Page navigation
function showProductsPage() {
    state.currentPage = 'products';
    
    elements.productsSection.style.display = 'block';
    elements.productDetailPage.style.display = 'none';
    elements.checkoutPage.style.display = 'none';
    
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
    
    // Set images
    elements.detailProductImageFront.src = product.frontImage;
    elements.detailProductImageBack.src = product.backImage;
    elements.detailProductTitle.textContent = product.title;
    
    // Устанавливаем первое фото активным
    switchProductImage('front');
    
    // Reset size selection
    elements.sizeOptions.forEach(option => {
        option.classList.remove('selected');
    });
    state.selectedSize = null;
    elements.addToCartDetail.disabled = true;
    elements.addToCartDetail.textContent = 'Добавить в корзину';
    elements.addToCartDetail.classList.remove('adding', 'added');
    
    // Show product page
    elements.productsSection.style.display = 'none';
    elements.checkoutPage.style.display = 'none';
    elements.productDetailPage.style.display = 'block';
    
    window.scrollTo(0, 0);
}

// Switch product image
function switchProductImage(view) {
    const frontImg = document.getElementById('detailProductImageFront');
    const backImg = document.getElementById('detailProductImageBack');
    const buttons = document.querySelectorAll('.gallery-btn');
    
    if (view === 'front') {
        frontImg.classList.add('active');
        backImg.classList.remove('active');
    } else {
        frontImg.classList.remove('active');
        backImg.classList.add('active');
    }
    
    buttons.forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.view === view) {
            btn.classList.add('active');
        }
    });
}

// Size selection
function selectSize(size) {
    elements.sizeOptions.forEach(option => {
        option.classList.remove('selected');
        if (option.dataset.size === size) {
            option.classList.add('selected');
        }
    });
    state.selectedSize = size;
    elements.addToCartDetail.disabled = false;
}

function addToCartFromDetail() {
    if (!state.currentProduct || !state.selectedSize) {
        showNotification('Пожалуйста, выберите размер');
        return;
    }

    // Анимация кнопки
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
    
    // Анимация иконки корзины
    animateCartItemAddition();
    
    // Показываем уведомление через 1 секунду
    setTimeout(() => {
        showNotification('Товар добавлен в корзину');
    }, 500);
}

// Анимация кнопки добавления в корзину
function animateAddToCart(button) {
    button.classList.add('adding');
    button.disabled = true;
    button.textContent = 'Добавляем...';
    
    setTimeout(() => {
        button.classList.remove('adding');
        button.classList.add('added');
        button.textContent = 'Добавлено ✓';
        
        setTimeout(() => {
            button.classList.remove('added');
            button.disabled = false;
            button.textContent = 'Добавить в корзину';
        }, 1500);
    }, 500);
}

function removeFromCart(itemId) {
    state.cart = state.cart.filter(item => item.id !== itemId);
    saveCart();
    updateCartDisplay();
}

function updateQuantity(itemId, change) {
    const item = state.cart.find(item => item.id === itemId);
    if (item) {
        item.quantity += change;
        if (item.quantity <= 0) {
            removeFromCart(itemId);
        } else {
            saveCart();
            updateCartDisplay();
        }
    }
}

function updateCartDisplay() {
    // Update cart items
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
            <div class="cart-item">
                <div class="cart-item-info">
                    <h4>${item.title}</h4>
                    <div class="cart-item-details">Размер: ${item.size}</div>
                </div>
                <div class="cart-item-controls">
                    <button class="quantity-btn" onclick="event.stopPropagation(); updateQuantity(${item.id}, -1)">-</button>
                    <span>${item.quantity}</span>
                    <button class="quantity-btn" onclick="event.stopPropagation(); updateQuantity(${item.id}, 1)">+</button>
                </div>
            </div>
        `).join('');
    }

    // Update total price
    const total = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    elements.totalPrice.textContent = total.toLocaleString() + ' ₽';

    // Update cart count
    const totalItems = state.cart.reduce((sum, item) => sum + item.quantity, 0);
    if (elements.cartCount) {
        elements.cartCount.textContent = totalItems;
    }
    elements.cartButtonCount.textContent = totalItems;
}

function openCart() {
    elements.cartSidebar.classList.add('active');
}

function closeCart() {
    elements.cartSidebar.classList.remove('active');
}

function openAboutModal() {
    elements.aboutModal.classList.add('active');
}

function closeAboutModal() {
    elements.aboutModal.classList.remove('active');
}

// Cart persistence
function saveCart() {
    localStorage.setItem('morelufs_cart', JSON.stringify(state.cart));
}

function loadCart() {
    const savedCart = localStorage.getItem('morelufs_cart');
    if (savedCart) {
        state.cart = JSON.parse(savedCart);
    }
}

// Checkout functionality
function openCheckout() {
    if (state.cart.length === 0) {
        showNotification('Корзина пуста');
        return;
    }
    
    state.currentPage = 'checkout';
    
    elements.productsSection.style.display = 'none';
    elements.productDetailPage.style.display = 'none';
    elements.checkoutPage.style.display = 'block';
    
    closeCart();
    updateCheckoutDisplay();
    setupFormValidation();
    
    window.scrollTo(0, 0);
}

function closeCheckout() {
    showProductsPage();
}

function updateCheckoutDisplay() {
    if (!elements.checkoutItems) return;
    
    // Calculate totals
    const subtotal = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const deliveryPrice = calculateDeliveryPrice();
    const paymentMethod = document.querySelector('input[name="payment"]:checked').value;
    const discount = paymentMethod === 'crypto' ? 200 : 0;
    const total = subtotal + deliveryPrice - discount;
    
    // Update items list
    elements.checkoutItems.innerHTML = state.cart.map(item => `
        <div class="order-item">
            <div class="item-info">
                <h4>${item.title}</h4>
                <div class="item-details">Размер: ${item.size} × ${item.quantity}</div>
            </div>
            <div class="item-price">${(item.price * item.quantity).toLocaleString()} ₽</div>
        </div>
    `).join('');
    
    // Update prices
    elements.subtotalPrice.textContent = subtotal.toLocaleString() + ' ₽';
    elements.deliveryPrice.textContent = deliveryPrice.toLocaleString() + ' ₽';
    elements.totalCheckoutPrice.textContent = total.toLocaleString() + ' ₽';
    elements.finalAmount.textContent = total.toLocaleString() + ' ₽';
    
    // Show/hide discount
    if (paymentMethod === 'crypto') {
        elements.discountRow.style.display = 'flex';
    } else {
        elements.discountRow.style.display = 'none';
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
    const form = document.querySelector('.checkout-form');
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
    return /^\+7\s?\(?\d{3}\)?\s?\d{3}-?\d{2}-?\d{2}$/.test(phone.replace(/\s/g, ''));
}

function showFieldError(field, message) {
    clearFieldError(field);
    field.style.borderColor = '#ff4444';
    
    const errorElement = document.createElement('div');
    errorElement.className = 'field-error';
    errorElement.style.color = '#ff4444';
    errorElement.style.fontSize = '12px';
    errorElement.style.marginTop = '5px';
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
    const paymentMethod = document.querySelector('input[name="payment"]:checked').value;
    const discount = paymentMethod === 'crypto' ? 200 : 0;
    const deliveryPrice = calculateDeliveryPrice();
    
    const orderData = {
        items: state.cart,
        customer: {
            name: document.getElementById('fullName').value,
            phone: document.getElementById('phone').value,
            email: document.getElementById('email').value,
            address: {
                country: document.getElementById('country').value,
                city: document.getElementById('city').value,
                postalCode: document.getElementById('postalCode').value,
                address: document.getElementById('address').value
            }
        },
        delivery: {
            method: document.querySelector('input[name="delivery"]:checked').value,
            price: deliveryPrice
        },
        payment_method: paymentMethod,
        discount: discount,
        comments: document.getElementById('comments').value,
        total: state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0) + 
               deliveryPrice - discount,
        telegram_user: state.telegramUser
    };
    
    try {
        // Для локальной разработки
        const baseURL = window.location.hostname === 'localhost' 
            ? 'http://localhost:5000' 
            : ''; // Для продакшна - относительный путь
        
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
                    // В Telegram открываем через WebApp
                    tg.openLink(paymentResult.payment_url);
                } else {
                    // В браузере открываем в новой вкладке
                    window.open(paymentResult.payment_url, '_blank');
                }
                
                // 5. Показываем успешное сообщение
                showNotification('Заказ оформлен! Открывается страница оплаты...');
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
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: ${type === 'error' ? '#ef4444' : '#000'};
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            z-index: 9999;
            font-weight: 500;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            animation: slideDown 0.3s ease;
        `;
        
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
                    <div class="address-suggestion" data-value="${suggestion.value}">
                        ${suggestion.value}
                    </div>
                `).join('');
                
                suggestionsContainer.classList.add('active');
                
                // Add click handlers to suggestions
                suggestionsContainer.querySelectorAll('.address-suggestion').forEach(item => {
                    item.addEventListener('click', () => {
                        addressInput.value = item.dataset.value;
                        suggestionsContainer.classList.remove('active');
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
    
    // Close suggestions when clicking outside
    document.addEventListener('click', (e) => {
        if (!addressInput.contains(e.target) && !suggestionsContainer.contains(e.target)) {
            suggestionsContainer.classList.remove('active');
        }
    });
}

// Make functions globally available for onclick handlers
window.updateQuantity = updateQuantity;
window.openCart = openCart;
window.closeCart = closeCart;

// Initialize the application when Telegram Web App is ready
if (tg && tg.ready) {
    tg.ready();
    init();
} else {
    // Fallback for development
    document.addEventListener('DOMContentLoaded', init);
}

// Telegram Web App event handlers
tg.onEvent('viewportChanged', (event) => {
    console.log('Viewport changed:', event);
});

tg.onEvent('themeChanged', () => {
    console.log('Theme changed');
    // Можно обновить тему интерфейса
});

tg.onEvent('mainButtonClicked', () => {
    console.log('Main button clicked');
});

// Для отладки
console.log('Telegram Web App initialized:', tg);

// Initialize address autocomplete when checkout page loads
document.addEventListener('DOMContentLoaded', () => {
    // Check if we're on checkout page
    if (document.getElementById('checkoutPage')) {
        setupAddressAutocomplete();
    }
});

// Add keyboard navigation for product images
document.addEventListener('keydown', (e) => {
    if (state.currentPage === 'detail') {
        if (e.key === 'ArrowLeft') {
            const frontImg = document.getElementById('detailProductImageFront');
            if (frontImg.classList.contains('active')) {
                switchProductImage('back');
            } else {
                switchProductImage('front');
            }
        } else if (e.key === 'ArrowRight') {
            const frontImg = document.getElementById('detailProductImageFront');
            if (frontImg.classList.contains('active')) {
                switchProductImage('back');
            } else {
                switchProductImage('front');
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
            }
        }
    }
});

// Cart item animation when added
function animateCartItemAddition() {
    const cartButton = document.getElementById('cartButton');
    if (cartButton) {
        cartButton.style.transform = 'scale(1.2)';
        setTimeout(() => {
            cartButton.style.transform = 'scale(1)';
        }, 300);
    }
}

// Update the addToCartFromDetail function to trigger animation
const originalAddToCartFromDetail = addToCartFromDetail;
addToCartFromDetail = function() {
    originalAddToCartFromDetail.call(this);
    animateCartItemAddition();
};

// Save scroll position when leaving product detail page
let scrollPosition = 0;

function saveScrollPosition() {
    if (state.currentPage === 'detail') {
        scrollPosition = window.scrollY;
    }
}

function restoreScrollPosition() {
    if (state.currentPage === 'products' && scrollPosition > 0) {
        setTimeout(() => {
            window.scrollTo(0, scrollPosition);
        }, 100);
    }
}

// Update page navigation functions


const originalShowProductsPage = showProductsPage;
showProductsPage = function() {
    saveScrollPosition();
    originalShowProductsPage.call(this);
    restoreScrollPosition();
};

const originalShowProductDetail = showProductDetail;
showProductDetail = function(productId) {
    saveScrollPosition();
    originalShowProductDetail.call(this, productId);
};

// Form auto-save for checkout
function setupFormAutoSave() {
    const form = document.querySelector('.checkout-form');
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
    
    localStorage.setItem('morelufs_checkout_form', JSON.stringify(formData));
}

function loadFormData() {
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
}

// Initialize form auto-save when checkout page loads
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('checkoutPage')) {
        setupFormAutoSave();
        loadFormData();
    }
});

// Clear form data after successful order
function clearFormData() {
    localStorage.removeItem('morelufs_checkout_form');
    localStorage.removeItem('morelufs_cart');
}

// Update processPayment function to clear form data
const originalProcessPayment = processPayment;
processPayment = async function() {
    try {
        await originalProcessPayment.call(this);
        clearFormData();
    } catch (error) {
        console.error('Payment error:', error);
        showNotification('Ошибка при оформлении заказа. Пожалуйста, попробуйте еще раз.', 'error');
    }
};

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // ESC to close modals and cart
    if (e.key === 'Escape') {
        if (elements.cartSidebar.classList.contains('active')) {
            closeCart();
        }
        if (elements.aboutModal.classList.contains('active')) {
            closeAboutModal();
        }
    }
    
    // 'C' to open cart
    if (e.key === 'c' || e.key === 'C') {
        if (!e.target.matches('input, textarea')) {
            openCart();
        }
    }
    
    // 'B' to go back
    if (e.key === 'b' || e.key === 'B') {
        if (state.currentPage === 'detail') {
            showProductsPage();
        } else if (state.currentPage === 'checkout') {
            closeCheckout();
        }
    }
});

// Initialize all features when app loads
document.addEventListener('DOMContentLoaded', () => {
    // Add CSS animations if not already added
    if (!document.querySelector('#animations-style')) {
        const style = document.createElement('style');
        style.id = 'animations-style';
        style.textContent = `
            @keyframes slideDown {
                from {
                    transform: translate(-50%, -20px);
                    opacity: 0;
                }
                to {
                    transform: translate(-50%, 0);
                    opacity: 1;
                }
            }
            
            @keyframes pulse {
                0% { transform: scale(1); }
                50% { transform: scale(0.95); }
                100% { transform: scale(1); }
            }
            
            @keyframes fadeBorder {
                0% { border-color: #ffffff; }
                50% { border-color: #666; }
                100% { border-color: #ffffff; }
            }
            
            @keyframes spin {
                to { transform: rotate(360deg); }
            }
            
            @keyframes slideIn {
                from { transform: translateX(100%); }
                to { transform: translateX(0); }
            }
            
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }
});

// Product image preloading for better performance
function preloadProductImages() {
    Object.values(products).forEach(product => {
        const frontImg = new Image();
        frontImg.src = product.frontImage;
        
        const backImg = new Image();
        backImg.src = product.backImage;
    });
}

// Call preloading when app initializes
setTimeout(preloadProductImages, 1000);

// Handle low network conditions
if ('connection' in navigator) {
    const connection = navigator.connection;
    
    if (connection.saveData || connection.effectiveType.includes('2g')) {
        // Reduce image quality for slow connections
        document.querySelectorAll('img').forEach(img => {
            if (img.src.includes('static/images/')) {
                img.loading = 'lazy';
            }
        });
    }
}

document.addEventListener('touchstart', (e) => {
    if (state.currentPage === 'detail') {
        touchStartX = e.changedTouches[0].screenX;
    }
});

document.addEventListener('touchend', (e) => {
    if (state.currentPage === 'detail') {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    }
});

function handleSwipe() {
    const swipeThreshold = 50;
    const swipeDistance = touchEndX - touchStartX;
    
    if (Math.abs(swipeDistance) > swipeThreshold) {
        if (swipeDistance > 0) {
            // Swipe right - show front image
            switchProductImage('front');
        } else {
            // Swipe left - show back image
            switchProductImage('back');
        }
    }
}

// Add this to setupEventListeners to initialize swipe support
const originalSetupEventListeners = setupEventListeners;
setupEventListeners = function() {
    originalSetupEventListeners.call(this);
    
    // Initialize swipe support
    const productImageMain = document.querySelector('.product-image-main');
    if (productImageMain) {
        productImageMain.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
        });
        
        productImageMain.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            handleSwipe();
        });
    }
};

// Export state for debugging
window.appState = state;
window.appElements = elements;
window.appProducts = products;

console.log('MORELUFS app initialized successfully!');
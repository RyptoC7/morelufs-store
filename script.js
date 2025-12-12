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
}

// Основные обработчики событий
function setupEventListeners() {
    // Cart functionality
    if (elements.cartButton) {
        elements.cartButton.addEventListener('click', openCart);
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
}

// Page navigation
function showProductsPage() {
    state.currentPage = 'products';
    
    hideAllPages();
    if (elements.productsSection) elements.productsSection.style.display = 'block';
    
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
            });
        }
        
        state.selectedSize = null;
        
        if (elements.addToCartDetail) {
            elements.addToCartDetail.disabled = true;
            elements.addToCartDetail.textContent = 'Добавить в корзину';
        }
    }
    
    hideAllPages();
    if (elements.productDetailPage) elements.productDetailPage.style.display = 'block';
    
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
    
    closeCart();
    updateCheckoutDisplay();
    
    window.scrollTo(0, 0);
}

function closeCheckout() {
    showProductsPage();
}

// Вспомогательные функции для управления страницами
function hideAllPages() {
    if (elements.productsSection) elements.productsSection.style.display = 'none';
    if (elements.productDetailPage) elements.productDetailPage.style.display = 'none';
    if (elements.checkoutPage) elements.checkoutPage.style.display = 'none';
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
            if (btn.dataset.view === view) {
                btn.classList.add('active');
            }
        });
    }
}

// Size selection
function selectSize(size) {
    if (elements.sizeOptions) {
        elements.sizeOptions.forEach(option => {
            option.classList.remove('selected');
            if (option.dataset.size === size) {
                option.classList.add('selected');
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
    showNotification('Товар добавлен в корзину');
}

// Управление корзиной
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

// Оптимизированное обновление отображения корзины
function updateCartDisplay() {
    // Update cart items
    if (elements.cartItems) {
        if (state.cart.length === 0) {
            elements.cartItems.innerHTML = '<div class="empty-cart"><p>Корзина пуста</p></div>';
        } else {
            elements.cartItems.innerHTML = state.cart.map(item => `
                <div class="cart-item" data-item-id="${item.id}">
                    <div class="cart-item-info">
                        <h4>${item.title}</h4>
                        <div class="cart-item-details">Размер: ${item.size}</div>
                    </div>
                    <div class="cart-item-controls">
                        <button class="quantity-btn" 
                                onclick="event.stopPropagation(); window.updateQuantity(${item.id}, -1)">-</button>
                        <span>${item.quantity}</span>
                        <button class="quantity-btn" 
                                onclick="event.stopPropagation(); window.updateQuantity(${item.id}, 1)">+</button>
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

    // Update cart count
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
    }
}

function closeCart() {
    if (elements.cartSidebar) {
        elements.cartSidebar.classList.remove('active');
    }
}

function openAboutModal() {
    if (elements.aboutModal) {
        elements.aboutModal.classList.add('active');
    }
}

function closeAboutModal() {
    if (elements.aboutModal) {
        elements.aboutModal.classList.remove('active');
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

// Payment processing
async function processPayment() {
    // Validate form
    const requiredFields = ['city', 'postalCode', 'address', 'fullName', 'phone', 'email'];
    let isValid = true;
    
    requiredFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field && !field.value.trim()) {
            field.style.borderColor = '#ff4444';
            isValid = false;
        }
    });
    
    if (!isValid) {
        showNotification('Пожалуйста, заполните все обязательные поля');
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
        alert(message);
    }
}

// Address autocomplete
function setupAddressAutocomplete() {
    const addressInput = document.getElementById('address');
    const suggestionsContainer = document.getElementById('addressSuggestions');
    
    if (!addressInput || !suggestionsContainer) return;
    
    addressInput.addEventListener('input', (e) => {
        const query = e.target.value;
        
        if (query.length < 3) {
            suggestionsContainer.classList.remove('active');
            suggestionsContainer.innerHTML = '';
            return;
        }
        
        // Заглушка для тестирования
        setTimeout(() => {
            suggestionsContainer.innerHTML = `
                <div class="address-suggestion" data-value="${query}, улица Примерная">${query}, улица Примерная</div>
                <div class="address-suggestion" data-value="${query}, проспект Тестовый">${query}, проспект Тестовый</div>
                <div class="address-suggestion" data-value="${query}, бульвар Демонстрационный">${query}, бульвар Демонстрационный</div>
            `;
            
            suggestionsContainer.classList.add('active');
            
            // Add click handlers
            suggestionsContainer.querySelectorAll('.address-suggestion').forEach(item => {
                item.addEventListener('click', () => {
                    addressInput.value = item.dataset.value;
                    suggestionsContainer.classList.remove('active');
                });
            });
        }, 300);
    });
    
    // Close suggestions on click outside
    document.addEventListener('click', (e) => {
        if (!addressInput.contains(e.target) && !suggestionsContainer.contains(e.target)) {
            suggestionsContainer.classList.remove('active');
        }
    });
}

// Form auto-save
function setupFormAutoSave() {
    const form = elements.checkoutForm;
    if (!form) return;
    
    const inputs = form.querySelectorAll('input, textarea');
    
    inputs.forEach(input => {
        input.addEventListener('input', () => {
            saveFormData();
        });
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

// Оптимизированная предзагрузка изображений
function optimizedPreloadImages() {
    const criticalImages = [
        '/static/images/dark_hoodie_front.jpg',
        '/static/images/gray_hoodie_front.jpg'
    ];
    
    criticalImages.forEach(src => {
        const img = new Image();
        img.src = src;
    });
}

// Make functions globally available for onclick handlers
window.updateQuantity = updateQuantity;
window.openCart = openCart;
window.closeCart = closeCart;

// Initialize the application
if (tg && tg.ready) {
    tg.ready();
    setTimeout(init, 100);
} else {
    document.addEventListener('DOMContentLoaded', init);
}

// Initialize address autocomplete when checkout page loads
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('checkoutPage')) {
        setupAddressAutocomplete();
        setupFormAutoSave();
        loadFormData();
    }
});

// Для отладки
console.log('MORELUFS app initialized successfully!');
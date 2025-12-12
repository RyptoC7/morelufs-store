from flask import Flask, send_file, jsonify, request, send_from_directory, make_response
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_compress import Compress
import os
import requests
import logging
import json
import time
from datetime import datetime
from dotenv import load_dotenv
import gzip
from functools import wraps
import redis
from werkzeug.middleware.proxy_fix import ProxyFix

# Загружаем переменные окружения
load_dotenv()

# Создаем приложение Flask
app = Flask(__name__, static_folder='static')

# Middleware для правильного определения IP за прокси
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_port=1)

# Включаем CORS для API
CORS(app, resources={
    r"/api/*": {
        "origins": ["*"],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

# Включаем сжатие Gzip
Compress(app)

# Настройка лимитера запросов
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["200 per day", "50 per hour"],
    storage_uri="memory://",  # Для продакшена лучше использовать Redis
    strategy="fixed-window"
)

# Конфигурация
TELEGRAM_BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN', 'YOUR_BOT_TOKEN')
TELEGRAM_CHAT_ID = os.getenv('TELEGRAM_CHAT_ID', 'YOUR_CHAT_ID')

# Конфигурация Redis для кэширования (опционально)
REDIS_URL = os.getenv('REDIS_URL')
redis_client = None
if REDIS_URL:
    try:
        redis_client = redis.from_url(REDIS_URL, decode_responses=True)
        app.logger.info("Redis подключен для кэширования")
    except Exception as e:
        app.logger.warning(f"Не удалось подключиться к Redis: {e}")
        redis_client = None

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Кэширование ответов
def cache_response(timeout=300):
    """Декоратор для кэширования ответов"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if not redis_client:
                return f(*args, **kwargs)
            
            cache_key = f"{request.path}:{hash(frozenset(request.args.items()))}"
            cached_response = redis_client.get(cache_key)
            
            if cached_response:
                app.logger.debug(f"Cache hit for {cache_key}")
                response = make_response(cached_response)
                response.headers['X-Cache'] = 'HIT'
                return response
            
            response = f(*args, **kwargs)
            
            # Кэшируем только успешные GET запросы
            if request.method == 'GET' and response.status_code == 200:
                try:
                    redis_client.setex(
                        cache_key,
                        timeout,
                        response.get_data(as_text=True)
                    )
                    response.headers['X-Cache'] = 'MISS'
                except Exception as e:
                    app.logger.warning(f"Failed to cache response: {e}")
            
            return response
        return decorated_function
    return decorator

def send_telegram_message(message):
    """Отправка сообщения в Telegram с таймаутом и повторными попытками"""
    if not TELEGRAM_BOT_TOKEN or TELEGRAM_BOT_TOKEN == 'YOUR_BOT_TOKEN':
        logger.warning("Telegram bot token не установлен")
        return False
    
    if not TELEGRAM_CHAT_ID or TELEGRAM_CHAT_ID == 'YOUR_CHAT_ID':
        logger.warning("Telegram chat ID не установлен")
        return False
    
    max_retries = 3
    for attempt in range(max_retries):
        try:
            url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
            payload = {
                'chat_id': TELEGRAM_CHAT_ID,
                'text': message,
                'parse_mode': 'HTML',
                'disable_web_page_preview': True
            }
            
            # Уменьшаем таймаут для телеграм API
            response = requests.post(
                url, 
                json=payload, 
                timeout=(3.05, 10)  # connect timeout, read timeout
            )
            
            if response.status_code == 200:
                logger.info("Сообщение успешно отправлено в Telegram")
                return True
            else:
                logger.warning(f"Telegram API вернул ошибку: {response.status_code}")
                if attempt < max_retries - 1:
                    time.sleep(1)  # Задержка перед повторной попыткой
        
        except requests.exceptions.Timeout:
            logger.warning(f"Таймаут при отправке в Telegram (попытка {attempt + 1})")
            if attempt < max_retries - 1:
                time.sleep(2)
        
        except requests.exceptions.RequestException as e:
            logger.error(f"Ошибка сети при отправке в Telegram: {e}")
            if attempt < max_retries - 1:
                time.sleep(2)
        
        except Exception as e:
            logger.error(f"Неожиданная ошибка при отправке в Telegram: {e}")
            break
    
    logger.error("Не удалось отправить сообщение в Telegram после всех попыток")
    return False

def format_order_message(order_data):
    """Форматирование сообщения о заказе"""
    try:
        customer = order_data.get('customer', {})
        items = order_data.get('items', [])
        delivery = order_data.get('delivery', {})
        
        # Формируем список товаров
        items_text = "\n".join([
            f"• {item.get('title', 'Товар')} (Размер: {item.get('size', 'N/A')}) "
            f"× {item.get('quantity', 1)} - {item.get('price', 0) * item.get('quantity', 1)} ₽" 
            for item in items
        ]) if items else "• Нет товаров"
        
        # Считаем сумму товаров
        items_total = sum(item.get('price', 0) * item.get('quantity', 1) for item in items)
        
        message = f"""<b>🛍️ НОВЫЙ ЗАКАЗ!</b>

<b>📦 Товары:</b>
{items_text}

<b>💰 Сумма:</b>
Товары: {items_total} ₽
Доставка: {delivery.get('price', 0)} ₽
<b>Итого: {order_data.get('total', 0)} ₽</b>

<b>🚚 Доставка:</b>
{delivery.get('method', 'Не выбран')}
Город: {customer.get('address', {}).get('city', 'Не указан')}
Адрес: {customer.get('address', {}).get('address', 'Не указан')}
Индекс: {customer.get('address', {}).get('postalCode', 'Не указан')}

<b>👤 Клиент:</b>
{customer.get('name', 'Не указан')}
📞 {customer.get('phone', 'Не указан')}
📧 {customer.get('email', 'Не указан')}

<b>💬 Комментарий:</b>
{order_data.get('comments', 'Нет комментария')}

<b>💳 Способ оплаты:</b>
{order_data.get('payment_method', 'Не выбран')}

<i>🕒 {order_data.get('timestamp', datetime.now().strftime("%d.%m.%Y %H:%M"))}</i>"""
        
        return message
    
    except Exception as e:
        logger.error(f"Ошибка при форматировании сообщения: {e}")
        return f"<b>Новый заказ!</b>\nПроизошла ошибка при формировании деталей."

# Middleware для измерения времени ответа
@app.before_request
def before_request():
    request.start_time = time.time()

@app.after_request
def after_request(response):
    if hasattr(request, 'start_time'):
        elapsed = time.time() - request.start_time
        logger.info(f"{request.method} {request.path} - {response.status_code} - {elapsed:.3f}s")
        response.headers['X-Response-Time'] = f'{elapsed:.3f}s'
    
    # Безопасные заголовки
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    
    # Для SPA важно разрешить загрузку скриптов
    response.headers['Content-Security-Policy'] = "default-src 'self'; script-src 'self' https://telegram.org https://cdnjs.cloudflare.com; style-src 'self' https://fonts.googleapis.com https://cdnjs.cloudflare.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:;"
    
    return response

# ========== СТАТИЧЕСКИЕ ФАЙЛЫ С ОПТИМИЗАЦИЕЙ ==========

@app.route('/')
@cache_response(timeout=3600)  # Кэшируем главную страницу на 1 час
def index():
    """Главная страница - отдаем index.html"""
    response = send_file('index.html')
    response.headers['Cache-Control'] = 'public, max-age=3600'
    return response

@app.route('/static/<path:filename>')
def serve_static(filename):
    """Отдаем статические файлы с кэшированием"""
    try:
        response = send_from_directory('static', filename)
        
        # Настраиваем кэширование в зависимости от типа файла
        if filename.endswith(('.css', '.js')):
            response.headers['Cache-Control'] = 'public, max-age=31536000, immutable'  # 1 год
        elif filename.endswith(('.jpg', '.jpeg', '.png', '.gif', '.webp')):
            response.headers['Cache-Control'] = 'public, max-age=604800'  # 1 неделя
        else:
            response.headers['Cache-Control'] = 'public, max-age=3600'  # 1 час
        
        return response
    except Exception as e:
        logger.error(f"Error serving static file {filename}: {e}")
        return jsonify({'error': 'File not found'}), 404

# ========== ВАЖНО: SPA маршрутизация ==========
@app.route('/<path:path>')
def catch_all(path):
    """Обрабатываем ВСЕ маршруты для SPA (Single Page Application)"""
    # Игнорируем известные расширения файлов
    if '.' in path and path.split('.')[-1] in ['ico', 'css', 'js', 'jpg', 'png', 'svg', 'json']:
        return jsonify({'error': 'Not found'}), 404
    
    # Для ВСЕХ остальных маршрутов возвращаем index.html
    response = send_file('index.html')
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    return response

# ========== API МАРШРУТЫ С ОПТИМИЗАЦИЕЙ ==========

@app.route('/api/order', methods=['POST'])
@limiter.limit("10 per minute")  # Ограничиваем 10 заказов в минуту
def create_order():
    """Создание нового заказа"""
    try:
        # Проверяем размер запроса
        if request.content_length and request.content_length > 1024 * 10:  # 10KB max
            return jsonify({'success': False, 'error': 'Request too large'}), 413
        
        data = request.get_json(silent=True)
        if not data:
            return jsonify({'success': False, 'error': 'Invalid JSON'}), 400
        
        # Быстрая валидация данных
        required_fields = ['customer', 'items']
        if not all(field in data for field in required_fields):
            return jsonify({'success': False, 'error': 'Missing required fields'}), 400
        
        customer = data.get('customer', {})
        if not all(k in customer for k in ['name', 'phone', 'email']):
            return jsonify({'success': False, 'error': 'Missing customer information'}), 400
        
        # Проверяем товары
        items = data.get('items', [])
        if not items or len(items) == 0:
            return jsonify({'success': False, 'error': 'Cart is empty'}), 400
        
        # Добавляем timestamp и ID заказа
        order_timestamp = datetime.now()
        order_id = int(order_timestamp.timestamp())
        data['timestamp'] = order_timestamp.strftime("%d.%m.%Y %H:%M")
        data['order_id'] = order_id
        
        # Рассчитываем итоговую сумму если не указана
        if 'total' not in data:
            items_total = sum(item.get('price', 0) * item.get('quantity', 1) for item in items)
            delivery_price = data.get('delivery', {}).get('price', 0)
            discount = data.get('discount', 0)
            data['total'] = items_total + delivery_price - discount
        
        # Отправляем заказ в Telegram (асинхронно)
        try:
            message = format_order_message(data)
            # Запускаем в отдельном потоке, чтобы не блокировать ответ
            import threading
            thread = threading.Thread(target=send_telegram_message, args=(message,))
            thread.daemon = True
            thread.start()
        except Exception as e:
            logger.error(f"Ошибка при подготовке Telegram сообщения: {e}")
            # Не прерываем выполнение если не удалось отправить в Telegram
        
        # Логируем заказ (в продакшене можно сохранять в БД)
        logger.info(f"Order created: ID={order_id}, Total={data['total']}, Customer={customer.get('name')}")
        
        # Возвращаем успешный ответ
        response_data = {
            'success': True, 
            'order_id': order_id,
            'message': 'Order created successfully',
            'timestamp': data['timestamp']
        }
        
        return jsonify(response_data)
        
    except Exception as e:
        logger.error(f"Ошибка при создании заказа: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

@app.route('/api/create-payment', methods=['POST'])
@limiter.limit("20 per minute")
def create_payment():
    """Создание платежа"""
    try:
        data = request.get_json(silent=True)
        if not data:
            return jsonify({'success': False, 'error': 'Invalid JSON'}), 400
        
        order_id = data.get('order_id')
        amount = data.get('amount', 0)
        payment_method = data.get('payment_method', 'yookassa')
        
        if not order_id or amount <= 0:
            return jsonify({'success': False, 'error': 'Invalid order data'}), 400
        
        # Генерация URL оплаты
        if payment_method == 'crypto':
            # Крипто-оплата со скидкой 200₽
            crypto_amount = max(0, amount - 200)  # Скидка 200₽, но не меньше 0
            
            return jsonify({
                'success': True,
                'payment_url': f"/crypto-payment?amount={crypto_amount}&order_id={order_id}",
                'payment_id': f"crypto_{order_id}",
                'discount': 200,
                'final_amount': crypto_amount
            })
        
        else:
            # Заглушка для тестирования
            # В реальном приложении здесь будет интеграция с платежными системами
            return jsonify({
                'success': True,
                'payment_url': f"/payment/success?order_id={order_id}",
                'payment_id': f"test_{order_id}",
                'amount': amount
            })
            
    except Exception as e:
        logger.error(f"Payment creation error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

@app.route('/api/address-suggestions', methods=['POST'])
@limiter.limit("30 per minute")
@cache_response(timeout=86400)  # Кэшируем на 1 день
def address_suggestions():
    """Автодополнение адресов"""
    try:
        data = request.get_json(silent=True)
        if not data:
            return jsonify({'suggestions': []})
        
        query = data.get('query', '').strip()
        
        if len(query) < 2:
            return jsonify({'suggestions': []})
        
        # В реальном приложении здесь будет интеграция с API геокодера
        # (Яндекс.Карты, Google Maps, DaData и т.д.)
        
        # Заглушка для тестирования
        mock_suggestions = [
            {'value': f'{query}, улица Примерная, дом 1'},
            {'value': f'{query}, проспект Тестовый, дом 15'},
            {'value': f'{query}, бульвар Демонстрационный, дом 25'}
        ]
        
        return jsonify({
            'suggestions': mock_suggestions[:3],  # Ограничиваем 3 предложениями
            'query': query
        })
            
    except Exception as e:
        logger.error(f"Address suggestions error: {e}")
        return jsonify({'suggestions': []})

@app.route('/api/products')
@cache_response(timeout=3600)  # Кэшируем продукты на 1 час
def get_products():
    """Получение списка продуктов"""
    products = [
        {
            'id': 'dark',
            'title': 'Dark Zip Hoodie',
            'price': 6000,
            'description': '100% Cotton, 470 g/m³',
            'images': {
                'front': '/static/images/dark_hoodie_front.jpg',
                'back': '/static/images/dark_hoodie_back.png'
            },
            'sizes': ['S', 'M', 'L'],
            'in_stock': True
        },
        {
            'id': 'gray', 
            'title': 'Gray Zip Hoodie',
            'price': 6000,
            'description': '100% Cotton, 470 g/m³',
            'images': {
                'front': '/static/images/gray_hoodie_front.jpg',
                'back': '/static/images/gray_hoodie_back.jpg'
            },
            'sizes': ['S', 'M', 'L'],
            'in_stock': True
        }
    ]
    
    response = jsonify(products)
    response.headers['Cache-Control'] = 'public, max-age=3600'
    return response

# ========== СТРАНИЦЫ ОПЛАТЫ С ОПТИМИЗАЦИЕЙ ==========

@app.route('/payment/success')
@cache_response(timeout=300)  # Короткое кэширование
def payment_success():
    """Страница успешной оплаты"""
    order_id = request.args.get('order_id', '')
    
    html = f'''<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="robots" content="noindex, nofollow">
    <title>Оплата успешна - MORELUFS</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f8f8f8;
            margin: 0;
            padding: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
        }}
        .success-container {{
            background: white;
            padding: 30px;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
            text-align: center;
            max-width: 400px;
            width: 90%;
        }}
        .success-icon {{
            font-size: 48px;
            color: #22c55e;
            margin-bottom: 20px;
        }}
        h1 {{
            color: #000;
            margin-bottom: 15px;
            font-weight: 600;
            font-size: 20px;
        }}
        p {{
            color: #666;
            line-height: 1.6;
            margin-bottom: 20px;
            font-size: 14px;
        }}
        .order-id {{
            background: #f1f5f9;
            padding: 10px 15px;
            border-radius: 6px;
            font-weight: 600;
            margin: 20px 0;
            font-size: 14px;
        }}
        .btn {{
            display: inline-block;
            background: #000;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            transition: opacity 0.3s;
            font-size: 14px;
            border: none;
            cursor: pointer;
            font-family: inherit;
        }}
        .btn:hover {{
            opacity: 0.9;
        }}
    </style>
</head>
<body>
    <div class="success-container">
        <div class="success-icon">✓</div>
        <h1>Оплата прошла успешно!</h1>
        <p>Ваш заказ был успешно оплачен и принят в обработку.</p>
        {f'<div class="order-id">Номер заказа: #{order_id}</div>' if order_id else ''}
        <p>Мы свяжемся с вами в ближайшее время для подтверждения деталей доставки.</p>
        <button onclick="closeWindow()" class="btn">Закрыть</button>
    </div>
    <script>
        function closeWindow() {{
            if (window.Telegram && Telegram.WebApp) {{
                Telegram.WebApp.close();
            }} else {{
                window.close();
            }}
        }}
        
        // Автоматическое закрытие через 5 секунд
        setTimeout(closeWindow, 5000);
    </script>
</body>
</html>'''
    
    response = make_response(html)
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    return response

@app.route('/crypto-payment')
@cache_response(timeout=300)
def crypto_payment():
    """Страница оплаты криптовалютой"""
    amount = request.args.get('amount', 0)
    order_id = request.args.get('order_id', '')
    
    try:
        amount_int = int(float(amount))
    except (ValueError, TypeError):
        amount_int = 0
    
    html = f'''<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="robots" content="noindex, nofollow">
    <title>Оплата криптовалютой - MORELUFS</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f8f8f8;
            margin: 0;
            padding: 20px;
        }}
        .crypto-container {{
            background: white;
            padding: 25px;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
            max-width: 400px;
            margin: 0 auto;
        }}
        h1 {{
            color: #000;
            margin-bottom: 20px;
            font-weight: 600;
            font-size: 20px;
            text-align: center;
        }}
        .info-box {{
            background: #f1f5f9;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
        }}
        .info-row {{
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
            font-size: 14px;
        }}
        .discount {{
            color: #22c55e;
            font-weight: 600;
        }}
        .wallet-address {{
            background: #f8f8f8;
            padding: 15px;
            border-radius: 8px;
            font-family: monospace;
            font-size: 14px;
            word-break: break-all;
            margin: 20px 0;
            text-align: center;
        }}
        .qr-code {{
            width: 200px;
            height: 200px;
            background: #f0f0f0;
            margin: 20px auto;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 8px;
            font-size: 12px;
            color: #666;
        }}
        .timer {{
            text-align: center;
            font-size: 14px;
            color: #666;
            margin: 20px 0;
        }}
        .btn {{
            display: block;
            width: 100%;
            background: #000;
            color: white;
            padding: 15px;
            border: none;
            border-radius: 8px;
            font-weight: 600;
            font-size: 16px;
            cursor: pointer;
            margin-top: 20px;
            font-family: inherit;
        }}
    </style>
</head>
<body>
    <div class="crypto-container">
        <h1>Оплата криптовалютой</h1>
        
        <div class="info-box">
            <div class="info-row">
                <span>Сумма заказа:</span>
                <span>{amount_int + 200} ₽</span>
            </div>
            <div class="info-row discount">
                <span>Скидка за крипту:</span>
                <span>-200 ₽</span>
            </div>
            <div class="info-row" style="font-weight: 600; font-size: 16px;">
                <span>К оплате:</span>
                <span>{amount_int} ₽</span>
            </div>
        </div>
        
        <div style="text-align: center; margin: 20px 0;">
            <div style="font-size: 14px; color: #666; margin-bottom: 10px;">Отправьте на адрес:</div>
            <div class="wallet-address">0x742d35Cc6634C0532925a3b8Bb</div>
        </div>
        
        <div class="qr-code">
            [QR-код для оплаты]
        </div>
        
        <div class="timer">
            ⏳ Счет действителен: <span id="timer">15:00</span>
        </div>
        
        <div style="font-size: 12px; color: #666; text-align: center; margin-top: 20px;">
            После оплаты нажмите кнопку ниже для подтверждения
        </div>
        
        <button onclick="checkPayment()" class="btn">Я ОПЛАТИЛ</button>
    </div>
    
    <script>
        let timeLeft = 15 * 60;
        
        function updateTimer() {{
            let minutes = Math.floor(timeLeft / 60);
            let seconds = timeLeft % 60;
            document.getElementById('timer').textContent = 
                minutes.toString().padStart(2, '0') + ':' + 
                seconds.toString().padStart(2, '0');
            
            if (timeLeft > 0) {{
                timeLeft--;
                setTimeout(updateTimer, 1000);
            }} else {{
                document.getElementById('timer').textContent = 'Время истекло';
            }}
        }}
        
        function checkPayment() {{
            window.location.href = '/payment/success?order_id={order_id}';
        }}
        
        updateTimer();
    </script>
</body>
</html>'''
    
    response = make_response(html)
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    return response

# ========== СЛУЖЕБНЫЕ МАРШРУТЫ ==========

@app.route('/health')
def health_check():
    """Проверка здоровья сервера"""
    health_status = {
        'status': 'healthy', 
        'service': 'Morelufs Telegram API',
        'timestamp': datetime.now().isoformat(),
        'version': '1.0.0',
        'dependencies': {
            'static_files': os.path.exists('static'),
            'templates': os.path.exists('index.html'),
            'telegram_token': bool(TELEGRAM_BOT_TOKEN and TELEGRAM_BOT_TOKEN != 'YOUR_BOT_TOKEN'),
            'redis': redis_client is not None and redis_client.ping()
        },
        'resources': {
            'memory': os.sysconf('SC_PAGE_SIZE') * os.sysconf('SC_PHYS_PAGES') if hasattr(os, 'sysconf') else 'unknown'
        }
    }
    
    response = jsonify(health_status)
    response.headers['Cache-Control'] = 'no-cache'
    return response

@app.route('/api/debug')
@limiter.exempt
def debug_info():
    """Информация для отладки"""
    debug_info = {
        'telegram_token_set': bool(TELEGRAM_BOT_TOKEN and TELEGRAM_BOT_TOKEN != 'YOUR_BOT_TOKEN'),
        'chat_id_set': bool(TELEGRAM_CHAT_ID and TELEGRAM_CHAT_ID != 'YOUR_CHAT_ID'),
        'current_time': datetime.now().isoformat(),
        'working_directory': os.getcwd(),
        'environment': os.environ.get('FLASK_ENV', 'production'),
        'python_version': os.sys.version,
        'headers': dict(request.headers),
        'client_ip': request.remote_addr
    }
    
    # Безопасно показываем список файлов
    try:
        debug_info['files_in_directory'] = os.listdir('.')
    except Exception as e:
        debug_info['files_in_directory_error'] = str(e)
    
    response = jsonify(debug_info)
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    return response

# ========== ОБРАБОТКА ОШИБОК ==========

@app.errorhandler(404)
def not_found(e):
    """Обработка 404 ошибки"""
    if request.path.startswith('/api/'):
        return jsonify({'error': 'API endpoint not found'}), 404
    
    # Для SPA возвращаем index.html
    response = send_file('index.html')
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    return response

@app.errorhandler(429)
def ratelimit_handler(e):
    """Обработка превышения лимита запросов"""
    return jsonify({
        'success': False, 
        'error': 'Too many requests',
        'message': 'Пожалуйста, попробуйте позже'
    }), 429

@app.errorhandler(500)
def internal_error(e):
    """Обработка 500 ошибки"""
    logger.error(f"Internal server error: {e}")
    return jsonify({'error': 'Internal server error', 'message': 'Пожалуйста, попробуйте позже'}), 500

@app.errorhandler(Exception)
def handle_all_exceptions(e):
    """Обработка всех необработанных исключений"""
    logger.error(f"Unhandled exception: {e}", exc_info=True)
    return jsonify({'error': 'Internal server error'}), 500

# ========== ЗАПУСК СЕРВЕРА ==========

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    debug_mode = os.getenv('FLASK_ENV', 'production') == 'development'
    
    # Создаем папку static если её нет
    if not os.path.exists('static'):
        os.makedirs('static')
        logger.info("Создана папка static/")
    
    # Проверяем необходимые файлы
    required_files = ['index.html', 'style.css', 'script.js']
    missing_files = [f for f in required_files if not os.path.exists(f)]
    
    if missing_files:
        logger.warning(f"Отсутствуют файлы: {missing_files}")
    
    # Проверка файлов изображений
    image_files = [
        'static/images/dark_hoodie_front.jpg',
        'static/images/dark_hoodie_back.png',
        'static/images/gray_hoodie_front.jpg',
        'static/images/gray_hoodie_back.jpg',
        'static/images/about.jpg'
    ]
    
    for img_file in image_files:
        if not os.path.exists(img_file):
            logger.warning(f"Отсутствует изображение: {img_file}")
    
    print("=" * 50)
    print("🚀 MORELUFS Telegram Mini App Server")
    print("=" * 50)
    print(f"📁 Текущая директория: {os.getcwd()}")
    print(f"🔧 Режим: {'development' if debug_mode else 'production'}")
    print(f"🔑 Telegram Token: {'✅ Установлен' if TELEGRAM_BOT_TOKEN != 'YOUR_BOT_TOKEN' else '❌ Не установлен'}")
    print(f"👤 Chat ID: {'✅ Установлен' if TELEGRAM_CHAT_ID != 'YOUR_CHAT_ID' else '❌ Не установлен'}")
    print(f"🔄 Redis кэш: {'✅ Включен' if redis_client else '❌ Выключен'}")
    print("=" * 50)
    print(f"🌐 Сервер запущен: http://localhost:{port}")
    print(f"📊 API доступно: http://localhost:{port}/api/products")
    print(f"❤️  Проверка здоровья: http://localhost:{port}/health")
    print("=" * 50)
    
    # Запускаем сервер
    app.run(
        host='0.0.0.0', 
        port=port, 
        debug=debug_mode,
        threaded=True,  # Поддержка многопоточности
        use_reloader=debug_mode  # Перезагрузка при изменении кода только в режиме разработки
    )
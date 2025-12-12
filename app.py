from flask import Flask, send_file, jsonify, request, send_from_directory
import os
import requests
import logging
from datetime import datetime
from dotenv import load_dotenv

# Загружаем переменные окружения
load_dotenv()

# Создаем приложение Flask
app = Flask(__name__, static_folder='static')

# Конфигурация
TELEGRAM_BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN', 'YOUR_BOT_TOKEN')
TELEGRAM_CHAT_ID = os.getenv('TELEGRAM_CHAT_ID', 'YOUR_CHAT_ID')

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def send_telegram_message(message):
    """Отправка сообщения в Telegram"""
    try:
        url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
        payload = {
            'chat_id': TELEGRAM_CHAT_ID,
            'text': message,
            'parse_mode': 'HTML'
        }
        response = requests.post(url, json=payload, timeout=10)
        return response.status_code == 200
    except Exception as e:
        logger.error(f"Ошибка отправки в Telegram: {e}")
        return False

def format_order_message(order_data):
    """Форматирование сообщения о заказе"""
    customer = order_data['customer']
    items = order_data['items']
    delivery = order_data['delivery']
    
    # Формируем список товаров
    items_text = "\n".join([
        f"• {item['title']} (Размер: {item['size']}) × {item['quantity']} - {item['price'] * item['quantity']} ₽" 
        for item in items
    ])
    
    # Считаем сумму товаров
    items_total = sum(item['price'] * item['quantity'] for item in items)
    
    message = f"""<b>🛍️ НОВЫЙ ЗАКАЗ!</b>

<b>📦 Товары:</b>
{items_text}

<b>💰 Сумма:</b>
Товары: {items_total} ₽
Доставка: {delivery['price']} ₽
<b>Итого: {order_data['total']} ₽</b>

<b>🚚 Доставка:</b>
{delivery['method']}
Город: {customer['address']['city']}
Адрес: {customer['address']['address']}
Индекс: {customer['address']['postalCode']}

<b>👤 Клиент:</b>
{customer['name']}
📞 {customer['phone']}
📧 {customer['email']}

<b>💬 Комментарий:</b>
{order_data.get('comments', 'Нет комментария')}

<b>💳 Способ оплаты:</b>
{order_data.get('payment_method', 'Не выбран')}

<i>🕒 {order_data.get('timestamp', '')}</i>"""
    
    return message

# ========== СТАТИЧЕСКИЕ ФАЙЛЫ ==========

@app.route('/')
def index():
    """Главная страница - отдаем index.html"""
    return send_file('index.html')

@app.route('/static/<path:path>')
def serve_static(path):
    """Отдаем статические файлы из папки static"""
    return send_from_directory('static', path)

# ========== ВАЖНО: SPA маршрутизация ==========
@app.route('/<path:path>')
def catch_all(path):
    """Обрабатываем ВСЕ маршруты для SPA (Single Page Application)"""
    # Список реальных файлов
    real_files = ['index.html', 'style.css', 'script.js', 'favicon.ico']
    
    # Если запрашивают реальный файл
    if path in real_files and os.path.exists(path):
        return send_file(path)
    
    # Если запрашивают файл из static
    if path.startswith('static/') and os.path.exists(path):
        return send_from_directory('.', path)
    
    # Для ВСЕХ остальных маршрутов возвращаем index.html
    # (позволяет работать Vue/React/Angular роутингу)
    return send_file('index.html')

# ========== API МАРШРУТЫ ==========

@app.route('/api/order', methods=['POST'])
def create_order():
    try:
        data = request.json
        
        # Валидация данных
        required_fields = ['customer', 'items', 'total', 'delivery']
        if not all(field in data for field in required_fields):
            return jsonify({'success': False, 'error': 'Missing required fields'}), 400
        
        customer = data['customer']
        if not all(k in customer for k in ['name', 'phone', 'email', 'address']):
            return jsonify({'success': False, 'error': 'Missing customer information'}), 400
        
        # Добавляем timestamp
        data['timestamp'] = datetime.now().strftime("%d.%m.%Y %H:%M")
        
        # Отправляем заказ в Telegram
        message = format_order_message(data)
        if send_telegram_message(message):
            logger.info(f"Заказ отправлен в Telegram")
            return jsonify({
                'success': True, 
                'order_id': int(datetime.now().timestamp()),
                'message': 'Order created successfully'
            })
        else:
            return jsonify({'success': False, 'error': 'Failed to send to Telegram'}), 500
        
    except Exception as e:
        logger.error(f"Ошибка при создании заказа: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/create-payment', methods=['POST'])
def create_payment():
    try:
        data = request.json
        order_id = data.get('order_id')
        amount = data.get('amount')
        payment_method = data.get('payment_method', 'yookassa')
        
        # Генерация URL оплаты
        if payment_method == 'crypto':
            # Крипто-оплата со скидкой 200₽
            crypto_amount = amount - 200  # Скидка 200₽
            
            return jsonify({
                'success': True,
                'payment_url': f"/crypto-payment?amount={crypto_amount}&order_id={order_id}",
                'payment_id': f"crypto_{order_id}",
                'discount': 200,
                'final_amount': crypto_amount
            })
        
        else:
            # Заглушка для тестирования
            return jsonify({
                'success': True,
                'payment_url': f"/payment/success?order_id={order_id}",
                'payment_id': f"test_{order_id}"
            })
            
    except Exception as e:
        logger.error(f"Payment creation error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/address-suggestions', methods=['POST'])
def address_suggestions():
    try:
        data = request.json
        query = data.get('query', '')
        
        if len(query) < 3:
            return jsonify({'suggestions': []})
        
        # Заглушка для автодополнения адресов
        mock_suggestions = [
            {'value': f'{query}, улица Примерная, дом 1'},
            {'value': f'{query}, проспект Тестовый, дом 15'},
            {'value': f'{query}, бульвар Демонстрационный, дом 25'}
        ]
        return jsonify({'suggestions': mock_suggestions})
            
    except Exception as e:
        logger.error(f"Address suggestions error: {e}")
        return jsonify({'suggestions': []})

@app.route('/api/products')
def get_products():
    products = [
        {
            'id': 'dark',
            'title': 'Dark Zip Hoodie',
            'price': 6000,
            'description': '100% Cotton, 470 g/m³',
            'images': {
                'front': '/static/images/dark_hoodie_front.jpg',
                'back': '/static/images/dark_hoodie_back.png'
            }
        },
        {
            'id': 'gray', 
            'title': 'Gray Zip Hoodie',
            'price': 6000,
            'description': '100% Cotton, 470 g/m³',
            'images': {
                'front': '/static/images/gray_hoodie_front.jpg',
                'back': '/static/images/gray_hoodie_back.jpg'
            }
        }
    ]
    return jsonify(products)

# ========== СТРАНИЦЫ ОПЛАТЫ ==========

@app.route('/payment/success')
def payment_success():
    order_id = request.args.get('order_id')
    
    return f'''
    <!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
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
    </script>
</body>
</html>
    '''

@app.route('/crypto-payment')
def crypto_payment():
    amount = request.args.get('amount', 0)
    order_id = request.args.get('order_id')
    
    return f'''
    <!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
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
                <span>{int(float(amount)) + 200} ₽</span>
            </div>
            <div class="info-row discount">
                <span>Скидка за крипту:</span>
                <span>-200 ₽</span>
            </div>
            <div class="info-row" style="font-weight: 600; font-size: 16px;">
                <span>К оплате:</span>
                <span>{int(float(amount))} ₽</span>
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
            }}
        }}
        
        function checkPayment() {{
            window.location.href = '/payment/success?order_id={order_id}';
        }}
        
        updateTimer();
    </script>
</body>
</html>
    '''

# ========== СЛУЖЕБНЫЕ МАРШРУТЫ ==========

@app.route('/health')
def health_check():
    return jsonify({
        'status': 'healthy', 
        'service': 'Morelufs Telegram API',
        'static_files': os.path.exists('static'),
        'templates': os.path.exists('index.html')
    })

@app.route('/api/debug')
def debug_info():
    """Информация для отладки"""
    return jsonify({
        'telegram_token_set': bool(TELEGRAM_BOT_TOKEN and TELEGRAM_BOT_TOKEN != 'YOUR_BOT_TOKEN'),
        'chat_id_set': bool(TELEGRAM_CHAT_ID and TELEGRAM_CHAT_ID != 'YOUR_CHAT_ID'),
        'current_time': datetime.now().isoformat(),
        'working_directory': os.getcwd(),
        'files_in_directory': os.listdir('.')
    })

# ========== ОБРАБОТКА ОШИБОК ==========

@app.errorhandler(404)
def not_found(e):
    """Обработка 404 ошибки - возвращаем index.html для SPA"""
    return send_file('index.html')

@app.errorhandler(500)
def internal_error(e):
    """Обработка 500 ошибки"""
    return jsonify({'error': 'Internal server error', 'message': str(e)}), 500

# ========== ЗАПУСК СЕРВЕРА ==========

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    
    # Создаем папку static если её нет
    if not os.path.exists('static'):
        os.makedirs('static')
        print("Создана папка static/")
    
    print("=" * 50)
    print("MORELUFS Telegram Mini App Server")
    print("=" * 50)
    print(f"📁 Текущая директория: {os.getcwd()}")
    print(f"📁 Существует index.html: {os.path.exists('index.html')}")
    print(f"📁 Существует static/: {os.path.exists('static')}")
    
    # Проверка файлов изображений
    image_files = [
        'static/images/dark_hoodie_front.jpg',
        'static/images/dark_hoodie_back.png',
        'static/images/gray_hoodie_front.jpg',
        'static/images/gray_hoodie_back.jpg',
        'static/images/about.jpg'
    ]
    
    print("\n📸 Проверка файлов изображений:")
    for img_file in image_files:
        exists = os.path.exists(img_file)
        status = '✅ СУЩЕСТВУЕТ' if exists else '❌ НЕ СУЩЕСТВУЕТ'
        print(f"  {img_file}: {status}")
    
    print(f"\n🔑 Telegram Token установлен: {'✅' if TELEGRAM_BOT_TOKEN != 'YOUR_BOT_TOKEN' else '❌'}")
    print(f"👤 Chat ID установлен: {'✅' if TELEGRAM_CHAT_ID != 'YOUR_CHAT_ID' else '❌'}")
    print("=" * 50)
    print(f"🌐 Сервер запущен: http://localhost:{port}")
    print(f"🔧 API доступно: http://localhost:{port}/api/products")
    print(f"❤️  Проверка здоровья: http://localhost:{port}/health")
    print("=" * 50)
    
    # Важно: debug=True для разработки, debug=False для продакшена!
    app.run(host='0.0.0.0', port=port, debug=True)
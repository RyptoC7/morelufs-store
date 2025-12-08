from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import os
import requests
import logging
from datetime import datetime

app = Flask(__name__)
CORS(app)

# Конфигурация
TELEGRAM_BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN', 'YOUR_BOT_TOKEN')
TELEGRAM_CHAT_ID = os.getenv('TELEGRAM_CHAT_ID', 'YOUR_CHAT_ID')
YOOKASSA_SHOP_ID = os.getenv('YOOKASSA_SHOP_ID', '')
YOOKASSA_SECRET_KEY = os.getenv('YOOKASSA_SECRET_KEY', '')

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
    items_text = chr(10).join([
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
        if payment_method == 'yookassa' and YOOKASSA_SHOP_ID:
            # Интеграция с ЮKassa
            import uuid
            payment_id = str(uuid.uuid4())
            
            # Здесь будет реальная интеграция с ЮKassa
            payment_url = f"https://yookassa.ru/payments/{payment_id}"
            
            return jsonify({
                'success': True,
                'payment_url': payment_url,
                'payment_id': payment_id
            })
        
        elif payment_method == 'crypto':
            # Крипто-оплата со скидкой 200₽
            crypto_amount = amount - 200  # Скидка 200₽
            
            # Интеграция с NOWPayments или другим сервисом
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
                'front': 'https://via.placeholder.com/400x500/000000/FFFFFF?text=Dark+Hoodie+Front',
                'back': 'https://via.placeholder.com/400x500/333333/FFFFFF?text=Dark+Hoodie+Back'
            }
        },
        {
            'id': 'gray', 
            'title': 'Gray Zip Hoodie',
            'price': 6000,
            'description': '100% Cotton, 470 g/m³',
            'images': {
                'front': 'https://via.placeholder.com/400x500/666666/FFFFFF?text=Gray+Hoodie+Front',
                'back': 'https://via.placeholder.com/400x500/999999/FFFFFF?text=Gray+Hoodie+Back'
            }
        }
    ]
    return jsonify(products)

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
            <button onclick="window.Telegram.WebApp.close()" class="btn">Закрыть</button>
        </div>
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
                // Здесь будет проверка оплаты
                window.location.href = '/payment/success?order_id={order_id}';
            }}
            
            updateTimer();
        </script>
    </body>
    </html>
    '''

@app.route('/health')
def health_check():
    return jsonify({'status': 'healthy', 'service': 'Morelufs Telegram API'})

@app.route('/')
def index():
    """Отдаем главную страницу"""
    return '''
    <!DOCTYPE html>
    <html lang="ru">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>MORELUFS Store API</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: #000;
                color: #fff;
                margin: 0;
                padding: 40px 20px;
                text-align: center;
                min-height: 100vh;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
            }
            .container {
                max-width: 600px;
            }
            h1 {
                font-size: 32px;
                margin-bottom: 10px;
                font-weight: 600;
            }
            .logo {
                font-size: 48px;
                margin-bottom: 30px;
            }
            .status {
                background: #22c55e;
                color: white;
                padding: 8px 16px;
                border-radius: 20px;
                display: inline-block;
                margin-bottom: 30px;
                font-weight: 500;
            }
            .endpoints {
                text-align: left;
                background: #111;
                padding: 20px;
                border-radius: 12px;
                margin: 20px 0;
            }
            .endpoint {
                margin-bottom: 15px;
                padding-bottom: 15px;
                border-bottom: 1px solid #333;
            }
            .endpoint:last-child {
                border-bottom: none;
                margin-bottom: 0;
                padding-bottom: 0;
            }
            .method {
                display: inline-block;
                background: #3b82f6;
                color: white;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 12px;
                font-weight: 600;
                margin-right: 10px;
            }
            .url {
                font-family: monospace;
                color: #ccc;
                font-size: 14px;
            }
            .description {
                color: #999;
                font-size: 14px;
                margin-top: 5px;
                margin-left: 50px;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="logo">🛍️</div>
            <h1>MORELUFS Store API</h1>
            <div class="status">✅ Сервер работает</div>
            <p>API для Telegram Mini App интернет-магазина</p>
            
            <div class="endpoints">
                <div class="endpoint">
                    <span class="method">GET</span>
                    <span class="url">/api/products</span>
                    <div class="description">Получить список товаров</div>
                </div>
                <div class="endpoint">
                    <span class="method">POST</span>
                    <span class="url">/api/order</span>
                    <div class="description">Создать новый заказ (отправляет в Telegram)</div>
                </div>
                <div class="endpoint">
                    <span class="method">POST</span>
                    <span class="url">/api/create-payment</span>
                    <div class="description">Создать платежную ссылку</div>
                </div>
                <div class="endpoint">
                    <span class="method">GET</span>
                    <span class="url">/health</span>
                    <div class="description">Проверка работоспособности сервера</div>
                </div>
            </div>
            
            <p style="color: #666; margin-top: 30px; font-size: 14px;">
                Для работы магазина откройте index.html в Telegram Mini App
            </p>
        </div>
    </body>
    </html>
    '''

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
from flask import Flask, render_template, request, jsonify
import serial
import time
import threading

app = Flask(__name__)

# Konfigurasi Serial
POSSIBLE_PORTS = ['COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8']  # Daftar port yang mungkin
BAUD_RATE = 9600
arduino = None
serial_lock = threading.Lock()
current_port = None

def find_arduino_port():
    """Cari port Arduino yang tersedia"""
    import serial.tools.list_ports
    
    # Cari semua port yang tersedia
    available_ports = serial.tools.list_ports.comports()
    print("=== SCANNING PORTS ===")
    
    arduino_ports = []
    for port in available_ports:
        print(f"Found: {port.device} - {port.description} - {port.hwid}")
        
        # Cek apakah ini Arduino berdasarkan description atau VID/PID
        if any(keyword in port.description.lower() for keyword in ['arduino', 'ch340', 'cp210', 'ftdi']):
            arduino_ports.append(port.device)
            print(f"  -> Potential Arduino port detected!")
    
    print(f"Arduino-like ports found: {arduino_ports}")
    
    # Test koneksi ke setiap port Arduino
    for port in arduino_ports:
        print(f"Testing connection to {port}...")
        try:
            test_serial = serial.Serial(port, BAUD_RATE, timeout=2)
            test_serial.close()
            print(f"  -> {port} connection test: SUCCESS")
            return port
        except Exception as e:
            print(f"  -> {port} connection test: FAILED ({e})")
    
    # Jika tidak ada yang cocok, coba semua port yang tersedia
    print("No Arduino-specific ports found, testing all available ports...")
    for port in available_ports:
        try:
            test_serial = serial.Serial(port.device, BAUD_RATE, timeout=1)
            test_serial.close()
            print(f"  -> {port.device} generic test: SUCCESS")
            return port.device
        except:
            print(f"  -> {port.device} generic test: FAILED")
    
    return None

def init_serial():
    global arduino, current_port
    
    # Coba port yang sudah diketahui dulu
    if current_port:
        try:
            arduino = serial.Serial(current_port, BAUD_RATE, timeout=1)
            time.sleep(2)  # Wait for Arduino to initialize
            print(f"Connected to Arduino on {current_port}")
            return True
        except Exception as e:
            print(f"Error connecting to {current_port}: {e}")
            current_port = None
    
    # Cari port Arduino yang tersedia
    found_port = find_arduino_port()
    if found_port:
        try:
            arduino = serial.Serial(found_port, BAUD_RATE, timeout=1)
            time.sleep(2)  # Wait for Arduino to initialize
            current_port = found_port
            print(f"Connected to Arduino on {found_port}")
            return True
        except Exception as e:
            print(f"Error connecting to {found_port}: {e}")
    
    print("No available Arduino port found")
    return False

def send_command(command):
    global arduino
    with serial_lock:
        try:
            if arduino and arduino.is_open:
                arduino.write(command.encode())
                time.sleep(0.2)  # Wait longer for Arduino to process
                
                # Read response with timeout
                response = ""
                start_time = time.time()
                while time.time() - start_time < 1:  # 1 second timeout
                    if arduino.in_waiting > 0:
                        response += arduino.read().decode()
                    else:
                        time.sleep(0.1)
                        if response:  # If we got some response, break
                            break
                
                return response.strip() if response else "Command sent"
        except Exception as e:
            print(f"Error sending command: {e}")
        return None

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/led/<state>')
def control_led(state):
    if state == 'on':
        response = send_command('1')
        return jsonify({'status': 'success', 'message': 'LED turned ON', 'response': response})
    elif state == 'off':
        response = send_command('0')
        return jsonify({'status': 'success', 'message': 'LED turned OFF', 'response': response})
    else:
        return jsonify({'status': 'error', 'message': 'Invalid command'})

@app.route('/status')
def get_status():
    global arduino, current_port
    status = 'connected' if arduino and arduino.is_open else 'disconnected'
    port_info = current_port if current_port else 'Not detected'
    return jsonify({'status': status, 'port': port_info})

@app.route('/ports')
def list_ports():
    """List semua port COM yang tersedia"""
    import serial.tools.list_ports
    available_ports = []
    for port in serial.tools.list_ports.comports():
        available_ports.append({
            'device': port.device,
            'description': port.description,
            'hwid': port.hwid
        })
    return jsonify({'ports': available_ports})

@app.route('/connect')
def connect_arduino():
    if init_serial():
        return jsonify({'status': 'success', 'message': f'Connected to Arduino on {current_port}'})
    else:
        return jsonify({'status': 'error', 'message': 'Failed to connect to Arduino. Check if Arduino is connected and not used by other applications.'})

@app.route('/connect/<port>')
def connect_specific_port(port):
    """Connect ke port spesifik yang dipilih user"""
    global arduino, current_port
    
    try:
        if arduino and arduino.is_open:
            arduino.close()
        
        arduino = serial.Serial(port, BAUD_RATE, timeout=1)
        time.sleep(2)
        current_port = port
        print(f"Successfully connected to Arduino on {port}")
        return jsonify({'status': 'success', 'message': f'Connected to Arduino on {port}'})
    except Exception as e:
        print(f"Failed to connect to {port}: {e}")
        return jsonify({'status': 'error', 'message': f'Failed to connect to {port}: {str(e)}'})

if __name__ == '__main__':
    # Don't auto-connect on startup, let user connect manually
    print("Arduino Web Controller started. Use web interface to connect to Arduino.")
    app.run(debug=True, host='0.0.0.0', port=5000)
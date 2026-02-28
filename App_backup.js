import React, { useState, useRef, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TouchableOpacity, 
  Dimensions, 
  Alert,
  StatusBar 
} from 'react-native';
import { GestureHandlerRootView, GestureDetector, Gesture } from 'react-native-gesture-handler';
import Svg, { Path, G } from 'react-native-svg';
import io from 'socket.io-client';

const { width, height } = Dimensions.get('window');

// ⚠️ QUAN TRỌNG: Thay đổi IP này thành IP máy tính của bạn
// Chạy 'ipconfig' trên Windows để tìm IPv4 Address
const SOCKET_URL = 'http://192.168.1.100:3000';

export default function App() {
  const [paths, setPaths] = useState([]);
  const [currentPath, setCurrentPath] = useState('');
  const [color, setColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [userCount, setUserCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  
  const socketRef = useRef(null);
  const currentPathRef = useRef('');

  useEffect(() => {
    // Kết nối Socket.IO
    socketRef.current = io(SOCKET_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    // Khi kết nối thành công
    socketRef.current.on('connect', () => {
      console.log('✅ Connected to server');
      setIsConnected(true);
    });

    // Nhận dữ liệu vẽ ban đầu khi mới join
    socketRef.current.on('init-drawing', (data) => {
      console.log(`📥 Received ${data.length} existing paths`);
      setPaths(data);
    });

    // Nhận dữ liệu vẽ từ users khác (realtime)
    socketRef.current.on('draw', (data) => {
      setPaths(prev => [...prev, data]);
    });

    // Xóa canvas
    socketRef.current.on('clear-canvas', () => {
      console.log('🗑️  Canvas cleared by another user');
      setPaths([]);
    });

    // Cập nhật số lượng user online
    socketRef.current.on('user-count', (count) => {
      setUserCount(count);
    });

    // Xử lý lỗi kết nối
    socketRef.current.on('connect_error', (error) => {
      console.error('❌ Connection error:', error);
      setIsConnected(false);
      Alert.alert(
        'Lỗi kết nối', 
        `Không thể kết nối đến server tại ${SOCKET_URL}\n\nVui lòng kiểm tra:\n1. Server đã chạy chưa?\n2. IP address đúng chưa?\n3. Cùng mạng WiFi chưa?`
      );
    });

    // Khi mất kết nối
    socketRef.current.on('disconnect', () => {
      console.log('❌ Disconnected from server');
      setIsConnected(false);
    });

    // Cleanup khi component unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  // Xử lý gesture vẽ
  const panGesture = Gesture.Pan()
    .onStart((e) => {
      // Bắt đầu nét vẽ mới
      currentPathRef.current = `M ${e.x} ${e.y}`;
      setCurrentPath(currentPathRef.current);
    })
    .onUpdate((e) => {
      // Cập nhật nét vẽ khi di chuyển
      currentPathRef.current += ` L ${e.x} ${e.y}`;
      setCurrentPath(currentPathRef.current);
    })
    .onEnd(() => {
      // Kết thúc nét vẽ
      const newPath = {
        path: currentPathRef.current,
        color: color,
        strokeWidth: strokeWidth,
      };
      
      // Thêm vào state local
      setPaths(prev => [...prev, newPath]);
      
      // Gửi đến server
      if (socketRef.current && isConnected) {
        socketRef.current.emit('draw', newPath);
      }
      
      // Reset current path
      setCurrentPath('');
      currentPathRef.current = '';
    });

  // Xóa toàn bộ canvas
  const clearCanvas = () => {
    Alert.alert(
      '🗑️ Xóa bảng vẽ',
      'Bạn có chắc muốn xóa toàn bộ bảng vẽ? Hành động này sẽ ảnh hưởng đến tất cả người dùng.',
      [
        { 
          text: 'Hủy', 
          style: 'cancel' 
        },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: () => {
            setPaths([]);
            if (socketRef.current && isConnected) {
              socketRef.current.emit('clear-canvas');
            }
          },
        },
      ]
    );
  };

  // Palette màu sắc
  const colors = [
    '#000000', // Đen
    '#FF0000', // Đỏ
    '#00FF00', // Xanh lá
    '#0000FF', // Xanh dương
    '#FFFF00', // Vàng
    '#FF00FF', // Tím
    '#00FFFF', // Cyan
    '#FFA500', // Cam
  ];

  // Độ dày nét vẽ
  const strokeWidths = [2, 4, 6, 8, 10];

  return (
    <GestureHandlerRootView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#6200ee" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>🎨 Bảng Vẽ Chung</Text>
        <View style={styles.statusContainer}>
          <View style={[styles.statusDot, { backgroundColor: isConnected ? '#4CAF50' : '#F44336' }]} />
          <Text style={styles.statusText}>
            {isConnected ? 'Đã kết nối' : 'Mất kết nối'}
          </Text>
          <Text style={styles.userCount}>
            👥 {userCount} người
          </Text>
        </View>
      </View>

      {/* Canvas vẽ */}
      <GestureDetector gesture={panGesture}>
        <View style={styles.canvas}>
          <Svg style={styles.svg}>
            <G>
              {/* Render tất cả các nét vẽ đã lưu */}
              {paths.map((p, index) => (
                <Path
                  key={`path-${index}`}
                  d={p.path}
                  stroke={p.color}
                  strokeWidth={p.strokeWidth}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}
              
              {/* Render nét vẽ hiện tại */}
              {currentPath && (
                <Path
                  d={currentPath}
                  stroke={color}
                  strokeWidth={strokeWidth}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
            </G>
          </Svg>
        </View>
      </GestureDetector>

      {/* Toolbar - Công cụ vẽ */}
      <View style={styles.toolbar}>
        {/* Chọn màu sắc */}
        <View style={styles.section}>
          <Text style={styles.label}>🎨 Màu sắc:</Text>
          <View style={styles.colorPicker}>
            {colors.map((c) => (
              <TouchableOpacity
                key={c}
                style={[
                  styles.colorButton,
                  { backgroundColor: c },
                  color === c && styles.selectedColor,
                ]}
                onPress={() => setColor(c)}
                activeOpacity={0.7}
              />
            ))}
          </View>
        </View>

        {/* Chọn độ dày */}
        <View style={styles.section}>
          <Text style={styles.label}>✏️ Độ dày:</Text>
          <View style={styles.widthPicker}>
            {strokeWidths.map((w) => (
              <TouchableOpacity
                key={w}
                style={[
                  styles.widthButton,
                  strokeWidth === w && styles.selectedWidth,
                ]}
                onPress={() => setStrokeWidth(w)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.widthText,
                  strokeWidth === w && styles.selectedWidthText
                ]}>
                  {w}px
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Nút xóa */}
        <TouchableOpacity 
          style={styles.clearButton} 
          onPress={clearCanvas}
          activeOpacity={0.8}
        >
          <Text style={styles.clearButtonText}>🗑️ Xóa toàn bộ</Text>
        </TouchableOpacity>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#6200ee',
    padding: 15,
    paddingTop: 50,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    color: 'white',
  },
  userCount: {
    fontSize: 14,
    color: 'white',
    fontWeight: '600',
    marginLeft: 8,
  },
  canvas: {
    flex: 1,
    backgroundColor: 'white',
    margin: 10,
    borderRadius: 10,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  svg: {
    flex: 1,
  },
  toolbar: {
    backgroundColor: 'white',
    padding: 15,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  section: {
    marginBottom: 15,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
    color: '#333',
  },
  colorPicker: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
  },
  colorButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#ddd',
    marginHorizontal: 5,
  },
  selectedColor: {
    borderColor: '#6200ee',
    borderWidth: 4,
    transform: [{ scale: 1.1 }],
  },
  widthPicker: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  widthButton: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#f5f5f5',
  },
  selectedWidth: {
    backgroundColor: '#6200ee',
    borderColor: '#6200ee',
  },
  widthText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  selectedWidthText: {
    color: 'white',
  },
  clearButton: {
    backgroundColor: '#ff3b30',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#ff3b30',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  clearButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
import { Platform } from 'react-native';

const DEV_ANDROID_URL = 'http://10.0.2.2:4000';
const DEV_IOS_URL = 'http://localhost:4000';
const PROD_URL = 'https://your-production-api.com';

// Get the local IP address for physical devices
const getLocalIP = async () => {
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        return `http://${data.ip}:4000`;
    } catch (error) {
        console.error('Error getting local IP:', error);
        return DEV_ANDROID_URL; // Fallback to Android emulator URL
    }
};

const getBaseUrl = async () => {
    if (__DEV__) {
        if (Platform.OS === 'android') {
            // Check if running in emulator
            if (Platform.constants.Brand === 'google') {
                return DEV_ANDROID_URL;
            }
            // Physical Android device
            return await getLocalIP();
        }
        if (Platform.OS === 'ios') {
            // Check if running in simulator
            if (Platform.constants.isTesting) {
                return DEV_IOS_URL;
            }
            // Physical iOS device
            return await getLocalIP();
        }
        // Web browser
        return DEV_IOS_URL;
    }
    return PROD_URL;
};

const apiConfig = {
    getBaseUrl,
    endpoints: {
        login: '/signin',
        signup: '/signup',
        courses: '/courses',
        users: '/admin/users',
        tutors: '/admin/tutors',
        // Add other endpoints here
    }
};

export default apiConfig; 
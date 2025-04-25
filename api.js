import apiConfig from './config';

const api = {
    async request(endpoint, options = {}) {
        const baseUrl = await apiConfig.getBaseUrl();
        const url = `${baseUrl}${endpoint}`;
        
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                // Add auth token if available
                ...(global.token && { 'Authorization': `Bearer ${global.token}` })
            }
        };

        try {
            const response = await fetch(url, { ...defaultOptions, ...options });
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'API request failed');
            }

            return data;
        } catch (error) {
            console.error(`API Error (${endpoint}):`, error);
            throw error;
        }
    },

    // API methods
    async login(email, password) {
        return this.request(apiConfig.endpoints.login, {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
    },

    async getCourses() {
        return this.request(apiConfig.endpoints.courses);
    },

    async getUsers() {
        return this.request(apiConfig.endpoints.users);
    },

    // Create new user (admin only)
    async createUser(userData) {
        return this.request(apiConfig.endpoints.users, {
            method: 'POST',
            body: JSON.stringify(userData)
        });
    },

    // Update existing user (admin only)
    async updateUser(userId, userData) {
        if (!global.token) {
            throw new Error('Authentication token is missing');
        }

        console.log('Making update request:', {
            userId,
            userData,
            hasToken: !!global.token
        });

        return this.request(`${apiConfig.endpoints.users}/${userId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${global.token}`
            },
            body: JSON.stringify(userData)
        });
    },

    // Delete user (admin only)
    async deleteUser(userId) {
        return this.request(`${apiConfig.endpoints.users}/${userId}`, {
            method: 'DELETE'
        });
    },

    // Create or update a note
    async createNote(noteData) {
        if (!global.token) {
            throw new Error('Authentication token is missing');
        }

        console.log('Creating note:', {
            noteData,
            hasToken: !!global.token
        });

        return this.request('/notes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${global.token}`
            },
            body: JSON.stringify(noteData)
        });
    },

    // Get all notes
    async getNotes() {
        return this.request('/notes');
    },

    // Get note for specific lesson
    async getLessonNote(lessonId) {
        return this.request(`/notes/${lessonId}`);
    },

    // Delete note
    async deleteNote(lessonId) {
        return this.request(`/notes/${lessonId}`, {
            method: 'DELETE'
        });
    },

    // Create new lesson
    async createLesson(lessonData) {
        return this.request('/lessons', {
            method: 'POST',
            body: JSON.stringify(lessonData)
        });
    },

    // Get lesson details
    async getLesson(lessonId) {
        return this.request(`/lessons/${lessonId}`);
    },

    // Update course progress
    async updateProgress(courseId, progress) {
        return this.request('/course-progress', {
            method: 'POST',
            body: JSON.stringify({
                courseId,
                progress
            })
        });
    },

    // Get progress for specific course
    async getCourseProgress(courseId) {
        return this.request(`/course-progress/${courseId}`);
    },

    // Get all course progress
    async getAllProgress() {
        return this.request('/course-progress');
    },

    // Track course progress
    async trackCourse(courseId) {
        if (!global.token) {
            throw new Error('Authentication token is missing');
        }

        console.log('Tracking course:', { courseId });

        return this.request('/courses/track', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${global.token}`
            },
            body: JSON.stringify({ courseId })
        });
    },

    // Get in-progress courses
    async getInProgressCourses() {
        return this.request('/courses/inprogress');
    },

    // Get course history
    async getCourseHistory(courseId) {
        return this.request(`/courses/${courseId}/history`);
    },

    // Mark lesson as completed
    async completeLesson(lessonId) {
        return this.request(`/lessons/${lessonId}/complete`, {
            method: 'POST'
        });
    },

    // Get lesson completion status
    async getLessonStatus(lessonId) {
        return this.request(`/lessons/${lessonId}/status`);
    },

    // Get tutors
    async getTutors() {
        return this.request(apiConfig.endpoints.tutors);
    },

    // Add a new tutor
    async addTutor(tutorData) {
        return this.request(apiConfig.endpoints.tutors, {
            method: 'POST',
            body: JSON.stringify(tutorData)
        });
    },

    // Update existing tutor (admin only)
    async updateTutor(tutorId, tutorData) {
        if (!tutorId) {
            throw new Error('Tutor ID is required');
        }
        
        console.log('Making update request:', {
            tutorId,
            tutorData,
            hasToken: !!global.token
        });

        return this.request(`${apiConfig.endpoints.tutors}/${tutorId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${global.token}`
            },
            body: JSON.stringify(tutorData)
        });
    },

    // Delete a tutor
    async deleteTutor(tutorId) {
        return this.request(`${apiConfig.endpoints.tutors}/${tutorId}`, {
            method: 'DELETE'
        });
    }
    // Add other API methods here
};

export default api; 
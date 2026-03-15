import axios from 'axios';

const api = axios.create({
    baseURL: '/api/',
    withCredentials: true,
});

// Configure Axios to work with Django's session auth and CSRF protection
api.defaults.xsrfCookieName = 'csrftoken';
api.defaults.xsrfHeaderName = 'X-CSRFToken';
api.interceptors.response.use(
    (response) => {
        return response;
    },
    (error) => {
        if (error.response?.status === 401) {
            // Only redirect on genuine 401 Unauthorized (session expired)
            if (window.location.pathname !== '/accounts/login/') {
                window.location.href = '/accounts/login/';
            }
        } else if (error.response) {
            // Dispatch a toast event for all other API errors (403, 500, etc.)
            const message = error.response.data?.detail
                || error.response.data?.message
                || `Request failed (${error.response.status})`;
            window.dispatchEvent(new CustomEvent('api-error', {
                detail: { message, type: 'error' }
            }));
        }
        return Promise.reject(error);
    }
);

export default api;

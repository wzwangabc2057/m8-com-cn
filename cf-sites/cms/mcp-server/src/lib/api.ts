import axios from 'axios';
import { CMS_API_URL, CMS_API_KEY } from '../config.js';

export const api = axios.create({
  baseURL: CMS_API_URL + '/api',
  headers: {
    Authorization: `Bearer ${CMS_API_KEY}`,
    'Content-Type': 'application/json',
  },
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.error || error.response?.data?.message || error.message;
    const status = error.response?.status;
    // console.error(`API Error [${status}]: ${message}`); // Optional logging
    return Promise.reject(new Error(`API Error: ${status} - ${message}`));
  }
);

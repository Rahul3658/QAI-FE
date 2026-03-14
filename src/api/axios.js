import axios from 'axios';

const API = axios.create({
  baseURL: "/api",
});

API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export default API;
// import axios from 'axios';

// // Determine which API URL to use based on the flag
// const useProduction = process.env.REACT_APP_USE_PRODUCTION === 'true';
// const apiUrl = useProduction 
//   ? process.env.REACT_APP_PROD_API_URL 
//   : process.env.REACT_APP_DEV_API_URL;

// const API = axios.create({
//   baseURL: apiUrl,
// });

// API.interceptors.request.use((config) => {
//   const token = localStorage.getItem('token');
//   if (token) {
//     config.headers.Authorization = `Bearer ${token}`;
//   }
//   return config;
// });

// export default API;

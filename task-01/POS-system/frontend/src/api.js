import axios from "axios";

const api = axios.create({
  baseURL: "https://backend-dusky-ten-yhsqmecen5.vercel.app/api",
});

export default api;
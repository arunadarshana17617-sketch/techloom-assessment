import axios from "axios";

// Local dev backend URL — will be replaced with the live Vercel URL after deployment
const BASE_URL = "http://localhost:5000/api";

const client = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

export default client;
import axios from "axios";

// Uses the live backend when deployed, falls back to localhost for local development
const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const client = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

export default client;
import { io } from "socket.io-client";
import { reactive } from "vue";

export const socketState = reactive({
  connected: false,
  id: "",
});

export const socket = io(import.meta.env.VITE_SOCKET_URL, {
  transports: ["websocket"],
  autoConnect: false,
});

socket.on("connect", () => {
  socketState.connected = true;
  socketState.id = socket.id ?? "";
  console.log("✅ Сокет подключен, ID:", socket.id);
});

socket.on("disconnect", () => {
  socketState.connected = false;
  socketState.id = "";
  console.log("❌ Сокет отключен");
});

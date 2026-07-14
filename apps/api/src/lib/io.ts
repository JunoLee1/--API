import { Server } from "socket.io";
import { Server as HttpServer } from "http";
import jwt from "jsonwebtoken";
import { ACCESS_TOKEN_COOKIE_NAME, JWT_ACCESS_TOKEN_SECRET } from "./constants";

let io: Server;

function parseCookies(cookieStr: string): Record<string, string> {
  return Object.fromEntries(
    cookieStr.split(";").map((c) => {
      const [k, ...v] = c.trim().split("=");
      return [k!.trim(), v.join("=").trim()];
    }),
  );
}

export function initIO(server: HttpServer) {
  io = new Server(server, {
    path: "/api/socket.io",
    cors: {
      origin: process.env["CLIENT_ORIGIN"],
      credentials: true,
    },
  });

  io.use((socket, next) => {
    const cookieStr = socket.handshake.headers.cookie ?? "";
    const token = parseCookies(cookieStr)[ACCESS_TOKEN_COOKIE_NAME];
    if (!token) return next(new Error("unauthorized"));
    try {
      socket.data.user = jwt.verify(token, JWT_ACCESS_TOKEN_SECRET);
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    socket.join("staff-room");
  });

  return io;
}

export function getIO(): Server {
  if (!io) throw new Error("Socket.io not initialized");
  return io;
}

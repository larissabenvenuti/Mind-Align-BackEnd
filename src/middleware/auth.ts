import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
  userId?: string;
}

export const requireAuth = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ error: "Token ausente ou mal formatado" });
  }

  const token = authHeader.substring(7);

  if (!token) {
    return res
      .status(401)
      .json({ error: "Token ausente ou mal formatado" });
  }

  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    console.error("JWT_SECRET não configurado no ambiente.");

    return res
      .status(500)
      .json({ error: "Configuração de autenticação ausente" });
  }

  try {
    const decoded = jwt.verify(token, jwtSecret) as {
      id: string;
    };

    if (!decoded.id) {
      return res
        .status(401)
        .json({ error: "Token inválido" });
    }

    req.userId = decoded.id;

    return next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res
        .status(401)
        .json({ error: "Sessão expirada. Faça login novamente." });
    }

    console.error("Erro ao validar JWT:", error);

    return res
      .status(401)
      .json({ error: "Token de autenticação inválido" });
  }
};
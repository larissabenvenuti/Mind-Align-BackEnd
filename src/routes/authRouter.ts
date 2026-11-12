import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import { meetsPasswordPolicy } from "../lib/passwordPolicy";

const router = Router();
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
);

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error(
      "JWT_SECRET não configurado no ambiente.",
    );
  }

  return secret;
};

const createToken = (user: {
  id: string;
  email: string;
  name: string | null;
}) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
    },
    getJwtSecret(),
    {
      expiresIn: "7d",
    },
  );
};

const formatUser = (user: {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  theme?: string | null;
  taskResetPreference?: string | null;
}) => {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    theme: user.theme ?? undefined,
    taskResetPreference:
      user.taskResetPreference ?? undefined,
  };
};

router.post(
  "/api/auth/register",
  async (req: Request, res: Response) => {
    try {
      const {
        name,
        email,
        password,
      } = req.body;

      if (
        typeof name !== "string" ||
        !name.trim() ||
        typeof email !== "string" ||
        !email.trim() ||
        typeof password !== "string" ||
        !password
      ) {
        return res
          .status(400)
          .json({
            error: "Faltando dados",
          });
      }

      const normalizedEmail = email.trim().toLowerCase();

      if (!emailRegex.test(normalizedEmail)) {
        return res.status(400).json({
          error: "Formato de e-mail inválido",
        });
      }

      if (!meetsPasswordPolicy(password)) {
        return res
          .status(400)
          .json({
            error:
              "A senha deve ter no mínimo 8 caracteres, letra maiúscula, letra minúscula, número e caractere especial",
          });
      }

      const exists =
        await prisma.user.findUnique({
          where: {
            email: normalizedEmail,
          },
        });

      if (exists) {
        return res
          .status(400)
          .json({
            error: "Usuário já existe",
          });
      }

      const hashed = await bcrypt.hash(
        password,
        10,
      );

      const user =
        await prisma.user.create({
          data: {
            email: normalizedEmail,
            password: hashed,
            name: name?.trim() || null,
          },
        });

      const token = createToken(user);

      return res.status(201).json({
        user: formatUser(user),
        token,
      });
    } catch (err: any) {
      console.error(
        "Erro no cadastro:",
        err,
      );

      return res
        .status(500)
        .json({
          error:
            "Erro interno no cadastro",
        });
    }
  },
);

router.post(
  "/api/auth/login",
  async (req: Request, res: Response) => {
    try {
      const {
        email,
        password,
      } = req.body;

      if (typeof email !== "string" || !email.trim() || !password) {
        return res
          .status(400)
          .json({
            error:
              "E-mail e senha são obrigatórios",
          });
      }

      const normalizedEmail =
        email.trim().toLowerCase();

      if (!emailRegex.test(normalizedEmail)) {
        return res.status(400).json({
          error: "Formato de e-mail inválido",
        });
      }

      const user =
        await prisma.user.findUnique({
          where: {
            email: normalizedEmail,
          },
        });

      if (!user || !user.password) {
        return res
          .status(401)
          .json({
            error:
              "E-mail ou senha incorretos",
          });
      }

      const isValid =
        await bcrypt.compare(
          password,
          user.password,
        );

      if (!isValid) {
        return res
          .status(401)
          .json({
            error:
              "E-mail ou senha incorretos",
          });
      }

      const token = createToken(user);

      return res.json({
        user: formatUser(user),
        token,
      });
    } catch (err: any) {
      console.error(
        "Erro no login:",
        err,
      );

      return res
        .status(500)
        .json({
          error:
            "Erro interno no login",
        });
    }
  },
);

router.post(
  "/api/auth/google",
  async (req: Request, res: Response) => {
    const {
      token,
    } = req.body as {
      token?: string;
    };

    if (!token) {
      console.error(
        "Google Auth: Token ausente no corpo da requisição",
      );

      return res
        .status(400)
        .json({
          error: "Token ausente.",
        });
    }

    try {
      const clientId =
        process.env.GOOGLE_CLIENT_ID;

      if (!clientId) {
        console.error(
          "GOOGLE_CLIENT_ID não configurado.",
        );

        return res
          .status(500)
          .json({
            error:
              "Google Auth não configurado.",
          });
      }

      const ticket =
        await googleClient.verifyIdToken({
          idToken: token,
          audience: clientId,
        });

      const payload =
        ticket.getPayload();

      if (
        !payload ||
        !payload.email
      ) {
        return res
          .status(401)
          .json({
            error:
              "Token Google inválido.",
          });
      }

      const {
        email,
        name,
        picture,
      } = payload;

      let user =
        await prisma.user.findUnique({
          where: {
            email,
          },
        });

      if (!user) {
        user =
          await prisma.user.create({
            data: {
              email,
              name:
                name ??
                "Usuário Google",
              image: picture ?? null,
            },
          });
      } else if (
        !user.image &&
        picture
      ) {
        user =
          await prisma.user.update({
            where: {
              id: user.id,
            },
            data: {
              image: picture,
            },
          });
      }

      const appToken =
        createToken(user);

      return res.json({
        user: formatUser(user),
        token: appToken,
      });
    } catch (error: any) {
      console.error(
        "Erro detalhado no login Google:",
        error,
      );

      return res
        .status(401)
        .json({
          error:
            "Falha ao autenticar Google.",
        });
    }
  },
);

export default router;
import { Router, Response } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthRequest } from "../middleware/auth";
import bcrypt from "bcryptjs";
import { meetsPasswordPolicy } from "../lib/passwordPolicy";

const router = Router();

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_PROFILE_IMAGE_LENGTH = 5_000_000;

router.get(
  "/api/user/profile",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;

      const user = await prisma.user.findUnique({
        where: {
          id: userId,
        },
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          theme: true,
          taskResetPreference: true,
        },
      });

      if (!user) {
        return res.status(404).json({
          error: "Usuário não encontrado",
        });
      }

      return res.json(user);
    } catch (error) {
      console.error("Erro ao buscar perfil:", error);

      return res.status(500).json({
        error: "Erro interno ao buscar perfil",
      });
    }
  }
);

router.put(
  "/api/user/profile",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const { name, email, image } = req.body;

      if (!name?.trim() || !email?.trim()) {
        return res.status(400).json({
          error: "Nome e e-mail são obrigatórios",
        });
      }

      const normalizedEmail = email.trim().toLowerCase();

      if (!emailRegex.test(normalizedEmail)) {
        return res.status(400).json({
          error: "Formato de e-mail inválido",
        });
      }

      const existingUser = await prisma.user.findUnique({
        where: {
          email: normalizedEmail,
        },
      });

      if (existingUser && existingUser.id !== userId) {
        return res.status(409).json({
          error: "Este e-mail já está em uso por outra conta",
        });
      }

      if (
        image !== undefined &&
        image !== null &&
        typeof image !== "string"
      ) {
        return res.status(400).json({
          error: "Imagem inválida",
        });
      }

      if (
        typeof image === "string" &&
        image.length > MAX_PROFILE_IMAGE_LENGTH
      ) {
        return res.status(400).json({
          error: "Imagem muito grande",
        });
      }

      const updatedUser = await prisma.user.update({
        where: {
          id: userId,
        },
        data: {
          name: name.trim(),
          email: normalizedEmail,
          ...(image !== undefined && {
            image,
          }),
        },
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          theme: true,
          taskResetPreference: true,
        },
      });

      return res.json(updatedUser);
    } catch (error) {
      console.error("Erro ao atualizar perfil:", error);

      return res.status(500).json({
        error: "Erro interno ao atualizar perfil",
      });
    }
  }
);

router.put(
  "/api/user/password",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const { currentPassword, newPassword } = req.body;

      if (
        typeof currentPassword !== "string" ||
        !currentPassword ||
        typeof newPassword !== "string" ||
        !newPassword
      ) {
        return res.status(400).json({
          error: "Preencha todas as senhas",
        });
      }

      if (!meetsPasswordPolicy(newPassword)) {
        return res.status(400).json({
          error:
            "A nova senha deve ter no mínimo 8 caracteres, letra maiúscula, letra minúscula, número e caractere especial",
        });
      }

      const user = await prisma.user.findUnique({
        where: {
          id: userId,
        },
      });

      if (!user || !user.password) {
        return res.status(403).json({
          error: "Ação não permitida para contas vinculadas ao Google",
        });
      }

      const isValid = await bcrypt.compare(
        currentPassword,
        user.password
      );

      if (!isValid) {
        return res.status(401).json({
          error: "Senha atual incorreta",
        });
      }

      const hashedPassword = await bcrypt.hash(
        newPassword,
        12
      );

      await prisma.user.update({
        where: {
          id: userId,
        },
        data: {
          password: hashedPassword,
        },
      });

      return res.json({
        message: "Senha atualizada com sucesso",
      });
    } catch (error) {
      console.error("Erro ao atualizar senha:", error);

      return res.status(500).json({
        error: "Erro interno ao atualizar senha",
      });
    }
  }
);

router.patch(
  "/api/user/settings",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const {
        theme,
        taskResetPreference,
      } = req.body;

      const updateData: {
        theme?: string;
        taskResetPreference?: string;
      } = {};

      if (theme) {
        updateData.theme = theme;
      }

      if (taskResetPreference) {
        updateData.taskResetPreference =
          taskResetPreference;
      }

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({
          error:
            "Nenhum dado válido fornecido para atualização",
        });
      }

      const updatedUser = await prisma.user.update({
        where: {
          id: userId,
        },
        data: updateData,
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          theme: true,
          taskResetPreference: true,
        },
      });

      return res.json(updatedUser);
    } catch (error) {
      console.error(
        "Erro ao atualizar configurações:",
        error
      );

      return res.status(500).json({
        error: "Erro interno ao atualizar configurações",
      });
    }
  }
);

router.delete(
  "/api/user/account",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;

      const user = await prisma.user.findUnique({
        where: {
          id: userId,
        },
        select: {
          id: true,
        },
      });

      if (!user) {
        return res.status(404).json({
          error: "Usuário não encontrado",
        });
      }

      await prisma.user.delete({
        where: {
          id: userId,
        },
      });

      return res.json({
        message: "Conta excluída com sucesso",
      });
    } catch (error) {
      console.error("Erro ao excluir conta:", error);

      return res.status(500).json({
        error: "Erro interno ao excluir conta",
      });
    }
  }
);

router.patch(
  "/api/user/image",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const { image } = req.body;

      if (image !== null && typeof image !== "string") {
        return res.status(400).json({
          error: "Imagem inválida",
        });
      }

      if (
        typeof image === "string" &&
        image.length > MAX_PROFILE_IMAGE_LENGTH
      ) {
        return res.status(400).json({
          error: "Imagem muito grande",
        });
      }

      const updatedUser = await prisma.user.update({
        where: {
          id: userId,
        },
        data: {
          image,
        },
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          theme: true,
          taskResetPreference: true,
        },
      });

      return res.json(updatedUser);
    } catch (error) {
      console.error("Erro ao atualizar imagem:", error);

      return res.status(500).json({
        error: "Erro interno ao atualizar imagem",
      });
    }
  }
);

export default router;
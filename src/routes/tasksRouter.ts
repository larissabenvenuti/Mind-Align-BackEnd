import { Router, Response } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthRequest } from "../middleware/auth";

const router = Router();

router.get(
  "/api/tasks",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const tasks = await prisma.task.findMany({
        where: { userId },
        include: { tags: true },
        orderBy: { id: "desc" },
      });
      res.json(tasks);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar tarefas" });
    }
  },
);

router.post(
  "/api/tasks",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const { text, tagIds } = req.body;
      
      if (!text || typeof text !== "string" || !text.trim()) {
        return res.status(400).json({ error: "Texto da tarefa obrigatório" });
      }

      const task = await prisma.task.create({
        data: {
          text: text.trim().slice(0, 80),
          userId,
          tags: tagIds && tagIds.length > 0 ? {
            connect: tagIds.map((id: string) => ({ id }))
          } : undefined
        },
        include: { tags: true }
      });
      res.status(201).json(task);
    } catch (error) {
      res.status(500).json({ error: "Erro ao criar tarefa" });
    }
  },
);

router.patch(
  "/api/tasks/:id/toggle",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      const task = await prisma.task.findFirst({ where: { id, userId } });
      
      if (!task) return res.status(404).json({ error: "Tarefa não encontrada" });

      const newStatus = !task.completed;
      const updated = await prisma.task.update({
        where: { id },
        data: { 
          completed: newStatus,
          completedAt: newStatus ? new Date() : null
        },
        include: { tags: true }
      });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Erro ao atualizar tarefa" });
    }
  },
);

router.delete(
  "/api/tasks/:id",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      const task = await prisma.task.findFirst({ where: { id, userId } });
      
      if (!task) return res.status(404).json({ error: "Tarefa não encontrada" });
      
      await prisma.task.delete({ where: { id } });
      res.json({ message: "Tarefa excluída com sucesso" });
    } catch (error) {
      res.status(500).json({ error: "Erro ao excluir tarefa" });
    }
  },
);

router.get(
  "/api/tags",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const tags = await prisma.tag.findMany({ where: { userId } });
      res.json(tags);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar tags" });
    }
  }
);

router.post(
  "/api/tags",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const { name, color } = req.body;
      
      if (!name || !color) {
        return res.status(400).json({ error: "Nome e cor são obrigatórios" });
      }

      const tag = await prisma.tag.create({
        data: { name, color, userId }
      });
      res.status(201).json(tag);
    } catch (error) {
      res.status(500).json({ error: "Erro ao criar tag" });
    }
  }
);

router.delete(
  "/api/tags/:id",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      const tag = await prisma.tag.findFirst({
        where: { id, userId },
        select: { id: true },
      });

      if (!tag) {
        return res.status(404).json({ error: "Tag não encontrada" });
      }

      await prisma.tag.delete({ where: { id: tag.id } });
      return res.status(204).send();
    } catch (error) {
      console.error("Erro ao excluir tag", error);
      return res.status(500).json({ error: "Erro ao excluir tag" });
    }
  },
);

export default router;
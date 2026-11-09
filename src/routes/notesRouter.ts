import { Router, Response } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthRequest } from "../middleware/auth";

const router = Router();

router.get(
  "/api/notes",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const notes = await prisma.note.findMany({
        where: { userId },
        orderBy: { date: "desc" },
      });
      res.json(notes);
    } catch (error) {
      console.error("Error fetching notes:", error);
      res.status(500).json({ error: "Erro ao buscar notas" });
    }
  },
);

router.post(
  "/api/notes",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const { content } = req.body;

      if (!content || typeof content !== "string" || !content.trim()) {
        return res.status(400).json({ error: "Conteúdo da nota obrigatório" });
      }

      const note = await prisma.note.create({
        data: {
          content: content.trim().slice(0, 500),
          userId,
        },
      });

      res.status(201).json(note);
    } catch (error) {
      console.error("Error creating note:", error);
      res.status(500).json({ error: "Erro ao criar nota" });
    }
  },
);

router.delete(
  "/api/notes/:id",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;

      const existingNote = await prisma.note.findFirst({
        where: { id, userId },
      });

      if (!existingNote) {
        return res.status(404).json({ error: "Nota não encontrada" });
      }

      await prisma.note.delete({
        where: { id },
      });

      res.json({ message: "Nota excluída com sucesso" });
    } catch (error) {
      console.error("Error deleting note:", error);
      res.status(500).json({ error: "Erro ao excluir nota" });
    }
  },
);

export default router;

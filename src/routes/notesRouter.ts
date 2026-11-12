import { Router, Response } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthRequest } from "../middleware/auth";

const router = Router();
const MAX_NOTE_CHARACTERS = 1000;

function getPlainText(content: string): string {
  return content
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|h[1-6])\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(
      /&(?:amp|lt|gt|quot|apos|nbsp);|&#(?:\d+|x[\da-f]+);/gi,
      (entity) => {
        const namedEntities: Record<string, string> = {
          "&amp;": "&",
          "&lt;": "<",
          "&gt;": ">",
          "&quot;": '"',
          "&apos;": "'",
          "&nbsp;": " ",
        };
        const namedValue = namedEntities[entity.toLowerCase()];
        if (namedValue !== undefined) return namedValue;

        const codePoint = entity.startsWith("&#x")
          ? Number.parseInt(entity.slice(3, -1), 16)
          : Number.parseInt(entity.slice(2, -1), 10);
        return codePoint <= 0x10ffff
          ? String.fromCodePoint(codePoint)
          : entity;
      },
    )
    .replace(/\n$/, "");
}

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

      if (!content || typeof content !== "string") {
        return res.status(400).json({ error: "Conteúdo da nota obrigatório" });
      }

      const plainText = getPlainText(content);

      if (!plainText.trim()) {
        return res.status(400).json({ error: "Conteúdo da nota obrigatório" });
      }

      if (plainText.length > MAX_NOTE_CHARACTERS) {
        return res.status(400).json({
          error: `A nota pode ter no máximo ${MAX_NOTE_CHARACTERS} caracteres`,
        });
      }

      const note = await prisma.note.create({
        data: {
          content: content.trim(),
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

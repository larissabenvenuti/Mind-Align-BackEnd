import { Router, Response } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthRequest } from "../middleware/auth";

const router = Router();

type ActivityItem = {
  id: string;
  type: "event" | "note" | "habit" | "task";
  content: string;
  date: Date;
};

router.get(
  "/api/activity",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;

      const [events, notes, habits, tasks] = await Promise.all([
        prisma.event.findMany({
          where: { userId },
          take: 5,
          orderBy: { start: "desc" },
        }),
        prisma.note.findMany({
          where: { userId },
          take: 5,
          orderBy: { date: "desc" },
        }),
        prisma.habit.findMany({
          where: { userId },
          take: 5,
          orderBy: { createdAt: "desc" },
        }),
        prisma.task.findMany({
          where: { userId },
          take: 5,
          orderBy: { createdAt: "desc" },
        }),
      ]);

      const activities: ActivityItem[] = [
        ...events.map((e) => ({
          id: e.id,
          type: "event" as const,
          content: e.title,
          date: e.start,
        })),
        ...notes.map((n) => ({
          id: n.id,
          type: "note" as const,
          content: n.content,
          date: n.date,
        })),
        ...habits.map((h) => ({
          id: h.id,
          type: "habit" as const,
          content: h.name,
          date: h.createdAt,
        })),
        ...tasks.map((t) => ({
          id: t.id,
          type: "task" as const,
          content: t.text,
          date: t.createdAt,
        })),
      ];

      activities.sort((a, b) => b.date.getTime() - a.date.getTime());
      
      return res.json(activities.slice(0, 8));
    } catch (err) {
      console.error("Erro na rota de atividades:", err);
      return res.status(500).json({ error: "Erro interno ao buscar atividades." });
    }
  },
);

export default router;
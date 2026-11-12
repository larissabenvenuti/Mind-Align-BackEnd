import { Router, Response } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthRequest } from "../middleware/auth";

const router = Router();

function formatHabit(habit: {
  id: string;
  name: string;
  weekData: string;
  currentStreak: number;
  longestStreak: number;
  lastResetDate: Date;
  createdAt: Date;
  userId: string;
}) {
  return {
    ...habit,
    weekData: JSON.parse(habit.weekData) as boolean[],
  };
}

router.get(
  "/api/habits",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const habits = await prisma.habit.findMany({
        where: { userId },
      });

      const now = new Date();
      const currentWeekStart = new Date(now);
      const day = currentWeekStart.getDay();
      const diff = currentWeekStart.getDate() - day + (day === 0 ? -6 : 1);
      currentWeekStart.setDate(diff);
      currentWeekStart.setHours(0, 0, 0, 0);

      const processedHabits = await Promise.all(habits.map(async (h) => {
        const lastReset = new Date(h.lastResetDate);
        
        if (lastReset < currentWeekStart) {
          const resetHabit = await prisma.habit.update({
            where: { id: h.id },
            data: {
              weekData: JSON.stringify([false, false, false, false, false, false, false]),
              lastResetDate: new Date(),
            }
          });
          return formatHabit(resetHabit);
        }
        
        return formatHabit(h);
      }));

      res.json(processedHabits);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar hábitos" });
    }
  },
);

router.post(
  "/api/habits",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const { name } = req.body;
      
      if (!name || typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ error: "Nome do hábito obrigatório" });
      }

      const habit = await prisma.habit.create({
        data: {
          name: name.trim(),
          userId,
          weekData: JSON.stringify([false, false, false, false, false, false, false]),
        },
      });

      res.status(201).json(formatHabit(habit));
    } catch (error) {
      res.status(500).json({ error: "Erro ao criar hábito" });
    }
  },
);

router.patch(
  "/api/habits/:id/toggle",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      const { day } = req.body;

      const habit = await prisma.habit.findFirst({ where: { id, userId } });
      if (!habit) return res.status(404).json({ error: "Hábito não encontrado" });

      const weekData = JSON.parse(habit.weekData);
      weekData[day] = !weekData[day];

      let currentStreak = habit.currentStreak;
      let longestStreak = habit.longestStreak;

      if (weekData[day]) {
        currentStreak += 1;
        if (currentStreak > longestStreak) {
          longestStreak = currentStreak;
        }
      } else {
        currentStreak = Math.max(0, currentStreak - 1);
      }

      await prisma.habit.update({
        where: { id },
        data: { 
          weekData: JSON.stringify(weekData),
          currentStreak,
          longestStreak
        },
      });

      res.json({ success: true, currentStreak, longestStreak });
    } catch (error) {
      res.status(500).json({ error: "Erro ao atualizar hábito" });
    }
  },
);

router.delete(
  "/api/habits/:id",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      
      const habit = await prisma.habit.findFirst({ where: { id, userId } });
      if (!habit) return res.status(404).json({ error: "Hábito não encontrado" });

      await prisma.habit.delete({ where: { id } });
      res.json({ message: "Hábito excluído com sucesso" });
    } catch (error) {
      res.status(500).json({ error: "Erro ao excluir hábito" });
    }
  },
);

export default router;
import { Router, Response } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthRequest } from "../middleware/auth";

const router = Router();

async function removePendingEventNotifications(userId: string, eventIds: string[]) {
  if (eventIds.length === 0) return;

  const eventIdSet = new Set(eventIds);
  const pending = await prisma.scheduledNotification.findMany({
    where: { userId, type: "EVENT_REMINDER", sent: false },
    select: { id: true, payload: true },
  });
  const notificationIds = pending
    .filter((notification) => {
      try {
        return eventIdSet.has(JSON.parse(notification.payload).eventId);
      } catch (error) {
        console.error(
          `Não foi possível ler o payload da notificação ${notification.id}:`,
          error,
        );
        return false;
      }
    })
    .map(({ id }) => id);

  if (notificationIds.length > 0) {
    await prisma.scheduledNotification.deleteMany({
      where: { id: { in: notificationIds } },
    });
  }
}

router.get(
  "/api/calendar",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const events = await prisma.event.findMany({
        where: { userId },
        orderBy: { start: "asc" },
      });
      res.json(events);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar eventos" });
    }
  },
);

router.post(
  "/api/calendar",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const { title, start, end, reminderMinutes, repeat } = req.body;

      if (!title || !start || !end) {
        return res.status(400).json({ error: "Título, início e término são obrigatórios" });
      }

      const startDate = new Date(start);
      const endDate = new Date(end);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({ error: "Data inválida" });
      }

      if (startDate >= endDate) {
        return res.status(400).json({ error: "A data de início deve ser anterior à data de término" });
      }

      const parsedReminderMinutes =
        reminderMinutes !== undefined ? Number(reminderMinutes) : 15;
      if (!Number.isInteger(parsedReminderMinutes) || parsedReminderMinutes < 0) {
        return res.status(400).json({ error: "O lembrete deve ser um número inteiro não negativo" });
      }

      const event = await prisma.event.create({
        data: {
          title,
          start: startDate,
          end: endDate,
          userId,
          repeat: repeat || null,
          reminderMinutes: parsedReminderMinutes,
        },
      });

      res.status(201).json(event);
    } catch (error) {
      res.status(500).json({ error: "Erro ao criar evento" });
    }
  },
);

router.put(
  "/api/calendar/:id",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      const { title, start, end, reminderMinutes, repeat } = req.body;

      const existingEvent = await prisma.event.findFirst({
        where: { id, userId },
      });

      if (!existingEvent) {
        return res.status(404).json({ error: "Evento não encontrado" });
      }

      if (!title || !start || !end) {
        return res.status(400).json({ error: "Título, início e término são obrigatórios" });
      }

      const startDate = new Date(start);
      const endDate = new Date(end);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({ error: "Data inválida" });
      }

      if (startDate >= endDate) {
        return res.status(400).json({ error: "A data de início deve ser anterior à data de término" });
      }

      if (
        reminderMinutes !== undefined &&
        (!Number.isInteger(Number(reminderMinutes)) || Number(reminderMinutes) < 0)
      ) {
        return res.status(400).json({ error: "O lembrete deve ser um número inteiro não negativo" });
      }

      const event = await prisma.event.update({
        where: { id },
        data: {
          title,
          start: startDate,
          end: endDate,
          repeat: repeat || null,
          reminderMinutes: reminderMinutes !== undefined ? Number(reminderMinutes) : undefined,
        },
      });

      res.json(event);
    } catch (error) {
      res.status(500).json({ error: "Erro ao atualizar evento" });
    }
  },
);

router.delete(
  "/api/calendar/:id",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;

      const existingEvent = await prisma.event.findFirst({
        where: { id, userId },
      });

      if (!existingEvent) {
        return res.status(404).json({ error: "Evento não encontrado" });
      }

      await prisma.event.delete({
        where: { id },
      });
      await removePendingEventNotifications(userId, [id]);

      res.json({ message: "Evento excluído com sucesso" });
    } catch (error) {
      res.status(500).json({ error: "Erro ao excluir evento" });
    }
  },
);

router.put(
  "/api/calendar/bulk/:title",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const { title } = req.params;
      const { newTitle, startOffset, endOffset } = req.body;

      const events = await prisma.event.findMany({
        where: { userId, title: decodeURIComponent(title) },
        orderBy: { start: "asc" },
      });

      if (events.length === 0) {
        return res.status(404).json({ error: "Nenhum evento encontrado" });
      }

      const updates = events.map((event) =>
        prisma.event.update({
          where: { id: event.id },
          data: {
            title: newTitle || event.title,
            start: startOffset
              ? new Date(event.start.getTime() + startOffset)
              : event.start,
            end: endOffset
              ? new Date(event.end.getTime() + endOffset)
              : event.end,
          },
        }),
      );

      await Promise.all(updates);

      const updated = await prisma.event.findMany({
        where: {
          userId,
          title: newTitle || decodeURIComponent(title),
        },
        orderBy: { start: "asc" },
      });

      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Erro ao atualizar eventos" });
    }
  },
);

router.delete(
  "/api/calendar/bulk/:title",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const { title } = req.params;

      const events = await prisma.event.findMany({
        where: { userId, title: decodeURIComponent(title) },
        select: { id: true },
      });

      const deletedCount = await prisma.event.deleteMany({
        where: { userId, title: decodeURIComponent(title) },
      });

      if (deletedCount.count === 0) {
        return res.status(404).json({ error: "Nenhum evento encontrado" });
      }

      await removePendingEventNotifications(
        userId,
        events.map(({ id }) => id),
      );

      res.json({
        message: "Eventos excluídos com sucesso",
        count: deletedCount.count,
      });
    } catch (error) {
      res.status(500).json({ error: "Erro ao excluir eventos" });
    }
  },
);

router.get(
  "/api/calendar/stats",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const [total, thisMonth, upcoming] = await Promise.all([
        prisma.event.count({ where: { userId } }),
        prisma.event.count({
          where: {
            userId,
            start: {
              gte: startOfMonth,
              lte: endOfMonth,
            },
          },
        }),
        prisma.event.count({
          where: {
            userId,
            start: { gte: now },
          },
        }),
      ]);

      res.json({
        total,
        thisMonth,
        upcoming,
      });
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar estatísticas" });
    }
  },
);

export default router;
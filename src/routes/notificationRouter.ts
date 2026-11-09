import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthRequest } from "../middleware/auth";
import webpush from "web-push";

const router = Router();

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:suporte-mindalign@gmail.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
}

router.get("/api/notifications/vapid-public-key", (req, res: Response) => {
  return res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || "" });
});

router.post(
  "/api/notifications/subscribe",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const { subscription } = req.body;

      if (!subscription || !subscription.endpoint) {
        return res.status(400).json({ error: "Dados de subscription inválidos ou ausentes" });
      }

      await prisma.$transaction([
        prisma.pushSubscription.deleteMany({
          where: {
            endpoint: subscription.endpoint,
            userId: { not: userId },
          },
        }),
        prisma.pushSubscription.upsert({
          where: {
            userId_endpoint: {
              userId,
              endpoint: subscription.endpoint,
            },
          },
          update: {
            subscription: JSON.stringify(subscription),
            updatedAt: new Date(),
          },
          create: {
            userId,
            endpoint: subscription.endpoint,
            subscription: JSON.stringify(subscription),
          },
        })
      ]);

      return res.status(201).json({ message: "Subscription vinculada e ativa com sucesso" });
    } catch (error) {
      console.error("Error subscribing to notifications:", error);
      return res.status(500).json({ error: "Erro interno ao registrar subscription" });
    }
  },
);

router.post(
  "/api/notifications/unsubscribe",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const { endpoint } = req.body;

      if (!endpoint) {
        return res.status(400).json({ error: "Endpoint obrigatório para remover subscription" });
      }

      await prisma.pushSubscription.deleteMany({
        where: { userId, endpoint },
      });

      return res.json({ message: "Subscription revogada com sucesso" });
    } catch (error) {
      console.error("Error unsubscribing:", error);
      return res.status(500).json({ error: "Erro interno ao revogar subscription" });
    }
  },
);

router.post(
  "/api/notifications/send",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const { title, body, icon, data } = req.body;

      if (!title?.trim()) {
        return res.status(400).json({ error: "O título da notificação é obrigatório" });
      }

      const subscriptions = await prisma.pushSubscription.findMany({
        where: { userId },
      });

      if (subscriptions.length === 0) {
        return res.status(404).json({ error: "O usuário não possui dispositivos registrados para notificações" });
      }

      const payload = JSON.stringify({
        title: title.trim(),
        body: body?.trim() || "",
        icon: icon || "/favicon.ico",
        badge: "/favicon.ico",
        data: data || {},
      });

      const results = await Promise.allSettled(
        subscriptions.map(async (sub) => {
          try {
            const subscription = JSON.parse(sub.subscription);
            await webpush.sendNotification(subscription, payload);
            return { success: true, endpoint: sub.endpoint };
          } catch (error: any) {
            if (error.statusCode === 410 || error.statusCode === 404) {
              await prisma.pushSubscription.delete({
                where: { id: sub.id },
              });
            }
            return {
              success: false,
              endpoint: sub.endpoint,
              error: error.message,
            };
          }
        }),
      );

      const successful = results.filter((r) => r.status === "fulfilled" && r.value.success).length;
      
      return res.json({
        message: "Processamento de notificações concluído",
        successful,
        failed: results.length - successful,
      });
    } catch (error) {
      console.error("Error sending notifications:", error);
      return res.status(500).json({ error: "Falha crítica no sistema de disparo de notificações" });
    }
  },
);

router.get(
  "/api/notifications/preferences",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;

      const preferences = await prisma.notificationPreferences.upsert({
        where: { userId },
        update: {},
        create: {
          userId,
          eventReminders: true,
          dailyTaskSummary: true,
          habitReminders: true,
          reminderMinutesBefore: 15,
        },
      });

      return res.json(preferences);
    } catch (error) {
      console.error("Error fetching preferences:", error);
      return res.status(500).json({ error: "Erro interno ao buscar as preferências do usuário" });
    }
  },
);

router.put(
  "/api/notifications/preferences",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const {
        eventReminders,
        dailyTaskSummary,
        habitReminders,
        reminderMinutesBefore,
      } = req.body;

      const preferences = await prisma.notificationPreferences.upsert({
        where: { userId },
        update: {
          eventReminders: eventReminders ?? undefined,
          dailyTaskSummary: dailyTaskSummary ?? undefined,
          habitReminders: habitReminders ?? undefined,
          reminderMinutesBefore: reminderMinutesBefore ?? undefined,
        },
        create: {
          userId,
          eventReminders: eventReminders ?? true,
          dailyTaskSummary: dailyTaskSummary ?? true,
          habitReminders: habitReminders ?? true,
          reminderMinutesBefore: reminderMinutesBefore ?? 15,
        },
      });

      if (eventReminders === false) {
        await prisma.scheduledNotification.deleteMany({
          where: { userId, type: "EVENT_REMINDER", sent: false },
        });
      }

      return res.json(preferences);
    } catch (error) {
      console.error("Error updating preferences:", error);
      return res.status(500).json({ error: "Falha ao gravar as novas preferências de notificação" });
    }
  },
);

router.post(
  "/api/notifications/schedule-event",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const { eventId } = req.body;

      if (typeof eventId !== "string" || !eventId.trim()) {
        return res.status(400).json({ error: "A carga útil do evento está incompleta" });
      }

      const result = await prisma.$transaction(async (transaction) => {
        const lockedEvent = await transaction.$queryRaw<Array<{ id: string }>>`
          SELECT "id"
          FROM "Event"
          WHERE "id" = ${eventId} AND "userId" = ${userId}
          FOR UPDATE
        `;
        if (lockedEvent.length === 0) {
          return { status: 404, body: { error: "Evento não encontrado" } };
        }

        const [event, preferences] = await Promise.all([
          transaction.event.findFirst({ where: { id: eventId, userId } }),
          transaction.notificationPreferences.upsert({
            where: { userId },
            update: {},
            create: { userId },
          }),
        ]);

        if (!event) {
          return { status: 404, body: { error: "Evento não encontrado" } };
        }

        const pending = await transaction.scheduledNotification.findMany({
          where: { userId, type: "EVENT_REMINDER", sent: false },
          select: { id: true, payload: true },
        });
        const existingForEvent = pending.filter((notification) => {
          try {
            return JSON.parse(notification.payload).eventId === event.id;
          } catch (error) {
            console.error(
              `Não foi possível ler o payload da notificação ${notification.id}:`,
              error,
            );
            return false;
          }
        });
        const existingIds = existingForEvent.map(({ id }) => id);

        if (!preferences.eventReminders) {
          if (existingIds.length > 0) {
            await transaction.scheduledNotification.deleteMany({
              where: { id: { in: existingIds } },
            });
          }
          return {
            status: 200,
            body: { message: "Ignorado: O usuário desabilitou lembretes de eventos" },
          };
        }

        const reminderTime = new Date(
          event.start.getTime() - event.reminderMinutes * 60000,
        );
        if (reminderTime <= new Date()) {
          if (existingIds.length > 0) {
            await transaction.scheduledNotification.deleteMany({
              where: { id: { in: existingIds } },
            });
          }
          return {
            status: 200,
            body: { message: "Ignorado: O momento de alerta do evento já se encontra no passado" },
          };
        }

        const existing = existingForEvent[0];

        if (existing) {
          await transaction.scheduledNotification.update({
            where: { id: existing.id },
            data: {
              scheduledFor: reminderTime,
              payload: JSON.stringify({
                eventId: event.id,
                title: `📅 ${event.title}`,
                body: `Inicia em ${event.reminderMinutes} minutos`,
                data: { url: "/calendar" },
              }),
            },
          });
        } else {
          await transaction.scheduledNotification.create({
            data: {
              userId,
              type: "EVENT_REMINDER",
              scheduledFor: reminderTime,
              payload: JSON.stringify({
                eventId: event.id,
                title: `📅 ${event.title}`,
                body: `Inicia em ${event.reminderMinutes} minutos`,
                data: { url: "/calendar" },
              }),
            },
          });
        }

        const duplicateIds = existingIds.slice(1);
        if (duplicateIds.length > 0) {
          await transaction.scheduledNotification.deleteMany({
            where: { id: { in: duplicateIds } },
          });
        }

        return {
          status: 201,
          body: {
            message: "Lembrete de evento orquestrado com sucesso",
            scheduledFor: reminderTime,
          },
        };
      });

      return res.status(result.status).json(result.body);
    } catch (error) {
      console.error("Error scheduling notification:", error);
      return res.status(500).json({ error: "Falha no motor de agendamento de eventos" });
    }
  },
);

const processScheduledNotifications = async (req: Request, res: Response) => {
    const authorizationHeader = req.headers.authorization;
    const bearerSecret = authorizationHeader?.match(/^Bearer\s+(.+)$/i)?.[1];
    const cronSecret = bearerSecret || req.headers["x-cron-secret"];
    if (!process.env.CRON_SECRET || cronSecret !== process.env.CRON_SECRET) {
      return res.status(403).json({ error: "Requisição negada por falha de autenticação externa" });
    }

    try {
      const now = new Date();
      const onTimeWindowStart = new Date(now.getTime() - 2 * 60 * 1000);

      await prisma.scheduledNotification.deleteMany({
        where: {
          type: "EVENT_REMINDER",
          sent: false,
          scheduledFor: { lt: onTimeWindowStart },
        },
      });

      const notifications = await prisma.scheduledNotification.findMany({
        where: {
          type: "EVENT_REMINDER",
          scheduledFor: { gte: onTimeWindowStart, lte: now },
          sent: false,
        },
        include: {
          user: { include: { pushSubscriptions: true } }
        },
      });

      let processed = 0;
      let errors = 0;

      for (const notification of notifications) {
        try {
          const claim = await prisma.scheduledNotification.updateMany({
            where: { id: notification.id, sent: false },
            data: { sent: true, sentAt: new Date() },
          });
          if (claim.count === 0) continue;

          const payload = JSON.parse(notification.payload);

          if (notification.user.pushSubscriptions.length > 0) {
            for (const sub of notification.user.pushSubscriptions) {
              try {
                const subscription = JSON.parse(sub.subscription);
                await webpush.sendNotification(
                  subscription,
                  JSON.stringify({
                    title: payload.title,
                    body: payload.body,
                    icon: payload.icon || "/favicon.ico",
                    badge: payload.badge || "/favicon.ico",
                    data: payload.data || {},
                  }),
                );
              } catch (error: any) {
                if (error.statusCode === 410 || error.statusCode === 404) {
                  await prisma.pushSubscription.delete({
                    where: { id: sub.id },
                  });
                } else {
                  console.error(
                    `Falha ao enviar a notificação ${notification.id} para a subscription ${sub.id}:`,
                    error,
                  );
                }
              }
            }
          }

          processed++;
        } catch (error) {
          console.error(`Erro ao processar a notificação ${notification.id}:`, error);
          errors++;
        }
      }

      return res.json({
        message: "Varredura de fila de notificações finalizada",
        processed,
        errors,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error processing scheduled notifications:", error);
      return res.status(500).json({ error: "Falha estrutural ao invocar processor de notificações" });
    }
};

router.get("/api/notifications/process-scheduled", processScheduledNotifications);
router.post("/api/notifications/process-scheduled", processScheduledNotifications);

router.delete(
  "/api/notifications/cleanup",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const result = await prisma.scheduledNotification.deleteMany({
        where: {
          sent: true,
          sentAt: { lte: thirtyDaysAgo },
        },
      });

      return res.json({
        message: "Procedimento de expurgo de logs concluído",
        deleted: result.count,
      });
    } catch (error) {
      console.error("Error cleaning up notifications:", error);
      return res.status(500).json({ error: "Ocorreu uma falha durante o expurgo de registros antigos" });
    }
  },
);

router.get(
  "/api/notifications/stats",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;

      const [totalSubscriptions, scheduledCount, sentCount, pendingCount] =
        await Promise.all([
          prisma.pushSubscription.count({ where: { userId } }),
          prisma.scheduledNotification.count({ where: { userId } }),
          prisma.scheduledNotification.count({ where: { userId, sent: true } }),
          prisma.scheduledNotification.count({ where: { userId, sent: false } }),
        ]);

      return res.json({
        totalSubscriptions,
        scheduledCount,
        sentCount,
        pendingCount,
      });
    } catch (error) {
      console.error("Error fetching notification stats:", error);
      return res.status(500).json({ error: "Falha técnica ao agregar dados de telemetria" });
    }
  },
);

export default router;
import cron from "node-cron";
import webPush from "web-push";
import { prisma } from "../lib/prisma";

const publicVapidKey = process.env.VAPID_PUBLIC_KEY!;
const privateVapidKey = process.env.VAPID_PRIVATE_KEY!;

webPush.setVapidDetails(
  process.env.VAPID_SUBJECT || "mailto:suporte@mindalign.com",
  publicVapidKey,
  privateVapidKey,
);

export function startNotificationScheduler() {
  cron.schedule("* * * * *", async () => {
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

      const pendingNotifications = await prisma.scheduledNotification.findMany({
        where: {
          type: "EVENT_REMINDER",
          scheduledFor: { gte: onTimeWindowStart, lte: now },
          sent: false,
        },
        include: {
          user: {
            include: {
              pushSubscriptions: true,
            },
          },
        },
      });

      if (pendingNotifications.length === 0) return;

      for (const notification of pendingNotifications) {
        const claim = await prisma.scheduledNotification.updateMany({
          where: { id: notification.id, sent: false },
          data: { sent: true, sentAt: new Date() },
        });
        if (claim.count === 0) continue;

        try {
          const payload = JSON.parse(notification.payload);

          for (const sub of notification.user.pushSubscriptions) {
            try {
              await webPush.sendNotification(
                JSON.parse(sub.subscription),
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
                await prisma.pushSubscription.delete({ where: { id: sub.id } });
              } else {
                console.error(
                  `Falha ao enviar a notificação ${notification.id} para a subscription ${sub.id}:`,
                  error,
                );
              }
            }
          }
        } catch (error) {
          console.error(
            `Erro ao processar a notificação ${notification.id}:`,
            error,
          );
        }
      }
    } catch (error) {
      console.error("Critical Error no Cron de Notificações de Eventos:", error);
    }
  });

  const schedulerTimezone = process.env.APP_TIMEZONE || "America/Sao_Paulo";

  cron.schedule("0 8 * * *", async () => {
    try {
      const preferences = await prisma.notificationPreferences.findMany({
        where: { dailyTaskSummary: true },
        include: {
          user: {
            include: {
              pushSubscriptions: true,
              tasks: {
                where: { completed: false },
              },
            },
          },
        },
      });

      for (const pref of preferences) {
        const pendingTasksCount = pref.user.tasks.length;
        if (pendingTasksCount === 0) continue;

        const payload = JSON.stringify({
          title: "📝 Resumo Diário de Tarefas",
          body: `Você tem ${pendingTasksCount} tarefa(s) pendente(s) para hoje. Vamos focar?`,
          icon: "/favicon.ico",
          badge: "/favicon.ico",
          data: { url: "/tasks" },
        });

        for (const sub of pref.user.pushSubscriptions) {
          try {
            await webPush.sendNotification(JSON.parse(sub.subscription), payload);
          } catch (error: any) {
            if (error.statusCode === 410 || error.statusCode === 404) {
              await prisma.pushSubscription.delete({ where: { id: sub.id } });
            }
          }
        }
      }
    } catch (error) {
      console.error("Erro no Cron de Resumo Diário de Tarefas:", error);
    }
  }, { timezone: schedulerTimezone });

  cron.schedule("0 20 * * *", async () => {
    try {
      const preferences = await prisma.notificationPreferences.findMany({
        where: { habitReminders: true },
        include: {
          user: {
            include: {
              pushSubscriptions: true,
              habits: true,
            },
          },
        },
      });

      for (const pref of preferences) {
        if (pref.user.habits.length === 0) continue;

        const payload = JSON.stringify({
          title: "🔥 Lembrete de Hábitos",
          body: "Já deu uma olhada nos seus hábitos hoje? Mantenha sua sequência ativa!",
          icon: "/favicon.ico",
          badge: "/favicon.ico",
          data: { url: "/habits" },
        });

        for (const sub of pref.user.pushSubscriptions) {
          try {
            await webPush.sendNotification(JSON.parse(sub.subscription), payload);
          } catch (error: any) {
            if (error.statusCode === 410 || error.statusCode === 404) {
              await prisma.pushSubscription.delete({ where: { id: sub.id } });
            }
          }
        }
      }
    } catch (error) {
      console.error("Erro no Cron de Lembretes de Hábitos:", error);
    }
  }, { timezone: schedulerTimezone });
}
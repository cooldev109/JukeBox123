import { prisma } from '../lib/prisma.js';
import { notifyUser, notifyRole } from '../lib/pushNotifications.js';

/**
 * Generate a machine alert and notify relevant users via push
 */
export async function generateAlert(
  machineId: string,
  type: 'OFFLINE' | 'AUDIO_FAIL' | 'PAYMENT_ERROR' | 'OWNER_INACTIVE',
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
  message: string,
): Promise<void> {
  // Create alert record
  const alert = await prisma.machineAlert.create({
    data: {
      machineId,
      type,
      severity,
      message,
      notifiedVia: 'DASHBOARD',
    },
  });

  // Find who to notify
  const machine = await prisma.machine.findUnique({
    where: { id: machineId },
    include: {
      venue: {
        select: {
          ownerId: true,
          name: true,
          state: true,
          city: true,
        },
      },
    },
  });

  if (!machine) return;

  const notificationTitle = `Alert: ${machine.venue.name}`;
  const notificationBody = message;
  const notificationData = { alertId: alert.id, machineId, type, severity };

  // Notify bar owner
  await notifyUser(machine.venue.ownerId, notificationTitle, notificationBody, notificationData);

  // Notify all admins
  await notifyRole('ADMIN', notificationTitle, notificationBody, notificationData);

  // Notify employees in the same region
  const employees = await prisma.user.findMany({
    where: {
      role: 'EMPLOYEE',
      OR: [
        { regionAccess: machine.venue.state },
        { regionAccess: machine.venue.city },
      ],
    },
    select: { id: true },
  });

  for (const emp of employees) {
    await notifyUser(emp.id, notificationTitle, notificationBody, notificationData);
  }
}

/**
 * Check for stale heartbeats and transition machines to OFFLINE
 * Called on a 60-second interval
 * Only transitions machines that have previously sent a heartbeat (lastHeartbeat is not null)
 * Machines that never sent a heartbeat stay ONLINE (default state for new/testing machines)
 */
export async function checkStaleHeartbeats(): Promise<void> {
  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);

  // Find ONLINE machines with stale heartbeats (only those that have sent at least one heartbeat)
  const staleMachines = await prisma.machine.findMany({
    where: {
      status: 'ONLINE',
      lastHeartbeat: { not: null, lt: twoMinutesAgo },
    },
    include: {
      venue: { select: { name: true } },
    },
  });

  for (const machine of staleMachines) {
    // Transition to OFFLINE
    await prisma.machine.update({
      where: { id: machine.id },
      data: { status: 'OFFLINE' },
    });

    // Check if we already have an unresolved OFFLINE alert
    const existingAlert = await prisma.machineAlert.findFirst({
      where: {
        machineId: machine.id,
        type: 'OFFLINE',
        isResolved: false,
      },
    });

    if (!existingAlert) {
      await generateAlert(
        machine.id,
        'OFFLINE',
        'MEDIUM',
        `Machine "${machine.name}" at ${machine.venue.name} has gone offline`,
      );
    }
  }
}

/**
 * Resolve an alert
 */
export async function resolveAlert(
  alertId: string,
  resolvedById: string,
): Promise<void> {
  const alert = await prisma.machineAlert.findUnique({
    where: { id: alertId },
    include: {
      machine: {
        select: {
          name: true,
          venue: { select: { name: true, ownerId: true } },
        },
      },
    },
  });

  if (!alert || alert.isResolved) return;

  await prisma.machineAlert.update({
    where: { id: alertId },
    data: {
      isResolved: true,
      resolvedAt: new Date(),
      resolvedById,
    },
  });

  // Notify relevant users
  const title = 'Alert Resolved';
  const body = `Alert resolved: ${alert.machine.name} at ${alert.machine.venue.name}`;
  const data = { alertId, machineId: alert.machineId, resolved: true };

  await notifyUser(alert.machine.venue.ownerId, title, body, data);
  await notifyRole('ADMIN', title, body, data);
}

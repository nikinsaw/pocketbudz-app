import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../auth/authenticate.js';
import type { DashboardService } from './service.js';

const params = z.object({ id: z.string().min(1) });
const query = z.object({ today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() });

export function registerDashboardRoutes(app: FastifyInstance, dashboard: DashboardService) {
  app.get('/households/:id/dashboard', { preHandler: authenticate }, async (req) => {
    const { id } = params.parse(req.params);
    const { today } = query.parse(req.query);
    return dashboard.get(req.userId, id, today);
  });
}

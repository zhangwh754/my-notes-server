import authRoutes from './auth.js';
import noteTypeRoutes from './noteTypes.js';
import noteRoutes from './notes.js';
import utilsRoutes from './utils.js';

export const routes = [
  { name: 'auth', instance: authRoutes },
  { name: 'noteTypes', instance: noteTypeRoutes },
  { name: 'notes', instance: noteRoutes },
  { name: 'utils', instance: utilsRoutes },
];

export function applyRoutes(app) {
  routes.forEach(({ instance }) => {
    app.use(instance.routes());
    app.use(instance.allowedMethods());
  });
}

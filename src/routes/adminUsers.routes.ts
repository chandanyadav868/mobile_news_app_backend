import { Router } from 'express';
import { AdminUsersController } from '../controllers/adminUsers.controller.js';

const router = Router();

// GET /api/v1/admin/users - Query list with filters & stats
router.get('/', AdminUsersController.getUsers);

// PATCH /api/v1/admin/users/:id/status - Quick status toggle (USER <-> ADMIN)
router.patch('/:id/status', AdminUsersController.updateStatus);

// PUT /api/v1/admin/users/:id - Full field update
router.put('/:id', AdminUsersController.updateUser);

// DELETE /api/v1/admin/users/:id - Remove user
router.delete('/:id', AdminUsersController.deleteUser);

export default router;

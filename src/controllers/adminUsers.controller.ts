import { Request, Response } from 'express';
import { prisma } from '../config/db.js';

export class AdminUsersController {
  /**
   * ─── API: GET ALL USERS WITH STATS ──────────────────────────────────────────
   * GET /api/v1/admin/users
   */
  public static async getUsers(req: Request, res: Response): Promise<void> {
    try {
      const search = (req.query.search as string)?.trim() || '';
      const statusFilter = (req.query.status as string)?.toUpperCase() || 'ALL';
      const providerFilter = (req.query.provider as string)?.toUpperCase() || 'ALL';

      const whereClause: any = {};

      if (search) {
        whereClause.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { id: { contains: search, mode: 'insensitive' } },
        ];
      }

      if (statusFilter !== 'ALL') {
        whereClause.status = statusFilter;
      }

      if (providerFilter !== 'ALL') {
        whereClause.authProvider = providerFilter;
      }

      const [users, totalCount, adminCount, verifiedCount, googleCount] = await Promise.all([
        prisma.user.findMany({
          where: whereClause,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true,
            authProvider: true,
            googleId: true,
            status: true,
            isEmailVerified: true,
            tokenVersion: true,
            lastLoginAt: true,
            bookmarkedArticleIds: true,
            readingHistoryCount: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
        prisma.user.count(),
        prisma.user.count({ where: { status: 'ADMIN' } }),
        prisma.user.count({ where: { isEmailVerified: true } }),
        prisma.user.count({ where: { authProvider: 'GOOGLE' } }),
      ]);

      res.status(200).json({
        success: true,
        stats: {
          total: totalCount,
          admins: adminCount,
          users: totalCount - adminCount,
          verified: verifiedCount,
          google: googleCount,
        },
        data: users,
      });
    } catch (err: any) {
      console.error('Failed to query users in AdminUsersController:', err);
      res.status(500).json({ success: false, message: 'Failed to retrieve user list: ' + err.message });
    }
  }

  /**
   * ─── API: FAST STATUS TOGGLE (USER <-> ADMIN) ──────────────────────────────
   * PATCH /api/v1/admin/users/:id/status
   */
  public static async updateStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!id) {
        res.status(400).json({ success: false, message: 'User ID is required' });
        return;
      }

      const normalizedStatus = status?.toUpperCase();
      if (!['USER', 'ADMIN'].includes(normalizedStatus)) {
        res.status(400).json({ success: false, message: 'Invalid status. Must be USER or ADMIN' });
        return;
      }

      const existingUser = await prisma.user.findUnique({ where: { id } });
      if (!existingUser) {
        res.status(404).json({ success: false, message: 'User not found' });
        return;
      }

      const updatedUser = await prisma.user.update({
        where: { id },
        data: {
          status: normalizedStatus,
          // bump tokenVersion to force client to refresh profile/token if needed
          tokenVersion: { increment: 1 },
        },
        select: {
          id: true,
          name: true,
          email: true,
          status: true,
          tokenVersion: true,
          updatedAt: true,
        },
      });

      console.log(`[AdminUsers] Status of user [${updatedUser.email}] updated to ${normalizedStatus}`);

      res.status(200).json({
        success: true,
        message: `User status successfully updated to ${normalizedStatus}`,
        user: updatedUser,
      });
    } catch (err: any) {
      console.error('Failed to update user status:', err);
      res.status(500).json({ success: false, message: 'Failed to update user status: ' + err.message });
    }
  }

  /**
   * ─── API: FULL USER FIELD EDIT ─────────────────────────────────────────────
   * PUT /api/v1/admin/users/:id
   */
  public static async updateUser(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { name, email, status, isEmailVerified, avatarUrl } = req.body;

      if (!id) {
        res.status(400).json({ success: false, message: 'User ID is required' });
        return;
      }

      const updateData: any = {};

      if (name !== undefined) updateData.name = String(name).trim();
      if (email !== undefined) updateData.email = String(email).trim().toLowerCase();
      if (status !== undefined) {
        const norm = String(status).toUpperCase();
        if (norm === 'USER' || norm === 'ADMIN') updateData.status = norm;
      }
      if (isEmailVerified !== undefined) updateData.isEmailVerified = Boolean(isEmailVerified);
      if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;

      // Bump token version
      updateData.tokenVersion = { increment: 1 };

      const updatedUser = await prisma.user.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
          authProvider: true,
          status: true,
          isEmailVerified: true,
          tokenVersion: true,
          updatedAt: true,
        },
      });

      res.status(200).json({
        success: true,
        message: 'User updated successfully',
        user: updatedUser,
      });
    } catch (err: any) {
      console.error('Failed to update user:', err);
      res.status(500).json({ success: false, message: 'Failed to update user: ' + err.message });
    }
  }

  /**
   * ─── API: DELETE USER ───────────────────────────────────────────────────────
   * DELETE /api/v1/admin/users/:id
   */
  public static async deleteUser(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      if (!id) {
        res.status(400).json({ success: false, message: 'User ID required' });
        return;
      }

      await prisma.user.delete({ where: { id } });

      console.log(`[AdminUsers] User [${id}] deleted by admin`);
      res.status(200).json({ success: true, message: 'User successfully deleted' });
    } catch (err: any) {
      console.error('Failed to delete user:', err);
      res.status(500).json({ success: false, message: 'Failed to delete user: ' + err.message });
    }
  }

  /**
   * ─── WEB UI: COMPLETE USER MANAGEMENT PORTAL ────────────────────────────────
   * GET /admin/users
   */
  public static async renderAdminUsersPortal(_req: Request, res: Response): Promise<void> {
    const html = `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NewsFlow • User Accounts & Roles Control Center</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" />
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            brand: {
              50: '#f5f3ff',
              500: '#8b5cf6',
              600: '#7c3aed',
              700: '#6d28d9',
            },
            surface: {
              dark: '#0B0F19',
              card: '#111827',
              border: '#1F2937'
            }
          }
        }
      }
    }
  </script>
  <style>
    body {
      background-color: #070B14;
      color: #E2E8F0;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    }
    .glass-card {
      background: rgba(17, 24, 39, 0.75);
      backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.4);
    }
    .badge-admin {
      background: linear-gradient(135deg, rgba(147, 51, 234, 0.25) 0%, rgba(219, 39, 119, 0.25) 100%);
      color: #E9D5FF;
      border: 1px solid rgba(168, 85, 247, 0.4);
    }
    .badge-user {
      background: rgba(59, 130, 246, 0.15);
      color: #93C5FD;
      border: 1px solid rgba(59, 130, 246, 0.3);
    }
    .badge-verified {
      background: rgba(16, 185, 129, 0.15);
      color: #6EE7B7;
      border: 1px solid rgba(16, 185, 129, 0.3);
    }
    .badge-unverified {
      background: rgba(245, 158, 11, 0.15);
      color: #FCD34D;
      border: 1px solid rgba(245, 158, 11, 0.3);
    }
  </style>
</head>
<body class="min-h-screen p-4 md:p-8">
  <div class="max-w-7xl mx-auto space-y-6">
    
    <!-- HEADER BAR -->
    <header class="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-card p-6 rounded-2xl">
      <div class="flex items-center space-x-4">
        <div class="h-12 w-12 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-purple-500/30">
          <i class="fa-solid fa-users-gear text-white text-2xl"></i>
        </div>
        <div>
          <div class="flex items-center space-x-2">
            <h1 class="text-2xl font-bold tracking-tight text-white">User Accounts & Roles</h1>
            <span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30">Live Control</span>
          </div>
          <p class="text-sm text-gray-400">View, manage, promote, and inspect all mobile app accounts & permissions</p>
        </div>
      </div>
      
      <div class="flex items-center space-x-3">
        <a href="/admin/cms" class="px-4 py-2 text-xs font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors border border-gray-700 flex items-center gap-2">
          <i class="fa-solid fa-newspaper"></i> CMS Portal
        </a>
        <a href="/dashboard" class="px-4 py-2 text-xs font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors border border-gray-700 flex items-center gap-2">
          <i class="fa-solid fa-chart-line"></i> Telemetry
        </a>
        <button onclick="loadUsers()" class="px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors shadow-lg shadow-indigo-600/30 flex items-center gap-2">
          <i class="fa-solid fa-rotate" id="refresh-icon"></i> Refresh Data
        </button>
      </div>
    </header>

    <!-- METRICS CARDS -->
    <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
      <div class="glass-card p-4 rounded-xl border border-gray-800">
        <div class="flex items-center justify-between">
          <span class="text-xs font-medium text-gray-400">Total Registered</span>
          <i class="fa-solid fa-users text-blue-400 text-sm"></i>
        </div>
        <div class="text-2xl font-bold text-white mt-2" id="stat-total">0</div>
        <div class="text-[11px] text-gray-500 mt-1">All app accounts</div>
      </div>

      <div class="glass-card p-4 rounded-xl border border-purple-500/30 bg-purple-950/20">
        <div class="flex items-center justify-between">
          <span class="text-xs font-medium text-purple-300">Administrators</span>
          <i class="fa-solid fa-crown text-purple-400 text-sm"></i>
        </div>
        <div class="text-2xl font-bold text-purple-200 mt-2" id="stat-admins">0</div>
        <div class="text-[11px] text-purple-400/70 mt-1">Full app & tab access</div>
      </div>

      <div class="glass-card p-4 rounded-xl border border-gray-800">
        <div class="flex items-center justify-between">
          <span class="text-xs font-medium text-gray-400">Regular Users</span>
          <i class="fa-solid fa-user text-indigo-400 text-sm"></i>
        </div>
        <div class="text-2xl font-bold text-white mt-2" id="stat-users">0</div>
        <div class="text-[11px] text-gray-500 mt-1">Standard reader role</div>
      </div>

      <div class="glass-card p-4 rounded-xl border border-gray-800">
        <div class="flex items-center justify-between">
          <span class="text-xs font-medium text-gray-400">Verified Emails</span>
          <i class="fa-solid fa-circle-check text-emerald-400 text-sm"></i>
        </div>
        <div class="text-2xl font-bold text-emerald-300 mt-2" id="stat-verified">0</div>
        <div class="text-[11px] text-gray-500 mt-1">OTP / Provider validated</div>
      </div>

      <div class="glass-card p-4 rounded-xl border border-gray-800">
        <div class="flex items-center justify-between">
          <span class="text-xs font-medium text-gray-400">Google Auth</span>
          <i class="fa-brands fa-google text-red-400 text-sm"></i>
        </div>
        <div class="text-2xl font-bold text-white mt-2" id="stat-google">0</div>
        <div class="text-[11px] text-gray-500 mt-1">Google OAuth logins</div>
      </div>
    </div>

    <!-- FILTER & SEARCH BAR -->
    <div class="glass-card p-4 rounded-xl flex flex-col md:flex-row gap-3 items-center justify-between">
      <div class="relative w-full md:w-96">
        <i class="fa-solid fa-magnifying-glass absolute left-3.5 top-3 text-gray-400 text-sm"></i>
        <input 
          type="text" 
          id="search-input" 
          placeholder="Search by name, email, or user ID..." 
          oninput="debounceSearch()"
          class="w-full bg-gray-900 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
        />
      </div>

      <div class="flex items-center gap-3 w-full md:w-auto">
        <select id="filter-status" onchange="loadUsers()" class="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-purple-500">
          <option value="ALL">All Roles (Admin & User)</option>
          <option value="ADMIN">👑 ADMIN Only</option>
          <option value="USER">Standard USER Only</option>
        </select>

        <select id="filter-provider" onchange="loadUsers()" class="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-purple-500">
          <option value="ALL">All Auth Providers</option>
          <option value="LOCAL">Email + Password</option>
          <option value="GOOGLE">Google OAuth</option>
        </select>
      </div>
    </div>

    <!-- USERS TABLE -->
    <div class="glass-card rounded-2xl overflow-hidden border border-gray-800">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm text-gray-300">
          <thead class="bg-gray-900/80 text-xs uppercase tracking-wider text-gray-400 border-b border-gray-800">
            <tr>
              <th scope="col" class="px-6 py-4">User</th>
              <th scope="col" class="px-6 py-4">Status / Role</th>
              <th scope="col" class="px-6 py-4">Provider</th>
              <th scope="col" class="px-6 py-4">Email Status</th>
              <th scope="col" class="px-6 py-4">Session Ver</th>
              <th scope="col" class="px-6 py-4">Last Active</th>
              <th scope="col" class="px-6 py-4">Created At</th>
              <th scope="col" class="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody id="user-table-body" class="divide-y divide-gray-800/60">
            <tr>
              <td colspan="8" class="text-center py-12 text-gray-500">
                <i class="fa-solid fa-spinner fa-spin text-2xl text-purple-500 mb-2"></i>
                <p>Loading accounts...</p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

  </div>

  <!-- EDIT USER MODAL -->
  <div id="edit-modal" class="fixed inset-0 bg-black/70 backdrop-blur-sm hidden items-center justify-center p-4 z-50">
    <div class="glass-card bg-gray-900 border border-gray-700 w-full max-w-lg rounded-2xl p-6 shadow-2xl relative">
      <button onclick="closeEditModal()" class="absolute top-4 right-4 text-gray-400 hover:text-white">
        <i class="fa-solid fa-xmark text-lg"></i>
      </button>

      <div class="flex items-center space-x-3 mb-5">
        <div class="h-10 w-10 rounded-lg bg-purple-600/30 border border-purple-500/40 flex items-center justify-center text-purple-300">
          <i class="fa-solid fa-user-pen"></i>
        </div>
        <div>
          <h3 class="text-lg font-bold text-white">Edit User Record</h3>
          <p class="text-xs text-gray-400" id="modal-user-id">ID: </p>
        </div>
      </div>

      <form id="edit-user-form" onsubmit="handleUserSave(event)" class="space-y-4">
        <input type="hidden" id="modal-id-val" />

        <div>
          <label class="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1">Full Name</label>
          <input type="text" id="modal-name" required class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500" />
        </div>

        <div>
          <label class="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1">Email Address</label>
          <input type="email" id="modal-email" required class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500" />
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1">Account Role</label>
            <select id="modal-status" class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500">
              <option value="USER">USER (Standard)</option>
              <option value="ADMIN">ADMIN (Full Tab Access)</option>
            </select>
          </div>

          <div>
            <label class="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1">Email Verified</label>
            <select id="modal-verified" class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500">
              <option value="true">Verified (Yes)</option>
              <option value="false">Unverified (No)</option>
            </select>
          </div>
        </div>

        <div class="pt-4 flex items-center justify-end space-x-3 border-t border-gray-800">
          <button type="button" onclick="closeEditModal()" class="px-4 py-2 text-xs font-medium text-gray-300 hover:bg-gray-800 rounded-lg transition-colors">
            Cancel
          </button>
          <button type="submit" class="px-5 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-lg shadow-lg shadow-purple-600/30 transition-all flex items-center gap-2">
            <i class="fa-solid fa-floppy-disk"></i> Save Changes
          </button>
        </div>
      </form>
    </div>
  </div>

  <script>
    let searchDebounce = null;
    let allUsersCache = [];

    function debounceSearch() {
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(() => {
        loadUsers();
      }, 300);
    }

    async function loadUsers() {
      const search = document.getElementById('search-input').value;
      const status = document.getElementById('filter-status').value;
      const provider = document.getElementById('filter-provider').value;
      const refreshIcon = document.getElementById('refresh-icon');

      if (refreshIcon) refreshIcon.classList.add('fa-spin');

      try {
        const queryParams = new URLSearchParams();
        if (search) queryParams.append('search', search);
        if (status !== 'ALL') queryParams.append('status', status);
        if (provider !== 'ALL') queryParams.append('provider', provider);

        const res = await fetch('/api/v1/admin/users?' + queryParams.toString());
        const data = await res.json();

        if (data.success) {
          allUsersCache = data.data;
          renderStats(data.stats);
          renderTable(data.data);
        } else {
          alert('Error loading users: ' + data.message);
        }
      } catch (err) {
        console.error('Failed to load users:', err);
      } finally {
        if (refreshIcon) refreshIcon.classList.remove('fa-spin');
      }
    }

    function renderStats(stats) {
      if (!stats) return;
      document.getElementById('stat-total').innerText = stats.total ?? 0;
      document.getElementById('stat-admins').innerText = stats.admins ?? 0;
      document.getElementById('stat-users').innerText = stats.users ?? 0;
      document.getElementById('stat-verified').innerText = stats.verified ?? 0;
      document.getElementById('stat-google').innerText = stats.google ?? 0;
    }

    function renderTable(users) {
      const tbody = document.getElementById('user-table-body');
      if (!users || users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center py-12 text-gray-500">No users found matching current filters.</td></tr>';
        return;
      }

      tbody.innerHTML = users.map(u => {
        const isAdmin = u.status === 'ADMIN';
        const roleBadge = isAdmin
          ? '<span class="badge-admin px-2.5 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1.5"><i class="fa-solid fa-crown text-[10px]"></i> ADMIN</span>'
          : '<span class="badge-user px-2.5 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1.5"><i class="fa-solid fa-user text-[10px]"></i> USER</span>';

        const emailBadge = u.isEmailVerified
          ? '<span class="badge-verified px-2 py-0.5 rounded text-[11px] font-medium inline-flex items-center gap-1"><i class="fa-solid fa-check text-[9px]"></i> Verified</span>'
          : '<span class="badge-unverified px-2 py-0.5 rounded text-[11px] font-medium inline-flex items-center gap-1"><i class="fa-solid fa-clock text-[9px]"></i> Pending</span>';

        const providerBadge = u.authProvider === 'GOOGLE'
          ? '<span class="text-red-400 font-medium text-xs inline-flex items-center gap-1"><i class="fa-brands fa-google text-[10px]"></i> Google</span>'
          : '<span class="text-gray-400 font-medium text-xs inline-flex items-center gap-1"><i class="fa-solid fa-envelope text-[10px]"></i> Local</span>';

        const avatar = u.avatarUrl 
          ? \`<img src="\${u.avatarUrl}" class="h-9 w-9 rounded-full object-cover border border-gray-700" alt="avatar" />\`
          : \`<div class="h-9 w-9 rounded-full bg-gradient-to-tr from-purple-700 to-indigo-600 flex items-center justify-center font-bold text-white text-xs">\${(u.name || 'U').charAt(0).toUpperCase()}</div>\`;

        const createdDate = new Date(u.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
        const lastActive = u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Never';

        // Fast status button
        const toggleBtn = isAdmin
          ? \`<button onclick="toggleUserStatus('\${u.id}', 'USER')" class="px-3 py-1.5 text-xs font-semibold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-lg transition-all flex items-center gap-1.5" title="Demote to USER">
              <i class="fa-solid fa-arrow-down text-[10px]"></i> Demote
            </button>\`
          : \`<button onclick="toggleUserStatus('\${u.id}', 'ADMIN')" class="px-3 py-1.5 text-xs font-semibold text-purple-300 bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/40 rounded-lg transition-all flex items-center gap-1.5" title="Promote to ADMIN">
              <i class="fa-solid fa-crown text-[10px]"></i> Promote Admin
            </button>\`;

        return \`
          <tr class="hover:bg-gray-800/40 transition-colors">
            <td class="px-6 py-4">
              <div class="flex items-center space-x-3">
                \${avatar}
                <div>
                  <div class="font-medium text-white flex items-center gap-2">
                    \${escapeHtml(u.name || 'Anonymous')}
                  </div>
                  <div class="text-xs text-gray-400 font-mono">\${escapeHtml(u.email)}</div>
                  <div class="text-[10px] text-gray-600 font-mono mt-0.5 select-all">ID: \${u.id}</div>
                </div>
              </div>
            </td>
            <td class="px-6 py-4">\${roleBadge}</td>
            <td class="px-6 py-4">\${providerBadge}</td>
            <td class="px-6 py-4">\${emailBadge}</td>
            <td class="px-6 py-4 font-mono text-xs text-gray-400">v\${u.tokenVersion ?? 0}</td>
            <td class="px-6 py-4 text-xs text-gray-400">\${lastActive}</td>
            <td class="px-6 py-4 text-xs text-gray-400">\${createdDate}</td>
            <td class="px-6 py-4 text-right">
              <div class="flex items-center justify-end space-x-2">
                \${toggleBtn}
                <button onclick="openEditModal('\${u.id}')" class="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors" title="Edit All Fields">
                  <i class="fa-solid fa-pen-to-square text-xs"></i>
                </button>
                <button onclick="deleteAccount('\${u.id}', '\${escapeHtml(u.email)}')" class="p-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-colors" title="Delete Account">
                  <i class="fa-solid fa-trash text-xs"></i>
                </button>
              </div>
            </td>
          </tr>
        \`;
      }).join('');
    }

    async function toggleUserStatus(userId, newStatus) {
      const actionTitle = newStatus === 'ADMIN' ? 'Promote this user to ADMIN?' : 'Demote this user to standard USER?';
      if (!confirm(\`Are you sure you want to \${actionTitle}\`)) return;

      try {
        const res = await fetch(\`/api/v1/admin/users/\${userId}/status\`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus })
        });
        const data = await res.json();
        if (data.success) {
          loadUsers();
        } else {
          alert('Failed to update status: ' + data.message);
        }
      } catch (err) {
        alert('Network error while updating status');
      }
    }

    function openEditModal(userId) {
      const user = allUsersCache.find(u => u.id === userId);
      if (!user) return;

      document.getElementById('modal-id-val').value = user.id;
      document.getElementById('modal-user-id').innerText = 'ID: ' + user.id;
      document.getElementById('modal-name').value = user.name || '';
      document.getElementById('modal-email').value = user.email || '';
      document.getElementById('modal-status').value = user.status || 'USER';
      document.getElementById('modal-verified').value = user.isEmailVerified ? 'true' : 'false';

      const modal = document.getElementById('edit-modal');
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }

    function closeEditModal() {
      const modal = document.getElementById('edit-modal');
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }

    async function handleUserSave(e) {
      e.preventDefault();
      const userId = document.getElementById('modal-id-val').value;
      const name = document.getElementById('modal-name').value;
      const email = document.getElementById('modal-email').value;
      const status = document.getElementById('modal-status').value;
      const isEmailVerified = document.getElementById('modal-verified').value === 'true';

      try {
        const res = await fetch(\`/api/v1/admin/users/\${userId}\`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, status, isEmailVerified })
        });
        const data = await res.json();
        if (data.success) {
          closeEditModal();
          loadUsers();
        } else {
          alert('Save failed: ' + data.message);
        }
      } catch (err) {
        alert('Network error while saving user');
      }
    }

    async function deleteAccount(userId, email) {
      if (!confirm(\`Are you sure you want to permanently delete user [\${email}]? This cannot be undone.\`)) return;

      try {
        const res = await fetch(\`/api/v1/admin/users/\${userId}\`, {
          method: 'DELETE'
        });
        const data = await res.json();
        if (data.success) {
          loadUsers();
        } else {
          alert('Failed to delete user: ' + data.message);
        }
      } catch (err) {
        alert('Network error while deleting user');
      }
    }

    function escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    // Load users on page open
    window.addEventListener('DOMContentLoaded', loadUsers);
  </script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }
}

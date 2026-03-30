import React, { useEffect, useState, useCallback } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  Paper,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import FormControlLabel from '@mui/material/FormControlLabel';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { userService, UserRecord, RoleRecord } from '../../services/userService';

// ── Role badge colours ─────────────────────────────────────────────────────────
const roleColour = (name: string): 'error' | 'primary' | 'warning' | 'default' => {
  if (name === 'Admin')   return 'error';
  if (name === 'Maker')   return 'primary';
  if (name === 'Checker') return 'warning';
  return 'default';
};

// ── Component ─────────────────────────────────────────────────────────────────

const UserManagement: React.FC = () => {
  const [tab, setTab]           = useState(0);
  const [users, setUsers]       = useState<UserRecord[]>([]);
  const [roles, setRoles]       = useState<RoleRecord[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  // New user dialog
  const [userDlg, setUserDlg]     = useState(false);
  const [uUsername, setUUsername] = useState('');
  const [uEmail, setUEmail]       = useState('');
  const [uPassword, setUPassword] = useState('');
  const [uActive, setUActive]     = useState(true);
  const [uSaving, setUSaving]     = useState(false);
  const [uError, setUError]       = useState<string | null>(null);

  // New role dialog
  const [roleDlg, setRoleDlg]   = useState(false);
  const [rName, setRName]       = useState('');
  const [rSaving, setRSaving]   = useState(false);
  const [rError, setRError]     = useState<string | null>(null);

  // ── Load ─────────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [u, r] = await Promise.all([userService.listUsers(), userService.listRoles()]);
      setUsers(u);
      setRoles(r);
    } catch {
      setError('Failed to load data — check that UserAccessManagementService is running.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Create user ───────────────────────────────────────────────────────────────
  const handleCreateUser = async () => {
    if (!uUsername.trim() || !uEmail.trim() || !uPassword.trim()) {
      setUError('Username, email, and password are required.');
      return;
    }
    setUSaving(true);
    setUError(null);
    try {
      await userService.createUser({
        username:     uUsername,
        email:        uEmail,
        passwordHash: uPassword, // demo: stored as-is; use seeder for bcrypt users
        isActive:     uActive,
      });
      setUserDlg(false);
      await load();
    } catch (e: any) {
      setUError(e?.response?.data ?? e?.message ?? 'Create failed.');
    } finally {
      setUSaving(false);
    }
  };

  // ── Delete user ───────────────────────────────────────────────────────────────
  const handleDeleteUser = async (u: UserRecord) => {
    if (!window.confirm(`Delete user ${u.email}?`)) return;
    try {
      await userService.deleteUser(u.id);
      await load();
    } catch (e: any) {
      setError(e?.response?.data ?? e?.message ?? 'Delete failed.');
    }
  };

  // ── Create role ───────────────────────────────────────────────────────────────
  const handleCreateRole = async () => {
    if (!rName.trim()) { setRError('Role name is required.'); return; }
    setRSaving(true);
    setRError(null);
    try {
      await userService.createRole(rName);
      setRoleDlg(false);
      await load();
    } catch (e: any) {
      setRError(e?.response?.data ?? e?.message ?? 'Create failed.');
    } finally {
      setRSaving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight={600}>User Management</Typography>
        {tab === 0 ? (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setUError(null); setUserDlg(true); }}>
            New User
          </Button>
        ) : (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setRError(null); setRoleDlg(true); }}>
            New Role
          </Button>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>
      )}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label={`Users (${users.length})`} />
        <Tab label={`Roles (${roles.length})`} />
      </Tabs>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
          <CircularProgress />
        </Box>
      ) : tab === 0 ? (
        /* ── Users Tab ─────────────────────────────────────────────────────────── */
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ '& th': { fontWeight: 700, bgcolor: 'grey.50' } }}>
                <TableCell>Username</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Roles</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 5, color: 'text.secondary' }}>
                    No users found.
                  </TableCell>
                </TableRow>
              ) : (
                users.map(u => (
                  <TableRow key={u.id} hover>
                    <TableCell sx={{ fontWeight: 600 }}>{u.username}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>
                      {u.userRoles?.map(ur => (
                        <Chip
                          key={ur.roleId}
                          label={ur.role?.name ?? `Role ${ur.roleId}`}
                          size="small"
                          color={roleColour(ur.role?.name ?? '')}
                          sx={{ mr: 0.5 }}
                        />
                      ))}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={u.isActive ? 'Active' : 'Inactive'}
                        size="small"
                        color={u.isActive ? 'success' : 'default'}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="Delete user">
                        <IconButton size="small" color="error" onClick={() => handleDeleteUser(u)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        /* ── Roles Tab ─────────────────────────────────────────────────────────── */
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ '& th': { fontWeight: 700, bgcolor: 'grey.50' } }}>
                <TableCell>Role Name</TableCell>
                <TableCell>Assigned Users</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {roles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2} align="center" sx={{ py: 5, color: 'text.secondary' }}>
                    No roles found.
                  </TableCell>
                </TableRow>
              ) : (
                roles.map(r => (
                  <TableRow key={r.id} hover>
                    <TableCell>
                      <Chip label={r.name} size="small" color={roleColour(r.name)} />
                    </TableCell>
                    <TableCell sx={{ color: 'text.secondary', fontSize: '0.85rem' }}>
                      {r.userRoles?.length ?? 0} user{(r.userRoles?.length ?? 0) !== 1 ? 's' : ''}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* ── New User Dialog ───────────────────────────────────────────────────── */}
      <Dialog open={userDlg} onClose={() => setUserDlg(false)} maxWidth="sm" fullWidth>
        <DialogTitle>New User</DialogTitle>
        <DialogContent dividers>
          {uError && <Alert severity="error" sx={{ mb: 2 }}>{uError}</Alert>}
          <Alert severity="info" sx={{ mb: 2 }} variant="outlined">
            Demo: new users are seeded without BCrypt hashing. For login, use the pre-seeded users
            (admin@saarbanking.com / maker / checker).
          </Alert>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <TextField
                label="Username *" fullWidth size="small"
                value={uUsername}
                onChange={e => setUUsername(e.target.value)}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Email *" fullWidth size="small" type="email"
                value={uEmail}
                onChange={e => setUEmail(e.target.value)}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Password *" fullWidth size="small" type="password"
                value={uPassword}
                onChange={e => setUPassword(e.target.value)}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={uActive}
                    onChange={e => setUActive(e.target.checked)}
                  />
                }
                label="Active"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUserDlg(false)} disabled={uSaving}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateUser} disabled={uSaving}>
            {uSaving ? <CircularProgress size={20} /> : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── New Role Dialog ───────────────────────────────────────────────────── */}
      <Dialog open={roleDlg} onClose={() => setRoleDlg(false)} maxWidth="xs" fullWidth>
        <DialogTitle>New Role</DialogTitle>
        <DialogContent dividers>
          {rError && <Alert severity="error" sx={{ mb: 2 }}>{rError}</Alert>}
          <TextField
            label="Role Name *" fullWidth size="small" sx={{ mt: 1 }}
            value={rName}
            onChange={e => setRName(e.target.value)}
            placeholder="e.g. BranchManager"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRoleDlg(false)} disabled={rSaving}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateRole} disabled={rSaving}>
            {rSaving ? <CircularProgress size={20} /> : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UserManagement;

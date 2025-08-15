import React, { useState } from 'react';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Paper,
  IconButton,
  Chip,
  Typography,
  TextField,
  InputAdornment,
  Button,
  Menu,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Grid,
  Tooltip,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  Search,
  Add,
  Edit,
  Delete,
  PlayArrow,
  CheckCircle,
  MoreVert,
  Visibility,
  FilterList,
  Refresh
} from '@mui/icons-material';

import { ExpressionDefinition, ExpressionFilters, EXPRESSION_CATEGORIES, EXPRESSION_STATUSES } from '../../types/expression';

interface ExpressionListProps {
  expressions: ExpressionDefinition[];
  loading: boolean;
  error: any;
  filters: ExpressionFilters;
  onFiltersChange: (filters: ExpressionFilters) => void;
  onCreateNew: () => void;
  onEdit: (expression: ExpressionDefinition) => void;
  onView: (expression: ExpressionDefinition) => void;
  onDelete: (id: string) => void;
  onApprove: (id: string) => void;
  onTest: (expression: ExpressionDefinition) => void;
  onRefresh: () => void;
}

const ExpressionList: React.FC<ExpressionListProps> = ({
  expressions,
  loading,
  error,
  filters,
  onFiltersChange,
  onCreateNew,
  onEdit,
  onView,
  onDelete,
  onApprove,
  onTest,
  onRefresh
}) => {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedExpression, setSelectedExpression] = useState<ExpressionDefinition | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, expression: ExpressionDefinition) => {
    setAnchorEl(event.currentTarget);
    setSelectedExpression(expression);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedExpression(null);
  };

  const handleFilterChange = (key: keyof ExpressionFilters, value: any) => {
    onFiltersChange({
      ...filters,
      [key]: value
    });
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'success';
      case 'approved':
        return 'primary';
      case 'draft':
        return 'warning';
      case 'inactive':
        return 'default';
      default:
        return 'default';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        Failed to load expressions. Please try again.
        <Button onClick={onRefresh} sx={{ ml: 2 }}>
          Retry
        </Button>
      </Alert>
    );
  }

  return (
    <Box>
      {/* Header and Actions */}
      <Box sx={{ display: 'flex', justifyContent: 'between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6" component="h2">
          Expressions ({expressions.length})
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            startIcon={<FilterList />}
            onClick={() => setShowFilters(!showFilters)}
            variant={showFilters ? 'contained' : 'outlined'}
            size="small"
          >
            Filters
          </Button>
          <Button
            startIcon={<Refresh />}
            onClick={onRefresh}
            variant="outlined"
            size="small"
          >
            Refresh
          </Button>
          <Button
            startIcon={<Add />}
            onClick={onCreateNew}
            variant="contained"
            size="small"
          >
            Create Expression
          </Button>
        </Box>
      </Box>

      {/* Filters */}
      {showFilters && (
        <Paper sx={{ p: 2, mb: 2 }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
            <TextField
              label="Search"
              value={filters.search || ''}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                ),
              }}
              size="small"
              sx={{ minWidth: 200 }}
            />
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Category</InputLabel>
              <Select
                value={filters.category || ''}
                onChange={(e) => handleFilterChange('category', e.target.value)}
                label="Category"
              >
                <MenuItem value="">All Categories</MenuItem>
                {EXPRESSION_CATEGORIES.map((category) => (
                  <MenuItem key={category} value={category}>
                    {category}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={filters.status || ''}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                label="Status"
              >
                <MenuItem value="">All Statuses</MenuItem>
                {EXPRESSION_STATUSES.map((status) => (
                  <MenuItem key={status} value={status}>
                    {status}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button
              onClick={() => onFiltersChange({})}
              variant="outlined"
              size="small"
            >
              Clear Filters
            </Button>
          </Box>
        </Paper>
      )}

      {/* Table */}
      <TableContainer component={Paper}>
        <Table sx={{ minWidth: 650 }} aria-label="expressions table">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Category</TableCell>
              <TableCell>Context</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Executions</TableCell>
              <TableCell>Avg Time (ms)</TableCell>
              <TableCell>Created</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                  <CircularProgress />
                </TableCell>
              </TableRow>
            ) : expressions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    No expressions found. Create your first expression to get started.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              expressions
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((expression) => (
                  <TableRow
                    key={expression.id}
                    sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                  >
                    <TableCell>
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                          {expression.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" noWrap>
                          {expression.description}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          ID: {expression.expressionId}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={expression.category} 
                        size="small" 
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {expression.contextType}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        → {expression.returnType}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={expression.status} 
                        size="small" 
                        color={getStatusColor(expression.status) as any}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {expression.totalExecutions.toLocaleString()}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Success: {Math.round((expression.totalExecutions > 0 ? 1 : 0) * 100)}%
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {expression.averageExecutionTimeMs}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {formatDate(expression.createdAt)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Tooltip title="View">
                          <IconButton size="small" onClick={() => onView(expression)}>
                            <Visibility />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Test">
                          <IconButton size="small" onClick={() => onTest(expression)}>
                            <PlayArrow />
                          </IconButton>
                        </Tooltip>
                        <IconButton
                          size="small"
                          onClick={(e) => handleMenuOpen(e, expression)}
                        >
                          <MoreVert />
                        </IconButton>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      {expressions.length > 0 && (
        <TablePagination
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={expressions.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      )}

      {/* Action Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <MenuItem onClick={() => {
          if (selectedExpression) onEdit(selectedExpression);
          handleMenuClose();
        }}>
          <Edit sx={{ mr: 1 }} /> Edit
        </MenuItem>
        {selectedExpression?.status === 'Draft' && (
          <MenuItem onClick={() => {
            if (selectedExpression) onApprove(selectedExpression.id);
            handleMenuClose();
          }}>
            <CheckCircle sx={{ mr: 1 }} /> Approve
          </MenuItem>
        )}
        <MenuItem 
          onClick={() => {
            if (selectedExpression) onDelete(selectedExpression.id);
            handleMenuClose();
          }}
          sx={{ color: 'error.main' }}
        >
          <Delete sx={{ mr: 1 }} /> Delete
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default ExpressionList;

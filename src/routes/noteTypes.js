import Router from 'koa-router';
import { query } from '../config/database.js';

const router = new Router({
  prefix: '/api/note-types',
});

// Get all note types for a user (tree structure)
router.get('/', async (ctx) => {
  const { userId } = ctx.query;

  if (!userId) {
    ctx.status = 400;
    ctx.body = {
      success: false,
      error: { message: 'User ID is required' },
    };
    return;
  }

  try {
    const result = await query(
      `SELECT
        nt.id,
        nt.user_id,
        nt.name,
        nt.description,
        nt.parent_id,
        nt.sort_order,
        nt.color,
        nt.icon,
        nt.created_at,
        nt.updated_at,
        (SELECT COUNT(*) FROM notes WHERE type_id = nt.id) as note_count
      FROM note_types nt
      WHERE nt.user_id = $1
      ORDER BY nt.sort_order, nt.name`,
      [userId]
    );

    ctx.body = {
      success: true,
      data: result.rows,
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = {
      success: false,
      error: { message: 'Failed to fetch note types', details: error.message },
    };
  }
});

// Get note type tree
router.get('/tree', async (ctx) => {
  const { userId } = ctx.query;

  if (!userId) {
    ctx.status = 400;
    ctx.body = {
      success: false,
      error: { message: 'User ID is required' },
    };
    return;
  }

  try {
    const result = await query('SELECT * FROM get_type_tree($1)', [userId]);

    ctx.body = {
      success: true,
      data: result.rows,
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = {
      success: false,
      error: { message: 'Failed to fetch type tree', details: error.message },
    };
  }
});

// Get single note type
router.get('/:id', async (ctx) => {
  const { id } = ctx.params;

  try {
    const result = await query('SELECT * FROM note_types WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      ctx.status = 404;
      ctx.body = {
        success: false,
        error: { message: 'Note type not found' },
      };
      return;
    }

    ctx.body = {
      success: true,
      data: result.rows[0],
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = {
      success: false,
      error: { message: 'Failed to fetch note type', details: error.message },
    };
  }
});

// Create note type
router.post('/', async (ctx) => {
  const { userId, name, description, parentId, sortOrder, color, icon } = ctx.request.body;

  if (!userId || !name) {
    ctx.status = 400;
    ctx.body = {
      success: false,
      error: { message: 'User ID and name are required' },
    };
    return;
  }

  try {
    const result = await query(
      `INSERT INTO note_types (user_id, name, description, parent_id, sort_order, color, icon)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [userId, name, description || null, parentId || null, sortOrder || 0, color || null, icon || null]
    );

    ctx.status = 201;
    ctx.body = {
      success: true,
      data: result.rows[0],
    };
  } catch (error) {
    if (error.code === '23505') {
      ctx.status = 409;
      ctx.body = {
        success: false,
        error: { message: 'Note type with this name already exists under the same parent' },
      };
      return;
    }

    ctx.status = 500;
    ctx.body = {
      success: false,
      error: { message: 'Failed to create note type', details: error.message },
    };
  }
});

// Update note type
router.put('/:id', async (ctx) => {
  const { id } = ctx.params;
  const { name, description, parentId, sortOrder, color, icon } = ctx.request.body;

  try {
    const result = await query(
      `UPDATE note_types
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           parent_id = COALESCE($3, parent_id),
           sort_order = COALESCE($4, sort_order),
           color = COALESCE($5, color),
           icon = COALESCE($6, icon)
       WHERE id = $7
       RETURNING *`,
      [name, description, parentId, sortOrder, color, icon, id]
    );

    if (result.rows.length === 0) {
      ctx.status = 404;
      ctx.body = {
        success: false,
        error: { message: 'Note type not found' },
      };
      return;
    }

    ctx.body = {
      success: true,
      data: result.rows[0],
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = {
      success: false,
      error: { message: 'Failed to update note type', details: error.message },
    };
  }
});

// Delete note type
router.delete('/:id', async (ctx) => {
  const { id } = ctx.params;

  try {
    const result = await query('DELETE FROM note_types WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      ctx.status = 404;
      ctx.body = {
        success: false,
        error: { message: 'Note type not found' },
      };
      return;
    }

    ctx.body = {
      success: true,
      data: { message: 'Note type deleted successfully' },
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = {
      success: false,
      error: { message: 'Failed to delete note type', details: error.message },
    };
  }
});

// Get note count for type (including subtypes)
router.get('/:id/note-count', async (ctx) => {
  const { id } = ctx.params;

  try {
    const result = await query('SELECT get_type_note_count($1) as count', [id]);

    ctx.body = {
      success: true,
      data: { count: result.rows[0].count },
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = {
      success: false,
      error: { message: 'Failed to get note count', details: error.message },
    };
  }
});

export default router;

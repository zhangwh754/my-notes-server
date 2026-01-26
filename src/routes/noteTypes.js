import Router from 'koa-router';
import { query } from '../config/database.js';
import { auth, checkOwnership } from '../middleware/auth.js';

const router = new Router({
  prefix: '/api/note-types',
});

// Get all note types for a user
router.get('/', auth, async (ctx) => {
  const { userId } = ctx.state.user;

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
router.get('/tree', auth, async (ctx) => {
  const { userId } = ctx.state.user;

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

// Get notes for a type including all subtypes
router.get('/notes', auth, async (ctx) => {
  const { userId } = ctx.state.user;
  const { id: typeId, page = 1, limit = 20 } = ctx.query;

  if (!typeId) {
    ctx.status = 400;
    ctx.body = {
      success: false,
      error: { message: 'Type ID is required' },
    };
    return;
  }

  try {
    // First, verify that the type belongs to the user
    const typeCheck = await query('SELECT id FROM note_types WHERE id = $1 AND user_id = $2', [
      typeId,
      userId,
    ]);

    if (typeCheck.rows.length === 0) {
      ctx.status = 404;
      ctx.body = {
        success: false,
        error: { message: 'Note type not found or does not belong to user' },
      };
      return;
    }

    // Get all type IDs (including subtypes)
    const typeIdsResult = await query('SELECT type_id FROM get_type_and_subtype_ids($1)', [typeId]);
    const typeIds = typeIdsResult.rows.map((row) => row.type_id);

    if (typeIds.length === 0) {
      ctx.body = {
        success: true,
        data: {
          notes: [],
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: 0,
            totalPages: 0,
          },
        },
      };
      return;
    }

    const offset = (page - 1) * limit;

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as total FROM notes WHERE user_id = $1 AND type_id = ANY($2)`,
      [userId, typeIds]
    );

    // Get paginated notes
    const result = await query(
      `SELECT
        n.id,
        n.user_id,
        n.type_id,
        nt.name as type_name,
        n.title,
        n.content,
        n.is_favorite,
        n.is_archived,
        n.created_at,
        n.updated_at,
        (SELECT COUNT(*) FROM attachments WHERE note_id = n.id) as attachment_count
      FROM notes n
      LEFT JOIN note_types nt ON n.type_id = nt.id
      WHERE n.user_id = $1 AND n.type_id = ANY($2)
      ORDER BY n.updated_at DESC
      LIMIT $3 OFFSET $4`,
      [userId, typeIds, limit, offset]
    );

    ctx.body = {
      success: true,
      data: {
        notes: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: parseInt(countResult.rows[0].total),
          totalPages: Math.ceil(countResult.rows[0].total / limit),
        },
      },
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = {
      success: false,
      error: { message: 'Failed to fetch notes', details: error.message },
    };
  }
});

// Get single note type
router.get('/:id', auth, checkOwnership('note_types'), async (ctx) => {
  const { id } = ctx.params;

  try {
    const result = await query('SELECT * FROM note_types WHERE id = $1', [id]);

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
router.post('/', auth, async (ctx) => {
  const { userId } = ctx.state.user;
  const { name, description, parentId, color, icon } = ctx.request.body;

  if (!name) {
    ctx.status = 400;
    ctx.body = {
      success: false,
      error: { message: 'Name is required' },
    };
    return;
  }

  try {
    // 自动计算 sort_order：同级最大值 + 1
    const result = await query(
      `INSERT INTO note_types (user_id, name, description, parent_id, sort_order, color, icon)
       SELECT $1, $2, $3, $4,
         COALESCE(
           (SELECT MAX(sort_order) FROM note_types WHERE user_id = $1 AND parent_id IS NOT DISTINCT FROM $4),
           0
         ) + 1,
         $5, $6
       RETURNING *`,
      [userId, name, description || null, parentId || null, color || null, icon || null]
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
router.put('/:id', auth, checkOwnership('note_types'), async (ctx) => {
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
      error: { message: 'Failed to update note type', details: error.message },
    };
  }
});

// Delete note type
router.delete('/:id', auth, checkOwnership('note_types'), async (ctx) => {
  const { id } = ctx.params;

  try {
    const result = await query('DELETE FROM note_types WHERE id = $1 RETURNING *', [id]);

    ctx.body = {
      success: true,
      data: { message: 'Note type deleted successfully' },
    };
  } catch (error) {
    if (error.code === '23503') {
      ctx.status = 409;
      ctx.body = {
        success: false,
        error: { message: 'Cannot delete note type that contains notes or sub-types' },
      };
      return;
    }

    ctx.status = 500;
    ctx.body = {
      success: false,
      error: { message: 'Failed to delete note type', details: error.message },
    };
  }
});

// Get note count for type (including subtypes)
router.get('/:id/note-count', auth, checkOwnership('note_types'), async (ctx) => {
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

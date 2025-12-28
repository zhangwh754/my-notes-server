import Router from 'koa-router';
import { query } from '../config/database.js';

const router = new Router({
  prefix: '/api/notes',
});

// Get all notes for a user (with filtering and pagination)
router.get('/', async (ctx) => {
  const { userId, typeId, isFavorite, isArchived, search, page = 1, limit = 20 } = ctx.query;

  if (!userId) {
    ctx.status = 400;
    ctx.body = {
      success: false,
      error: { message: 'User ID is required' },
    };
    return;
  }

  try {
    const offset = (page - 1) * limit;
    let conditions = ['user_id = $1'];
    let params = [userId];
    let paramIndex = 2;

    // Add optional filters
    if (typeId) {
      conditions.push(`type_id = $${paramIndex++}`);
      params.push(typeId);
    }

    if (isFavorite !== undefined) {
      conditions.push(`is_favorite = $${paramIndex++}`);
      params.push(isFavorite === 'true');
    }

    if (isArchived !== undefined) {
      conditions.push(`is_archived = $${paramIndex++}`);
      params.push(isArchived === 'true');
    }

    if (search) {
      conditions.push(`title ILIKE $${paramIndex++}`);
      params.push(`%${search}%`);
    }

    const whereClause = conditions.join(' AND ');

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as total FROM notes WHERE ${whereClause}`,
      params
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
      WHERE ${whereClause}
      ORDER BY n.updated_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...params, limit, offset]
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

// Get single note by ID
router.get('/:id', async (ctx) => {
  const { id } = ctx.params;

  try {
    const result = await query(
      `SELECT
        n.*,
        nt.name as type_name,
        (SELECT COUNT(*) FROM attachments WHERE note_id = n.id) as attachment_count
      FROM notes n
      LEFT JOIN note_types nt ON n.type_id = nt.id
      WHERE n.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      ctx.status = 404;
      ctx.body = {
        success: false,
        error: { message: 'Note not found' },
      };
      return;
    }

    // Get tags for this note
    const tagsResult = await query(
      `SELECT t.id, t.name
       FROM tags t
       INNER JOIN note_tags nt ON t.id = nt.tag_id
       WHERE nt.note_id = $1`,
      [id]
    );

    const note = result.rows[0];
    note.tags = tagsResult.rows;

    ctx.body = {
      success: true,
      data: note,
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = {
      success: false,
      error: { message: 'Failed to fetch note', details: error.message },
    };
  }
});

// Create note
router.post('/', async (ctx) => {
  const { userId, typeId, title, content, isFavorite, isArchived } = ctx.request.body;

  if (!userId || !typeId || !title) {
    ctx.status = 400;
    ctx.body = {
      success: false,
      error: { message: 'User ID, type ID, and title are required' },
    };
    return;
  }

  try {
    const result = await query(
      `INSERT INTO notes (user_id, type_id, title, content, is_favorite, is_archived)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        userId,
        typeId,
        title,
        content || null,
        isFavorite || false,
        isArchived || false,
      ]
    );

    ctx.status = 201;
    ctx.body = {
      success: true,
      data: result.rows[0],
    };
  } catch (error) {
    if (error.code === '23503') {
      ctx.status = 400;
      ctx.body = {
        success: false,
        error: { message: 'Invalid user ID or type ID' },
      };
      return;
    }

    ctx.status = 500;
    ctx.body = {
      success: false,
      error: { message: 'Failed to create note', details: error.message },
    };
  }
});

// Update note
router.put('/:id', async (ctx) => {
  const { id } = ctx.params;
  const { typeId, title, content, isFavorite, isArchived } = ctx.request.body;

  try {
    const result = await query(
      `UPDATE notes
       SET type_id = COALESCE($1, type_id),
           title = COALESCE($2, title),
           content = COALESCE($3, content),
           is_favorite = COALESCE($4, is_favorite),
           is_archived = COALESCE($5, is_archived)
       WHERE id = $6
       RETURNING *`,
      [typeId, title, content, isFavorite, isArchived, id]
    );

    if (result.rows.length === 0) {
      ctx.status = 404;
      ctx.body = {
        success: false,
        error: { message: 'Note not found' },
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
      error: { message: 'Failed to update note', details: error.message },
    };
  }
});

// Delete note
router.delete('/:id', async (ctx) => {
  const { id } = ctx.params;

  try {
    const result = await query('DELETE FROM notes WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      ctx.status = 404;
      ctx.body = {
        success: false,
        error: { message: 'Note not found' },
      };
      return;
    }

    ctx.body = {
      success: true,
      data: { message: 'Note deleted successfully' },
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = {
      success: false,
      error: { message: 'Failed to delete note', details: error.message },
    };
  }
});

// Toggle favorite status
router.patch('/:id/favorite', async (ctx) => {
  const { id } = ctx.params;

  try {
    const result = await query(
      `UPDATE notes
       SET is_favorite = NOT is_favorite
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      ctx.status = 404;
      ctx.body = {
        success: false,
        error: { message: 'Note not found' },
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
      error: { message: 'Failed to toggle favorite', details: error.message },
    };
  }
});

// Toggle archive status
router.patch('/:id/archive', async (ctx) => {
  const { id } = ctx.params;

  try {
    const result = await query(
      `UPDATE notes
       SET is_archived = NOT is_archived
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      ctx.status = 404;
      ctx.body = {
        success: false,
        error: { message: 'Note not found' },
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
      error: { message: 'Failed to toggle archive', details: error.message },
    };
  }
});

// Get note tags
router.get('/:id/tags', async (ctx) => {
  const { id } = ctx.params;

  try {
    const result = await query(
      `SELECT t.id, t.name, t.created_at
       FROM tags t
       INNER JOIN note_tags nt ON t.id = nt.tag_id
       WHERE nt.note_id = $1`,
      [id]
    );

    ctx.body = {
      success: true,
      data: result.rows,
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = {
      success: false,
      error: { message: 'Failed to fetch note tags', details: error.message },
    };
  }
});

// Add tag to note
router.post('/:id/tags', async (ctx) => {
  const { id } = ctx.params;
  const { tagId } = ctx.request.body;

  if (!tagId) {
    ctx.status = 400;
    ctx.body = {
      success: false,
      error: { message: 'Tag ID is required' },
    };
    return;
  }

  try {
    const result = await query(
      `INSERT INTO note_tags (note_id, tag_id)
       VALUES ($1, $2)
       ON CONFLICT (note_id, tag_id) DO NOTHING
       RETURNING *`,
      [id, tagId]
    );

    ctx.status = 201;
    ctx.body = {
      success: true,
      data: { message: 'Tag added to note' },
    };
  } catch (error) {
    if (error.code === '23503') {
      ctx.status = 400;
      ctx.body = {
        success: false,
        error: { message: 'Invalid note ID or tag ID' },
      };
      return;
    }

    ctx.status = 500;
    ctx.body = {
      success: false,
      error: { message: 'Failed to add tag to note', details: error.message },
    };
  }
});

// Remove tag from note
router.delete('/:id/tags/:tagId', async (ctx) => {
  const { id, tagId } = ctx.params;

  try {
    const result = await query(
      'DELETE FROM note_tags WHERE note_id = $1 AND tag_id = $2 RETURNING *',
      [id, tagId]
    );

    if (result.rows.length === 0) {
      ctx.status = 404;
      ctx.body = {
        success: false,
        error: { message: 'Tag not found on this note' },
      };
      return;
    }

    ctx.body = {
      success: true,
      data: { message: 'Tag removed from note' },
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = {
      success: false,
      error: { message: 'Failed to remove tag from note', details: error.message },
    };
  }
});

export default router;

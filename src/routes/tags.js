import Router from 'koa-router';
import { query } from '../config/database.js';

const router = new Router({
  prefix: '/api/tags',
});

// Get all tags for a user
router.get('/', async (ctx) => {
  const { userId, search } = ctx.query;

  if (!userId) {
    ctx.status = 400;
    ctx.body = {
      success: false,
      error: { message: 'User ID is required' },
    };
    return;
  }

  try {
    let queryText = `
      SELECT
        t.id,
        t.user_id,
        t.name,
        t.created_at,
        (SELECT COUNT(*) FROM note_tags WHERE tag_id = t.id) as note_count
      FROM tags t
      WHERE t.user_id = $1
    `;
    const params = [userId];

    if (search) {
      queryText += ' AND t.name ILIKE $2';
      params.push(`%${search}%`);
    }

    queryText += ' ORDER BY t.name';

    const result = await query(queryText, params);

    ctx.body = {
      success: true,
      data: result.rows,
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = {
      success: false,
      error: { message: 'Failed to fetch tags', details: error.message },
    };
  }
});

// Get popular tags for a user (most used)
router.get('/popular', async (ctx) => {
  const { userId, limit = 10 } = ctx.query;

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
        t.id,
        t.user_id,
        t.name,
        t.created_at,
        COUNT(nt.note_id) as note_count
      FROM tags t
      INNER JOIN note_tags nt ON t.id = nt.tag_id
      WHERE t.user_id = $1
      GROUP BY t.id
      ORDER BY note_count DESC
      LIMIT $2`,
      [userId, limit]
    );

    ctx.body = {
      success: true,
      data: result.rows,
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = {
      success: false,
      error: { message: 'Failed to fetch popular tags', details: error.message },
    };
  }
});

// Get single tag by ID
router.get('/:id', async (ctx) => {
  const { id } = ctx.params;

  try {
    const result = await query(
      `SELECT
        t.*,
        (SELECT COUNT(*) FROM note_tags WHERE tag_id = t.id) as note_count
      FROM tags t
      WHERE t.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      ctx.status = 404;
      ctx.body = {
        success: false,
        error: { message: 'Tag not found' },
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
      error: { message: 'Failed to fetch tag', details: error.message },
    };
  }
});

// Get notes for a tag
router.get('/:id/notes', async (ctx) => {
  const { id } = ctx.params;
  const { page = 1, limit = 20 } = ctx.query;

  try {
    const offset = (page - 1) * limit;

    // Get total count
    const countResult = await query(
      'SELECT COUNT(*) as total FROM note_tags WHERE tag_id = $1',
      [id]
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
        n.updated_at
      FROM notes n
      INNER JOIN note_tags nt_tag ON n.id = nt_tag.note_id
      LEFT JOIN note_types nt ON n.type_id = nt.id
      WHERE nt_tag.tag_id = $1
      ORDER BY n.updated_at DESC
      LIMIT $2 OFFSET $3`,
      [id, limit, offset]
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
      error: { message: 'Failed to fetch tag notes', details: error.message },
    };
  }
});

// Create tag
router.post('/', async (ctx) => {
  const { userId, name } = ctx.request.body;

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
      'INSERT INTO tags (user_id, name) VALUES ($1, $2) RETURNING *',
      [userId, name]
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
        error: { message: 'Tag with this name already exists for this user' },
      };
      return;
    }

    ctx.status = 500;
    ctx.body = {
      success: false,
      error: { message: 'Failed to create tag', details: error.message },
    };
  }
});

// Create or get tag (if exists, return existing)
router.post('/find-or-create', async (ctx) => {
  const { userId, name } = ctx.request.body;

  if (!userId || !name) {
    ctx.status = 400;
    ctx.body = {
      success: false,
      error: { message: 'User ID and name are required' },
    };
    return;
  }

  try {
    // Try to find existing tag
    const existingResult = await query(
      'SELECT * FROM tags WHERE user_id = $1 AND name = $2',
      [userId, name]
    );

    if (existingResult.rows.length > 0) {
      ctx.body = {
        success: true,
        data: existingResult.rows[0],
        created: false,
      };
      return;
    }

    // Create new tag
    const result = await query(
      'INSERT INTO tags (user_id, name) VALUES ($1, $2) RETURNING *',
      [userId, name]
    );

    ctx.status = 201;
    ctx.body = {
      success: true,
      data: result.rows[0],
      created: true,
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = {
      success: false,
      error: { message: 'Failed to find or create tag', details: error.message },
    };
  }
});

// Update tag
router.put('/:id', async (ctx) => {
  const { id } = ctx.params;
  const { name } = ctx.request.body;

  if (!name) {
    ctx.status = 400;
    ctx.body = {
      success: false,
      error: { message: 'Name is required' },
    };
    return;
  }

  try {
    const result = await query(
      'UPDATE tags SET name = $1 WHERE id = $2 RETURNING *',
      [name, id]
    );

    if (result.rows.length === 0) {
      ctx.status = 404;
      ctx.body = {
        success: false,
        error: { message: 'Tag not found' },
      };
      return;
    }

    ctx.body = {
      success: true,
      data: result.rows[0],
    };
  } catch (error) {
    if (error.code === '23505') {
      ctx.status = 409;
      ctx.body = {
        success: false,
        error: { message: 'Tag with this name already exists' },
      };
      return;
    }

    ctx.status = 500;
    ctx.body = {
      success: false,
      error: { message: 'Failed to update tag', details: error.message },
    };
  }
});

// Delete tag
router.delete('/:id', async (ctx) => {
  const { id } = ctx.params;

  try {
    const result = await query('DELETE FROM tags WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      ctx.status = 404;
      ctx.body = {
        success: false,
        error: { message: 'Tag not found' },
      };
      return;
    }

    ctx.body = {
      success: true,
      data: { message: 'Tag deleted successfully' },
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = {
      success: false,
      error: { message: 'Failed to delete tag', details: error.message },
    };
  }
});

export default router;

-- Active: 1766910103838@@127.0.0.1@5432@noteapp
-- 用户表
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 笔记类型表 (支持树形结构)
CREATE TABLE note_types (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    parent_id BIGINT,  -- 父类型ID，NULL表示顶级类型
    sort_order INTEGER DEFAULT 0,  -- 同级排序
    color VARCHAR(7),  -- 类型标识颜色，如 #FF5733
    icon VARCHAR(50),  -- 图标标识
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES note_types(id) ON DELETE CASCADE,

    -- 确保同一用户下，同一父类型下的类型名称不重复
    UNIQUE(user_id, parent_id, name)
);

-- 为树形查询创建索引
CREATE INDEX idx_note_types_user_id ON note_types(user_id);
CREATE INDEX idx_note_types_parent_id ON note_types(parent_id);

-- 笔记表
CREATE TABLE notes (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    type_id BIGINT NOT NULL,  -- 所属类型
    title VARCHAR(255) NOT NULL,
    content TEXT,
    is_favorite BOOLEAN DEFAULT FALSE,
    is_archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (type_id) REFERENCES note_types(id) ON DELETE RESTRICT
);

-- 笔记表索引
CREATE INDEX idx_notes_user_id ON notes(user_id);
CREATE INDEX idx_notes_type_id ON notes(type_id);
CREATE INDEX idx_notes_created_at ON notes(created_at DESC);
CREATE INDEX idx_notes_title ON notes USING gin(to_tsvector('simple', title));  -- 全文搜索

-- 笔记附件表
CREATE TABLE attachments (
    id BIGSERIAL PRIMARY KEY,
    note_id BIGINT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size BIGINT,
    mime_type VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
);

CREATE INDEX idx_attachments_note_id ON attachments(note_id);

-- 创建更新时间触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为需要的表添加更新时间触发器
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_note_types_updated_at BEFORE UPDATE ON note_types
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notes_updated_at BEFORE UPDATE ON notes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 递归查询类型树的示例函数
CREATE OR REPLACE FUNCTION get_type_tree(p_user_id BIGINT, p_parent_id BIGINT DEFAULT NULL)
RETURNS TABLE (
    id BIGINT,
    name VARCHAR,
    parent_id BIGINT,
    level INTEGER,
    path TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE type_tree AS (
        -- 基础查询：获取指定父节点的直接子节点
        SELECT
            nt.id,
            nt.name,
            nt.parent_id,
            1 as level,
            nt.name::TEXT as path
        FROM note_types nt
        WHERE nt.user_id = p_user_id
            AND (p_parent_id IS NULL AND nt.parent_id IS NULL
                 OR nt.parent_id = p_parent_id)

        UNION ALL

        -- 递归查询：获取子节点的子节点
        SELECT
            nt.id,
            nt.name,
            nt.parent_id,
            tt.level + 1,
            tt.path || ' > ' || nt.name
        FROM note_types nt
        INNER JOIN type_tree tt ON nt.parent_id = tt.id
        WHERE nt.user_id = p_user_id
    )
    SELECT * FROM type_tree ORDER BY path;
END;
$$ LANGUAGE plpgsql;

-- 获取类型下所有笔记数量(包括子类型)的函数
CREATE OR REPLACE FUNCTION get_type_note_count(p_type_id BIGINT)
RETURNS INTEGER AS $$
DECLARE
    total_count INTEGER;
BEGIN
    WITH RECURSIVE type_tree AS (
        SELECT id FROM note_types WHERE id = p_type_id
        UNION ALL
        SELECT nt.id FROM note_types nt
        INNER JOIN type_tree tt ON nt.parent_id = tt.id
    )
    SELECT COUNT(*)::INTEGER INTO total_count
    FROM notes n
    WHERE n.type_id IN (SELECT id FROM type_tree);

    RETURN total_count;
END;
$$ LANGUAGE plpgsql;

-- 获取类型及其所有子类型的ID列表
CREATE OR REPLACE FUNCTION get_type_and_subtype_ids(p_type_id BIGINT)
RETURNS TABLE (type_id BIGINT) AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE type_tree AS (
        SELECT id FROM note_types WHERE id = p_type_id
        UNION ALL
        SELECT nt.id FROM note_types nt
        INNER JOIN type_tree tt ON nt.parent_id = tt.id
    )
    SELECT id FROM type_tree;
END;
$$ LANGUAGE plpgsql;

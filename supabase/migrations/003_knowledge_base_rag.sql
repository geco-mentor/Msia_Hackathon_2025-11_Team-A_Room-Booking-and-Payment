-- Knowledge Base RAG Setup
-- This migration adds pgvector support and tables for RAG functionality

-- ============================================
-- ENABLE PGVECTOR EXTENSION
-- ============================================
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================
-- KNOWLEDGE BASE DOCUMENTS TABLE
-- Stores uploaded PDF documents
-- ============================================
CREATE TABLE IF NOT EXISTS knowledge_base_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'application/pdf',
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'ready', 'error')),
  chunk_count INTEGER DEFAULT 0,
  error_message TEXT,
  uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- DOCUMENT CHUNKS TABLE
-- Stores text chunks with embeddings for RAG
-- ============================================
CREATE TABLE IF NOT EXISTS document_chunks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES knowledge_base_documents(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  page_number INTEGER,
  embedding vector(1536),  -- OpenAI ada-002 embedding dimension
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- UNANSWERED QUERIES TABLE
-- Stores queries that couldn't be answered for admin review
-- ============================================
CREATE TABLE IF NOT EXISTS unanswered_queries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_message TEXT NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  session_id TEXT,
  confidence_score FLOAT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'answered', 'dismissed')),
  admin_response TEXT,
  responded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Index for document status queries
CREATE INDEX IF NOT EXISTS idx_kb_documents_status ON knowledge_base_documents(status);

-- Index for chunk document lookup
CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id ON document_chunks(document_id);

-- HNSW index for fast similarity search on embeddings
-- This is critical for RAG performance
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding ON document_chunks
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Index for unanswered queries status
CREATE INDEX IF NOT EXISTS idx_unanswered_queries_status ON unanswered_queries(status);
CREATE INDEX IF NOT EXISTS idx_unanswered_queries_created ON unanswered_queries(created_at DESC);

-- ============================================
-- SIMILARITY SEARCH FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  content text,
  page_number int,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.document_id,
    dc.content,
    dc.page_number,
    1 - (dc.embedding <=> query_embedding) AS similarity
  FROM document_chunks dc
  JOIN knowledge_base_documents kbd ON dc.document_id = kbd.id
  WHERE kbd.status = 'ready'
    AND dc.embedding IS NOT NULL
    AND 1 - (dc.embedding <=> query_embedding) > match_threshold
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Enable RLS
ALTER TABLE knowledge_base_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE unanswered_queries ENABLE ROW LEVEL SECURITY;

-- Knowledge Base Documents Policies
DROP POLICY IF EXISTS "Anyone can view ready documents" ON knowledge_base_documents;
DROP POLICY IF EXISTS "Admins can manage documents" ON knowledge_base_documents;

CREATE POLICY "Anyone can view ready documents" ON knowledge_base_documents
  FOR SELECT USING (status = 'ready');

CREATE POLICY "Admins can manage documents" ON knowledge_base_documents
  FOR ALL USING (is_admin());

-- Document Chunks Policies (public read for RAG)
DROP POLICY IF EXISTS "Anyone can view chunks of ready documents" ON document_chunks;
DROP POLICY IF EXISTS "Admins can manage chunks" ON document_chunks;

CREATE POLICY "Anyone can view chunks of ready documents" ON document_chunks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM knowledge_base_documents
      WHERE id = document_chunks.document_id
      AND status = 'ready'
    )
  );

CREATE POLICY "Admins can manage chunks" ON document_chunks
  FOR ALL USING (is_admin());

-- Unanswered Queries Policies
DROP POLICY IF EXISTS "Admins can view all unanswered queries" ON unanswered_queries;
DROP POLICY IF EXISTS "Admins can manage unanswered queries" ON unanswered_queries;
DROP POLICY IF EXISTS "System can insert unanswered queries" ON unanswered_queries;

CREATE POLICY "Admins can view all unanswered queries" ON unanswered_queries
  FOR SELECT USING (is_admin());

CREATE POLICY "Admins can manage unanswered queries" ON unanswered_queries
  FOR ALL USING (is_admin());

-- Allow inserting unanswered queries from backend (service role)
CREATE POLICY "System can insert unanswered queries" ON unanswered_queries
  FOR INSERT WITH CHECK (true);

-- ============================================
-- TRIGGERS
-- ============================================

-- Update timestamp trigger for knowledge_base_documents
DROP TRIGGER IF EXISTS update_kb_documents_updated_at ON knowledge_base_documents;
CREATE TRIGGER update_kb_documents_updated_at
  BEFORE UPDATE ON knowledge_base_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

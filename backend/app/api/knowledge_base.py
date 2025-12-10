"""Knowledge Base API endpoints for RAG functionality."""
from typing import Optional
from fastapi import APIRouter, UploadFile, File, HTTPException, Query
from pydantic import BaseModel

from app.services.knowledge_base import get_knowledge_base_service

router = APIRouter(prefix="/knowledge-base", tags=["Knowledge Base"])


# ==================== REQUEST/RESPONSE MODELS ====================

class RAGQueryRequest(BaseModel):
    """Request model for RAG query."""
    query: str
    language: str = "english"
    session_id: Optional[str] = None
    user_id: Optional[str] = None


class RAGQueryResponse(BaseModel):
    """Response model for RAG query."""
    response: str
    escalated: bool
    confidence: float
    sources: list


class AdminResponseRequest(BaseModel):
    """Request model for admin response to unanswered query."""
    admin_response: str
    responded_by: str


class DocumentResponse(BaseModel):
    """Response model for document."""
    id: str
    name: str
    file_path: str
    file_size: int
    mime_type: str
    status: str
    chunk_count: int
    error_message: Optional[str]
    created_at: str
    updated_at: str


# ==================== DOCUMENT ENDPOINTS ====================

@router.post("/documents/upload", response_model=DocumentResponse)
async def upload_document(
    file: UploadFile = File(...),
    uploaded_by: Optional[str] = Query(None, description="User ID of uploader")
):
    """
    Upload a PDF document to the knowledge base.
    The document will be processed in the background (text extraction, chunking, embedding).
    """
    # Validate file type
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")

    if file.content_type not in ["application/pdf", "application/x-pdf"]:
        raise HTTPException(status_code=400, detail="Invalid file type. Only PDF files are allowed")

    # Read file content
    content = await file.read()
    file_size = len(content)

    # Check file size (max 50MB)
    max_size = 50 * 1024 * 1024
    if file_size > max_size:
        raise HTTPException(status_code=400, detail="File size exceeds 50MB limit")

    kb_service = get_knowledge_base_service()
    document = await kb_service.upload_document(
        file_content=content,
        file_name=file.filename,
        file_size=file_size,
        uploaded_by=uploaded_by
    )

    if not document:
        raise HTTPException(status_code=500, detail="Failed to create document record")

    return document


@router.get("/documents", response_model=list[DocumentResponse])
async def get_documents():
    """Get all knowledge base documents."""
    kb_service = get_knowledge_base_service()
    return await kb_service.get_documents()


@router.get("/documents/{document_id}", response_model=DocumentResponse)
async def get_document(document_id: str):
    """Get a single document by ID."""
    kb_service = get_knowledge_base_service()
    document = await kb_service.get_document(document_id)

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    return document


@router.delete("/documents/{document_id}")
async def delete_document(document_id: str):
    """Delete a document and all its chunks."""
    kb_service = get_knowledge_base_service()
    success = await kb_service.delete_document(document_id)

    if not success:
        raise HTTPException(status_code=404, detail="Document not found")

    return {"message": "Document deleted successfully"}


# ==================== RAG QUERY ENDPOINT ====================

@router.post("/query", response_model=RAGQueryResponse)
async def query_knowledge_base(request: RAGQueryRequest):
    """
    Query the knowledge base using RAG.

    Returns a response generated from the knowledge base documents.
    If confidence is low, the query will be escalated for admin review.
    """
    if not request.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    kb_service = get_knowledge_base_service()
    result = await kb_service.generate_rag_response(
        user_query=request.query,
        language=request.language,
        session_id=request.session_id,
        user_id=request.user_id
    )

    return result


@router.post("/search")
async def search_documents(
    query: str = Query(..., description="Search query"),
    threshold: float = Query(0.7, description="Similarity threshold (0-1)"),
    limit: int = Query(5, description="Maximum number of results")
):
    """
    Search documents by semantic similarity.
    Returns raw search results without LLM generation.
    """
    kb_service = get_knowledge_base_service()
    result = await kb_service.query_knowledge_base(
        query=query,
        match_threshold=threshold,
        match_count=limit
    )
    return result


# ==================== UNANSWERED QUERIES (ADMIN) ====================

@router.get("/unanswered-queries")
async def get_unanswered_queries(
    status: Optional[str] = Query(None, description="Filter by status: pending, answered, dismissed"),
    limit: int = Query(50, description="Maximum number of results")
):
    """Get unanswered queries for admin review."""
    kb_service = get_knowledge_base_service()
    queries = await kb_service.get_unanswered_queries(status=status, limit=limit)
    return queries


@router.post("/unanswered-queries/{query_id}/respond")
async def respond_to_query(query_id: str, request: AdminResponseRequest):
    """Admin responds to an unanswered query."""
    kb_service = get_knowledge_base_service()
    result = await kb_service.respond_to_query(
        query_id=query_id,
        admin_response=request.admin_response,
        responded_by=request.responded_by
    )

    if not result:
        raise HTTPException(status_code=404, detail="Query not found")

    return result


@router.post("/unanswered-queries/{query_id}/dismiss")
async def dismiss_query(query_id: str):
    """Dismiss an unanswered query."""
    kb_service = get_knowledge_base_service()
    await kb_service.dismiss_query(query_id)
    return {"message": "Query dismissed"}


# ==================== STATS ====================

@router.get("/stats")
async def get_knowledge_base_stats():
    """Get knowledge base statistics."""
    kb_service = get_knowledge_base_service()

    documents = await kb_service.get_documents()
    unanswered = await kb_service.get_unanswered_queries(status="pending")

    total_docs = len(documents)
    ready_docs = len([d for d in documents if d["status"] == "ready"])
    processing_docs = len([d for d in documents if d["status"] == "processing"])
    error_docs = len([d for d in documents if d["status"] == "error"])
    total_chunks = sum(d.get("chunk_count", 0) or 0 for d in documents)
    total_size = sum(d.get("file_size", 0) or 0 for d in documents)

    return {
        "total_documents": total_docs,
        "ready_documents": ready_docs,
        "processing_documents": processing_docs,
        "error_documents": error_docs,
        "total_chunks": total_chunks,
        "total_storage_bytes": total_size,
        "pending_queries": len(unanswered)
    }

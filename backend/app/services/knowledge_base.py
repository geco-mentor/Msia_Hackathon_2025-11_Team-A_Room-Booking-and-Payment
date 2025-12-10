"""Knowledge Base RAG Service for document processing and retrieval."""
import asyncio
import io
import uuid
from typing import Optional
from datetime import datetime

from langchain_openai import OpenAIEmbeddings
from pypdf import PdfReader

from app.config import get_settings
from app.services.supabase import get_supabase_service

settings = get_settings()

ESCALATION_MESSAGES = {
    "english": (
        "I don't have enough information in the knowledge base to answer that accurately. "
        "I've forwarded your request to our team and a human admin will get back to you soon. "
        "For anything urgent, please email hello@infinity8.my or call +60 3-1234-5678."
    ),
    "malay": (
        "Saya tidak mempunyai maklumat mencukupi dalam pangkalan ilmu untuk menjawab soalan itu dengan tepat. "
        "Permintaan anda telah dimajukan kepada pasukan kami dan admin manusia akan menghubungi anda tidak lama lagi. "
        "Untuk bantuan segera, sila e-mel hello@infinity8.my atau telefon +60 3-1234-5678."
    ),
    "chinese": (
        "知识库暂时没有足够资讯来准确回答这个问题。我已转交给真人管理员，团队会尽快回复你。"
        "如需紧急协助，请电邮 hello@infinity8.my 或致电 +60 3-1234-5678。"
    ),
}


class KnowledgeBaseService:
    """Service for knowledge base document processing and RAG operations."""

    def __init__(self):
        self.supabase = get_supabase_service()
        self.embeddings = OpenAIEmbeddings(
            openai_api_key=settings.OPENAI_API_KEY,
            model="text-embedding-ada-002"
        )
        self.storage_bucket = "knowledge-base"
        self.chunk_size = 1000
        self.chunk_overlap = 200

    # ==================== DOCUMENT UPLOAD ====================

    async def upload_document(
        self,
        file_content: bytes,
        file_name: str,
        file_size: int,
        uploaded_by: Optional[str] = None
    ) -> dict:
        """
        Upload a PDF document to Supabase storage and create a database record.
        Returns the document record.
        """
        # Make sure the storage bucket is present before we attempt an upload
        await self._ensure_storage_bucket()

        # Generate unique file path
        file_id = str(uuid.uuid4())
        file_path = f"documents/{file_id}/{file_name}"

        # Upload to Supabase Storage
        try:
            await asyncio.to_thread(
                self.supabase.client.storage.from_(self.storage_bucket).upload,
                file_path,
                file_content,
                {"content-type": "application/pdf"}
            )
        except Exception as e:
            # If bucket doesn't exist, create it first
            message = str(e).lower()
            if "bucket" in message or "not found" in message:
                await self._ensure_storage_bucket()
                await asyncio.to_thread(
                    self.supabase.client.storage.from_(self.storage_bucket).upload,
                    file_path,
                    file_content,
                    {"content-type": "application/pdf"}
                )
            else:
                raise RuntimeError(f"Failed to upload document to storage: {e}") from e

        # Create document record
        document_data = {
            "name": file_name,
            "file_path": file_path,
            "file_size": file_size,
            "mime_type": "application/pdf",
            "status": "processing",
            "uploaded_by": uploaded_by
        }

        response = await self.supabase._execute(
            self.supabase.client.table("knowledge_base_documents")
            .insert(document_data)
        )

        document = response.data[0] if response.data else None

        if document:
            # Start background processing
            asyncio.create_task(self._process_document(document["id"], file_content))

        return document

    async def _ensure_storage_bucket(self):
        """Ensure the storage bucket exists."""
        try:
            # If the bucket already exists, no-op
            try:
                buckets = await asyncio.to_thread(
                    self.supabase.client.storage.list_buckets
                )
                if any(
                    b.get("id") == self.storage_bucket
                    or b.get("name") == self.storage_bucket
                    for b in buckets or []
                ):
                    return
            except Exception:
                # If listing fails, fall through to create (best effort)
                pass

            await asyncio.to_thread(
                self.supabase.client.storage.create_bucket,
                self.storage_bucket,
                {
                    "public": False,
                    # 50MB limit to mirror API validation and keep uploads bounded
                    "file_size_limit": 50 * 1024 * 1024,
                    "allowed_mime_types": ["application/pdf"]
                }
            )
        except Exception as e:
            # Treat any failure as "already handled" to avoid blocking uploads when
            # the bucket already exists or the API rejects a duplicate create.
            if "exists" in str(e).lower() or "name must be string" in str(e).lower():
                return
            return

    async def _process_document(self, document_id: str, file_content: bytes):
        """Process a PDF document: extract text, chunk, and create embeddings."""
        try:
            # Extract text from PDF
            pdf_reader = PdfReader(io.BytesIO(file_content))
            chunks_data = []

            for page_num, page in enumerate(pdf_reader.pages):
                text = page.extract_text()
                if text.strip():
                    page_chunks = self._split_text(text)
                    for chunk_idx, chunk in enumerate(page_chunks):
                        chunks_data.append(
                            {
                                "content": chunk,
                                "page_number": page_num + 1,
                                "chunk_index": len(chunks_data),
                            }
                        )

            if not chunks_data:
                await self._update_document_status(
                    document_id, "error", "No text content found in PDF"
                )
                return

            # Generate embeddings for all chunks
            texts = [chunk["content"] for chunk in chunks_data]
            embeddings = await asyncio.to_thread(
                self.embeddings.embed_documents, texts
            )

            # Insert chunks with embeddings
            for i, (chunk, embedding) in enumerate(zip(chunks_data, embeddings)):
                chunk_record = {
                    "document_id": document_id,
                    "content": chunk["content"],
                    "chunk_index": chunk["chunk_index"],
                    "page_number": chunk["page_number"],
                    "embedding": embedding,
                    "metadata": {}
                }
                await self.supabase._execute(
                    self.supabase.client.table("document_chunks")
                    .insert(chunk_record)
                )

            # Update document status
            await self._update_document_status(
                document_id, "ready", chunk_count=len(chunks_data)
            )

        except Exception as e:
            await self._update_document_status(
                document_id, "error", str(e)
            )

    async def _update_document_status(
        self,
        document_id: str,
        status: str,
        error_message: Optional[str] = None,
        chunk_count: Optional[int] = None
    ):
        """Update document processing status."""
        update_data = {"status": status}
        if error_message:
            update_data["error_message"] = error_message
        if chunk_count is not None:
            update_data["chunk_count"] = chunk_count

        await self.supabase._execute(
            self.supabase.client.table("knowledge_base_documents")
            .update(update_data)
            .eq("id", document_id)
        )

    def _split_text(self, text: str) -> list[str]:
        """
        Lightweight text splitter to avoid importing heavy langchain_text_splitters.
        Splits on characters with overlap to maintain context without blocking app startup.
        """
        chunks: list[str] = []
        step = max(self.chunk_size - self.chunk_overlap, 1)
        text_length = len(text)

        for start in range(0, text_length, step):
            end = min(start + self.chunk_size, text_length)
            chunk = text[start:end].strip()
            if chunk:
                chunks.append(chunk)

        return chunks

    # ==================== DOCUMENT MANAGEMENT ====================

    async def get_documents(self) -> list[dict]:
        """Get all knowledge base documents."""
        response = await self.supabase._execute(
            self.supabase.client.table("knowledge_base_documents")
            .select("*")
            .order("created_at", desc=True)
        )
        return response.data

    async def get_document(self, document_id: str) -> Optional[dict]:
        """Get a single document by ID."""
        response = await self.supabase._execute(
            self.supabase.client.table("knowledge_base_documents")
            .select("*")
            .eq("id", document_id)
            .single()
        )
        return response.data

    async def delete_document(self, document_id: str) -> bool:
        """Delete a document and its chunks."""
        # Get document to find file path
        document = await self.get_document(document_id)
        if not document:
            return False

        # Delete from storage
        try:
            await asyncio.to_thread(
                self.supabase.client.storage.from_(self.storage_bucket).remove,
                [document["file_path"]]
            )
        except Exception:
            pass  # Continue even if storage deletion fails

        # Delete document (chunks will cascade)
        await self.supabase._execute(
            self.supabase.client.table("knowledge_base_documents")
            .delete()
            .eq("id", document_id)
        )
        return True

    # ==================== RAG QUERY ====================

    async def query_knowledge_base(
        self,
        query: str,
        match_threshold: float = 0.7,
        match_count: int = 5
    ) -> dict:
        """
        Query the knowledge base using semantic search.
        Returns relevant context and confidence score.
        """
        # Generate query embedding
        query_embedding = await asyncio.to_thread(
            self.embeddings.embed_query, query
        )

        # Search for similar chunks using the match_documents function
        response = await self.supabase._execute(
            self.supabase.client.rpc(
                "match_documents",
                {
                    "query_embedding": query_embedding,
                    "match_threshold": match_threshold,
                    "match_count": match_count
                }
            )
        )

        chunks = response.data if response.data else []

        if not chunks:
            return {
                "found": False,
                "context": "",
                "sources": [],
                "confidence": 0.0
            }

        # Calculate average confidence
        avg_confidence = sum(chunk["similarity"] for chunk in chunks) / len(chunks)

        # Combine context from relevant chunks
        context_parts = []
        sources = []
        seen_doc_ids = set()

        for chunk in chunks:
            context_parts.append(chunk["content"])
            if chunk["document_id"] not in seen_doc_ids:
                seen_doc_ids.add(chunk["document_id"])
                # Get document name
                doc = await self.get_document(chunk["document_id"])
                if doc:
                    sources.append({
                        "document_id": chunk["document_id"],
                        "document_name": doc["name"],
                        "page_number": chunk["page_number"],
                        "similarity": chunk["similarity"]
                    })

        context = "\n\n---\n\n".join(context_parts)

        return {
            "found": True,
            "context": context,
            "sources": sources,
            "confidence": avg_confidence
        }

    
    async def generate_rag_response(
        self,
        user_query: str,
        language: str = "english",
        session_id: Optional[str] = None,
        user_id: Optional[str] = None
    ) -> dict:
        """
        Generate a response using RAG.
        If confidence is low, logs the query for admin review.
        """
        from langchain_openai import ChatOpenAI
        from langchain_core.prompts import ChatPromptTemplate

        # Query knowledge base
        kb_result = await self.query_knowledge_base(user_query)

        # Confidence threshold for escalation
        CONFIDENCE_THRESHOLD = 0.75

        def escalation_response(confidence: float) -> dict:
            """Build a consistent escalation payload."""
            return {
                "response": ESCALATION_MESSAGES.get(language, ESCALATION_MESSAGES["english"]),
                "escalated": True,
                "confidence": confidence,
                "sources": []
            }

        if not kb_result["found"] or kb_result["confidence"] < CONFIDENCE_THRESHOLD:
            # Log unanswered query for admin review
            await self._log_unanswered_query(
                user_query,
                user_id,
                session_id,
                kb_result["confidence"] if kb_result["found"] else 0.0
            )

            return escalation_response(kb_result["confidence"] if kb_result["found"] else 0.0)

        # Generate response using LLM with context
        llm = ChatOpenAI(
            model="gpt-4o-mini",
            temperature=0.3,
            openai_api_key=settings.OPENAI_API_KEY
        )

        language_instructions = {
            "english": "Respond in English.",
            "malay": "Respond in Bahasa Malaysia.",
            "chinese": "Respond in Chinese."
        }

        prompt = ChatPromptTemplate.from_messages([
            ("system", """You are a helpful customer service assistant for Infinity8 coworking space.
Answer the user's question ONLY using the information provided in the context below.
Do NOT make up information. If the context doesn't contain enough information to fully answer the question, reply exactly with: HANDOFF_TO_HUMAN
Keep your response concise and helpful (2-4 sentences).
{language_instruction}

Context from our knowledge base:
{context}"""),
            ("human", "{question}")
        ])

        chain = prompt | llm

        response = await asyncio.to_thread(
            lambda: chain.invoke({
                "context": kb_result["context"],
                "question": user_query,
                "language_instruction": language_instructions.get(language, language_instructions["english"])
            })
        )

        answer_text = (response.content or "").strip()

        if answer_text.upper() == "HANDOFF_TO_HUMAN":
            await self._log_unanswered_query(
                user_query,
                user_id,
                session_id,
                kb_result["confidence"]
            )
            return escalation_response(kb_result["confidence"])

        return {
            "response": answer_text,
            "escalated": False,
            "confidence": kb_result["confidence"],
            "sources": kb_result["sources"]
        }

    async def _log_unanswered_query(
        self,
        user_message: str,
        user_id: Optional[str],
        session_id: Optional[str],
        confidence_score: float
    ):
        """Log an unanswered query for admin review."""
        query_data = {
            "user_message": user_message,
            "user_id": user_id,
            "session_id": session_id,
            "confidence_score": confidence_score,
            "status": "pending"
        }

        try:
            await self.supabase._execute(
                self.supabase.client.table("unanswered_queries")
                .insert(query_data)
            )
        except Exception as e:
            print(f"Failed to log unanswered query: {e}")

    # ==================== ADMIN: UNANSWERED QUERIES ====================

    async def get_unanswered_queries(
        self,
        status: Optional[str] = None,
        limit: int = 50
    ) -> list[dict]:
        """Get unanswered queries for admin review."""
        query = (
            self.supabase.client.table("unanswered_queries")
            .select("*")
            .order("created_at", desc=True)
            .limit(limit)
        )

        if status:
            query = query.eq("status", status)

        response = await self.supabase._execute(query)
        return response.data

    async def respond_to_query(
        self,
        query_id: str,
        admin_response: str,
        responded_by: str
    ) -> dict:
        """Admin responds to an unanswered query."""
        update_data = {
            "status": "answered",
            "admin_response": admin_response,
            "responded_by": responded_by,
            "responded_at": datetime.now().isoformat()
        }

        response = await self.supabase._execute(
            self.supabase.client.table("unanswered_queries")
            .update(update_data)
            .eq("id", query_id)
        )
        return response.data[0] if response.data else None

    async def dismiss_query(self, query_id: str) -> bool:
        """Dismiss an unanswered query."""
        await self.supabase._execute(
            self.supabase.client.table("unanswered_queries")
            .update({"status": "dismissed"})
            .eq("id", query_id)
        )
        return True


# Singleton instance
_kb_service: Optional[KnowledgeBaseService] = None


def get_knowledge_base_service() -> KnowledgeBaseService:
    """Get Knowledge Base service singleton."""
    global _kb_service
    if _kb_service is None:
        _kb_service = KnowledgeBaseService()
    return _kb_service
